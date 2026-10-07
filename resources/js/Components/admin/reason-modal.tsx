import { useForm } from "@inertiajs/react";
import type { FormEvent, ReactNode } from "react";
import { useId } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";

interface ReasonModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  url: string;
  /** Name of the text field the backend validates ("reason" or "note"). */
  field?: "reason" | "note";
  label?: string;
  required?: boolean;
  confirmLabel: string;
  variant?: "primary" | "danger";
  extra?: Record<string, string>;
}

/** Confirms a staff action that needs a written reason (suspend, reject, resolve). */
export function ReasonModal({ open, onClose, title, description, url, field = "reason", label = "Motivo", required = true, confirmLabel, variant = "danger", extra = {} }: ReasonModalProps) {
  const formId = useId();
  const form = useForm<Record<string, string>>({ [field]: "", ...extra });

  const close = () => {
    form.reset();
    form.clearErrors();
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url, { preserveScroll: true, onSuccess: close });
  };

  const firstOther = Object.entries(form.errors).find(([key]) => key !== field)?.[1];

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} variant={variant} loading={form.processing} disabled={required && form.data[field].trim().length < 5}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-3">
        <Field label={label} hint={required ? "Al menos 5 caracteres. Queda en la auditoría." : "Opcional. Queda en la auditoría."} error={form.errors[field]}>
          {(id, invalid) => (
            <Textarea id={id} invalid={invalid} rows={4} maxLength={500} value={form.data[field]} onChange={(event) => form.setData(field, event.target.value)} autoFocus />
          )}
        </Field>
        {firstOther && (
          <p className="text-sm text-danger" role="alert">
            {firstOther}
          </p>
        )}
      </form>
    </Modal>
  );
}
