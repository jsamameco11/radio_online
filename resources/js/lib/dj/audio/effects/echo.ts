import { assemble, createShell, ramp, type Effect } from "./effect";

const MAX_DELAY = 8;

/** Beat echo with darkened repeats; turned off, its tail fades out. */
export function createEcho(ctx: AudioContext): Effect {
  const shell = createShell(ctx);
  const delay = ctx.createDelay(MAX_DELAY);
  const feedback = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 4500;
  const lowcut = ctx.createBiquadFilter();
  lowcut.type = "highpass";
  lowcut.frequency.value = 180;
  shell.send.connect(delay);
  delay.connect(tone).connect(lowcut).connect(feedback).connect(delay);
  delay.connect(shell.wet);

  return assemble(shell, {
    nodes: [delay, feedback, tone, lowcut],
    apply(on, depth) {
      ramp(shell.send.gain, on ? 1 : 0, ctx);
      ramp(shell.wet.gain, depth * 0.9, ctx);
      ramp(feedback.gain, 0.3 + depth * 0.45, ctx);
    },
    cycle(seconds) {
      ramp(delay.delayTime, Math.min(MAX_DELAY, Math.max(0.01, seconds)), ctx, 0.05);
    },
  });
}
