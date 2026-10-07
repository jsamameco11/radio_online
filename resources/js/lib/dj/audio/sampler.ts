import { decodeAudio, stopSource } from "./decode";

/** The sampler's sounds: each address decoded once, fired into the sampler bus. */
export class Sampler {
  private readonly buffers = new Map<string, Promise<AudioBuffer>>();
  private readonly sounding = new Map<number, AudioBufferSourceNode>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
  ) {}

  preload(src: string): void {
    void this.buffer(src).catch(() => undefined);
  }

  /** Fires a slot (again from the start if it was sounding); rejects when its audio cannot be opened. */
  async fire(index: number, src: string): Promise<void> {
    const buffer = await this.buffer(src);
    this.stop(index);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    source.onended = () => {
      if (this.sounding.get(index) === source) this.sounding.delete(index);
    };
    source.start();
    this.sounding.set(index, source);
  }

  /** Stops one slot, or all of them. */
  stop(index?: number): void {
    [...this.sounding].forEach(([key, source]) => {
      if (index !== undefined && key !== index) return;
      stopSource(source);
      this.sounding.delete(key);
    });
  }

  dispose(): void {
    this.stop();
  }

  private buffer(src: string): Promise<AudioBuffer> {
    let loading = this.buffers.get(src);
    if (!loading) {
      loading = decodeAudio(this.ctx, src);
      loading.catch(() => this.buffers.delete(src));
      this.buffers.set(src, loading);
    }
    return loading;
  }
}
