import { assemble, createShell, ramp, type Effect } from "./effect";

/** Metallic sweep across four cycles; turned off, its tail fades out. */
export function createFlanger(ctx: AudioContext): Effect {
  const shell = createShell(ctx);
  const delay = ctx.createDelay(0.05);
  delay.delayTime.value = 0.004;
  const feedback = ctx.createGain();
  const lfo = ctx.createOscillator();
  const sweep = ctx.createGain();
  sweep.gain.value = 0.0032;
  lfo.connect(sweep).connect(delay.delayTime);
  lfo.start();
  shell.send.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(shell.wet);

  return assemble(shell, {
    nodes: [delay, feedback, sweep],
    oscillators: [lfo],
    apply(on, depth) {
      ramp(shell.send.gain, on ? 1 : 0, ctx);
      ramp(shell.wet.gain, 0.4 + depth * 0.5, ctx);
      ramp(feedback.gain, 0.2 + depth * 0.6, ctx);
    },
    cycle(seconds) {
      ramp(lfo.frequency, 1 / Math.max(0.05, seconds * 4), ctx, 0.05);
    },
  });
}
