import { ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { cn } from "@/lib/cn";
import { bytes, duration } from "@/lib/format";
import { http, HttpError } from "@/lib/http";
import type { CaptureBrief, ConsoleLimits, Option, TrackKind } from "@/types/studio";

/**
 * When the transmission ends: keep its recording as a library audio (and, optionally, an episode
 * with its cover, left as a draft or published at once) or discard it.
 */
export function CaptureDialog({
  base,
  recording,
  kinds,
  canEpisodes,
  title: suggested,
  limits,
  onClose,
  onDone,
}: {
  base: string;
  recording: CaptureBrief;
  kinds: Option<TrackKind>[];
  canEpisodes: boolean;
  title: string;
  limits: ConsoleLimits;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [title, setTitle] = useState(suggested || "Transmisión en vivo");
  const [kind, setKind] = useState<TrackKind>("program");
  const [episode, setEpisode] = useState(false);
  const [program, setProgram] = useState(suggested);
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [publish, setPublish] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const preview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setProblem(null);
    const body = new FormData();
    body.set("title", title);
    body.set("kind", kind);
    body.set("episode", episode ? "1" : "0");
    if (episode) {
      body.set("program", program);
      body.set("description", description);
      body.set("publish", publish ? "1" : "0");
      if (cover) body.set("cover", cover);
    }
    try {
      const data = await http.post<{ message: string }>(`${base}/grabacion/${recording.id}/guardar`, body);
      onDone(data.message);
    } catch (error) {
      if (error instanceof HttpError && error.body.errors) setErrors(Object.fromEntries(Object.entries(error.body.errors).map(([key, messages]) => [key, messages[0]])));
      else setProblem(error instanceof HttpError ? error.firstError() : "No pudimos guardar la grabación. Inténtalo de nuevo.");
    }
    setBusy(false);
  }

  async function discard() {
    if (!window.confirm("¿Descartar la grabación? El audio se borra y no se puede recuperar.")) return;
    setBusy(true);
    try {
      const data = await http.delete<{ message: string }>(`${base}/grabacion/${recording.id}`);
      onDone(data.message);
    } catch (error) {
      setProblem(error instanceof HttpError ? error.firstError() : "No pudimos descartar la grabación.");
    }
    setBusy(false);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Guardar la transmisión"
      description={`Grabación de ${duration(recording.duration ?? 0)} (${bytes(recording.bytes)}). Guárdala en la biblioteca para programarla o publicarla. También la encuentras luego en Grabaciones.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => void discard()} disabled={busy} className="mr-auto">
            Descartar
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Más tarde
          </Button>
          <Button type="submit" form="capture-save" loading={busy}>
            {episode && publish ? "Guardar y publicar" : "Guardar"}
          </Button>
        </>
      }
    >
      <form id="capture-save" onSubmit={(event) => void save(event)} className="space-y-4">
        <Field label="Nombre" error={errors.title}>
          {(id, invalid) => <Input id={id} invalid={invalid} value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} required />}
        </Field>
        <Field label="Tipo" error={errors.kind}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={kind} onChange={(event) => setKind(event.target.value as TrackKind)}>
              {kinds.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {canEpisodes ? (
          <>
            <Switch checked={episode} onChange={setEpisode} label="Crear también un episodio" description="Los oyentes lo escuchan cuando quieran desde la página de la radio." />
            {episode ? (
              <>
                <Field label="Programa (opcional)" error={errors.program}>
                  {(id, invalid) => <Input id={id} invalid={invalid} value={program} maxLength={120} onChange={(event) => setProgram(event.target.value)} />}
                </Field>
                <Field label="Descripción (opcional)" error={errors.description} hint={`${description.length}/${limits.description}`}>
                  {(id, invalid) => <Textarea id={id} invalid={invalid} value={description} maxLength={limits.description} onChange={(event) => setDescription(event.target.value)} />}
                </Field>
                <Field label="Portada (opcional)" error={errors.cover} hint={`JPG, PNG o WEBP de hasta ${limits.cover_mb} MB. Sin portada se usa la de la radio.`}>
                  {(id) => (
                    <div className="flex items-center gap-3">
                      <span className={cn("flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-raised", !preview && "text-faint")}>
                        {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5" />}
                      </span>
                      <label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-raised">
                        {cover ? "Cambiar imagen" : "Elegir imagen"}
                      </label>
                      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setCover(event.target.files?.[0] ?? null)} />
                      {cover ? (
                        <Button size="icon" variant="ghost" onClick={() => setCover(null)} aria-label="Quitar la portada">
                          <X className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  )}
                </Field>
                <Switch checked={publish} onChange={setPublish} label="Publicar en Episodios" description={publish ? "Se publica al guardar: los oyentes pueden escucharlo enseguida." : "Queda como borrador para que lo completes y publiques en Episodios."} />
              </>
            ) : null}
          </>
        ) : null}
        {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      </form>
    </Modal>
  );
}
