import { Link, router } from "@inertiajs/react";
import { Search, ShieldCheck, Users } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Avatar } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input, Select } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, count, dateTime } from "@/lib/format";
import type { Paginated } from "@/types";
import type { Option, UserRow } from "@/types/admin";

interface Filters {
  q: string;
  role: string;
  status: string;
}

interface Props {
  users: Paginated<UserRow>;
  filters: Filters;
  roles: Option[];
  statuses: Option[];
}

export default function UsersIndex({ users, filters, roles, statuses }: Props) {
  const [values, setValues] = useState(filters);

  const apply = (next: Filters) => {
    setValues(next);
    router.get("/admin/usuarios", Object.fromEntries(Object.entries(next).filter(([, value]) => value !== "")), { preserveState: true, replace: true });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply(values);
  };

  return (
    <AdminLayout title="Usuarios">
      <div className="space-y-6">
        <PageHeader eyebrow="Personas" title="Usuarios" description={`${count(users.total)} cuentas con estos filtros.`} />

        <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input value={values.q} onChange={(event) => setValues({ ...values, q: event.target.value })} placeholder="Nombre o correo" className="pl-9" aria-label="Buscar usuarios" />
          </div>
          <Select value={values.role} onChange={(event) => apply({ ...values, role: event.target.value })} className="w-48" aria-label="Rol">
            <option value="">Todos los roles</option>
            {roles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select value={values.status} onChange={(event) => apply({ ...values, status: event.target.value })} className="w-40" aria-label="Estado">
            <option value="">Todo estado</option>
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>

        <Panel padded={false}>
          {users.data.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Users className="size-6" />} title="Ninguna cuenta coincide" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Cuenta</th>
                    <th className="px-5 py-3 font-medium">Rol</th>
                    <th className="px-5 py-3 text-right font-medium">Radios</th>
                    <th className="px-5 py-3 font-medium">Último ingreso</th>
                    <th className="px-5 py-3 font-medium">Alta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.data.map((user) => (
                    <tr key={user.id} className="hover:bg-raised/60">
                      <td className="px-5 py-3">
                        <Link href={`/admin/usuarios/${user.id}`} className="flex items-center gap-3">
                          <Avatar name={user.name} src={user.avatar_url} size="sm" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 font-medium hover:underline">
                              {user.name}
                              {user.two_factor_enabled && <ShieldCheck className="size-3.5 text-onair" aria-label="Verificación en dos pasos activa" />}
                              {user.status === "suspended" && <Badge tone="danger">{user.status_label}</Badge>}
                            </span>
                            <span className="text-xs text-muted">{user.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={user.is_staff ? "info" : "neutral"}>{user.role_label}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right tabular">{count(user.memberships_count ?? 0)}</td>
                      <td className="px-5 py-3 text-xs text-muted">{user.last_login_at ? ago(user.last_login_at) : "Nunca"}</td>
                      <td className="px-5 py-3 text-xs text-muted">{dateTime(user.created_at, { dateStyle: "medium" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-line px-5 py-3 empty:hidden">
            <Pagination page={users} />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  );
}
