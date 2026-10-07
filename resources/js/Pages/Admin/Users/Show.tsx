import { Link, router, useForm, usePage } from "@inertiajs/react";
import { ArrowLeft, Ban, RotateCcw, ShieldCheck, ShieldOff } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { AuditList } from "@/Components/admin/audit-list";
import { ReasonModal } from "@/Components/admin/reason-modal";
import { PageErrors } from "@/Components/forms/page-errors";
import { Avatar } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Field, Select } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, dateTime, money } from "@/lib/format";
import type { SharedProps } from "@/types";
import type { AuditEntry, FrequencyRequestRow, Option, UserRow } from "@/types/admin";

interface Props {
  user: UserRow;
  memberships: { station_id: number; display_name: string; station_status: string; station_status_label: string; role: string; role_label: string; since: string | null }[];
  wallet: {
    balance_cents: number;
    currency: string;
    status: string;
    status_label: string;
    transactions: { id: number | string; type: string; type_label: string; amount_cents: number; balance_after_cents: number; description: string | null; created_at: string | null }[];
  } | null;
  requests: FrequencyRequestRow[];
  audit: AuditEntry[] | null;
  roles: Option[];
  can: { manage: boolean; changeRole: boolean; grantSuperAdmin: boolean };
}

export default function UserShow({ user, memberships, wallet, requests, audit, roles, can }: Props) {
  const { auth } = usePage<SharedProps>().props;
  const [suspending, setSuspending] = useState(false);
  const suspended = user.status === "suspended";

  return (
    <AdminLayout title={user.name}>
      <div className="space-y-6">
        <Link href="/admin/usuarios" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" />
          Usuarios
        </Link>

        <header className="flex flex-wrap items-center gap-5">
          <Avatar name={user.name} src={user.avatar_url} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="font-display text-2xl font-semibold">{user.name}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {user.email}
              <Badge tone={user.is_staff ? "info" : "neutral"}>{user.role_label}</Badge>
              {suspended && <Badge tone="danger">{user.status_label}</Badge>}
              {user.two_factor_enabled ? (
                <span className="inline-flex items-center gap-1 text-onair">
                  <ShieldCheck className="size-4" />
                  2FA activa
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <ShieldOff className="size-4" />
                  Sin 2FA
                </span>
              )}
            </p>
          </div>
          {can.manage &&
            (suspended ? (
              <Button icon={<RotateCcw className="size-4" />} onClick={() => router.post(`/admin/usuarios/${user.id}/reactivar`, {}, { preserveScroll: true })}>
                Reactivar cuenta
              </Button>
            ) : (
              <Button variant="danger" icon={<Ban className="size-4" />} onClick={() => setSuspending(true)}>
                Suspender cuenta
              </Button>
            ))}
        </header>

        {!suspending && <PageErrors only={["user"]} />}

        {suspended && (
          <div className="rounded-2xl border border-danger/30 bg-danger-soft px-5 py-4 text-sm text-danger">
            <p className="font-semibold">Suspendida {user.suspended_at ? `el ${dateTime(user.suspended_at)}` : ""}</p>
            {user.suspension_reason && <p className="mt-1">{user.suspension_reason}</p>}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Panel title="Radios" padded={memberships.length === 0}>
              {memberships.length === 0 ? (
                <p className="text-sm text-muted">No forma parte de ninguna radio.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {memberships.map((membership) => (
                    <li key={membership.station_id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <Link href={`/admin/radios/${membership.station_id}`} className="font-medium hover:underline">
                        {membership.display_name}
                      </Link>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        {membership.station_status === "suspended" && <Badge tone="danger">{membership.station_status_label}</Badge>}
                        {membership.role_label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Billetera" description="Solo lectura." padded={!wallet || wallet.transactions.length === 0}>
              {!wallet ? (
                <p className="text-sm text-muted">Todavía no tiene billetera.</p>
              ) : (
                <>
                  <div className={wallet.transactions.length > 0 ? "flex items-center justify-between border-b border-line px-5 py-4" : "flex items-center justify-between"}>
                    <span className="font-display text-2xl font-semibold tabular">{money(wallet.balance_cents, wallet.currency)}</span>
                    <Badge tone={wallet.status === "active" ? "onair" : "warning"}>{wallet.status_label}</Badge>
                  </div>
                  {wallet.transactions.length > 0 && (
                    <ul className="divide-y divide-line text-sm">
                      {wallet.transactions.map((transaction) => (
                        <li key={transaction.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                          <span className="min-w-0">
                            <span className="block">{transaction.type_label}</span>
                            <span className="text-xs text-muted">{transaction.description ?? (transaction.created_at ? dateTime(transaction.created_at) : "")}</span>
                          </span>
                          <span className={`tabular ${transaction.amount_cents >= 0 ? "text-onair" : "text-ink"}`}>{money(transaction.amount_cents, wallet.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Panel>

            <Panel title="Solicitudes de frecuencia" padded={requests.length === 0}>
              {requests.length === 0 ? (
                <p className="text-sm text-muted">No envió solicitudes.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {requests.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span>
                        <span className="font-medium tabular">{item.frequency.display}</span> · {item.station_name}
                        <span className="block text-xs text-muted">
                          {item.kind_label} · {ago(item.created_at)}
                        </span>
                      </span>
                      <Badge tone={item.status === "approved" ? "onair" : item.status === "pending" ? "warning" : "neutral"}>{item.status_label}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Cuenta">
              <dl className="space-y-3 text-sm">
                <Row label="Alta" value={dateTime(user.created_at)} />
                <Row label="Correo verificado" value={user.email_verified ? "Sí" : "No"} />
                <Row label="Último ingreso" value={user.last_login_at ? `${ago(user.last_login_at)} · ${user.last_login_ip ?? ""}` : "Nunca"} />
                <Row label="País" value={user.country ?? "—"} />
              </dl>
            </Panel>

            {can.changeRole && <RoleForm user={user} roles={roles.filter((role) => can.grantSuperAdmin || role.value !== "super_admin")} isSelf={auth.user?.id === user.id} />}

            {audit && (
              <Panel title="Actividad">
                <AuditList entries={audit} />
              </Panel>
            )}
          </div>
        </div>
      </div>

      <ReasonModal
        open={suspending}
        onClose={() => setSuspending(false)}
        title={`Suspender a ${user.name}`}
        description="Se cerrarán sus sesiones y no podrá entrar hasta que la reactives."
        url={`/admin/usuarios/${user.id}/suspender`}
        confirmLabel="Suspender cuenta"
      />
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

function RoleForm({ user, roles, isSelf }: { user: UserRow; roles: Option[]; isSelf: boolean }) {
  const form = useForm({ role: user.role });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(`/admin/usuarios/${user.id}/rol`, { preserveScroll: true });
  };

  return (
    <form onSubmit={submit}>
      <Panel
        title="Rol en la plataforma"
        description="El personal necesita verificación en dos pasos para entrar al panel."
        footer={
          <Button type="submit" size="sm" loading={form.processing} disabled={isSelf || !form.isDirty}>
            Cambiar rol
          </Button>
        }
      >
        <Field error={form.errors.role} hint={isSelf ? "No puedes cambiar tu propio rol." : undefined}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={form.data.role} onChange={(event) => form.setData("role", event.target.value)} disabled={isSelf}>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Panel>
    </form>
  );
}
