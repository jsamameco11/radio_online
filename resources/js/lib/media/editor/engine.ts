import { EQ_BANDS, cutAt, editedLength, keeps, toEdited, type Cut, type Recipe } from "./recipe";

/**
 * Plays the original audio with the edit applied live: the cut parts are skipped, the fades are heard
 * and the sound goes through the same chain the server renders (FilterGraph.php, same formulas):
 * rumble cut, voice and stereo (mid/side), equalizer, compressor, level and a safety limiter.
 * Noise reduction and the de-esser only exist on the server; they are heard in the final-result sample.
 */

const dbToGain = (db: number) => 10 ** (db / 20);

/** Threshold (dB), ratio and makeup (dB) of the compressor for an amount from 1 to 100, as FilterGraph::compressor. */
export function compressorSettings(amount: number): [number, number, number] {
  const threshold = -10 - amount * 0.2;
  const ratio = 1.5 + amount * 0.045;
  return [threshold, ratio, -threshold * (1 - 1 / ratio) * 0.5];
}

/** Gains (dB) of the mid/side stage, as FilterGraph::midSideGains. */
export function midSideGains(recipe: Recipe) {
  return { mid: recipe.voice * 0.06, presence: recipe.voice * 0.05, side: -recipe.voice * 0.08 + recipe.width * 0.06 };
}

type Graph = {
  context: AudioContext;
  presence: BiquadFilterNode;
  mid: GainNode;
  side: GainNode;
  highpass: BiquadFilterNode;
  bands: BiquadFilterNode[];
  compressor: DynamicsCompressorNode;
  makeup: GainNode;
  level: GainNode;
  limiter: DynamicsCompressorNode;
  wet: GainNode;
  dry: GainNode;
  fade: GainNode;
  join: GainNode;
  meters: [AnalyserNode, AnalyserNode];
};

export class PreviewEngine {
  readonly audio: HTMLAudioElement;
  private graph: Graph | null = null;
  private recipe: Recipe;
  private duration: number;
  private loudness: number | null = null;
  private bypassed = false;
  private loopRange: Cut | null = null;
  private frame = 0;
  private meterBuffer = new Float32Array(1024);
  private failed = false;

  constructor(src: string, duration: number, recipe: Recipe, private onChange: () => void) {
    this.duration = duration;
    this.recipe = recipe;
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "auto";
    this.audio.src = src;
    this.audio.onplay = () => {
      this.loop();
      this.onChange();
    };
    this.audio.onpause = () => this.onChange();
    this.audio.onended = () => this.onChange();
    this.audio.onerror = () => {
      this.failed = true;
      this.onChange();
    };
  }

  get playing() {
    return !this.audio.paused && !this.audio.ended;
  }

  get time() {
    return this.audio.currentTime;
  }

  get broken() {
    return this.failed;
  }

  async play(from?: number) {
    this.build();
    if (this.graph?.context.state === "suspended") await this.graph.context.resume();
    const start = from ?? this.audio.currentTime;
    const parts = keeps(this.recipe.cuts, this.duration);
    const last = parts[parts.length - 1];
    let at = last && start >= last[1] - 0.05 ? parts[0][0] : start;
    const cut = cutAt(this.recipe.cuts, at);
    if (cut >= 0) at = this.recipe.cuts[cut][1];
    this.audio.currentTime = Math.min(at, this.duration);
    this.applyFade();
    try {
      await this.audio.play();
    } catch {
      this.onChange();
    }
  }

  pause() {
    this.audio.pause();
  }

  seek(time: number) {
    this.audio.currentTime = Math.max(0, Math.min(this.duration, time));
    this.applyFade();
    this.onChange();
  }

  setRecipe(recipe: Recipe) {
    this.recipe = recipe;
    this.applySound();
  }

  setLoudness(loudness: number | null) {
    this.loudness = loudness;
    this.applySound();
  }

  /** Hear the sound without the treatment (cuts and fades still apply), to compare. */
  setBypass(bypassed: boolean) {
    this.bypassed = bypassed;
    if (!this.graph) return;
    const now = this.graph.context.currentTime;
    this.graph.wet.gain.setTargetAtTime(bypassed ? 0 : 1, now, 0.015);
    this.graph.dry.gain.setTargetAtTime(bypassed ? 1 : 0, now, 0.015);
  }

  setLoop(range: Cut | null) {
    this.loopRange = range && range[1] - range[0] > 0.2 ? range : null;
  }

  /** Peak level of each channel, in dBFS (−60 when silent or before playing). */
  levels(): [number, number] {
    if (!this.graph || !this.playing) return [-60, -60];
    return this.graph.meters.map((meter) => {
      meter.getFloatTimeDomainData(this.meterBuffer);
      let peak = 0;
      for (const value of this.meterBuffer) peak = Math.max(peak, Math.abs(value));
      return Math.max(-60, 20 * Math.log10(peak || 1e-6));
    }) as [number, number];
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    void this.graph?.context.close();
    this.graph = null;
  }

  private build() {
    if (this.graph) return;
    const context = new AudioContext();
    const source = context.createMediaElementSource(this.audio);
    const upmix = new GainNode(context, { channelCount: 2, channelCountMode: "explicit", channelInterpretation: "speakers" });
    source.connect(upmix);

    const highpass = new BiquadFilterNode(context, { type: "highpass", frequency: 10, Q: Math.SQRT1_2 });
    upmix.connect(highpass);

    const split = context.createChannelSplitter(2);
    highpass.connect(split);
    const midIn = new GainNode(context, { channelCount: 1, channelCountMode: "explicit" });
    const sideIn = new GainNode(context, { channelCount: 1, channelCountMode: "explicit" });
    const half = (channel: number, gain: number, target: GainNode) => {
      const node = new GainNode(context, { gain, channelCount: 1, channelCountMode: "explicit" });
      split.connect(node, channel);
      node.connect(target);
    };
    half(0, 0.5, midIn);
    half(1, 0.5, midIn);
    half(0, 0.5, sideIn);
    half(1, -0.5, sideIn);
    const presence = new BiquadFilterNode(context, { type: "peaking", frequency: 3000, Q: 1, gain: 0, channelCount: 1, channelCountMode: "explicit" });
    const mid = new GainNode(context, { channelCount: 1, channelCountMode: "explicit" });
    const side = new GainNode(context, { channelCount: 1, channelCountMode: "explicit" });
    const invert = new GainNode(context, { gain: -1, channelCount: 1, channelCountMode: "explicit" });
    midIn.connect(presence).connect(mid);
    sideIn.connect(side);
    const merge = context.createChannelMerger(2);
    mid.connect(merge, 0, 0);
    mid.connect(merge, 0, 1);
    side.connect(merge, 0, 0);
    side.connect(invert).connect(merge, 0, 1);

    let chain: AudioNode = merge;
    const bands = EQ_BANDS.map((band) => {
      const filter = new BiquadFilterNode(context, { type: band.type, frequency: band.hz, Q: band.type === "peaking" ? 1 : Math.SQRT1_2, gain: 0 });
      chain.connect(filter);
      chain = filter;
      return filter;
    });
    const compressor = new DynamicsCompressorNode(context, { threshold: 0, ratio: 1, knee: 9, attack: 0.015, release: 0.18 });
    const makeup = new GainNode(context);
    const level = new GainNode(context);
    const limiter = new DynamicsCompressorNode(context, { threshold: -1, ratio: 20, knee: 0, attack: 0.003, release: 0.05 });
    chain.connect(compressor).connect(makeup).connect(level).connect(limiter);

    const wet = new GainNode(context, { gain: this.bypassed ? 0 : 1 });
    const dry = new GainNode(context, { gain: this.bypassed ? 1 : 0 });
    limiter.connect(wet);
    upmix.connect(dry);
    const fade = new GainNode(context);
    const join = new GainNode(context);
    wet.connect(fade);
    dry.connect(fade);
    fade.connect(join).connect(context.destination);

    const meterSplit = context.createChannelSplitter(2);
    join.connect(meterSplit);
    const meters = [0, 1].map((channel) => {
      const meter = new AnalyserNode(context, { fftSize: 1024, smoothingTimeConstant: 0 });
      meterSplit.connect(meter, channel);
      return meter;
    }) as [AnalyserNode, AnalyserNode];

    this.graph = { context, presence, mid, side, highpass, bands, compressor, makeup, level, limiter, wet, dry, fade, join, meters };
    this.applySound();
  }

  private applySound() {
    const graph = this.graph;
    if (!graph) return;
    const recipe = this.recipe;
    const now = graph.context.currentTime;
    const set = (param: AudioParam, value: number) => param.setTargetAtTime(value, now, 0.03);

    set(graph.highpass.frequency, recipe.lowcut ? 80 : 10);
    const gains = midSideGains(recipe);
    set(graph.presence.gain, gains.presence);
    set(graph.mid.gain, dbToGain(gains.mid));
    set(graph.side.gain, dbToGain(gains.side));
    graph.bands.forEach((band, index) => set(band.gain, recipe.eq[index] ?? 0));

    const [threshold, ratio, makeup] = recipe.compress > 0 ? compressorSettings(recipe.compress) : [0, 1, 0];
    set(graph.compressor.threshold, threshold);
    set(graph.compressor.ratio, ratio);
    set(graph.makeup.gain, dbToGain(makeup));

    const leveling = recipe.normalize && this.loudness !== null ? Math.max(-20, Math.min(20, -14 - this.loudness)) : 0;
    set(graph.level.gain, dbToGain(recipe.gain + leveling));
    set(graph.limiter.threshold, recipe.normalize ? -1.5 : -0.2);
  }

  /** Fade in and out, as heard at this moment of the edited audio. */
  private applyFade() {
    if (!this.graph) return;
    const length = editedLength(this.recipe, this.duration);
    const at = toEdited(this.audio.currentTime, this.recipe, this.duration);
    let gain = 1;
    if (this.recipe.fadeIn > 0) gain = Math.min(gain, at / this.recipe.fadeIn);
    if (this.recipe.fadeOut > 0) gain = Math.min(gain, (length - at) / this.recipe.fadeOut);
    this.graph.fade.gain.setTargetAtTime(Math.max(0, Math.min(1, gain)), this.graph.context.currentTime, 0.01);
  }

  /** Jumps over the cut parts (with a tiny dip so the jump never clicks), loops the selection and follows the fades. */
  private loop = () => {
    cancelAnimationFrame(this.frame);
    if (!this.playing) return;
    const time = this.audio.currentTime;
    const lookahead = 0.03;

    if (this.loopRange && time >= this.loopRange[1] - lookahead) {
      this.jump(this.skip(this.loopRange[0]));
    } else {
      const next = this.recipe.cuts.find(([start, end]) => time + lookahead >= start && time < end);
      if (next) {
        if (next[1] >= this.duration - 0.01) {
          this.audio.pause();
          this.audio.currentTime = next[0];
        } else {
          this.jump(next[1]);
        }
      }
    }
    this.applyFade();
    this.frame = requestAnimationFrame(this.loop);
  };

  private skip(time: number) {
    const cut = cutAt(this.recipe.cuts, time);
    return cut >= 0 ? this.recipe.cuts[cut][1] : time;
  }

  private jump(time: number) {
    if (this.graph) {
      const param = this.graph.join.gain;
      const now = this.graph.context.currentTime;
      param.cancelScheduledValues(now);
      param.setValueAtTime(0, now);
      param.linearRampToValueAtTime(1, now + 0.04);
    }
    this.audio.currentTime = time;
  }
}
