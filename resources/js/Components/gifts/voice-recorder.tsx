import { Mic, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/Components/ui/button";
import { duration } from "@/lib/format";

export interface VoiceClip {
  blob: Blob;
  /** MIME type without codec parameters ("audio/webm"). */
  mime: string;
  seconds: number;
  url: string;
}

type RecorderState = "idle" | "requesting" | "recording" | "error";

const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];

function supportedType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function canRecordVoice(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** File extension the backend expects for a recorded clip. */
export function voiceExtension(mime: string): string {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

/**
 * Records a short voice note with the microphone (MediaRecorder), stops by
 * itself at `maxSeconds`, and lets the listener hear it before sending.
 */
export function VoiceRecorder({
  maxSeconds,
  value,
  onChange,
  disabled = false,
}: {
  maxSeconds: number;
  value: VoiceClip | null;
  onChange: (clip: VoiceClip | null) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);

  const releaseMicrophone = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  useEffect(() => () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    releaseMicrophone();
  }, []);

  useEffect(() => () => {
    if (value) URL.revokeObjectURL(value.url);
  }, [value]);

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const start = async () => {
    if (!canRecordVoice()) {
      setState("error");
      setError("Tu navegador no permite grabar audio. Prueba con Chrome, Edge, Firefox o Safari actualizados.");
      return;
    }

    setError(null);
    setState("requesting");

    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setState("error");
      setError("Necesitamos permiso para usar tu micrófono. Revísalo en la configuración del navegador.");
      return;
    }

    const type = supportedType();
    const chunks: Blob[] = [];
    const media = new MediaRecorder(stream.current, type ? { mimeType: type, audioBitsPerSecond: 64_000 } : undefined);
    recorder.current = media;

    media.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
    media.onstop = () => {
      const seconds = Math.min(maxSeconds, (performance.now() - startedAt.current) / 1000);
      const mime = (media.mimeType || type || "audio/webm").split(";")[0];
      releaseMicrophone();
      setState("idle");
      setElapsed(0);
      if (chunks.length === 0 || seconds < 0.5) {
        setError("La grabación fue demasiado corta. Inténtalo de nuevo.");
        return;
      }
      const blob = new Blob(chunks, { type: mime });
      onChange({ blob, mime, seconds: Math.round(seconds * 10) / 10, url: URL.createObjectURL(blob) });
    };

    startedAt.current = performance.now();
    media.start(250);
    setState("recording");
    timer.current = window.setInterval(() => {
      const seconds = (performance.now() - startedAt.current) / 1000;
      setElapsed(seconds);
      if (seconds >= maxSeconds) stop();
    }, 200);
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-raised p-3">
        <audio src={value.url} controls preload="metadata" className="h-10 min-w-0 flex-1" />
        <span className="text-xs text-muted tabular">{duration(value.seconds)}</span>
        <Button variant="ghost" size="icon" onClick={() => onChange(null)} disabled={disabled} aria-label="Borrar mensaje de voz">
          <Trash2 className="size-4" />
        </Button>
      </div>
    );
  }

  const progress = Math.min(100, (elapsed / maxSeconds) * 100);

  return (
    <div className="space-y-2">
      {state === "recording" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-signal/30 bg-signal-soft p-3">
          <span className="size-2.5 shrink-0 rounded-full bg-signal animate-onair" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-signal">
              <span>GRABANDO</span>
              <span className="tabular">
                {duration(elapsed)} / {duration(maxSeconds)}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-signal/15">
              <div className="h-full rounded-full bg-signal transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <Button variant="signal" size="sm" onClick={stop} icon={<Square className="size-3.5" />}>
            Detener
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={start}
          loading={state === "requesting"}
          disabled={disabled}
          icon={<Mic className="size-4" />}
          className="w-full"
        >
          Grabar mensaje de voz <span className="text-muted">· hasta {maxSeconds} s</span>
        </Button>
      )}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
