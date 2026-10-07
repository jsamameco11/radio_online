import type { DeckLoop } from "../types";
import type { DeckCommand, DeckReport } from "./deck-processor";

/** How often the platter movement is turned into speeds for the audio thread. */
export const DECK_TICK_MS = 15;

const TICK_SECONDS = DECK_TICK_MS / 1000;
const MAX_SCRATCH_SPEED = 12;
const MAX_BEND = 0.5;
/** Pitch bend per turn per second of the jog ring. */
const BEND_PER_TURN = 0.08;
/** Share of the bend kept each tick once the ring stops, so it eases back to the tempo. */
const BEND_RELEASE = 0.6;

/** One deck's processor on the audio thread: where it plays and what the hand does on its platter. */
export class DeckPlayer {
  readonly node: AudioWorkletNode;
  /** Length of the loaded track, in samples. */
  private length = 0;
  private report: DeckReport = { pos: 0, rate: 0, playing: false, at: 0, ended: false };
  private scratching = false;
  private scratchMoved = 0;
  private bendMoved = 0;
  private bend = 0;

  constructor(
    private readonly ctx: AudioContext,
    onEnded: () => void,
  ) {
    this.node = new AudioWorkletNode(ctx, "dj-deck", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    this.node.port.onmessage = (event: MessageEvent<DeckReport>) => {
      this.report = event.data;
      if (event.data.ended) onEnded();
    };
    this.send({ t: "keylock", on: true });
  }

  get isScratching(): boolean {
    return this.scratching;
  }

  send(command: DeckCommand): void {
    this.node.port.postMessage(command);
  }

  /** Hands a decoded track to the audio thread (its samples are transferred, not copied). */
  load(buffer: AudioBuffer): void {
    const left = buffer.getChannelData(0).slice();
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1).slice() : null;
    this.length = left.length;
    this.report = { pos: 0, rate: 0, playing: false, at: this.ctx.currentTime, ended: false };
    this.node.port.postMessage({ t: "load", left, right } satisfies DeckCommand, right ? [left.buffer, right.buffer] : [left.buffer]);
  }

  unload(): void {
    this.length = 0;
    this.send({ t: "unload" });
  }

  play(on: boolean): void {
    this.send({ t: "play", on });
  }

  seek(seconds: number): void {
    const pos = Math.min(this.length, Math.max(0, seconds * this.ctx.sampleRate));
    this.report = { ...this.report, pos, at: this.ctx.currentTime };
    this.send({ t: "seek", pos });
  }

  setLoop(loop: DeckLoop): void {
    const rate = this.ctx.sampleRate;
    this.send({ t: "loop", on: loop.active, start: loop.start * rate, end: loop.end * rate });
  }

  /** Where the deck plays now, in seconds, extrapolated from the last report of the audio thread. */
  position(loop: DeckLoop | null): number {
    const rate = this.ctx.sampleRate;
    const { pos, rate: speed, at } = this.report;
    let samples = pos + speed * Math.max(0, this.ctx.currentTime - at) * rate;
    if (loop?.active && speed > 0 && pos < loop.end * rate && samples >= loop.end * rate) {
      samples -= (loop.end - loop.start) * rate;
    }
    return Math.min(this.length, Math.max(0, samples)) / rate;
  }

  scratchStart(): void {
    this.scratching = true;
    this.scratchMoved = 0;
    this.send({ t: "scratch", on: true, velocity: 0 });
  }

  /** Movement of the platter, in seconds of audio. */
  scratchMove(seconds: number): void {
    if (this.scratching) this.scratchMoved += seconds;
  }

  scratchEnd(): void {
    if (!this.scratching) return;
    this.scratching = false;
    this.send({ t: "scratch", on: false, velocity: 0 });
  }

  /** Movement of the jog ring while playing, in turns. */
  bendBy(turns: number): void {
    this.bendMoved += turns;
  }

  /** Turns the hand's movement since the last tick into speeds for the audio thread. */
  tick(): void {
    if (this.scratching) {
      this.send({ t: "scratch", on: true, velocity: Math.max(-MAX_SCRATCH_SPEED, Math.min(MAX_SCRATCH_SPEED, this.scratchMoved / TICK_SECONDS)) });
      this.scratchMoved = 0;
    }
    const target = this.bendMoved !== 0 ? Math.max(-MAX_BEND, Math.min(MAX_BEND, (this.bendMoved / TICK_SECONDS) * BEND_PER_TURN)) : this.bend * BEND_RELEASE;
    this.bendMoved = 0;
    const bend = Math.abs(target) < 0.001 ? 0 : target;
    if (bend !== this.bend) {
      this.bend = bend;
      this.send({ t: "bend", value: bend });
    }
  }

  dispose(): void {
    this.node.port.onmessage = null;
    this.node.port.close();
    this.node.disconnect();
  }
}
