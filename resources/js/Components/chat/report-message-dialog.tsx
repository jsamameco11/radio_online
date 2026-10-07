import { CheckCircle2, Flag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Select, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { HttpError, http } from "@/lib/http";
import type { ChatMessage } from "@/types/chat";
import type { Option } from "@/types/site";

/** Report a chat message to the moderation team. */
export function ReportMessageDialog({ url, message, reasons, onClose }: { url: string; message: ChatMessage; reasons: Option[]; onClose: () => void }) {
  const [reason, setReason] = useState(reasons[0]?.value ?? "");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);

  const submit = async () => {
    setSending(true);
    setErrors({});
    try {
      const result = await http.post<{ message: string }>(url, { reason, details: details.trim() || null });
      setDone(result.message);
    } catch (failure) {
      if (failure instanceof HttpError && failure.body.errors) {
        setErrors(Object.fromEntries(Object.entries(failure.body.errors).map(([field, messages]) => [field, messages[0]])));
      } else {
        setErrors({ reason: failure instanceof HttpError ? failure.firstError() : "Se perdió la conexión. Inténtalo otra vez." });
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Reportar mensaje"
      description={`De ${message.user?.name ?? "un oyente"}: “${message.body.length > 80 ? `${message.body.slice(0, 80)}…` : message.body}”`}
      footer={
        done ? (
          <Button onClick={onClose}>Cerrar</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={submit} loading={sending} icon={<Flag className="size-4" />}>
              Reportar
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className="flex items-start gap-2 text-sm text-onair">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {done}
        </p>
      ) : (
        <div className="space-y-4">
          <Field label="Motivo" error={errors.reason}>
            {(id, invalid) => (
              <Select id={id} invalid={invalid} value={reason} onChange={(event) => setReason(event.target.value)}>
                {reasons.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Detalle (opcional)" error={errors.details}>
            {(id, invalid) => <Textarea id={id} invalid={invalid} rows={3} maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Cuéntanos qué ocurre." />}
          </Field>
        </div>
      )}
    </Modal>
  );
}
