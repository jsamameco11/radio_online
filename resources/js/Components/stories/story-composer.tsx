import { router } from "@inertiajs/react";
import { Clapperboard, ImageIcon, Send, Type, UploadCloud, X } from "lucide-react";
import type { DragEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/Components/studio/upload/progress-bar";
import { Button } from "@/Components/ui/button";
import { Field, Textarea } from "@/Components/ui/field";
import { Tabs } from "@/Components/ui/tabs";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { bytes, duration } from "@/lib/format";
import { HttpError } from "@/lib/http";
import { xhrJson } from "@/lib/media/upload";
import type { StoryBackground, StoryKind, StoryLimits } from "@/types/stories";
import { StoryStage } from "./story-stage";
import { storyBackgrounds } from "./story-style";

interface Media {
  file: File;
  url: string;
  seconds: number | null;
  poster: Blob | null;
  posterUrl: string | null;
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
const MB = 1024 * 1024;

/** Length and a poster frame of a video, read in the browser before uploading it. */
function readVideo(url: string): Promise<{ seconds: number; poster: Blob | null }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let seconds = 0;
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onerror = () => reject(new Error("No pudimos leer el video. Prueba con un archivo MP4."));
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration)) {
        video.currentTime = Number.MAX_SAFE_INTEGER;
        return;
      }
      seconds = video.duration;
      video.currentTime = Math.min(0.5, seconds / 2);
    };
    video.onseeked = () => {
      if (seconds === 0) {
        seconds = video.duration;
        video.currentTime = Math.min(0.5, seconds / 2);
        return;
      }
      const scale = Math.min(1, 1080 / Math.max(1, video.videoWidth));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context || canvas.width === 0) {
        resolve({ seconds, poster: null });
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve({ seconds, poster: blob }), "image/jpeg", 0.85);
    };
    video.src = url;
  });
}

function extension(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

/** Checks a photo or video against the same limits the server applies and prepares its preview. */
async function prepare(file: File, kind: "image" | "video", limits: StoryLimits): Promise<Media> {
  if (kind === "image") {
    if (!IMAGE_MIMES.includes(file.type) && !limits.image_types.includes(extension(file))) throw new Error("La foto debe ser JPG, PNG o WEBP.");
    if (file.size > limits.max_image_mb * MB) throw new Error(`La foto pesa ${bytes(file.size)}; el máximo es ${limits.max_image_mb} MB.`);
    return { file, url: URL.createObjectURL(file), seconds: null, poster: null, posterUrl: null };
  }
  if (!VIDEO_MIMES.includes(file.type) && !limits.video_types.includes(extension(file))) throw new Error("El video debe ser MP4, WEBM o MOV.");
  if (file.size > limits.max_video_mb * MB) throw new Error(`El video pesa ${bytes(file.size)}; el máximo es ${limits.max_video_mb} MB.`);
  const url = URL.createObjectURL(file);
  try {
    const { seconds, poster } = await readVideo(url);
    if (seconds > limits.max_video_seconds + 0.5) {
      throw new Error(`El video dura ${duration(seconds)}; el máximo es ${limits.max_video_seconds} segundos. Recórtalo y vuelve a intentarlo.`);
    }
    return { file, url, seconds, poster, posterUrl: poster ? URL.createObjectURL(poster) : null };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function release(media: Media | null) {
  if (!media) return;
  URL.revokeObjectURL(media.url);
  if (media.posterUrl) URL.revokeObjectURL(media.posterUrl);
}

/** Composer of the studio: a photo, a video or a text, with a phone-sized live preview. */
export function StoryComposer({ limits, full }: { limits: StoryLimits; full: boolean }) {
  const url = useStudioUrl();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<StoryKind>("image");
  const [media, setMedia] = useState<Media | null>(null);
  const [text, setText] = useState("");
  const [background, setBackground] = useState<StoryBackground>(limits.backgrounds[0]?.value ?? "signal");
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => () => release(media), [media]);

  const switchKind = (next: StoryKind) => {
    if (next === kind) return;
    setKind(next);
    setMedia(null);
    setError(null);
    setDone(null);
  };

  const choose = async (file: File | undefined) => {
    if (!file || kind === "text") return;
    setError(null);
    setDone(null);
    setReading(true);
    try {
      setMedia(await prepare(file, kind, limits));
    } catch (failure) {
      setMedia(null);
      setError(failure instanceof Error ? failure.message : "No pudimos leer el archivo.");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    void choose(event.dataTransfer.files[0]);
  };

  const ready = kind === "text" ? text.trim().length > 0 : media !== null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || progress !== null) return;
    const form = new FormData();
    form.append("kind", kind);
    if (text.trim()) form.append("text", text.trim());
    if (kind === "text") form.append("background", background);
    if (media) {
      form.append("media", media.file);
      if (media.poster) form.append("poster", new File([media.poster], "portada.jpg", { type: "image/jpeg" }));
      if (media.seconds !== null) form.append("duration", media.seconds.toFixed(2));
    }
    setError(null);
    setDone(null);
    setProgress(0);
    try {
      await xhrJson("POST", url("/estados"), form, setProgress);
      setMedia(null);
      setText("");
      setDone(`Publicamos tu estado. Lo verán durante ${limits.lifetime_hours} horas.`);
      router.reload({ only: ["stories"] });
    } catch (failure) {
      setError(failure instanceof HttpError ? failure.firstError() : "No pudimos publicar el estado. Inténtalo de nuevo.");
    } finally {
      setProgress(null);
    }
  };

  const accept = kind === "image" ? [...IMAGE_MIMES, ...limits.image_types.map((type) => `.${type}`)] : [...VIDEO_MIMES, ...limits.video_types.map((type) => `.${type}`)];
  const preview =
    kind === "text"
      ? { kind, media_url: null, poster_url: null, text: text.trim() || "Escribe tu mensaje", background }
      : media && { kind, media_url: media.url, poster_url: media.posterUrl, text: text.trim() || null, background: null };

  return (
    <form onSubmit={submit} className="grid gap-6 rounded-2xl border border-line bg-surface p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <Tabs<StoryKind>
          value={kind}
          onChange={switchKind}
          items={[
            { value: "image", label: <><ImageIcon className="size-4" /> Foto</> },
            { value: "video", label: <><Clapperboard className="size-4" /> Video</> },
            { value: "text", label: <><Type className="size-4" /> Texto</> },
          ]}
        />

        {kind === "text" ? (
          <>
            <Field label="Mensaje" hint={`${text.length}/${limits.max_text}`}>
              {(id) => (
                <Textarea id={id} value={text} maxLength={limits.max_text} onChange={(event) => setText(event.target.value)} placeholder="Hoy a las 8 pm, entrevista en vivo con…" className="min-h-32" />
              )}
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink">Fondo</legend>
              <div className="flex flex-wrap gap-2">
                {limits.backgrounds.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBackground(option.value)}
                    aria-pressed={background === option.value}
                    aria-label={option.label}
                    title={option.label}
                    className={cn("size-10 rounded-full ring-2 ring-offset-2 ring-offset-surface transition", background === option.value ? "ring-ink" : "ring-transparent hover:ring-line-strong")}
                    style={{ background: storyBackgrounds[option.value] }}
                  />
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <>
            {media ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{media.file.name}</span>
                  <span className="text-xs text-muted tabular">
                    {bytes(media.file.size)}
                    {media.seconds !== null && ` · ${duration(media.seconds)}`}
                  </span>
                </span>
                <Button variant="ghost" size="sm" icon={<X className="size-4" />} onClick={() => setMedia(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
                  dragging ? "border-signal bg-signal-soft" : "border-line-strong hover:border-ink hover:bg-raised",
                )}
              >
                <UploadCloud className={cn("size-8", dragging ? "text-signal" : "text-muted")} aria-hidden />
                <span className="text-sm font-semibold text-ink">{reading ? "Leyendo el archivo…" : kind === "image" ? "Arrastra una foto o elígela" : "Arrastra un video o elígelo"}</span>
                <span className="text-xs text-muted">
                  {kind === "image"
                    ? `JPG, PNG o WEBP · hasta ${limits.max_image_mb} MB · se ve 6 segundos`
                    : `MP4, WEBM o MOV · hasta ${limits.max_video_mb} MB y ${limits.max_video_seconds} segundos`}
                </span>
                <span className="text-xs text-faint">Formato vertical (9:16) para ocupar toda la pantalla.</span>
                <input ref={input} type="file" accept={accept.join(",")} className="sr-only" onChange={(event) => void choose(event.target.files?.[0])} disabled={reading} />
              </label>
            )}
            <Field label="Texto (opcional)" hint={`${text.length}/${limits.max_text}`}>
              {(id) => <Textarea id={id} value={text} maxLength={limits.max_text} onChange={(event) => setText(event.target.value)} placeholder="Escribe un texto para acompañar…" />}
            </Field>
          </>
        )}

        {error && (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="rounded-xl bg-onair-soft px-4 py-3 text-sm text-onair" role="status">
            {done}
          </p>
        )}
        {progress !== null && (
          <div className="space-y-1.5">
            <ProgressBar value={progress} />
            <p className="text-xs text-muted tabular">{progress < 1 ? `Subiendo… ${Math.round(progress * 100)} %` : "Publicando…"}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="signal" icon={<Send className="size-4" />} loading={progress !== null} disabled={!ready || full}>
            Publicar estado
          </Button>
          <p className="text-xs text-muted">
            {full ? `Llegaste al máximo de ${limits.max_active} estados activos.` : `Desaparece a las ${limits.lifetime_hours} horas.`}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[260px]">
        <div className="rounded-[2.25rem] border-[6px] border-raised bg-black shadow-2xl ring-1 ring-line">
          {preview ? (
            <StoryStage story={preview} loop className="rounded-[1.85rem]" />
          ) : (
            <div className="flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-[1.85rem] bg-canvas px-6 text-center text-xs text-muted">
              {kind === "image" ? <ImageIcon className="size-6 text-faint" /> : <Clapperboard className="size-6 text-faint" />}
              Aquí verás tu estado como lo verán tus oyentes.
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-faint">Vista previa</p>
      </div>
    </form>
  );
}
