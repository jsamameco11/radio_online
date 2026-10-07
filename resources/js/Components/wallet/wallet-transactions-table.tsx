import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { dateTime, money } from "@/lib/format";
import type { WalletTransaction } from "@/types/wallet";

/**
 * Wallet movements with signed amounts and the balance after each one.
 * The platform ledger also shows whose wallet moved and who adjusted it.
 */
export function WalletTransactionsTable({ rows, showOwner = false }: { rows: WalletTransaction[]; showOwner?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium tracking-wide text-muted uppercase">
            <th className="px-5 py-3 font-medium">Movimiento</th>
            {showOwner && <th className="px-5 py-3 font-medium">Billetera</th>}
            <th className="px-5 py-3 font-medium">Fecha</th>
            <th className="px-5 py-3 text-right font-medium">Monto</th>
            <th className="px-5 py-3 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const credit = row.amount_cents > 0;
            return (
              <tr key={row.id} className="align-top">
                <td className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", credit ? "bg-onair-soft text-onair" : "bg-raised text-muted")}
                      aria-hidden
                    >
                      {credit ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{row.type.label}</p>
                      {row.description && <p className="text-xs text-muted">{row.description}</p>}
                      {row.actor && <p className="text-xs text-faint">Por {row.actor}</p>}
                    </div>
                  </div>
                </td>
                {showOwner && (
                  <td className="px-5 py-3 text-xs text-muted">
                    {row.owner ? (
                      <>
                        <span className="block text-faint uppercase">{row.owner.type === "station" ? "Emisora" : "Oyente"}</span>
                        <span className="text-ink">{row.owner.name}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-5 py-3 whitespace-nowrap text-muted">{dateTime(row.created_at)}</td>
                <td className={cn("px-5 py-3 text-right font-semibold whitespace-nowrap tabular", credit ? "text-onair" : "text-ink")}>
                  {credit ? "+" : "−"}
                  {money(Math.abs(row.amount_cents), row.currency)}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap text-muted tabular">{money(row.balance_after_cents, row.currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
