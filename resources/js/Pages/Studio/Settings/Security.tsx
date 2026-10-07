import { Link, router, useForm } from "@inertiajs/react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { FormEvent } from "react";
import { PageErrors } from "@/Components/forms/page-errors";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select, Switch } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { ago } from "@/lib/format";

interface SecurityMember {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  role_label: string;
  two_factor_enabled: boolean;
  last_login_at: string | null;
  sessions: number;
  last_seen_at: string | null;
}

interface Props {
  settings: { require_two_factor: boolean };
  team: SecurityMember[];
  tracksSessions: boolean;
  userHasTwoFactor: boolean;
  canManage: boolean;
  isOwner: boolean;
  frequencyLabel: string;
  transferCandidates: { value: number; label: string }[];
}

export default function Security({ settings, team, tracksSessions, userHasTwoFactor, canManage, isOwner, frequencyLabel, transferCandidates }: Props) {
  const url = useStudioUrl();
  const transfer = useForm({ user_id: String(transferCandidates[0]?.value ?? ""), password: "" });
  const close = useForm({ confirmation: "", password: "" });
  const missingTwoFactor = team.filter((member) => !member.two_factor_enabled).length;

  const toggleTwoFactor = (value: boolean) => router.put(url("/configuracion/seguridad"), { require_two_factor: value }, { preserveScroll: true });

  const submitTransfer = (event: FormEvent) => {
    event.preventDefault();
    transfer.post(url("/configuracion/seguridad/transferir"), { preserveScroll: true, onFinish: () => transfer.reset("password") });
  };

  const submitClose = (event: FormEvent) => {
    event.preventDefault();
    close.post(url("/configuracion/seguridad/cerrar"), { preserveScroll: true, onFinish: () => close.reset("password") });
  };

  return (
    <StudioLayout title="Seguridad">
      <div className="max-w-4xl space-y-6">
        <PageHeader eyebrow="Configuración" title="Seguridad" description="Protege el acceso al estudio de tu radio." />
        <PageErrors only={["require_two_factor"]} />

        <Panel title="Verificación en dos pasos" description="Si la exiges, nadie del equipo podrá entrar al estudio sin activarla en su cuenta.">
          <div className="space-y-3">
            <Switch
              checked={settings.require_two_factor}
              onChange={toggleTwoFactor}
              disabled={!canManage || (!userHasTwoFactor && !settings.require_two_factor)}
              label="Exigir verificación en dos pasos al equipo"
              description={missingTwoFactor > 0 ? `${missingTwoFactor} ${missingTwoFactor === 1 ? "persona no la tiene" : "personas no la tienen"} activa.` : "Todo el equipo la tiene activa."}
            />
            {!userHasTwoFactor && (
              <p className="text-xs text-warning">
                Primero actívala en tu cuenta:{" "}
                <Link href="/cuenta/seguridad" className="underline">
                  Seguridad de la cuenta
                </Link>
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Accesos del equipo" padded={false}>
          <ul className="divide-y divide-line text-sm">
            {team.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                {member.two_factor_enabled ? <ShieldCheck className="size-4 text-onair" aria-label="Con verificación en dos pasos" /> : <ShieldAlert className="size-4 text-warning" aria-label="Sin verificación en dos pasos" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{member.name}</span>
                  <span className="block truncate text-xs text-muted">{member.email}</span>
                </span>
                <Badge tone="neutral">{member.role_label}</Badge>
                <span className="w-40 text-right text-xs text-muted">
                  {member.last_login_at ? `Ingresó ${ago(member.last_login_at)}` : "Nunca ingresó"}
                  {tracksSessions && member.sessions > 0 && <span className="block">{member.sessions === 1 ? "1 sesión abierta" : `${member.sessions} sesiones abiertas`}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {isOwner && (
          <>
            <form onSubmit={submitTransfer}>
              <Panel
                title="Transferir la radio"
                description="La otra persona pasa a ser propietaria y tú quedas como administrador."
                footer={
                  <Button type="submit" variant="secondary" loading={transfer.processing} disabled={transferCandidates.length === 0 || transfer.data.password === ""}>
                    Transferir
                  </Button>
                }
              >
                {transferCandidates.length === 0 ? (
                  <p className="text-sm text-muted">Agrega primero a alguien a tu equipo.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nueva persona propietaria" error={transfer.errors.user_id}>
                      {(id, invalid) => (
                        <Select id={id} invalid={invalid} value={transfer.data.user_id} onChange={(event) => transfer.setData("user_id", event.target.value)}>
                          {transferCandidates.map((candidate) => (
                            <option key={candidate.value} value={candidate.value}>
                              {candidate.label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field label="Tu contraseña" error={transfer.errors.password}>
                      {(id, invalid) => <Input id={id} invalid={invalid} type="password" autoComplete="current-password" value={transfer.data.password} onChange={(event) => transfer.setData("password", event.target.value)} />}
                    </Field>
                  </div>
                )}
              </Panel>
            </form>

            <form onSubmit={submitClose}>
              <Panel
                title="Cerrar la radio"
                description="Se detiene la transmisión, la radio desaparece del dial y la frecuencia queda libre. Tus seguidores ya no podrán encontrarte."
                footer={
                  <Button type="submit" variant="danger" loading={close.processing} disabled={close.data.confirmation !== frequencyLabel || close.data.password === ""}>
                    Cerrar la radio
                  </Button>
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`Escribe ${frequencyLabel} para confirmar`} error={close.errors.confirmation}>
                    {(id, invalid) => <Input id={id} invalid={invalid} value={close.data.confirmation} onChange={(event) => close.setData("confirmation", event.target.value)} className="tabular" />}
                  </Field>
                  <Field label="Tu contraseña" error={close.errors.password}>
                    {(id, invalid) => <Input id={id} invalid={invalid} type="password" autoComplete="current-password" value={close.data.password} onChange={(event) => close.setData("password", event.target.value)} />}
                  </Field>
                </div>
              </Panel>
            </form>
          </>
        )}
      </div>
    </StudioLayout>
  );
}
