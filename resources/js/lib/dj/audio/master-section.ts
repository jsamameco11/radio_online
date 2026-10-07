import { cueBlend, levelGain } from "../curves";
import type { MixerSettings } from "../types";
import { createInsertPoint, type InsertPoint } from "./insert-point";

/**
 * The master of the booth: the channels and the sampler sum into its insert point, then its level
 * and a brickwall limiter. The result feeds the meters, the air send (to the broadcaster, closed
 * until the mix goes on air) and the headphones, which blend it with the cued channels.
 */
export class MasterSection {
  readonly insert: InsertPoint;
  readonly cueBus: GainNode;
  readonly samplerBus: GainNode;
  readonly meters: [AnalyserNode, AnalyserNode];
  private readonly level: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly out: GainNode;
  private readonly splitter: ChannelSplitterNode;
  private readonly air: GainNode;
  private readonly cueSide: GainNode;
  private readonly masterSide: GainNode;
  private readonly phones: GainNode;

  constructor(
    private readonly ctx: AudioContext,
    onAir: AudioNode,
  ) {
    this.insert = createInsertPoint(ctx);
    this.cueBus = ctx.createGain();
    this.samplerBus = ctx.createGain();
    this.level = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;
    this.out = ctx.createGain();
    this.splitter = ctx.createChannelSplitter(2);
    this.meters = [ctx.createAnalyser(), ctx.createAnalyser()];
    this.meters.forEach((meter) => (meter.fftSize = 1024));
    this.air = ctx.createGain();
    this.air.gain.value = 0;
    this.cueSide = ctx.createGain();
    this.masterSide = ctx.createGain();
    this.phones = ctx.createGain();

    this.samplerBus.connect(this.insert.from);
    this.insert.to.connect(this.level).connect(this.limiter).connect(this.out);
    this.out.connect(this.air).connect(onAir);
    this.out.connect(this.splitter);
    this.splitter.connect(this.meters[0], 0);
    this.splitter.connect(this.meters[1], 1);
    this.out.connect(this.masterSide).connect(this.phones);
    this.cueBus.connect(this.cueSide).connect(this.phones);
    this.phones.connect(ctx.destination);
  }

  /** Where the channels sum. */
  get bus(): GainNode {
    return this.insert.from;
  }

  apply({ master, cueMix, phones, samplerVolume }: MixerSettings): void {
    const t = this.ctx.currentTime;
    const [cue, mix] = cueBlend(cueMix);
    this.level.gain.setTargetAtTime(levelGain(master), t, 0.02);
    this.cueSide.gain.setTargetAtTime(cue, t, 0.02);
    this.masterSide.gain.setTargetAtTime(mix, t, 0.02);
    this.phones.gain.setTargetAtTime(levelGain(phones), t, 0.02);
    this.samplerBus.gain.setTargetAtTime(levelGain(samplerVolume), t, 0.02);
  }

  setOnAir(on: boolean): void {
    this.air.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  dispose(): void {
    [this.insert.from, this.insert.to, this.cueBus, this.samplerBus, this.level, this.limiter, this.out, this.splitter, ...this.meters, this.air, this.cueSide, this.masterSide, this.phones].forEach((node) =>
      node.disconnect(),
    );
  }
}
