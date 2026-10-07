import { http } from "@/lib/http";
import type { BroadcastState, ProgramLayer, ProgramMix } from "@/types/studio";
import { unlock } from "./program-player";

/** Level of an analyser between 0 and 1 (RMS in dB, from -60 to 0). */
export function meterLevel(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>): { level: number; peak: number } {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  let peak = 0;
  for (const value of buffer) {
    sum += value * value;
    peak = Math.max(peak, Math.abs(value));
  }
  const rms = Math.sqrt(sum / buffer.length);
  const db = 20 * Math.log10(Math.max(rms, 1e-5));
  return { level: Math.min(1, Math.max(0, (db + 60) / 60)), peak: Math.min(1, peak) };
}

async function gathered(pc: RTCPeerConnection, timeout = 2500): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const done = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", done);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", done);
    window.setTimeout(resolve, timeout);
  });
}

export type ControlMessage =
  | { t: "mix"; mix: ProgramMix; rev: number }
  | { t: "layer"; layer: ProgramLayer }
  | { t: "stop"; ids: string[] }
  | { t: "voice"; on: boolean };

/** Voice this long above the threshold turns the detection on; this much silence turns it off. */
const VOICE_ATTACK_MS = 12;
const VOICE_HANG_MS = 550;

/**
 * Gain after the leveling compressor (+9 dB): any microphone from -48 to -16 dBFS of speech
 * reaches the listeners between -22 and -13 dBFS, above the music dropped under it, with the
 * limiter keeping the peaks under -1 dBFS.
 */
const VOICE_MAKEUP = 2.8;

/**
 * Speech detection on the audio thread, so it answers within milliseconds even with the tab in
 * the background. The noise floor follows quiet moments fast and loud ones slowly; voice is
 * what rises 10 dB above it (never below -52 dBFS, always from -20 dBFS).
 */
const DETECTOR = `
class StationVoiceDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.noise = -70; this.on = false; this.loud = 0; this.quiet = 0; this.enabled = false;
    this.port.onmessage = (event) => {
      this.enabled = Boolean(event.data);
      this.loud = 0;
      if (!this.enabled && this.on) { this.on = false; this.port.postMessage(false); }
    };
  }
  process(inputs) {
    const samples = inputs[0] && inputs[0][0];
    if (!samples) return true;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const db = 10 * Math.log10(sum / samples.length + 1e-12);
    const ms = (samples.length / sampleRate) * 1000;
    this.noise += (db - this.noise) * (db < this.noise ? 0.02 : 0.0004);
    if (!this.enabled) return true;
    const threshold = Math.min(-20, Math.max(-52, this.noise + 10));
    if (db > threshold) { this.loud += ms; this.quiet = 0; } else { this.quiet += ms; if (this.quiet > 40) this.loud = 0; }
    const next = this.on ? this.quiet < ${VOICE_HANG_MS} : this.loud >= ${VOICE_ATTACK_MS};
    if (next !== this.on) { this.on = next; this.port.postMessage(next); }
    return true;
  }
}
registerProcessor("station-voice-detector", StationVoiceDetector);
`;

const detectorModules = new WeakMap<BaseAudioContext, Promise<void>>();

function loadDetector(ctx: AudioContext): Promise<void> {
  let loading = detectorModules.get(ctx);
  if (!loading) {
    const url = URL.createObjectURL(new Blob([DETECTOR], { type: "application/javascript" }));
    loading = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    detectorModules.set(ctx, loading);
  }
  return loading;
}

export type VoiceStatus = "off" | "connecting" | "on";

/** The listener side of the live microphone, signaled through /radio/{frequency}/voz. */
export class VoiceLink {
  status: VoiceStatus = "off";
  onStatus?: (status: VoiceStatus) => void;
  onMix?: (mix: ProgramMix, rev: number) => void;
  onLayer?: (layer: ProgramLayer) => void;
  onStop?: (ids: string[]) => void;
  /** The host started or stopped speaking: the program drops under the voice. */
  onVoice?: (on: boolean) => void;
  /**
   * Hands the voice to the program mixer (null when it ends); true when it took it, so the
   * voice and the music share one volume and one limiter. Otherwise this element plays it.
   */
  route?: (stream: MediaStream | null) => boolean;
  readonly audio: HTMLAudioElement;

  private speaking = false;
  private pc: RTCPeerConnection | null = null;
  private session: string | null = null;
  private requestedAt = 0;
  private busy = false;

  constructor(
    private readonly base: string,
    private readonly listener: string,
  ) {
    this.audio = new Audio();
    this.audio.autoplay = true;
  }

  unlock(): Promise<void> {
    return unlock(this.audio);
  }

  setVolume(volume: number): void {
    this.audio.volume = Math.min(1, Math.max(0, volume));
  }

  async update(state: BroadcastState): Promise<void> {
    const session = state.live.on ? state.live.session : null;
    if (!session) {
      this.close();
      this.session = null;
      return;
    }
    if (session !== this.session) {
      this.close();
      this.session = session;
      this.requestedAt = 0;
    }
    if (this.busy) return;
    const voice = state.voice;
    if (this.pc) {
      if (["connected", "connecting", "new"].includes(this.pc.connectionState)) return;
      this.close();
    }
    if (voice?.offer && voice.state === "offered") {
      await this.accept(session, voice.offer, state.ice);
      return;
    }
    const stuck = Date.now() - this.requestedAt > 15000;
    if (!voice || voice.state === "idle" || voice.state === "connected" || voice.state === "answered" || stuck) {
      if (Date.now() - this.requestedAt < 4000) return;
      this.requestedAt = Date.now();
      this.setStatus("connecting");
      await http.post(`${this.base}/voz`, { oyente: this.listener, session }).catch(() => undefined);
    }
  }

  close(): void {
    this.pc?.close();
    this.pc = null;
    if (this.audio.srcObject) this.route?.(null);
    this.audio.srcObject = null;
    this.audio.muted = false;
    this.setSpeaking(false);
    this.setStatus("off");
  }

  private setSpeaking(on: boolean): void {
    if (on === this.speaking) return;
    this.speaking = on;
    this.onVoice?.(on);
  }

  private setStatus(status: VoiceStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.onStatus?.(status);
  }

  private async accept(session: string, offer: string, ice: RTCIceServer[]): Promise<void> {
    this.busy = true;
    this.setStatus("connecting");
    try {
      const pc = new RTCPeerConnection({ iceServers: ice });
      this.pc = pc;
      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        // Chrome only feeds a remote stream to Web Audio while a media element plays it, so it stays attached, muted.
        this.audio.srcObject = stream;
        this.audio.muted = this.route?.(stream) ?? false;
        void this.audio.play().catch(() => undefined);
      };
      pc.ondatachannel = (event) => {
        event.channel.onmessage = (message) => this.receive(String(message.data));
      };
      pc.onconnectionstatechange = () => {
        if (pc !== this.pc) return;
        if (pc.connectionState === "connected") this.setStatus("on");
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          this.close();
          this.requestedAt = 0;
        }
      };
      await pc.setRemoteDescription({ type: "offer", sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      await http.post(`${this.base}/voz/respuesta`, { oyente: this.listener, session, sdp: pc.localDescription?.sdp ?? "" });
    } catch {
      this.close();
      this.requestedAt = 0;
    } finally {
      this.busy = false;
    }
  }

  private receive(text: string): void {
    let data: ControlMessage;
    try {
      data = JSON.parse(text) as ControlMessage;
    } catch {
      return;
    }
    if (data.t === "mix") this.onMix?.(data.mix, data.rev);
    if (data.t === "layer") this.onLayer?.(data.layer);
    if (data.t === "stop") this.onStop?.(data.ids);
    if (data.t === "voice") this.setSpeaking(data.on);
  }
}

interface Peer {
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  created: number;
}

/**
 * The console microphone: capture, voice processing (high-pass, compressor), the
 * talk gate, voice detection and one WebRTC connection per listener.
 */
export class Broadcaster {
  analyser: AnalyserNode | null = null;
  stream: MediaStream | null = null;
  readonly peers = new Map<string, Peer>();
  /** Whether the host's voice is detected now (only while talking with «Detectar voz» on). */
  speaking = false;
  onVoice?: (on: boolean) => void;

  private ctx: AudioContext | null = null;
  private gate: GainNode | null = null;
  private fader: GainNode | null = null;
  private returnGain: GainNode | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private detector: AudioWorkletNode | null = null;
  private fallbackTimer = 0;
  private talking = false;
  private detect = true;
  private recorder: MediaRecorder | null = null;
  private recordStarted = 0;
  private recordMime = "";

  /** `offerUrl` is the console route that hands each listener its offer. */
  constructor(private readonly offerUrl: string) {}

  get open(): boolean {
    return this.stream !== null;
  }

  get connected(): number {
    let count = 0;
    this.peers.forEach((peer) => {
      if (peer.pc.connectionState === "connected") count += 1;
    });
    return count;
  }

  async openMic(deviceId: string | null, processing: boolean): Promise<MediaStream> {
    this.closeMic();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: processing,
        noiseSuppression: processing,
        autoGainControl: false,
        channelCount: 1,
      },
    });
    const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx ??= new Context({ latencyHint: "interactive" });
    await this.ctx.resume();
    const ctx = this.ctx;
    this.stream = stream;
    this.source = ctx.createMediaStreamSource(stream);
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 85;
    const presence = ctx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 3200;
    presence.gain.value = 2.5;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -36;
    compressor.knee.value = 8;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.25;
    const makeup = ctx.createGain();
    makeup.gain.value = VOICE_MAKEUP;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.06;
    this.fader ??= ctx.createGain();
    this.gate = ctx.createGain();
    this.gate.gain.value = this.talking ? 1 : 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.returnGain = ctx.createGain();
    this.returnGain.gain.value = 0;
    this.dest ??= ctx.createMediaStreamDestination();
    this.source.connect(highpass).connect(presence).connect(compressor).connect(makeup).connect(limiter).connect(this.fader).connect(this.analyser);
    this.analyser.connect(this.gate).connect(this.dest);
    this.analyser.connect(this.returnGain).connect(ctx.destination);
    await this.listenForVoice(ctx, compressor);
    return stream;
  }

  /** Records exactly the microphone the listeners hear, in pieces, until stopRecording(). */
  startRecording(onChunk: (blob: Blob, index: number) => void): boolean {
    const stream = this.dest?.stream;
    if (!stream || this.recorder || typeof MediaRecorder === "undefined") return false;
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) return false;
    const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64_000 });
    this.recordMime = mime;
    let index = 0;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) onChunk(event.data, index++);
    };
    recorder.start(10_000);
    this.recorder = recorder;
    this.recordStarted = performance.now();
    return true;
  }

  /** Stops the recorder and resolves (with the seconds recorded) after its last piece has been handed to onChunk. */
  stopRecording(): Promise<number> {
    const recorder = this.recorder;
    const duration = this.recordStarted ? (performance.now() - this.recordStarted) / 1000 : 0;
    this.recorder = null;
    this.recordStarted = 0;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(duration);
    return new Promise((resolve) => {
      recorder.addEventListener("stop", () => resolve(duration), { once: true });
      recorder.stop();
    });
  }

  get recording(): boolean {
    return this.recorder !== null;
  }

  recordingExtension(): "webm" | "m4a" {
    return this.recordMime.includes("mp4") ? "m4a" : "webm";
  }

  closeMic(): void {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.recorder = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.source?.disconnect();
    this.source = null;
    this.detector?.disconnect();
    this.detector = null;
    window.clearInterval(this.fallbackTimer);
    this.fallbackTimer = 0;
    this.setSpeaking(false);
  }

  setLevel(value: number): void {
    if (this.fader && this.ctx) this.fader.gain.setTargetAtTime(value, this.ctx.currentTime, 0.03);
  }

  setTalking(on: boolean): void {
    this.talking = on;
    if (this.gate && this.ctx) this.gate.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04);
    this.syncDetection();
  }

  /** «Detectar voz»: while talking, the program drops for every listener as soon as the voice is heard. */
  setDetect(on: boolean): void {
    this.detect = on;
    this.syncDetection();
  }

  /** Lets the operator hear their own processed microphone. */
  setReturn(on: boolean): void {
    if (this.returnGain && this.ctx) this.returnGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  async serve(ids: string[], ice: RTCIceServer[]): Promise<void> {
    const dest = this.dest;
    const track = dest?.stream.getAudioTracks()[0];
    if (!track || !dest) return;
    await Promise.all(
      ids.map(async (id) => {
        this.drop(id);
        const pc = new RTCPeerConnection({ iceServers: ice });
        pc.addTrack(track, dest.stream);
        const channel = pc.createDataChannel("control");
        channel.onopen = () => channel.send(JSON.stringify({ t: "voice", on: this.speaking } satisfies ControlMessage));
        this.peers.set(id, { pc, channel, created: Date.now() });
        pc.onconnectionstatechange = () => {
          if (["failed", "closed"].includes(pc.connectionState)) this.drop(id);
        };
        try {
          const offer = await pc.createOffer();
          offer.sdp = offer.sdp?.replace("useinbandfec=1", "useinbandfec=1;stereo=0;maxaveragebitrate=64000");
          await pc.setLocalDescription(offer);
          await gathered(pc);
          await http.post(this.offerUrl, { id, sdp: pc.localDescription?.sdp ?? "" });
        } catch {
          this.drop(id);
        }
      }),
    );
  }

  async accept(answers: { id: string; answer: string }[]): Promise<void> {
    await Promise.all(
      answers.map(async ({ id, answer }) => {
        const peer = this.peers.get(id);
        if (!peer || peer.pc.signalingState !== "have-local-offer") return;
        await peer.pc.setRemoteDescription({ type: "answer", sdp: answer }).catch(() => this.drop(id));
      }),
    );
  }

  /** Closes connections of listeners that left (after a grace period for new ones). */
  prune(alive: string[]): void {
    const keep = new Set(alive);
    this.peers.forEach((peer, id) => {
      if (!keep.has(id) && Date.now() - peer.created > 20000) this.drop(id);
    });
  }

  broadcast(message: ControlMessage): void {
    const text = JSON.stringify(message);
    this.peers.forEach((peer) => {
      if (peer.channel.readyState === "open") peer.channel.send(text);
    });
  }

  dropAll(): void {
    [...this.peers.keys()].forEach((id) => this.drop(id));
  }

  shutdown(): void {
    this.dropAll();
    this.closeMic();
    void this.ctx?.close();
    this.ctx = null;
    this.fader = null;
    this.dest = null;
  }

  /** Speech band of the processed microphone (before its fader) into the detector. */
  private async listenForVoice(ctx: AudioContext, input: AudioNode): Promise<void> {
    const low = ctx.createBiquadFilter();
    low.type = "highpass";
    low.frequency.value = 250;
    const high = ctx.createBiquadFilter();
    high.type = "lowpass";
    high.frequency.value = 4000;
    input.connect(low).connect(high);
    try {
      await loadDetector(ctx);
      const node = new AudioWorkletNode(ctx, "station-voice-detector", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      node.port.onmessage = (event) => this.setSpeaking(Boolean(event.data));
      high.connect(node).connect(ctx.destination);
      this.detector = node;
    } catch {
      this.watchWithAnalyser(ctx, high);
    }
    this.syncDetection();
  }

  /** Same detection on the main thread, for browsers without AudioWorklet. */
  private watchWithAnalyser(ctx: AudioContext, input: AudioNode): void {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    input.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    let noise = -70;
    let loud = 0;
    let quiet = 0;
    let last = performance.now();
    window.clearInterval(this.fallbackTimer);
    this.fallbackTimer = window.setInterval(() => {
      const at = performance.now();
      const ms = at - last;
      last = at;
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (const value of buffer) sum += value * value;
      const db = 10 * Math.log10(sum / buffer.length + 1e-12);
      noise += (db - noise) * (db < noise ? 0.15 : 0.003);
      if (!this.detecting) return;
      const threshold = Math.min(-20, Math.max(-52, noise + 10));
      if (db > threshold) {
        loud += ms;
        quiet = 0;
      } else {
        quiet += ms;
        if (quiet > 40) loud = 0;
      }
      this.setSpeaking(this.speaking ? quiet < VOICE_HANG_MS : loud >= VOICE_ATTACK_MS);
    }, 15);
  }

  private get detecting(): boolean {
    return this.detect && this.talking && this.stream !== null;
  }

  private syncDetection(): void {
    this.detector?.port.postMessage(this.detecting);
    if (!this.detecting) this.setSpeaking(false);
  }

  private setSpeaking(on: boolean): void {
    if (on === this.speaking) return;
    this.speaking = on;
    this.broadcast({ t: "voice", on });
    this.onVoice?.(on);
  }

  private drop(id: string): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.pc.close();
    this.peers.delete(id);
  }
}
