import { assemble, createShell, ramp, type Effect } from "./effect";

function crushCurve(bits: number): Float32Array<ArrayBuffer> {
  const steps = 2 ** Math.max(2, bits);
  const curve = new Float32Array(4096);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

/** Bit reduction: from 10 bits at the lowest level down to 3 at the highest. */
export function createBitcrush(ctx: AudioContext): Effect {
  const shell = createShell(ctx);
  const shaper = ctx.createWaveShaper();
  shell.send.connect(shaper).connect(shell.wet);

  return assemble(shell, {
    nodes: [shaper],
    apply(on, depth) {
      shaper.curve = crushCurve(Math.round(10 - depth * 7));
      ramp(shell.send.gain, on ? 1 : 0, ctx);
      ramp(shell.wet.gain, on ? 1 : 0, ctx);
      ramp(shell.dry.gain, on ? 0 : 1, ctx);
    },
  });
}
