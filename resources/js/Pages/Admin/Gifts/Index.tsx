import { router, useForm, usePage } from "@inertiajs/react";
import { Gift, Pencil, Plus, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Field, Input, Select, Switch } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { count, money } from "@/lib/format";
import type { SharedProps } from "@/types";
import type { GiftItem } from "@/types/wallet";

type CatalogGift = GiftItem & { sent_count: number; sent_total_cents: number };

interface Props {
  gifts: CatalogGift[];
  animations: string[];
  minPriceCents: number;
}

const animationLabels: Record<string, string> = {
  float: "Flotar",
  pulse: "Latido",
  bloom: "Florecer",
  bounce: "Rebote",
  shine: "Brillo",
  crown: "Corona",
  launch: "Despegue",
};

export default function GiftsIndex({ gifts, animations, minPriceCents }: Props) {
  const { app } = usePage<SharedProps>().props;
  const [editing, setEditing] = useState<CatalogGift | "new" | null>(null);
  const [removing, setRemoving] = useState<CatalogGift | null>(null);

  return (
    <AdminLayout title="Catálogo de regalos">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Finanzas"
          title="Catálogo de regalos"
          description="Los regalos que los oyentes pueden enviar a cualquier radio. Un regalo que ya se envió no se puede eliminar, solo desactivar."
          actions={
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
              Nuevo regalo
            </Button>
          }
        />

        <Panel padded={false}>
          {gifts.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Gift className="size-6" />} title="El catálogo está vacío" description="Crea el primer regalo para que los oyentes puedan apoyar a sus radios." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Regalo</th>
                    <th className="px-5 py-3 text-right font-medium">Precio</th>
                    <th className="px-5 py-3 font-medium">Animación</th>
                    <th className="px-5 py-3 text-right font-medium">Orden</th>
                    <th className="px-5 py-3 text-right font-medium">Enviados</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {gifts.map((gift) => (
                    <tr key={gift.id}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3">
                          <span className="text-2xl leading-none" aria-hidden>
                            {gift.emoji}
                          </span>
                          <span className="font-medium">{gift.name}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular">{money(gift.price_cents, app.currency)}</td>
                      <td className="px-5 py-3 text-muted">{gift.animation ? animationLabels[gift.animation] ?? gift.animation : "—"}</td>
                      <td className="px-5 py-3 text-right text-muted tabular">{gift.sort_order}</td>
                      <td className="px-5 py-3 text-right tabular">
                        {count(gift.sent_count)}
                        <span className="block text-xs text-muted">{money(gift.sent_total_cents, app.currency)}</span>
                      </td>
                      <td className="px-5 py-3">{gift.active ? <Badge tone="onair">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label={`Editar ${gift.name}`} onClick={() => setEditing(gift)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Eliminar ${gift.name}`}
                            disabled={gift.sent_count > 0}
                            title={gift.sent_count > 0 ? "Ya fue enviado: desactívalo en su lugar" : undefined}
                            onClick={() => setRemoving(gift)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {editing && (
        <GiftForm
          key={editing === "new" ? "new" : editing.id}
          gift={editing === "new" ? null : editing}
          animations={animations}
          minPriceCents={minPriceCents}
          nextOrder={Math.max(0, ...gifts.map((gift) => gift.sort_order)) + 10}
          onClose={() => setEditing(null)}
        />
      )}

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Eliminar regalo"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => removing && router.delete(`/admin/regalos/${removing.id}`, { preserveScroll: true, onFinish: () => setRemoving(null) })}
            >
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          ¿Eliminar «{removing?.name}» del catálogo? Los oyentes dejarán de verlo de inmediato.
        </p>
      </Modal>
    </AdminLayout>
  );
}

interface GiftFormProps {
  gift: CatalogGift | null;
  animations: string[];
  minPriceCents: number;
  nextOrder: number;
  onClose: () => void;
}

function GiftForm({ gift, animations, minPriceCents, nextOrder, onClose }: GiftFormProps) {
  const { app } = usePage<SharedProps>().props;
  const form = useForm({
    name: gift?.name ?? "",
    emoji: gift?.emoji ?? "",
    price: ((gift?.price_cents ?? minPriceCents) / 100).toFixed(2),
    animation: gift?.animation ?? "",
    sort_order: gift?.sort_order ?? nextOrder,
    active: gift?.active ?? true,
  });

  form.transform(({ price, animation, ...data }) => ({ ...data, animation: animation || null, price_cents: Math.round(Number(price) * 100) }));
  const errors: Partial<Record<string, string>> = form.errors;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const options = { preserveScroll: true, onSuccess: onClose };
    if (gift) form.put(`/admin/regalos/${gift.id}`, options);
    else form.post("/admin/regalos", options);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={gift ? `Editar «${gift.name}»` : "Nuevo regalo"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="gift-form" loading={form.processing}>
            {gift ? "Guardar cambios" : "Crear regalo"}
          </Button>
        </>
      }
    >
      <form id="gift-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[6rem_1fr] gap-4">
          <Field label="Emoji" error={form.errors.emoji}>
            {(id, invalid) => (
              <Input id={id} invalid={invalid} maxLength={16} value={form.data.emoji} onChange={(event) => form.setData("emoji", event.target.value)} className="text-center text-xl" />
            )}
          </Field>
          <Field label="Nombre" error={form.errors.name}>
            {(id, invalid) => <Input id={id} invalid={invalid} maxLength={40} value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Precio (${app.currency})`} hint={`Mínimo ${money(minPriceCents, app.currency)}.`} error={errors.price_cents}>
            {(id, invalid) => (
              <Input
                id={id}
                invalid={invalid}
                type="number"
                min={minPriceCents / 100}
                step="0.01"
                inputMode="decimal"
                value={form.data.price}
                onChange={(event) => form.setData("price", event.target.value)}
              />
            )}
          </Field>
          <Field label="Orden" hint="Los menores aparecen primero." error={form.errors.sort_order}>
            {(id, invalid) => (
              <Input id={id} invalid={invalid} type="number" min={0} max={1000} value={form.data.sort_order} onChange={(event) => form.setData("sort_order", Number(event.target.value))} />
            )}
          </Field>
        </div>

        <Field label="Animación" hint="Cómo se celebra el regalo en la página de la radio." error={form.errors.animation}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={form.data.animation} onChange={(event) => form.setData("animation", event.target.value)}>
              <option value="">Sin animación</option>
              {animations.map((animation) => (
                <option key={animation} value={animation}>
                  {animationLabels[animation] ?? animation}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Switch
          checked={form.data.active}
          onChange={(active) => form.setData("active", active)}
          label="Disponible para los oyentes"
          description="Un regalo inactivo no aparece en el catálogo, pero su historial se conserva."
        />
      </form>
    </Modal>
  );
}
