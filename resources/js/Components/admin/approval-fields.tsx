import { fieldError } from "@/Components/forms/field-error";
import { Field, Select, Textarea } from "@/Components/ui/field";
import type { FreeFrequency } from "@/types/admin";

/** Included in the approval email. The reviewer can edit it before sending. */
export const DEFAULT_APPROVAL_NOTE =
  "¡Felicitaciones! Has obtenido tu frecuencia en vivo. Utilízala con responsabilidad y profesionalismo. Da lo mejor de ti para hacer crecer tu frecuencia y comenzar a monetizar. Te deseamos el mayor de los éxitos. Recuerda respetar en todo momento la política de restricción de palabras en tu emisión, tus mensajes y tu contenido.";

export function approvalDefaults(requested: string, conflict: boolean, free: FreeFrequency[]): { frequency: string; note: string } {
  return { frequency: defaultFrequency(requested, conflict, free), note: DEFAULT_APPROVAL_NOTE };
}

function defaultFrequency(requested: string, conflict: boolean, free: FreeFrequency[]): string {
  if (!conflict && free.some((item) => item.label === requested)) return requested;
  if (free.length === 0) return "";

  const target = Number(requested);

  return free.reduce((closest, item) => (Math.abs(Number(item.label) - target) < Math.abs(Number(closest.label) - target) ? item : closest)).label;
}

interface ApprovalFieldsProps {
  requestedLabel: string;
  requestedDisplay: string;
  conflict: boolean;
  free: FreeFrequency[];
  frequency: string;
  note: string;
  errors: object;
  onFrequency: (value: string) => void;
  onNote: (value: string) => void;
}

/** Frequency to assign and the note that goes out with the approval. */
export function ApprovalFields({ requestedLabel, requestedDisplay, conflict, free, frequency, note, errors, onFrequency, onNote }: ApprovalFieldsProps) {
  const chosen = free.find((item) => item.label === frequency);

  return (
    <>
      <Field
        label="Frecuencia"
        hint={
          free.length === 0
            ? "No hay frecuencias libres para asignar."
            : conflict
              ? `${requestedDisplay} ya no está libre. Elige otra.`
              : frequency === requestedLabel
                ? "Es la frecuencia solicitada. Puedes asignar otra libre."
                : `Asignarás ${chosen?.display ?? frequency} en lugar de ${requestedDisplay}.`
        }
        error={fieldError(errors, "frequency", "request", "user")}
      >
        {(id, invalid) => (
          <Select id={id} invalid={invalid} value={frequency} onChange={(event) => onFrequency(event.target.value)} disabled={free.length === 0} className="tabular">
            {free.length === 0 && <option value="">Sin frecuencias libres</option>}
            {free.map((item) => (
              <option key={item.label} value={item.label}>
                {item.display}
                {item.label === requestedLabel ? " · solicitada" : ""}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Nota" hint="Se incluye en el correo de aprobación. Puedes editarla." error={fieldError(errors, "note")}>
        {(id, invalid) => <Textarea id={id} invalid={invalid} rows={6} maxLength={500} value={note} onChange={(event) => onNote(event.target.value)} />}
      </Field>
    </>
  );
}
