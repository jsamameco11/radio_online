/** Decodes an audio file of this computer or of an address into samples of the context. */
export async function decodeAudio(ctx: BaseAudioContext, from: File | string): Promise<AudioBuffer> {
  const data = typeof from === "string" ? await fetch(from).then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status))))) : await from.arrayBuffer();
  return ctx.decodeAudioData(data);
}

/** Stops a one-shot source that may have already ended. */
export function stopSource(source: AudioScheduledSourceNode): void {
  try {
    source.stop();
  } catch {
    // Already stopped.
  }
  source.disconnect();
}
