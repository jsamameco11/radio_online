/** Length of an audio file in seconds as the browser reads it, or null when it cannot be decoded. */
export function probeDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const source = URL.createObjectURL(file);
    const finish = (value: number | null) => {
      URL.revokeObjectURL(source);
      audio.removeAttribute("src");
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 15000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        window.clearTimeout(timer);
        finish(Math.round(audio.duration * 100) / 100);
        return;
      }
      // Recordings from MediaRecorder report Infinity until the player seeks to the end.
      audio.ontimeupdate = () => {
        if (!Number.isFinite(audio.duration)) return;
        window.clearTimeout(timer);
        audio.ontimeupdate = null;
        finish(Math.round(audio.duration * 100) / 100);
      };
      audio.currentTime = 1e7;
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    audio.src = source;
  });
}
