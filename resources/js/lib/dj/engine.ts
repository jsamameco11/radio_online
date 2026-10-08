import { meterLevel, type Broadcaster } from "@/lib/radio/voice";
import { analyze } from "./analysis";
import { ChannelStrip } from "./audio/channel-strip";
import { decodeAudio } from "./audio/decode";
import { DECK_TICK_MS, DeckPlayer } from "./audio/deck-player";
import { loadDeckProcessor } from "./audio/deck-processor";
import { FxInsert } from "./audio/fx-insert";
import type { InsertPoint } from "./audio/insert-point";
import { MasterSection } from "./audio/master-section";
import { Sampler } from "./audio/sampler";
import { beatFloor, beatLength, beatPhase, nearestBeat, roundBpm, syncFader, tappedBpm, wrapGrid } from "./beat-grid";
import { DECKS, JUMP_PADS, LOOP_PADS, SECONDS_PER_TURN } from "./constants";
import { autoGainFor, crossfaderGains } from "./curves";
import { deckDefaults, djDefaults, emptyHotcues } from "./defaults";
import type { ChannelState, DeckId, DeckLoop, DeckState, DjState, FxState, MixerSettings, PadMode, SamplerSlot, TrackSource } from "./types";

const partnerOf = (id: DeckId): DeckId => (id === 0 ? 1 : 0);

const TAP_WINDOW_MS = 2000;
const TAPS_KEPT = 8;
const DEFAULT_FX_BPM = 120;

/**
 * The DJ booth of the console, in the console's own audio context: two decks (tempo, key lock,
 * scratch, loops, hot cues, beat jump, sync), a two-channel mixer, a beat FX unit, an eight-slot
 * sampler, headphones with cue and mix, and a master that goes on air through the broadcaster.
 * Positions come from the audio thread; the interface reads them every frame with position().
 */
export class DjEngine {
  private readonly ctx: AudioContext;
  private state: DjState = djDefaults();
  private readonly listeners = new Set<(state: DjState) => void>();
  private readonly master: MasterSection;
  private readonly fx: FxInsert;
  private readonly sampler: Sampler;
  private players: DeckPlayer[] = [];
  private strips: ChannelStrip[] = [];
  private readonly previewing = [false, false];
  private readonly taps: number[][] = [[], []];
  private readonly meterBuffer = new Float32Array(1024);
  private timer = 0;
  private disposed = false;

  constructor(private readonly caster: Broadcaster) {
    this.ctx = caster.context();
    this.master = new MasterSection(this.ctx, caster.musicInput());
    this.fx = new FxInsert(this.ctx);
    this.sampler = new Sampler(this.ctx, this.master.samplerBus);
  }

  async init(): Promise<void> {
    await loadDeckProcessor(this.ctx);
    if (this.disposed) return;
    this.players = DECKS.map((id) => new DeckPlayer(this.ctx, () => this.ended(id)));
    this.strips = DECKS.map((id) => new ChannelStrip(this.ctx, this.players[id].node, this.master.cueBus, this.master.bus));
    DECKS.forEach((id) => this.applyChannel(id));
    this.applyMixer();
    this.applyFx();
    this.caster.setTalkover(this.state.talkover);
    this.timer = window.setInterval(() => this.players.forEach((player) => player.tick()), DECK_TICK_MS);
    this.set({ ready: true });
  }

  dispose(): void {
    this.disposed = true;
    window.clearInterval(this.timer);
    this.caster.setMixOnAir(false);
    this.sampler.dispose();
    this.fx.dispose();
    this.players.forEach((player) => player.dispose());
    this.strips.forEach((strip) => strip.dispose());
    this.master.dispose();
    this.listeners.clear();
  }

  getState(): DjState {
    return this.state;
  }

  subscribe(listener: (state: DjState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** Browsers start audio only after a click or a key: every control wakes the context. */
  wake(): void {
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  // ── Reading ─────────────────────────────────────────────────────────────

  /** Where the deck plays now, in seconds. */
  position(id: DeckId): number {
    return this.players[id]?.position(this.state.decks[id].loop) ?? 0;
  }

  /** Tempo of the deck as it sounds now (its BPM × its tempo fader). */
  effectiveBpm(id: DeckId): number | null {
    const deck = this.state.decks[id];
    return deck.bpm ? deck.bpm * this.rate(id) : null;
  }

  levels(): { channels: [number, number]; master: [number, number] } {
    const read = (analyser: AnalyserNode | undefined) => (analyser ? meterLevel(analyser, this.meterBuffer).level : 0);
    return {
      channels: [read(this.strips[0]?.meter), read(this.strips[1]?.meter)],
      master: [read(this.master.meters[0]), read(this.master.meters[1])],
    };
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  async load(id: DeckId, source: TrackSource): Promise<void> {
    if (this.state.decks[id].playing) {
      this.patchDeck(id, { error: "Detén el deck antes de cargar otra pista." });
      return;
    }
    this.wake();
    this.patchDeck(id, { loading: true, error: null });
    try {
      const buffer = await decodeAudio(this.ctx, "file" in source ? source.file : source.src);
      // Lets the interface show «Cargando» before the analysis holds the main thread.
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const detected = analyze(buffer);
      const analysis = source.bpm ? { ...detected, bpm: source.bpm, grid: 0 } : detected;
      const cue = analysis.bpm ? analysis.grid : 0;
      const player = this.players[id];
      player.load(buffer);
      this.patchDeck(id, {
        track: { id: source.id, title: source.title, artist: source.artist, duration: buffer.duration },
        loading: false,
        playing: false,
        bpm: analysis.bpm,
        grid: analysis.grid,
        cue,
        hotcues: emptyHotcues(),
        loop: null,
        loopIn: null,
        sync: false,
        reverse: false,
        waveform: analysis.waveform,
        autoGain: autoGainFor(analysis.rms),
      });
      player.send({ t: "reverse", on: false });
      player.seek(cue);
      this.applyChannel(id);
      this.refreshFxCycle();
    } catch {
      this.patchDeck(id, { loading: false, error: "No pudimos abrir ese audio. Prueba con otro archivo (MP3, WAV, AAC, OGG o FLAC)." });
    }
  }

  eject(id: DeckId): void {
    const deck = this.state.decks[id];
    if (deck.playing) return;
    this.players[id].unload();
    this.patchDeck(id, { ...deckDefaults(), tempo: deck.tempo, range: deck.range, keylock: deck.keylock, vinyl: deck.vinyl, padMode: deck.padMode });
  }

  // ── Transport ───────────────────────────────────────────────────────────

  togglePlay(id: DeckId): void {
    const deck = this.state.decks[id];
    if (!deck.track) return;
    this.wake();
    const next = !deck.playing;
    if (next && deck.sync) this.alignPhase(id);
    this.players[id].play(next);
    this.patchDeck(id, { playing: next });
  }

  /**
   * CDJ cue: paused, it sets the cue where the deck stands and plays from it while held; playing,
   * it returns to the cue and stops.
   */
  cueDown(id: DeckId): void {
    const deck = this.state.decks[id];
    if (!deck.track) return;
    this.wake();
    const player = this.players[id];
    if (deck.playing) {
      player.play(false);
      player.seek(deck.cue);
      this.patchDeck(id, { playing: false });
      return;
    }
    const here = this.position(id);
    const cue = Math.abs(here - deck.cue) < 0.01 ? deck.cue : this.snap(id, here);
    player.seek(cue);
    this.patchDeck(id, { cue });
    this.previewing[id] = true;
    player.play(true);
  }

  cueUp(id: DeckId): void {
    if (!this.previewing[id]) return;
    this.previewing[id] = false;
    if (this.state.decks[id].playing) return;
    this.players[id].play(false);
    this.players[id].seek(this.state.decks[id].cue);
  }

  seek(id: DeckId, seconds: number): void {
    if (!this.state.decks[id].track) return;
    this.wake();
    this.players[id].seek(seconds);
  }

  setReverse(id: DeckId, on: boolean): void {
    this.players[id]?.send({ t: "reverse", on });
    this.patchDeck(id, { reverse: on });
  }

  // ── Tempo ───────────────────────────────────────────────────────────────

  setTempo(id: DeckId, tempo: number): void {
    const deck = this.state.decks[id];
    const value = Math.min(1, Math.max(-1, tempo));
    this.patchDeck(id, { tempo: value, sync: deck.sync && Math.abs(value - deck.tempo) < 1e-6 });
    this.applyTempo(id);
  }

  /** Changes the fader range keeping the speed the deck plays at. */
  setRange(id: DeckId, range: number): void {
    const tempo = Math.min(1, Math.max(-1, (this.rate(id) - 1) / range));
    this.patchDeck(id, { range, tempo });
    this.applyTempo(id);
  }

  resetTempo(id: DeckId): void {
    this.setTempo(id, 0);
  }

  setKeylock(id: DeckId, on: boolean): void {
    this.players[id]?.send({ t: "keylock", on });
    this.patchDeck(id, { keylock: on });
  }

  /** Sync: the deck takes the tempo of the other one and, when both play, its beat phase too. */
  toggleSync(id: DeckId): string | null {
    const deck = this.state.decks[id];
    if (deck.sync) {
      this.patchDeck(id, { sync: false });
      return null;
    }
    const partner = partnerOf(id);
    const target = this.effectiveBpm(partner);
    if (!deck.bpm || !target) return "Para sincronizar, ambos decks necesitan una pista con BPM.";
    const fader = syncFader(deck.bpm, target, deck.range);
    if (!fader) return "La diferencia de BPM es demasiado grande para sincronizar.";
    if (this.state.decks[partner].sync) this.patchDeck(partner, { sync: false });
    this.patchDeck(id, { ...fader, sync: true });
    this.applyTempo(id);
    if (deck.playing && this.state.decks[partner].playing) this.alignPhase(id);
    return null;
  }

  /** Tap tempo: the BPM follows the taps (four or more, a couple of seconds apart at most). */
  tap(id: DeckId): void {
    const now = performance.now();
    const taps = this.taps[id];
    this.taps[id] = [...taps.filter((at) => now - at < TAP_WINDOW_MS * Math.max(1, taps.length)), now].slice(-TAPS_KEPT);
    const bpm = tappedBpm(this.taps[id], this.rate(id));
    if (bpm !== null) this.changeBpm(id, bpm);
  }

  scaleBpm(id: DeckId, factor: number): void {
    const bpm = this.state.decks[id].bpm;
    if (bpm) this.changeBpm(id, roundBpm(bpm * factor));
  }

  // ── Beat grid ───────────────────────────────────────────────────────────

  /** Moves the beat grid by some milliseconds. */
  nudgeGrid(id: DeckId, ms: number): void {
    const deck = this.state.decks[id];
    if (deck.bpm) this.patchDeck(id, { grid: wrapGrid(deck.bpm, deck.grid + ms / 1000) });
  }

  /** The beat under the playhead becomes a downbeat of the grid. */
  gridHere(id: DeckId): void {
    const deck = this.state.decks[id];
    if (deck.bpm) this.patchDeck(id, { grid: wrapGrid(deck.bpm, this.position(id)) });
  }

  setQuantize(quantize: boolean): void {
    this.set({ quantize });
  }

  // ── Pads, cues and loops ────────────────────────────────────────────────

  setPadMode(id: DeckId, padMode: PadMode): void {
    this.patchDeck(id, { padMode });
  }

  /** A performance pad in one of its modes; with shift a hot cue is erased and a sample stopped. */
  triggerPad(id: DeckId, mode: PadMode, index: number, shift = false): void {
    if (mode === "hotcue") {
      if (shift) this.clearHotcue(id, index);
      else this.hotcue(id, index);
    } else if (mode === "loop") this.beatLoop(id, LOOP_PADS[index]);
    else if (mode === "jump") this.beatJump(id, JUMP_PADS[index]);
    else if (shift) this.stopSample(index);
    else void this.fireSample(index);
  }

  /** Hot cue: an empty pad stores the position; a stored one jumps there (and starts the deck). */
  hotcue(id: DeckId, index: number): void {
    const deck = this.state.decks[id];
    if (!deck.track) return;
    this.wake();
    const stored = deck.hotcues[index];
    if (stored === null || stored === undefined) {
      const hotcues = [...deck.hotcues];
      hotcues[index] = this.snap(id, this.position(id));
      this.patchDeck(id, { hotcues });
      return;
    }
    this.jumpTo(id, stored);
    if (!deck.playing) {
      this.players[id].play(true);
      this.patchDeck(id, { playing: true });
    }
  }

  clearHotcue(id: DeckId, index: number): void {
    const hotcues = [...this.state.decks[id].hotcues];
    hotcues[index] = null;
    this.patchDeck(id, { hotcues });
  }

  /** Auto loop of some beats from the beat at the playhead (or exits it when the same loop is on). */
  beatLoop(id: DeckId, beats: number): void {
    const deck = this.state.decks[id];
    if (!deck.track) return;
    const length = beats * beatLength(deck.bpm);
    if (deck.loop?.active && Math.abs(deck.loop.end - deck.loop.start - length) < 1e-3) {
      this.setLoop(id, { ...deck.loop, active: false });
      return;
    }
    const here = this.position(id);
    const start = this.state.quantize ? beatFloor(deck, here) : here;
    this.setLoop(id, { start, end: Math.min(deck.track.duration, start + length), active: true });
  }

  loopIn(id: DeckId): void {
    if (this.state.decks[id].track) this.patchDeck(id, { loopIn: this.snap(id, this.position(id)) });
  }

  loopOut(id: DeckId): void {
    const deck = this.state.decks[id];
    if (!deck.track) return;
    const here = this.snap(id, this.position(id));
    const start = deck.loopIn ?? deck.loop?.start ?? null;
    if (start === null || here <= start + 0.01) return;
    this.setLoop(id, { start, end: here, active: true });
    this.patchDeck(id, { loopIn: null });
  }

  /** Reloop / exit: leaves the active loop, or returns to the last one. */
  reloop(id: DeckId): void {
    const loop = this.state.decks[id].loop;
    if (!loop) return;
    if (loop.active) {
      this.setLoop(id, { ...loop, active: false });
      return;
    }
    this.setLoop(id, { ...loop, active: true });
    this.jumpTo(id, loop.start);
  }

  resizeLoop(id: DeckId, factor: number): void {
    const { loop, track } = this.state.decks[id];
    if (!loop || !track) return;
    const length = (loop.end - loop.start) * factor;
    if (length >= 0.02) this.setLoop(id, { ...loop, end: Math.min(track.duration, loop.start + length) });
  }

  /** Moves the playhead (and an active loop) some beats, keeping the phase. */
  beatJump(id: DeckId, beats: number): void {
    const deck = this.state.decks[id];
    if (!deck.track) return;
    const shift = beats * beatLength(deck.bpm);
    if (deck.loop?.active) this.setLoop(id, { start: deck.loop.start + shift, end: deck.loop.end + shift, active: true });
    this.players[id].seek(this.position(id) + shift);
  }

  // ── Platter ─────────────────────────────────────────────────────────────

  setVinyl(id: DeckId, on: boolean): void {
    this.patchDeck(id, { vinyl: on });
  }

  /** The platter is touched in vinyl mode: the deck follows the hand. */
  scratchStart(id: DeckId): void {
    if (!this.state.decks[id].track) return;
    this.wake();
    this.players[id]?.scratchStart();
  }

  /** Movement of the platter, in seconds of audio (a full turn is SECONDS_PER_TURN). */
  scratchMove(id: DeckId, seconds: number): void {
    this.players[id]?.scratchMove(seconds);
  }

  isScratching(id: DeckId): boolean {
    return this.players[id]?.isScratching ?? false;
  }

  scratchEnd(id: DeckId): void {
    this.players[id]?.scratchEnd();
  }

  /** The jog ring (or the platter outside vinyl mode): bends the pitch while playing, searches while paused. */
  jog(id: DeckId, turns: number): void {
    const deck = this.state.decks[id];
    if (!deck.track) return;
    if (deck.playing) this.players[id].bendBy(turns);
    else this.players[id].seek(this.position(id) + turns * SECONDS_PER_TURN);
  }

  // ── Mixer and output ────────────────────────────────────────────────────

  setChannel(id: DeckId, patch: Partial<ChannelState>): void {
    const channels = [...this.state.channels] as DjState["channels"];
    channels[id] = { ...channels[id], ...patch };
    this.set({ channels });
    this.applyChannel(id);
  }

  setMixer(patch: Partial<MixerSettings> & { autoGain?: boolean }): void {
    this.set(patch);
    this.applyMixer();
    if (patch.autoGain !== undefined) DECKS.forEach((id) => this.applyChannel(id));
  }

  setTalkover(talkover: number): void {
    this.set({ talkover });
    this.caster.setTalkover(talkover);
  }

  /** Puts the master on air (to every listener) or back to the headphones only. */
  setOnAir(onAir: boolean): void {
    this.wake();
    this.master.setOnAir(onAir);
    this.caster.setMixOnAir(onAir);
    this.set({ onAir });
  }

  /** Headphones on another output (a second sound card or the controller's), where the browser allows it. */
  async setOutput(deviceId: string): Promise<boolean> {
    const sink = this.ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    if (!sink.setSinkId) return false;
    try {
      await sink.setSinkId(deviceId);
      return true;
    } catch {
      return false;
    }
  }

  // ── Beat FX and sampler ─────────────────────────────────────────────────

  setFx(patch: Partial<FxState>): void {
    this.set({ fx: { ...this.state.fx, ...patch } });
    this.applyFx();
  }

  setSample(index: number, slot: SamplerSlot | null): void {
    const sampler = [...this.state.sampler];
    sampler[index] = slot;
    this.set({ sampler });
    if (slot) this.sampler.preload(slot.src);
  }

  /** Fires a sampler slot into the master; a slot whose audio cannot be opened is emptied. */
  async fireSample(index: number): Promise<void> {
    const slot = this.state.sampler[index];
    if (!slot) return;
    this.wake();
    try {
      await this.sampler.fire(index, slot.src);
    } catch {
      this.setSample(index, null);
    }
  }

  stopSample(index?: number): void {
    this.sampler.stop(index);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private ended(id: DeckId): void {
    if (this.state.decks[id].playing) this.patchDeck(id, { playing: false });
  }

  private rate(id: DeckId): number {
    const deck = this.state.decks[id];
    return 1 + deck.tempo * deck.range;
  }

  private snap(id: DeckId, seconds: number): number {
    return this.state.quantize ? nearestBeat(this.state.decks[id], seconds) : Math.max(0, seconds);
  }

  /** A jump that lands in phase when quantize is on and the deck plays. */
  private jumpTo(id: DeckId, seconds: number): void {
    const deck = this.state.decks[id];
    if (this.state.quantize && deck.playing && deck.bpm) {
      const beat = beatLength(deck.bpm);
      const offset = beatPhase(deck, this.position(id)) * beat;
      this.players[id].seek(beatFloor(deck, seconds + beat / 2) + offset);
      return;
    }
    this.players[id].seek(seconds);
  }

  private alignPhase(id: DeckId): void {
    const partner = partnerOf(id);
    const mine = this.state.decks[id];
    const theirs = this.state.decks[partner];
    if (!mine.bpm || !theirs.bpm || !theirs.playing) return;
    let diff = beatPhase(theirs, this.position(partner)) - beatPhase(mine, this.position(id));
    if (diff > 0.5) diff -= 1;
    if (diff < -0.5) diff += 1;
    this.players[id].seek(this.position(id) + diff * beatLength(mine.bpm));
  }

  private changeBpm(id: DeckId, bpm: number): void {
    this.patchDeck(id, { bpm });
    this.followSync(id);
    this.refreshFxCycle();
  }

  /** A deck in sync follows the tempo of the other when it changes. */
  private followSync(changed: DeckId): void {
    const partner = partnerOf(changed);
    if (!this.state.decks[partner].sync) return;
    this.patchDeck(partner, { sync: false });
    this.toggleSync(partner);
  }

  private setLoop(id: DeckId, loop: DeckLoop): void {
    this.players[id].setLoop(loop);
    this.patchDeck(id, { loop });
  }

  private applyTempo(id: DeckId): void {
    this.players[id]?.send({ t: "tempo", value: this.rate(id) });
    this.followSync(id);
    this.refreshFxCycle();
  }

  private applyChannel(id: DeckId): void {
    this.strips[id]?.apply(this.state.channels[id], this.state.autoGain ? this.state.decks[id].autoGain : 1);
  }

  private applyMixer(): void {
    const gains = crossfaderGains(this.state.crossfader, this.state.curve);
    this.strips.forEach((strip, id) => strip.setCrossfade(gains[id]));
    this.master.apply(this.state);
  }

  private insertPoint(target: FxState["target"]): InsertPoint | null {
    if (target === "master") return this.master.insert;
    return this.strips[target === "1" ? 0 : 1]?.insert ?? null;
  }

  private applyFx(): void {
    const point = this.insertPoint(this.state.fx.target);
    if (!point) return;
    this.fx.apply(this.state.fx, point);
    this.refreshFxCycle();
  }

  /** Beat length for the FX: the tempo of the targeted deck, or of the deck that plays. */
  private refreshFxCycle(): void {
    const { fx, decks } = this.state;
    const preferred: DeckId | null = fx.target === "1" ? 0 : fx.target === "2" ? 1 : null;
    const withBpm = (id: DeckId) => decks[id].bpm !== null;
    const source = preferred !== null && withBpm(preferred) ? preferred : (DECKS.find((id) => decks[id].playing && withBpm(id)) ?? DECKS.find(withBpm) ?? null);
    const bpm = (source !== null ? this.effectiveBpm(source) : null) ?? DEFAULT_FX_BPM;
    this.fx.setCycle((60 / bpm) * fx.beats);
  }

  private patchDeck(id: DeckId, patch: Partial<DeckState>): void {
    const decks = [...this.state.decks] as DjState["decks"];
    decks[id] = { ...decks[id], ...patch };
    this.set({ decks });
  }

  private set(patch: Partial<DjState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
