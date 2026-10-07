import { assemble, createShell, ramp, type Effect } from "./effect";

const GATE_RAMP = 0.005;

/** Transformer: chops the sound into rhythmic hits, one per cycle. */
export function createTrans(ctx: AudioContext): Effect {
  const shell = createShell(ctx);
  const gate = ctx.createGain();
  gate.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.type = "square";
  const swing = ctx.createGain();
  swing.gain.value = 0.5;
  lfo.connect(swing).connect(gate.gain);
  lfo.start();
  shell.send.connect(gate).connect(shell.wet);

  return assemble(shell, {
    nodes: [gate, swing],
    oscillators: [lfo],
    apply(on, depth) {
      ramp(shell.send.gain, on ? 1 : 0, ctx, GATE_RAMP);
      ramp(shell.wet.gain, on ? depth : 0, ctx, GATE_RAMP);
      ramp(shell.dry.gain, on ? 1 - depth : 1, ctx, GATE_RAMP);
    },
    cycle(seconds) {
      ramp(lfo.frequency, 1 / Math.max(0.02, seconds), ctx, 0.02);
    },
  });
}
