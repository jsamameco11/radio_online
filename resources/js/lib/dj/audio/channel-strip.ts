import { bandDb, dbToGain, filterShape, levelGain } from "../curves";
import type { ChannelState } from "../types";
import { createInsertPoint, type InsertPoint } from "./insert-point";

const EQ_BANDS = { low: 220, mid: 1000, high: 3800 };

/**
 * One mixer channel: auto gain, trim, three-band EQ, the one-knob filter, the headphones cue send,
 * the channel fader, its side of the crossfader and an insert point for the beat FX, into the master.
 */
export class ChannelStrip {
  readonly meter: AnalyserNode;
  readonly insert: InsertPoint;
  private readonly normalize: GainNode;
  private readonly trim: GainNode;
  private readonly low: BiquadFilterNode;
  private readonly mid: BiquadFilterNode;
  private readonly high: BiquadFilterNode;
  private readonly highpass: BiquadFilterNode;
  private readonly lowpass: BiquadFilterNode;
  private readonly cueSend: GainNode;
  private readonly fader: GainNode;
  private readonly crossfade: GainNode;

  constructor(
    private readonly ctx: AudioContext,
    source: AudioNode,
    cueBus: AudioNode,
    masterBus: AudioNode,
  ) {
    this.normalize = ctx.createGain();
    this.trim = ctx.createGain();
    this.low = this.filter("lowshelf", EQ_BANDS.low);
    this.mid = this.filter("peaking", EQ_BANDS.mid);
    this.mid.Q.value = 0.8;
    this.high = this.filter("highshelf", EQ_BANDS.high);
    this.highpass = this.filter("highpass", 10);
    this.lowpass = this.filter("lowpass", 22000);
    this.cueSend = ctx.createGain();
    this.fader = ctx.createGain();
    this.crossfade = ctx.createGain();
    this.insert = createInsertPoint(ctx);
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 1024;

    source.connect(this.normalize).connect(this.trim).connect(this.low).connect(this.mid).connect(this.high).connect(this.highpass).connect(this.lowpass);
    this.lowpass.connect(this.meter);
    this.lowpass.connect(this.cueSend).connect(cueBus);
    this.lowpass.connect(this.fader).connect(this.crossfade).connect(this.insert.from);
    this.insert.to.connect(masterBus);
  }

  /** Follows the channel's knobs; `normalize` is the track's auto gain (1 when it is off). */
  apply(channel: ChannelState, normalize: number): void {
    const t = this.ctx.currentTime;
    const filter = filterShape(channel.filter);
    this.normalize.gain.setTargetAtTime(normalize, t, 0.05);
    this.trim.gain.setTargetAtTime(dbToGain(channel.trim), t, 0.02);
    this.low.gain.setTargetAtTime(bandDb(channel.low), t, 0.01);
    this.mid.gain.setTargetAtTime(bandDb(channel.mid), t, 0.01);
    this.high.gain.setTargetAtTime(bandDb(channel.high), t, 0.01);
    this.lowpass.frequency.setTargetAtTime(filter.lowpass, t, 0.02);
    this.highpass.frequency.setTargetAtTime(filter.highpass, t, 0.02);
    this.lowpass.Q.setTargetAtTime(filter.lowQ, t, 0.02);
    this.highpass.Q.setTargetAtTime(filter.highQ, t, 0.02);
    this.fader.gain.setTargetAtTime(levelGain(channel.fader), t, 0.008);
    this.cueSend.gain.setTargetAtTime(channel.cue ? 1 : 0, t, 0.01);
  }

  setCrossfade(gain: number): void {
    this.crossfade.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.004);
  }

  dispose(): void {
    [this.normalize, this.trim, this.low, this.mid, this.high, this.highpass, this.lowpass, this.cueSend, this.fader, this.crossfade, this.insert.from, this.insert.to, this.meter].forEach((node) => node.disconnect());
  }

  private filter(type: BiquadFilterType, frequency: number): BiquadFilterNode {
    const node = this.ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    return node;
  }
}
