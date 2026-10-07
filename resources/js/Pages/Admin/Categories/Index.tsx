import { router, useForm } from "@inertiajs/react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { PageErrors } from "@/Components/forms/page-errors";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select, Switch } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { count } from "@/lib/format";
import type { CategoryRow } from "@/types/admin";

interface Group {
  value: string;
  label: string;
  categories: CategoryRow[];
}

export default function CategoriesIndex({ groups }: { groups: Group[] }) {
  const [editing, setEditing] = useState<CategoryRow | { group: string } | null>(null);

  const move = (category: CategoryRow, direction: "up" | "down") => router.post(`/admin/categorias/${category.slug}/mover`, { direction }, { preserveScroll: true });

  const remove = (category: CategoryRow) => {
    if (confirm(`¿Eliminar «${category.name}»? Esta acción no se puede deshacer.`)) {
      router.delete(`/admin/categorias/${category.slug}`, { preserveScroll: true });
    }
  };

  return (
    <AdminLayout title="Categorías">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Descubrimiento"
          title="Categorías"
          description="Cada radio elige hasta tres. Los oyentes las usan para explorar. Una categoría en uso no se elimina: se desactiva."
          actions={
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing({ group: groups[0]?.value ?? "" })}>
              Nueva categoría
            </Button>
          }
        />

        {!editing && <PageErrors />}

        <div className="grid gap-6 lg:grid-cols-2">
          {groups.map((group) => (
            <Panel
              key={group.value}
              title={group.label}
              description={`${group.categories.length} categorías`}
              padded={false}
              actions={
                <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setEditing({ group: group.value })}>
                  Agregar
                </Button>
              }
            >
              {group.categories.length === 0 ? (
                <p className="p-5 text-sm text-muted">Sin categorías en este grupo.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {group.categories.map((category, index) => (
                    <li key={category.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="flex flex-col">
                        <button type="button" disabled={index === 0} onClick={() => move(category, "up")} className="text-faint hover:text-ink disabled:opacity-30" aria-label={`Subir ${category.name}`}>
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button type="button" disabled={index === group.categories.length - 1} onClick={() => move(category, "down")} className="text-faint hover:text-ink disabled:opacity-30" aria-label={`Bajar ${category.name}`}>
                          <ArrowDown className="size-3.5" />
                        </button>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{category.name}</span>
                        <span className="ml-2 text-xs text-faint">/{category.slug}</span>
                      </span>
                      {!category.active && <Badge>Inactiva</Badge>}
                      <span className="text-xs text-muted tabular">{count(category.stations_count ?? 0)} radios</span>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(category)} aria-label={`Editar ${category.name}`}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={(category.stations_count ?? 0) > 0} onClick={() => remove(category)} aria-label={`Eliminar ${category.name}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>
      </div>

      {editing && <CategoryModal category={"id" in editing ? editing : null} group={editing.group} groups={groups} onClose={() => setEditing(null)} />}
    </AdminLayout>
  );
}

function CategoryModal({ category, group, groups, onClose }: { category: CategoryRow | null; group: string; groups: Group[]; onClose: () => void }) {
  const form = useForm({ name: category?.name ?? "", group, active: category?.active ?? true });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const options = { preserveScroll: true, onSuccess: onClose };
    if (category) form.put(`/admin/categorias/${category.slug}`, options);
    else form.post("/admin/categorias", options);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? `Editar «${category.name}»` : "Nueva categoría"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" loading={form.processing}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4">
        <Field label="Nombre" error={form.errors.name} hint={category ? "La dirección web de la categoría no cambia." : undefined}>
          {(id, invalid) => <Input id={id} invalid={invalid} maxLength={60} value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} autoFocus />}
        </Field>
        <Field label="Grupo" error={form.errors.group}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={form.data.group} onChange={(event) => form.setData("group", event.target.value)}>
              {groups.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Switch checked={form.data.active} onChange={(active) => form.setData("active", active)} label="Activa" description="Las inactivas no se pueden elegir ni aparecen en la exploración." />
      </form>
    </Modal>
  );
}
