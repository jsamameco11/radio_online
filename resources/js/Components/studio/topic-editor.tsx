import { router, useForm, usePage } from "@inertiajs/react";
import { Hash, Pencil, Square } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { fieldError } from "@/Components/forms/field-error";
import { HashtagInput } from "@/Components/forms/hashtag-input";
import { Button } from "@/Components/ui/button";
import { Field, Input } from "@/Components/ui/field";
import { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { ago } from "@/lib/format";
import { realtime } from "@/lib/realtime";
import type { SharedProps } from "@/types";

interface TopicEditorProps {
  /** Temporary hashtags allowed per topic (config platform.stations.max_topic_hashtags). */
  maxHashtags?: number;
  /** Hashtags offered with one click, usually the station's permanent ones. */
  suggestions?: string[];
  className?: string;
}

/**
 * "¿Qué está pasando ahora?": shows the current topic of the open studio and
 * lets the team publish a new one, edit it or end it. Compact enough for the
 * live console; stays in sync with other team members through "studio.{id}".
 */
export function TopicEditor({ maxHashtags = 5, suggestions = [], className }: TopicEditorProps) {
  const { studio } = usePage<SharedProps>().props;
  const url = useStudioUrl();
  const canOperate = useStudioCan()("console.operate");
  const topic = studio?.station.current_topic ?? null;
  const stationId = studio?.station.id;
  const [mode, setMode] = useState<"view" | "new" | "edit">(topic ? "view" : "new");
  const form = useForm<{ title: string; hashtags: string[] }>({ title: "", hashtags: [] });

  useEffect(() => {
    const echo = realtime();
    if (!echo || !stationId) return;
    const name = `studio.${stationId}`;
    echo.private(name).listen(".CurrentTopicChanged", () => router.reload({ only: ["studio"] }));
    return () => {
      echo.private(name).stopListening(".CurrentTopicChanged");
    };
  }, [stationId]);

  useEffect(() => {
    if (!topic && mode === "view") setMode("new");
  }, [topic, mode]);

  const start = (next: "new" | "edit") => {
    form.clearErrors();
    form.setData(next === "edit" && topic ? { title: topic.title, hashtags: topic.hashtags } : { title: "", hashtags: [] });
    setMode(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const options = {
      preserveScroll: true,
      onSuccess: () => {
        form.reset();
        setMode("view");
      },
    };
    if (mode === "edit") form.put(url("/tema"), options);
    else form.post(url("/tema"), options);
  };

  const end = () => router.delete(url("/tema"), { preserveScroll: true });

  if (!studio) return null;

  return (
    <section className={cn("space-y-3 rounded-2xl border border-line bg-surface p-4", className)}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Hash className="size-4 text-signal" />
          ¿Qué está pasando ahora?
        </h2>
        {topic && <span className="text-xs text-muted">Desde {ago(topic.started_at)}</span>}
      </header>

      {mode === "view" && topic ? (
        <div className="space-y-3">
          <p className="text-base font-medium text-ink">{topic.title}</p>
          {topic.hashtags.length > 0 && (
            <p className="flex flex-wrap gap-1.5">
              {topic.hashtags.map((tag) => (
                <span key={tag} className="rounded-full bg-signal-soft px-2.5 py-0.5 text-xs font-medium text-signal">
                  #{tag}
                </span>
              ))}
            </p>
          )}
          {canOperate && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => start("new")}>
                Nuevo tema
              </Button>
              <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => start("edit")}>
                Editar
              </Button>
              <Button size="sm" variant="ghost" icon={<Square className="size-3.5" />} onClick={end}>
                Terminar
              </Button>
            </div>
          )}
        </div>
      ) : canOperate ? (
        <form onSubmit={submit} className="space-y-3">
          <Field error={fieldError(form.errors, "title")}>
            {(id, invalid) => (
              <Input id={id} invalid={invalid} maxLength={160} value={form.data.title} onChange={(event) => form.setData("title", event.target.value)} placeholder="Ej.: Entrevista con la banda Los Andes" />
            )}
          </Field>
          <Field error={fieldError(form.errors, "hashtags")}>
            {(id, invalid) => (
              <HashtagInput id={id} invalid={invalid} value={form.data.hashtags} onChange={(hashtags) => form.setData("hashtags", hashtags)} max={maxHashtags} maxLength={40} suggestions={suggestions} placeholder="Hashtags del tema" />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            {topic && (
              <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
                Cancelar
              </Button>
            )}
            <Button size="sm" type="submit" loading={form.processing} disabled={form.data.title.trim().length < 3}>
              {mode === "edit" ? "Guardar" : "Publicar tema"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted">Tu radio no tiene un tema en curso.</p>
      )}
    </section>
  );
}
