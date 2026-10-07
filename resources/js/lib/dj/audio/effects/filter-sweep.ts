import { assemble, createShell, ramp, type Effect } from "./effect";

/** Resonant low-pass that rises and falls once per cycle. */
export function createFilterSweep(ctx: AudioContext): Effect {
  const shell = createShell(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 7;
  filter.frequency.value = 1400;
  const lfo = ctx.createOscillator();
  const sweep = ctx.createGain();
  sweep.gain.value = 1250;
  lfo.connect(sweep).connect(filter.frequency);
  lfo.start();
  shell.send.connect(filter).connect(shell.wet);

  return assemble(shell, {
    nodes: [filter, sweep],
    oscillators: [lfo],
    apply(on, depth) {
      ramp(shell.send.gain, on ? 1 : 0, ctx);
      ramp(shell.wet.gain, on ? depth : 0, ctx);
      ramp(shell.dry.gain, on ? 1 - depth : 1, ctx);
    },
    cycle(seconds) {
      ramp(lfo.frequency, 1 / Math.max(0.05, seconds), ctx, 0.05);
    },
  });
}
