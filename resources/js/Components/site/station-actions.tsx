import { router, useForm } from "@inertiajs/react";
import { Check, Flag, Heart, Link2, Share2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Select, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import type { Station } from "@/types";
import type { Option } from "@/types/site";

export function FollowButton({ station, following }: { station: Station; following: boolean }) {
  const [busy, setBusy] = useState(false);
  const url = `/radio/${station.frequency.slug}/seguir`;
  const options = { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => setBusy(false) };

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      loading={busy}
      onClick={() => (following ? router.delete(url, options) : router.post(url, {}, options))}
      icon={following ? <Check className="size-4" /> : <Heart className="size-4" />}
      aria-pressed={following}
    >
      {following ? "Siguiendo" : "Seguir"}
    </Button>
  );
}

/** Native share sheet when the device has one; otherwise copies the link. */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Escucha ${title} en Tu Radio Online`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Button variant="secondary" onClick={() => void share()} icon={copied ? <Link2 className="size-4 text-onair" /> : <Share2 className="size-4" />}>
      {copied ? "Enlace copiado" : "Compartir"}
    </Button>
  );
}

/** Flags the station (or one of its episodes, with `url`) for the moderation team. */
export function ReportButton({ url, reasons, subject }: { url: string; reasons: Option[]; subject: string }) {
  const [open, setOpen] = useState(false);
  const form = useForm({ reason: "", details: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url, {
      preserveScroll: true,
      onSuccess: () => {
        form.reset();
        setOpen(false);
      },
    });
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} icon={<Flag className="size-4" />}>
        Reportar
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Reportar ${subject}`}
        description="Tu reporte es confidencial. El equipo de moderación lo revisará."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="report-form" variant="danger" loading={form.processing}>
              Enviar reporte
            </Button>
          </>
        }
      >
        <form id="report-form" onSubmit={submit} className="space-y-4">
          <Field label="Motivo" error={form.errors.reason}>
            {(id, invalid) => (
              <Select id={id} invalid={invalid} value={form.data.reason} onChange={(event) => form.setData("reason", event.target.value)} required>
                <option value="" disabled>
                  Elige un motivo
                </option>
                {reasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Detalles" hint="Opcional, salvo que elijas «Otro motivo». Máximo 1000 caracteres." error={form.errors.details}>
            {(id, invalid) => (
              <Textarea id={id} invalid={invalid} maxLength={1000} value={form.data.details} onChange={(event) => form.setData("details", event.target.value)} />
            )}
          </Field>
        </form>
      </Modal>
    </>
  );
}
