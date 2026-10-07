import { router, useForm, usePage } from "@inertiajs/react";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { PageErrors } from "@/Components/forms/page-errors";
import { Avatar } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { ago } from "@/lib/format";
import type { SharedProps } from "@/types";
import type { TeamMember } from "@/types/station-admin";

interface RoleOption {
  value: TeamMember["role"];
  label: string;
  permissions: string[];
}

interface Props {
  members: TeamMember[];
  roles: RoleOption[];
  canManage: boolean;
}

export default function Team({ members, roles, canManage }: Props) {
  const url = useStudioUrl();
  const userId = usePage<SharedProps>().props.auth.user?.id;
  const assignable = roles.filter((role) => role.value !== "owner");
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const form = useForm({ email: "", role: assignable[0]?.value ?? "host" });

  const invite = (event: FormEvent) => {
    event.preventDefault();
    form.post(url("/configuracion/equipo"), { preserveScroll: true, onSuccess: () => form.reset("email") });
  };

  const changeRole = (member: TeamMember, role: string) => router.put(url(`/configuracion/equipo/${member.id}`), { role }, { preserveScroll: true });

  return (
    <StudioLayout title="Equipo">
      <div className="max-w-4xl space-y-6">
        <PageHeader eyebrow="Configuración" title="Equipo" description="Las personas que te ayudan a llevar la radio y lo que cada una puede hacer." />
        <PageErrors only={["member", "role"]} />

        {canManage && (
          <form onSubmit={invite}>
            <Panel title="Agregar a alguien" description="La persona necesita una cuenta en Tu Radio Online. Le avisaremos por correo.">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Correo" error={form.errors.email} className="min-w-64 flex-1">
                  {(id, invalid) => <Input id={id} invalid={invalid} type="email" value={form.data.email} onChange={(event) => form.setData("email", event.target.value)} placeholder="nombre@correo.com" />}
                </Field>
                <Field label="Rol" error={form.errors.role}>
                  {(id, invalid) => (
                    <Select id={id} invalid={invalid} value={form.data.role} onChange={(event) => form.setData("role", event.target.value as TeamMember["role"])}>
                      {assignable.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Button type="submit" icon={<UserPlus className="size-4" />} loading={form.processing} disabled={form.data.email === ""}>
                  Agregar
                </Button>
              </div>
            </Panel>
          </form>
        )}

        <Panel title={`Miembros (${members.length})`} padded={false}>
          <ul className="divide-y divide-line">
            {members.map((member) => {
              const editable = canManage && member.role !== "owner" && member.user.id !== userId;

              return (
                <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <Avatar name={member.user.name} src={member.user.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      {member.user.name}
                      {member.user.id === userId && <span className="text-xs text-muted">(tú)</span>}
                      {member.user.two_factor_enabled && <ShieldCheck className="size-3.5 text-onair" aria-label="Verificación en dos pasos activa" />}
                      {member.user.suspended && <Badge tone="danger">Suspendido</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {member.user.email}
                      {member.user.last_login_at && ` · último ingreso ${ago(member.user.last_login_at)}`}
                    </span>
                  </span>
                  {editable ? (
                    <>
                      <Select aria-label={`Rol de ${member.user.name}`} value={member.role} onChange={(event) => changeRole(member, event.target.value)} className="w-auto">
                        {assignable.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </Select>
                      <Button size="icon" variant="ghost" aria-label={`Quitar a ${member.user.name}`} onClick={() => setRemoving(member)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <Badge tone={member.role === "owner" ? "signal" : "neutral"}>{member.role_label}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Qué puede hacer cada rol">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {roles.map((role) => (
              <div key={role.value}>
                <dt className="font-medium">{role.label}</dt>
                <dd className="text-xs text-muted">{role.permissions.length} permisos</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Quitar del equipo"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => removing && router.delete(url(`/configuracion/equipo/${removing.id}`), { preserveScroll: true, onFinish: () => setRemoving(null) })}>
              Quitar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{removing?.user.name} dejará de tener acceso al estudio. Podrás volver a agregarle cuando quieras.</p>
      </Modal>
    </StudioLayout>
  );
}
