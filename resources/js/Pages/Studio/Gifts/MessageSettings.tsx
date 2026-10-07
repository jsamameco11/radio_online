import { useForm } from "@inertiajs/react";
import { X } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input, Switch } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { duration } from "@/lib/format";

interface Props {
  settings: { accept_text: boolean; accept_voice: boolean; auto_hide_filtered: boolean; blocked_words: string[] };
  limits: { max_message_length: number; max_voice_seconds: number; max_blocked_words: number };
}

export default function MessageSettings({ settings, limits }: Props) {
  const url = useStudioUrl();
  const canEdit = useStudioCan()("station.settings");
  const form = useForm(settings);
  const [word, setWord] = useState("");

  const addWords = () => {
    const incoming = word
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item !== "" && !form.data.blocked_words.includes(item));
    if (incoming.length > 0) form.setData("blocked_words", [...form.data.blocked_words, ...new Set(incoming)].slice(0, limits.max_blocked_words));
    setWord("");
  };

  const onWordKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addWords();
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/mensajes"), { preserveScroll: true });
  };

  const wordErrors = Object.entries(form.errors)
    .filter(([key]) => key.startsWith("blocked_words"))
    .map(([, message]) => message);

  return (
    <StudioLayout title="Configuración de mensajes">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <PageHeader
          eyebrow="Configuración"
          title="Mensajes de los oyentes"
          description="Elige qué mensajes pueden acompañar a un regalo y qué palabras no quieres recibir."
        />

        <Panel title="Qué pueden enviar">
          <div className="space-y-5">
            <Switch
              checked={form.data.accept_text}
              onChange={(value) => form.setData("accept_text", value)}
              disabled={!canEdit}
              label="Mensajes de texto"
              description={`Hasta ${limits.max_message_length} caracteres por regalo.`}
            />
            <Switch
              checked={form.data.accept_voice}
              onChange={(value) => form.setData("accept_voice", value)}
              disabled={!canEdit}
              label="Mensajes de voz"
              description={`Notas de hasta ${duration(limits.max_voice_seconds)} que escuchas en la consola con “Escuchar mensaje”.`}
            />
          </div>
        </Panel>

        <Panel
          title="Palabras bloqueadas"
          description="Se reemplazan por asteriscos en los mensajes de texto. No distingue mayúsculas ni tildes."
          footer={
            <div className="flex justify-end">
              <Button type="submit" loading={form.processing} disabled={!canEdit || !form.isDirty}>
                Guardar cambios
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <Field
              label="Agregar palabras"
              hint={`Separa varias con comas. ${form.data.blocked_words.length} de ${limits.max_blocked_words}.`}
              error={wordErrors[0]}
            >
              {(id, invalid) => (
                <div className="flex gap-2">
                  <Input
                    id={id}
                    invalid={invalid}
                    maxLength={40}
                    value={word}
                    onChange={(event) => setWord(event.target.value)}
                    onKeyDown={onWordKey}
                    disabled={!canEdit}
                    placeholder="spam, insulto…"
                  />
                  <Button variant="secondary" onClick={addWords} disabled={!canEdit || word.trim() === ""}>
                    Agregar
                  </Button>
                </div>
              )}
            </Field>

            {form.data.blocked_words.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {form.data.blocked_words.map((item) => (
                  <li key={item} className="inline-flex items-center gap-1 rounded-full bg-raised py-1 pr-1 pl-3 text-sm ring-1 ring-line">
                    {item}
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => form.setData("blocked_words", form.data.blocked_words.filter((candidate) => candidate !== item))}
                      className="rounded-full p-1 text-muted hover:bg-surface hover:text-ink"
                      aria-label={`Quitar ${item}`}
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Switch
              checked={form.data.auto_hide_filtered}
              onChange={(value) => form.setData("auto_hide_filtered", value)}
              disabled={!canEdit}
              label="Ocultar automáticamente los mensajes filtrados"
              description="Si un mensaje contiene una palabra bloqueada, llega directo a “Ocultos” en lugar de tu bandeja."
            />
          </div>
        </Panel>
      </form>
    </StudioLayout>
  );
}
