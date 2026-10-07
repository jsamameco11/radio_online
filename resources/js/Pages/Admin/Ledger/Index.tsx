import { router, useForm, usePage } from "@inertiajs/react";
import { Landmark, Percent, Scale, Search, Users, Wallet } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel, Stat } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import { WalletTransactionsTable } from "@/Components/wallet/wallet-transactions-table";
import AdminLayout from "@/Layouts/AdminLayout";
import { money } from "@/lib/format";
import type { Paginated, SharedProps } from "@/types";
import type { Labeled, WalletTransaction, WalletTransactionType } from "@/types/wallet";

type OwnerType = "user" | "station";

interface Filters {
  tipo: WalletTransactionType | null;
  titular: OwnerType | null;
  buscar: string;
  desde: string | null;
  hasta: string | null;
}

interface Props {
  filters: Filters;
  types: Labeled<WalletTransactionType>[];
  summary: { listener_balances_cents: number; station_balances_cents: number; platform_fees_cents: number; processor_fees_cents: number; deposits_cents: number };
  transactions: Paginated<WalletTransaction>;
  canAdjust: boolean;
}

export default function LedgerIndex({ filters, types, summary, transactions, canAdjust }: Props) {
  const { app } = usePage<SharedProps>().props;
  const [search, setSearch] = useState(filters.buscar);
  const [adjusting, setAdjusting] = useState(false);

  const filter = (changes: Partial<Filters>) => {
    const next = { ...filters, ...changes };
    router.get(
      "/admin/movimientos",
      {
        tipo: next.tipo ?? undefined,
        titular: next.titular ?? undefined,
        buscar: next.buscar || undefined,
        desde: next.desde || undefined,
        hasta: next.hasta || undefined,
      },
      { preserveState: true, replace: true },
    );
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    filter({ buscar: search.trim() });
  };

  return (
    <AdminLayout title="Movimientos">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Finanzas"
          title="Libro de movimientos"
          description="Cada cambio de saldo de cada billetera, con el saldo antes y después. Nada se edita: las correcciones son ajustes nuevos."
          actions={
            canAdjust && (
              <Button icon={<Scale className="size-4" />} onClick={() => setAdjusting(true)}>
                Ajuste manual
              </Button>
            )
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Saldo de oyentes" value={money(summary.listener_balances_cents, app.currency)} icon={<Users className="size-4" />} />
          <Stat label="Saldo de radios" value={money(summary.station_balances_cents, app.currency)} icon={<Landmark className="size-4" />} />
          <Stat
            label="Ganancia de la plataforma"
            value={money(summary.platform_fees_cents, app.currency)}
            icon={<Percent className="size-4" />}
            hint={`Costo del procesador: ${money(summary.processor_fees_cents, app.currency)}`}
          />
          <Stat label="Recargas acreditadas" value={money(summary.deposits_cents, app.currency)} icon={<Wallet className="size-4" />} />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Tabs<"todos" | OwnerType>
            value={filters.titular ?? "todos"}
            onChange={(titular) => filter({ titular: titular === "todos" ? null : titular })}
            items={[
              { value: "todos", label: "Todas" },
              { value: "user", label: "Oyentes" },
              { value: "station", label: "Radios" },
            ]}
          />
          <Select
            value={filters.tipo ?? ""}
            onChange={(event) => filter({ tipo: (event.target.value || null) as WalletTransactionType | null })}
            className="h-10 w-48"
            aria-label="Tipo de movimiento"
          >
            <option value="">Todos los tipos</option>
            {types.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted">
            Desde
            <Input type="date" value={filters.desde ?? ""} onChange={(event) => filter({ desde: event.target.value || null })} className="w-40" />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            Hasta
            <Input type="date" value={filters.hasta ?? ""} onChange={(event) => filter({ hasta: event.target.value || null })} className="w-40" />
          </label>
          <form onSubmit={submitSearch} className="flex items-center gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Correo, nombre o frecuencia" className="w-60" aria-label="Buscar titular" />
            <Button type="submit" variant="secondary" icon={<Search className="size-4" />}>
              Buscar
            </Button>
          </form>
        </div>

        <Panel padded={false} footer={transactions.last_page > 1 ? <Pagination page={transactions} /> : undefined}>
          {transactions.data.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Wallet className="size-6" />} title="No hay movimientos con estos filtros" />
            </div>
          ) : (
            <WalletTransactionsTable rows={transactions.data} showOwner />
          )}
        </Panel>
      </div>

      {adjusting && <AdjustmentModal onClose={() => setAdjusting(false)} />}
    </AdminLayout>
  );
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function AdjustmentModal({ onClose }: { onClose: () => void }) {
  const { app } = usePage<SharedProps>().props;
  const form = useForm({
    owner_type: "user" as OwnerType,
    owner: "",
    direction: "credit" as "credit" | "debit",
    amount: "",
    reason: "",
    idempotency_key: newIdempotencyKey(),
  });

  form.transform(({ direction, amount, ...data }) => ({
    ...data,
    amount_cents: Math.round(Number(amount) * 100) * (direction === "debit" ? -1 : 1),
  }));
  const errors: Partial<Record<string, string>> = form.errors;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post("/admin/movimientos/ajustes", {
      preserveScroll: true,
      onSuccess: onClose,
      onError: () => form.setData("idempotency_key", newIdempotencyKey()),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Ajuste manual de saldo"
      description="Crea un movimiento nuevo en el libro y queda registrado en la auditoría con tu nombre y el motivo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="wallet-adjustment" loading={form.processing}>
            Registrar ajuste
          </Button>
        </>
      }
    >
      <form id="wallet-adjustment" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <Field label="Titular" error={form.errors.owner_type}>
            {(id, invalid) => (
              <Select id={id} invalid={invalid} value={form.data.owner_type} onChange={(event) => form.setData("owner_type", event.target.value as OwnerType)}>
                <option value="user">Oyente</option>
                <option value="station">Radio</option>
              </Select>
            )}
          </Field>
          <Field label={form.data.owner_type === "user" ? "Correo del oyente" : "Frecuencia de la radio"} error={form.errors.owner}>
            {(id, invalid) => (
              <Input
                id={id}
                invalid={invalid}
                value={form.data.owner}
                onChange={(event) => form.setData("owner", event.target.value)}
                placeholder={form.data.owner_type === "user" ? "oyente@correo.com" : "89.30"}
                required
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <Field label="Operación">
            {(id) => (
              <Select id={id} value={form.data.direction} onChange={(event) => form.setData("direction", event.target.value as "credit" | "debit")}>
                <option value="credit">Abonar</option>
                <option value="debit">Descontar</option>
              </Select>
            )}
          </Field>
          <Field label={`Monto (${app.currency})`} error={errors.amount_cents}>
            {(id, invalid) => (
              <Input
                id={id}
                invalid={invalid}
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                inputMode="decimal"
                value={form.data.amount}
                onChange={(event) => form.setData("amount", event.target.value)}
                required
              />
            )}
          </Field>
        </div>

        <Field label="Motivo" hint="Entre 5 y 200 caracteres. Explica por qué se corrige el saldo." error={form.errors.reason}>
          {(id, invalid) => (
            <Textarea id={id} invalid={invalid} required minLength={5} maxLength={200} value={form.data.reason} onChange={(event) => form.setData("reason", event.target.value)} />
          )}
        </Field>

        {form.errors.idempotency_key && <p className="text-xs text-danger">{form.errors.idempotency_key}</p>}
      </form>
    </Modal>
  );
}
