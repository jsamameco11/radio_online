import { router, usePage } from "@inertiajs/react";
import { Gift, HandHeart, Mic, Package } from "lucide-react";
import { Avatar } from "@/Components/ui/avatar";
import { EmptyState } from "@/Components/ui/empty-state";
import { Checkbox, Select } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel, Stat } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { count, dateTime, money } from "@/lib/format";
import type { Paginated, SharedProps } from "@/types";
import type { ReceivedGift } from "@/types/wallet";

type Period = "7" | "30" | "90" | "todo";

interface Props {
  filters: { periodo: Period; regalo: number | null; con_mensaje: boolean };
  totals: { gifts: number; units: number; earned_cents: number };
  supporters: { id: number; name: string; gifts: number; earned_cents: number }[];
  breakdown: { gift: { id: number; name: string; emoji: string | null } | null; units: number; earned_cents: number }[];
  catalog: { id: number; name: string; emoji: string | null }[];
  gifts: Paginated<ReceivedGift>;
}

const periods: { value: Period; label: string }[] = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "todo", label: "Todo" },
];

export default function GiftsIndex({ filters, totals, supporters, breakdown, catalog, gifts }: Props) {
  const { app } = usePage<SharedProps>().props;
  const url = useStudioUrl();
  const formatMoney = (cents: number) => money(cents, app.currency);
  const topBreakdown = Math.max(1, ...breakdown.map((row) => row.earned_cents));

  const filter = (changes: Partial<Props["filters"]>) => {
    const next = { ...filters, ...changes };
    router.get(
      url("/regalos"),
      { periodo: next.periodo, regalo: next.regalo ?? undefined, con_mensaje: next.con_mensaje ? 1 : undefined },
      { preserveState: true, preserveScroll: true, replace: true },
    );
  };

  return (
    <StudioLayout title="Regalos">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Audiencia"
          title="Regalos recibidos"
          description="Lo que tus oyentes te envían, quiénes más te apoyan y cuánto suma para la radio."
          actions={<Tabs value={filters.periodo} onChange={(periodo) => filter({ periodo })} items={periods} />}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Regalos" value={count(totals.gifts)} icon={<Gift className="size-4" />} hint={`${count(totals.units)} unidades`} />
          <Stat label="Sumado a tu billetera" value={formatMoney(totals.earned_cents)} icon={<HandHeart className="size-4" />} hint="Disponible para retirar" />
          <Stat label="Mejor apoyo" value={supporters[0]?.name ?? "—"} icon={<Package className="size-4" />} hint={supporters[0] ? formatMoney(supporters[0].earned_cents) : "Aún sin regalos"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Panel
            title="Historial"
            padded={false}
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <Select value={filters.regalo ?? ""} onChange={(event) => filter({ regalo: event.target.value ? Number(event.target.value) : null })} className="h-8 w-44 text-xs">
                  <option value="">Todos los regalos</option>
                  {catalog.map((gift) => (
                    <option key={gift.id} value={gift.id}>
                      {gift.emoji} {gift.name}
                    </option>
                  ))}
                </Select>
                <Checkbox label="Con mensaje" checked={filters.con_mensaje} onChange={(event) => filter({ con_mensaje: event.target.checked })} />
              </div>
            }
            footer={gifts.last_page > 1 ? <Pagination page={gifts} /> : undefined}
          >
            {gifts.data.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<Gift className="size-6" />} title="No hay regalos en este periodo" description="Invita a tu audiencia a apoyar la radio desde tu página pública." />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {gifts.data.map((gift) => (
                  <li key={gift.id} className="flex items-start gap-4 px-5 py-4">
                    <span className="text-3xl leading-none" aria-hidden>
                      {gift.gift?.emoji ?? "🎁"}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm">
                        <span className="font-semibold">{gift.sender?.name ?? "Oyente anónimo"}</span>
                        <span className="text-muted"> envió </span>
                        <span className="font-medium">
                          {gift.gift?.name}
                          {gift.quantity > 1 && ` ×${gift.quantity}`}
                        </span>
                      </p>
                      {gift.message?.body && gift.message.status.value === "visible" && <p className="text-sm text-muted">“{gift.message.body}”</p>}
                      {gift.message?.has_voice && (
                        <p className="inline-flex items-center gap-1 text-xs text-signal">
                          <Mic className="size-3" /> Mensaje de voz
                        </p>
                      )}
                      <p className="text-xs text-faint">{dateTime(gift.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-onair tabular">+{formatMoney(gift.station_amount_cents)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel title="Quienes más apoyan" description="Sin contar los regalos anónimos">
              {supporters.length === 0 ? (
                <p className="text-sm text-muted">Todavía nadie en este periodo.</p>
              ) : (
                <ol className="space-y-3">
                  {supporters.map((supporter, index) => (
                    <li key={supporter.id} className="flex items-center gap-3">
                      <span className="w-4 text-center font-display text-sm text-faint tabular">{index + 1}</span>
                      <Avatar name={supporter.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{supporter.name}</span>
                        <span className="text-xs text-muted">
                          {supporter.gifts} {supporter.gifts === 1 ? "regalo" : "regalos"}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular">{formatMoney(supporter.earned_cents)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title="Por regalo">
              {breakdown.length === 0 ? (
                <p className="text-sm text-muted">Sin datos en este periodo.</p>
              ) : (
                <ul className="space-y-3">
                  {breakdown.map((row) => (
                    <li key={row.gift?.id ?? "x"} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {row.gift?.emoji} {row.gift?.name ?? "Regalo"} <span className="text-xs text-muted">×{count(row.units)}</span>
                        </span>
                        <span className="font-medium tabular">{formatMoney(row.earned_cents)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-raised">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${(row.earned_cents / topBreakdown) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </StudioLayout>
  );
}
