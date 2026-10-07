import { http, HttpError } from "@/lib/http";
import type { CaptureBrief } from "@/types/studio";
import type { Broadcaster } from "./voice";

interface CaptureAnswer {
  recording: CaptureBrief;
  duplicate?: boolean;
}

/**
 * Uploads the live microphone in order while the transmission is open, to the console's
 * recording routes (`base` is the studio URL of /consola/grabacion). A failed piece is retried;
 * a piece the server already has is not sent twice; when the recording is full it stops sending.
 */
export class LiveCapture {
  id: string | null = null;
  done = false;
  /** Why the upload stopped before the end, for the operator. */
  problem: string | null = null;
  private chain: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly caster: Broadcaster,
    private readonly base: string,
  ) {}

  /** Opens the recording on the server and starts the recorder; throws with the message to show. */
  async start(session: string): Promise<CaptureBrief> {
    const { recording } = await http.post<CaptureAnswer>(this.base, { session });
    this.id = recording.id;
    const started = this.caster.startRecording((blob, index) => {
      this.chain = this.chain.then(() => this.send(recording.id, blob, index));
    });
    if (!started) {
      await http.delete(`${this.base}/${recording.id}`).catch(() => undefined);
      this.id = null;
      throw new Error("Este navegador no pudo grabar la transmisión. El vivo sigue al aire.");
    }
    return recording;
  }

  /** Stops the recorder, waits for the pieces in flight and closes the recording. */
  async finish(): Promise<CaptureBrief | null> {
    if (this.done || !this.id) return null;
    this.done = true;
    const duration = await this.caster.stopRecording();
    await this.chain.catch(() => undefined);
    const { recording } = await http.post<CaptureAnswer>(`${this.base}/${this.id}/fin`, { duration: Math.round(duration * 10) / 10 });
    return recording;
  }

  private async send(id: string, blob: Blob, index: number): Promise<void> {
    if (this.stopped) return;
    const extension = this.caster.recordingExtension();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const body = new FormData();
      body.set("index", String(index));
      body.set("extension", extension);
      body.set("audio", blob, `tramo-${index}.${extension}`);
      try {
        await http.post<CaptureAnswer>(`${this.base}/${id}/partes`, body);
        return;
      } catch (error) {
        if (error instanceof HttpError && error.status !== 429 && error.status < 500) {
          this.stopped = true;
          this.problem = error.firstError();
          return;
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
    }
    this.stopped = true;
    this.problem = "Se perdió la conexión mientras grabábamos. Guardamos lo que alcanzó a subir.";
  }
}
