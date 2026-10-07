/**
 * Records audio from the microphone in the browser (MediaRecorder) for episodes: Opus in WebM
 * where available, AAC in MP4 on Safari. Exposes the input level for a meter while recording.
 */

const TYPES = [
  { mime: "audio/webm;codecs=opus", extension: "webm" },
  { mime: "audio/ogg;codecs=opus", extension: "ogg" },
  { mime: "audio/mp4", extension: "m4a" },
];

export function recordingSupported(): boolean {
  return typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

export class BrowserRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer = new Float32Array(1024);
  private startedAt = 0;
  private pausedFor = 0;
  private pausedAt = 0;
  private type = TYPES[0];

  get state(): RecordingState | "idle" {
    return this.recorder?.state ?? "idle";
  }

  /** Seconds recorded, without the pauses. */
  get elapsed(): number {
    if (!this.startedAt) return 0;
    const now = this.pausedAt || performance.now();
    return (now - this.startedAt - this.pausedFor) / 1000;
  }

  /** Peak input level from 0 to 1. */
  level(): number {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buffer);
    let peak = 0;
    for (const value of this.buffer) peak = Math.max(peak, Math.abs(value));
    return Math.min(1, peak);
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    this.type = TYPES.find((type) => MediaRecorder.isTypeSupported(type.mime)) ?? TYPES[0];
    this.recorder = new MediaRecorder(this.stream, { mimeType: this.type.mime, audioBitsPerSecond: 128000 });
    this.chunks = [];
    this.recorder.ondataavailable = (event) => event.data.size > 0 && this.chunks.push(event.data);
    this.context = new AudioContext();
    this.analyser = new AnalyserNode(this.context, { fftSize: 1024 });
    this.context.createMediaStreamSource(this.stream).connect(this.analyser);
    this.recorder.start(1000);
    this.startedAt = performance.now();
    this.pausedFor = 0;
    this.pausedAt = 0;
  }

  pause() {
    if (this.recorder?.state !== "recording") return;
    this.recorder.pause();
    this.pausedAt = performance.now();
  }

  resume() {
    if (this.recorder?.state !== "paused") return;
    this.recorder.resume();
    this.pausedFor += performance.now() - this.pausedAt;
    this.pausedAt = 0;
  }

  /** Stops and returns the recording as a file named after the moment it started. */
  stop(): Promise<File> {
    const recorder = this.recorder;
    if (!recorder) return Promise.reject(new Error("No hay una grabación en curso."));
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        const file = new File(this.chunks, `grabacion-${stamp}.${this.type.extension}`, { type: this.type.mime.split(";")[0] });
        this.release();
        resolve(file);
      };
      recorder.stop();
    });
  }

  /** Stops everything without keeping the audio. */
  release() {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.stream = null;
    this.recorder = null;
    this.context = null;
    this.analyser = null;
    this.startedAt = 0;
  }
}
