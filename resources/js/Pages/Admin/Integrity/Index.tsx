import { Link, router } from "@inertiajs/react";
import { Ban, Bot, Check, Clock, Eye, Fingerprint, ShieldCheck, UserX, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ReasonModal } from "@/Components/admin/reason-modal";
import { PageErrors } from "@/Components/forms/page-errors";
import { Badge, type Tone } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel, Stat } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, count, dateTime } from "@/lib/format";
import { http, HttpError } from "@/lib/http";
import type { Paginated } from "@/types";
import type { IntegrityAccount, IntegrityAlertRow, IntegrityAlertStatus } from "@/types/admin";

interface Props {
  alerts: Paginated<IntegrityAlertRow>;
  tab: IntegrityAlertStatus;
  counts: Record<IntegrityAlertStatus, number>;
  stats: { pending_follows: number; discarded_follows: number; flagged_accounts: number; blocked_today: number };
  rules: { account_hours: number; listen_seconds: number; guests_per_network: number; warmup_seconds: number; follows_per_hour: number; follows_per_day: number };
  canFlag: boolean;
}

type Pending = { alert: IntegrityAlertRow; outcome: "purged" | "dismissed" };

const severityTones: Record<IntegrityAlertRow["severity"]["value"], Tone> = { high: "danger", medium: "warning", low: "neutral" };

const followTones: Record<NonNullable<IntegrityAccount["follow"]>["value"], Tone> = { counted: "signal", pending: "warning", discarded: "neutral" };

export default function IntegrityIndex({ alerts, tab, counts, stats, rules, canFlag }: Props) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [inspecting, setInspecting] = useState<IntegrityAlertRow | null>(null);

  return (
    <AdminLayout title="Integridad">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Comunidad"
          title="Integridad de la audiencia"
          description="Protegemos los suscriptores y los oyentes de cada radio de granjas de cuentas y enjambres de bots. Las cifras falsas no cuentan para la monetización, el dial ni la venta de canales."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Alertas abiertas" value={count(counts.open)} icon={<ShieldCheck className="size-4" />} hint="Revisadas cada 15 minutos" />
          <Stat label="Suscripciones en verificación" value={count(stats.pending_follows)} icon={<Clock className="size-4" />} hint="Cuentan cuando la cuenta lo merezca" />
          <Stat label="Cuentas marcadas" value={count(stats.flagged_accounts)} icon={<UserX className="size-4" />} hint={`${count(stats.discarded_follows)} suscripciones descartadas`} />
          <Stat label="Reproductores bloqueados hoy" value={count(stats.blocked_today)} icon={<Bot className="size-4" />} hint="No suman audiencia" />
        </div>

        <Panel title="Cómo se protegen las cifras" description="Se aplica sola, en tiempo real, a todas las radios.">
          <ul className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <Rule icon={<Users className="size-4" />} title="Suscriptores reales">
              Una suscripción cuenta cuando la cuenta tiene más de {rules.account_hours} h y escuchó al menos {Math.round(rules.listen_seconds / 60)} min en la plataforma. Antes queda en verificación.
            </Rule>
            <Rule icon={<Fingerprint className="size-4" />} title="Un oyente, un voto">
              Cada cuenta cuenta una vez aunque abra muchas pestañas; sin cuenta cuentan hasta {rules.guests_per_network} reproductores por red.
            </Rule>
            <Rule icon={<Clock className="size-4" />} title="Escucha sostenida">
              Un reproductor suma a la audiencia después de {rules.warmup_seconds} s sonando y mientras siga enviando señal.
            </Rule>
            <Rule icon={<Ban className="size-4" />} title="Sin automatización">
              Scripts y navegadores sin pantalla no cuentan. Una cuenta se suscribe a {rules.follows_per_hour} radios por hora y {rules.follows_per_day} por día como máximo.
            </Rule>
          </ul>
        </Panel>

        <Tabs
          value={tab}
          onChange={(value) => router.get("/admin/integridad", value === "open" ? {} : { tab: value }, { preserveState: true, replace: true })}
          items={[
            { value: "open", label: "Abiertas", count: counts.open },
            { value: "purged", label: "Depuradas", count: counts.purged },
            { value: "dismissed", label: "Descartadas", count: counts.dismissed },
          ]}
        />

        {!pending && <PageErrors />}

        {alerts.data.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="size-6" />}
            title={tab === "open" ? "Sin señales de bots" : "Nada por aquí"}
            description={tab === "open" ? "Ninguna radio muestra patrones de granjas de cuentas ni enjambres de reproductores." : undefined}
          />
        ) : (
          <div className="space-y-3">
            {alerts.data.map((alert) => (
              <AlertCard key={alert.id} alert={alert} canFlag={canFlag} onInspect={() => setInspecting(alert)} onResolve={(outcome) => setPending({ alert, outcome })} />
            ))}
            <Pagination page={alerts} />
          </div>
        )}
      </div>

      {inspecting && <AccountsModal alert={inspecting} onClose={() => setInspecting(null)} />}

      {pending && (
        <ReasonModal
          key={`${pending.alert.id}-${pending.outcome}`}
          open
          onClose={() => setPending(null)}
          title={pending.outcome === "purged" ? `Depurar: ${pending.alert.kind.label}` : pending.alert.purgeable ? "Descartar alerta" : "Marcar como revisada"}
          description={purgeDescription(pending)}
          url={`/admin/integridad/${pending.alert.id}/resolver`}
          field="note"
          label="Nota interna"
          required={false}
          variant={pending.outcome === "purged" ? "danger" : "primary"}
          confirmLabel={pending.outcome === "purged" ? "Depurar" : pending.alert.purgeable ? "Descartar" : "Marcar como revisada"}
          extra={{ outcome: pending.outcome }}
        />
      )}
    </AdminLayout>
  );
}

function purgeDescription({ alert, outcome }: Pending): string {
  if (outcome === "dismissed") return alert.purgeable ? "Usa descartar cuando el crecimiento es legítimo (una campaña, una mención en medios). No se toca ninguna cifra." : "Estos reproductores ya están fuera de todas las cifras.";
  if (alert.concerns_accounts) {
    return `Marcaremos ${count(alert.accounts)} cuentas como granja de bots: todas sus suscripciones, en cualquier radio, dejan de contar y su escucha sale de las estadísticas. Podrán seguir escuchando. El personal no se marca.`;
  }
  return "Las reproducciones de estas redes en el periodo de la alerta salen de las estadísticas de la radio.";
}

function Rule({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-signal-soft text-signal">{icon}</span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}

function AlertCard({ alert, canFlag, onInspect, onResolve }: { alert: IntegrityAlertRow; canFlag: boolean; onInspect: () => void; onResolve: (outcome: Pending["outcome"]) => void }) {
  const open = alert.status.value === "open";
  const canPurge = alert.purgeable && (!alert.concerns_accounts || canFlag);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={severityTones[alert.severity.value]}>Riesgo {alert.severity.label.toLowerCase()}</Badge>
            <span className="font-medium text-ink">{alert.kind.label}</span>
            <span className="text-xs text-muted">
              {open ? `Detectada ${ago(alert.detected_at)} · vista ${ago(alert.last_detected_at)}` : `${alert.status.label} por ${alert.resolver ?? "—"} ${alert.resolved_at ? ago(alert.resolved_at) : ""}`}
            </span>
          </div>
          {alert.station && (
            <p className="text-sm text-muted">
              <Link href={`/admin/radios/${alert.station.id}`} className="font-medium text-ink hover:underline">
                {alert.station.display_name}
              </Link>{" "}
              · {count(alert.station.follower_count)} suscriptores contados
              {alert.station.status === "suspended" && (
                <Badge tone="danger" className="ml-2">
                  Suspendida
                </Badge>
              )}
            </p>
          )}
          <p className="max-w-3xl text-sm text-muted">{alert.kind.description}</p>
          <dl className="flex flex-wrap gap-2">
            {alert.figures.map((figure) => (
              <div key={figure.label} className="rounded-xl bg-raised px-3 py-2">
                <dt className="text-[11px] tracking-wide text-muted uppercase">{figure.label}</dt>
                <dd className="font-semibold text-ink tabular">{figure.value}</dd>
              </div>
            ))}
          </dl>
          {alert.since && <p className="text-xs text-faint">Periodo analizado desde {dateTime(alert.since)}</p>}
          {alert.note && <p className="text-sm text-ink">“{alert.note}”</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {alert.concerns_accounts && alert.accounts > 0 && (
            <Button variant="secondary" size="sm" icon={<Eye className="size-3.5" />} onClick={onInspect}>
              Ver {count(alert.accounts)} cuentas
            </Button>
          )}
          {open && (
            <>
              <Button variant="ghost" size="sm" icon={<Check className="size-3.5" />} onClick={() => onResolve("dismissed")}>
                {alert.purgeable ? "Descartar" : "Revisada"}
              </Button>
              {canPurge && (
                <Button variant="danger" size="sm" icon={<UserX className="size-3.5" />} onClick={() => onResolve("purged")}>
                  Depurar
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

function AccountsModal({ alert, onClose }: { alert: IntegrityAlertRow; onClose: () => void }) {
  const [data, setData] = useState<{ total: number; accounts: IntegrityAccount[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    http
      .get<{ total: number; accounts: IntegrityAccount[] }>(`/admin/integridad/${alert.id}/cuentas`)
      .then((result) => active && setData(result))
      .catch((failure: unknown) => active && setError(failure instanceof HttpError ? failure.firstError() : "No pudimos cargar las cuentas."));
    return () => {
      active = false;
    };
  }, [alert.id]);

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Cuentas de la alerta: ${alert.kind.label}`}
      description={data && data.total > data.accounts.length ? `Mostramos las ${data.accounts.length} más recientes de ${count(data.total)}.` : alert.station?.display_name}
    >
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="py-8 text-center text-sm text-muted">Cargando cuentas…</p>}
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-medium">Cuenta</th>
                <th className="py-2 pr-3 font-medium">Creada</th>
                <th className="py-2 pr-3 font-medium">Escuchó</th>
                <th className="py-2 pr-3 font-medium">Suscripción</th>
                <th className="py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((account) => (
                <tr key={account.id} className="border-b border-line/60 last:border-0">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/usuarios/${account.id}`} className="font-medium text-ink hover:underline">
                      {account.name}
                    </Link>
                    <span className="block text-xs text-muted">{account.email}</span>
                  </td>
                  <td className="py-2 pr-3 text-muted">{account.created_at ? ago(account.created_at) : "—"}</td>
                  <td className="py-2 pr-3 text-muted tabular">{account.listened_minutes > 0 ? `${count(account.listened_minutes)} min` : "Nunca"}</td>
                  <td className="py-2 pr-3">{account.follow ? <Badge tone={followTones[account.follow.value]}>{account.follow.label}</Badge> : <span className="text-xs text-muted">Ya no sigue</span>}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {account.flagged && <Badge tone="danger">Marcada</Badge>}
                      {account.suspended && <Badge tone="danger">Suspendida</Badge>}
                      {!account.verified && <Badge tone="warning">Sin verificar</Badge>}
                      {!account.flagged && !account.suspended && account.verified && <Badge>Activa</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
