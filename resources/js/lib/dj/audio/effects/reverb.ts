import { assemble, createShell, ramp, type Effect } from "./effect";

const ROOM_SECONDS = 3.2;

/** A stereo room: decaying noise, a little different on each side. */
function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.round(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.2;
  }
  return buffer;
}

/** Room reverb; turned off, its tail fades out. */
export function createReverb(ctx: AudioContext): Effect {
  const shell = createShell(ctx);
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse(ctx, ROOM_SECONDS);
  const lowcut = ctx.createBiquadFilter();
  lowcut.type = "highpass";
  lowcut.frequency.value = 220;
  shell.send.connect(lowcut).connect(convolver).connect(shell.wet);

  return assemble(shell, {
    nodes: [convolver, lowcut],
    apply(on, depth) {
      ramp(shell.send.gain, on ? 1 : 0, ctx);
      ramp(shell.wet.gain, depth * 1.4, ctx);
    },
  });
}
