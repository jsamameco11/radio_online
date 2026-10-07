import { History } from "lucide-react";
import { EmptyState } from "@/Components/ui/empty-state";
import { ago, dateTime } from "@/lib/format";
import type { AuditEntry } from "@/types/admin";

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Inició sesión",
  "user.suspended": "Suspendió una cuenta",
  "user.reactivated": "Reactivó una cuenta",
  "user.role_changed": "Cambió el rol de una cuenta",
  "user.sessions_closed": "Cerró sus otras sesiones",
  "user.email_changed": "Cambió su correo",
  "dial.expanded": "Amplió el dial",
  "frequency.reserved": "Reservó una frecuencia",
  "frequency.released": "Liberó una frecuencia",
  "frequency.assigned": "Asignó una frecuencia",
  "frequency.maintenance_started": "Puso una frecuencia en mantenimiento",
  "frequency.maintenance_ended": "Sacó una frecuencia de mantenimiento",
  "frequency_request.submitted": "Envió una solicitud de frecuencia",
  "frequency_request.approved": "Aprobó una solicitud de frecuencia",
  "frequency_request.rejected": "Rechazó una solicitud de frecuencia",
  "frequency_request.cancelled": "Retiró una solicitud de frecuencia",
  "station.updated": "Editó los datos de una radio",
  "station.profile_updated": "Editó el perfil de una radio",
  "station.image_updated": "Cambió una imagen de la radio",
  "station.image_removed": "Quitó una imagen de la radio",
  "station.suspended": "Suspendió una radio",
  "station.reactivated": "Reactivó una radio",
  "station.frequency_changed": "Mudó una radio de frecuencia",
  "station.member_added": "Sumó a alguien al equipo",
  "station.member_removed": "Quitó a alguien del equipo",
  "station.member_role_changed": "Cambió un rol del equipo",
  "station.ownership_transferred": "Transfirió la propiedad de una radio",
  "station.closed": "Cerró una radio",
  "station.settings_updated": "Cambió la configuración de una radio",
  "topic.started": "Publicó un tema",
  "topic.updated": "Editó el tema actual",
  "topic.ended": "Terminó un tema",
  "category.created": "Creó una categoría",
  "category.updated": "Editó una categoría",
  "category.deleted": "Eliminó una categoría",
  "report.submitted": "Reportó contenido",
  "report.resolved": "Resolvió un reporte",
  "report.dismissed": "Descartó un reporte",
  "gift_message.hidden": "Ocultó un mensaje de regalo",
  "gift_message.restored": "Volvió a mostrar un mensaje de regalo",
  "gift_message.reported": "Reportó un mensaje de regalo",
  "platform.settings_updated": "Cambió la configuración de la plataforma",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Compact timeline of audited actions. */
export function AuditList({ entries, showStation = true }: { entries: AuditEntry[]; showStation?: boolean }) {
  if (entries.length === 0) {
    return <EmptyState icon={<History className="size-6" />} title="Sin actividad registrada" />;
  }

  return (
    <ol className="divide-y divide-line">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm text-ink">
              <span className="font-medium">{entry.actor?.name ?? "Sistema"}</span> · {actionLabel(entry.action)}
            </p>
            <p className="truncate text-xs text-muted">
              <code className="text-faint">{entry.action}</code>
              {showStation && entry.station && (
                <>
                  {" · "}
                  <span className="tabular">{entry.station.frequency}</span> {entry.station.name}
                </>
              )}
            </p>
          </div>
          <time dateTime={entry.created_at} title={dateTime(entry.created_at)} className="shrink-0 text-xs text-muted">
            {ago(entry.created_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
