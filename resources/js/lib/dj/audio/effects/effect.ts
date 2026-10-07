import { stopSource } from "../decode";

/** A beat-synced effect placed as an insert: `input` → (dry + effect) → `output`. */
export interface Effect {
  readonly input: GainNode;
  readonly output: GainNode;
  setOn(on: boolean): void;
  setDepth(depth: number): void;
  /** Length of the effect's cycle, in seconds (beat length × division). */
  setCycle(seconds: number): void;
  dispose(): void;
}

/** The input splits into a dry path and a send; the processed signal returns through `wet`. */
export interface EffectShell {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly dry: GainNode;
  readonly send: GainNode;
  readonly wet: GainNode;
}

interface EffectParts {
  /** Sets the gains for the switch and the level. */
  apply(on: boolean, depth: number): void;
  /** Follows the length of the cycle, in seconds. */
  cycle?(seconds: number): void;
  nodes: AudioNode[];
  oscillators?: OscillatorNode[];
}

const RAMP = 0.015;

export function ramp(param: AudioParam, value: number, ctx: BaseAudioContext, time = RAMP): void {
  param.setTargetAtTime(value, ctx.currentTime, time);
}

export function createShell(ctx: AudioContext): EffectShell {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const send = ctx.createGain();
  const wet = ctx.createGain();
  send.gain.value = 0;
  wet.gain.value = 0;
  input.connect(dry).connect(output);
  input.connect(send);
  wet.connect(output);
  return { input, output, dry, send, wet };
}

/** An effect from its shell and processing: it remembers its switch and level and releases every node. */
export function assemble(shell: EffectShell, parts: EffectParts): Effect {
  let on = false;
  let depth = 0.5;
  parts.apply(on, depth);
  return {
    input: shell.input,
    output: shell.output,
    setOn(next) {
      on = next;
      parts.apply(on, depth);
    },
    setDepth(next) {
      depth = next;
      parts.apply(on, depth);
    },
    setCycle(seconds) {
      parts.cycle?.(seconds);
    },
    dispose() {
      parts.oscillators?.forEach(stopSource);
      [shell.input, shell.output, shell.dry, shell.send, shell.wet, ...parts.nodes].forEach((node) => node.disconnect());
    },
  };
}
