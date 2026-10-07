import { useState, type FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { bytes, duration } from "@/lib/format";
import { http, HttpError } from "@/lib/http";
import type { CaptureBrief, Option, TrackKind } from "@/types/studio";

/** When the transmission ends: keep its recording as a library audio (and, optionally, an episode) or discard it. */
export function CaptureDialog({
  base,
  recording,
  kinds,
  canEpisodes,
  title: suggested,
  onClose,
  onDone,
}: {
  base: string;
  recording: CaptureBrief;
  kinds: Option<TrackKind>[];
  canEpisodes: boolean;
  title: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [title, setTitle] = useState(suggested || "Transmisión en vivo");
  const [kind, setKind] = useState<TrackKind>("program");
  const [episode, setEpisode] = useState(false);
  const [program, setProgram] = useState(suggested);
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setProblem(null);
    try {
      const data = await http.post<{ message: string }>(`${base}/grabacion/${recording.id}/guardar`, { title, kind, episode, program: episode ? program : null, description: episode ? description : null });
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
            Guardar
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
            <Switch checked={episode} onChange={setEpisode} label="Crear también un episodio" description="Queda como borrador para que lo completes y publiques en Episodios." />
            {episode ? (
              <>
                <Field label="Programa (opcional)" error={errors.program}>
                  {(id, invalid) => <Input id={id} invalid={invalid} value={program} maxLength={120} onChange={(event) => setProgram(event.target.value)} />}
                </Field>
                <Field label="Descripción (opcional)" error={errors.description}>
                  {(id, invalid) => <Textarea id={id} invalid={invalid} value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} />}
                </Field>
              </>
            ) : null}
          </>
        ) : null}
        {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      </form>
    </Modal>
  );
}
