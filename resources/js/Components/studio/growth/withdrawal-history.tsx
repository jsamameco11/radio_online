import { Banknote } from "lucide-react";
import { Badge } from "@/Components/ui/badge";
import { EmptyState } from "@/Components/ui/empty-state";
import { dateTime, money } from "@/lib/format";
import type { WithdrawalRow, WithdrawalStatus } from "@/types/growth";

const tones: Record<WithdrawalStatus, "info" | "onair" | "danger"> = { pending: "info", paid: "onair", rejected: "danger" };

/** The withdrawals of a station, newest first. */
export function WithdrawalHistory({ rows }: { rows: WithdrawalRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-5">
        <EmptyState icon={<Banknote className="size-6" />} title="Aún no hiciste retiros" description="Cuando retires tus ganancias, aquí verás cada solicitud y su estado." />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-5 py-3 font-medium">Fecha</th>
            <th className="px-5 py-3 font-medium">Destino</th>
            <th className="px-5 py-3 font-medium">Estado</th>
            <th className="px-5 py-3 text-right font-medium">Monto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-5 py-3 whitespace-nowrap text-muted">{dateTime(row.created_at)}</td>
              <td className="px-5 py-3">{row.destination}</td>
              <td className="px-5 py-3">
                <Badge tone={tones[row.status.value]}>{row.status.label}</Badge>
                {row.status.value === "paid" && row.paid_reference && <span className="mt-1 block text-xs text-muted">Ref. {row.paid_reference}</span>}
                {row.status.value === "rejected" && row.review_note && <span className="mt-1 block max-w-72 text-xs text-muted">{row.review_note} · el monto volvió a tu saldo</span>}
              </td>
              <td className="px-5 py-3 text-right font-semibold tabular">{money(row.amount_cents, row.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
