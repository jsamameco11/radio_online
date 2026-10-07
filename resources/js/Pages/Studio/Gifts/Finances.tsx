import { CalendarDays, Landmark, Percent, PiggyBank } from "lucide-react";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel, Stat } from "@/Components/ui/panel";
import { WalletTransactionsTable } from "@/Components/wallet/wallet-transactions-table";
import StudioLayout from "@/Layouts/StudioLayout";
import { count, dateTime, money } from "@/lib/format";
import type { Paginated } from "@/types";
import type { WalletTransaction } from "@/types/wallet";

interface Props {
  wallet: { balance_cents: number; currency: string; status: string };
  summary: {
    lifetime_earned_cents: number;
    lifetime_fees_cents: number;
    lifetime_gifts: number;
    month_earned_cents: number;
    fee_percent: number;
  };
  series: { date: string; earned_cents: number; gifts: number }[];
  transactions: Paginated<WalletTransaction>;
}

export default function Finances({ wallet, summary, series, transactions }: Props) {
  const formatMoney = (cents: number) => money(cents, wallet.currency);
  const peak = Math.max(1, ...series.map((day) => day.earned_cents));
  const periodTotal = series.reduce((sum, day) => sum + day.earned_cents, 0);
  const dayLabel = (date: string) => dateTime(`${date}T12:00:00`, { day: "numeric", month: "short" });

  return (
    <StudioLayout title="Finanzas">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Radio"
          title="Finanzas"
          description={`Cada regalo suma a la billetera de la radio después de la comisión de la plataforma (${summary.fee_percent}%).`}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Saldo de la radio" value={formatMoney(wallet.balance_cents)} icon={<Landmark className="size-4" />} hint={`Billetera ${wallet.status.toLowerCase()}`} />
          <Stat label="Este mes" value={formatMoney(summary.month_earned_cents)} icon={<CalendarDays className="size-4" />} />
          <Stat
            label="Ganado en total"
            value={formatMoney(summary.lifetime_earned_cents)}
            icon={<PiggyBank className="size-4" />}
            hint={`${count(summary.lifetime_gifts)} regalos recibidos`}
          />
          <Stat label="Comisión de la plataforma" value={formatMoney(summary.lifetime_fees_cents)} icon={<Percent className="size-4" />} hint={`${summary.fee_percent}% de cada regalo`} />
        </div>

        <Panel title="Últimos 30 días" description={`${formatMoney(periodTotal)} para la radio`}>
          <div className="flex h-44 items-end gap-1" role="img" aria-label="Ingresos por regalos de los últimos 30 días">
            {series.map((day) => (
              <div key={day.date} className="group relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-gold/70 transition group-hover:bg-gold"
                  style={{ height: day.earned_cents > 0 ? `${Math.max(4, (day.earned_cents / peak) * 100)}%` : "2px" }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs shadow-lg group-hover:block">
                  <p className="font-semibold tabular">{formatMoney(day.earned_cents)}</p>
                  <p className="text-muted">
                    {dayLabel(day.date)} · {day.gifts} {day.gifts === 1 ? "regalo" : "regalos"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {series.length > 0 && (
            <div className="mt-2 flex justify-between text-xs text-faint">
              <span>{dayLabel(series[0].date)}</span>
              <span>{dayLabel(series[series.length - 1].date)}</span>
            </div>
          )}
        </Panel>

        <Panel title="Movimientos" padded={false} footer={transactions.last_page > 1 ? <Pagination page={transactions} /> : undefined}>
          <WalletTransactionsTable rows={transactions.data} />
        </Panel>
      </div>
    </StudioLayout>
  );
}
