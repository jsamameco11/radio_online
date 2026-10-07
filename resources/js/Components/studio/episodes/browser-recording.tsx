import { Mic, Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/Components/ui/button";
import { duration as formatDuration } from "@/lib/format";
import { BrowserRecorder, recordingSupported } from "@/lib/media/recorder";

interface Props {
  maxDuration: number;
  onRecorded: (file: File, seconds: number) => void;
}

/** Records the episode right here with the microphone, with a level meter and pause. */
export function BrowserRecording({ maxDuration, onRecorded }: Props) {
  const recorder = useRef<BrowserRecorder | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "paused">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const finish = useRef<() => void>(() => undefined);

  useEffect(() => () => recorder.current?.release(), []);

  useEffect(() => {
    if (state === "idle") return;
    let frame = 0;
    const tick = () => {
      const current = recorder.current;
      if (!current) return;
      setElapsed(current.elapsed);
      setLevel(current.level());
      if (current.elapsed >= maxDuration) finish.current();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state, maxDuration]);

  const start = async () => {
    setError(null);
    const next = new BrowserRecorder();
    try {
      await next.start();
      recorder.current = next;
      setState("recording");
    } catch {
      next.release();
      setError("No pudimos usar el micrófono. Revisa que el navegador tenga permiso para usarlo.");
    }
  };

  const stop = async () => {
    const current = recorder.current;
    if (!current) return;
    const seconds = current.elapsed;
    recorder.current = null;
    setState("idle");
    setLevel(0);
    onRecorded(await current.stop(), seconds);
  };
  useEffect(() => {
    finish.current = () => void stop();
  });

  if (!recordingSupported()) return <p className="text-sm text-muted">Tu navegador no permite grabar audio. Usa Chrome, Edge, Firefox o Safari actualizados.</p>;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-raised p-4">
      <div className="flex items-center gap-4">
        <span className={state === "recording" ? "size-3 animate-pulse rounded-full bg-danger" : "size-3 rounded-full bg-line-strong"} aria-hidden />
        <span className="font-display text-2xl font-semibold tabular">{formatDuration(elapsed)}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-onair transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {state === "idle" ? (
          <Button variant="danger" icon={<Mic className="size-4" />} onClick={start}>
            Empezar a grabar
          </Button>
        ) : (
          <>
            {state === "recording" ? (
              <Button
                variant="secondary"
                icon={<Pause className="size-4" />}
                onClick={() => {
                  recorder.current?.pause();
                  setState("paused");
                }}
              >
                Pausar
              </Button>
            ) : (
              <Button
                variant="secondary"
                icon={<Play className="size-4" />}
                onClick={() => {
                  recorder.current?.resume();
                  setState("recording");
                }}
              >
                Continuar
              </Button>
            )}
            <Button icon={<Square className="size-4" />} onClick={stop}>
              Terminar
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
