import { Link } from "@inertiajs/react";
import { Check, Loader2, Sparkles, Wallet, X } from "lucide-react";
import { pinLabel, tierLook } from "@/Components/chat/highlight-tiers";
import { cn } from "@/lib/cn";
import type { HighlightTier } from "@/types/chat";

interface HighlightPickerProps {
  tiers: HighlightTier[];
  selected: number | null;
  balance: number | null;
  formatMoney: (cents: number) => string;
  onSelect: (cents: number | null) => void;
  onClose: () => void;
}

/**
 * "Destacar": the listener picks how much to pay so their message stands out
 * for the host and every listener; the higher tiers stay pinned on top.
 */
export function HighlightPicker({ tiers, selected, balance, formatMoney, onSelect, onClose }: HighlightPickerProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-3 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-gold" /> Destaca tu mensaje
          </p>
          <p className="mt-0.5 text-xs text-muted">Se verá remarcado para la cabina y para todos los oyentes. Los montos mayores quedan fijados arriba.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-raised hover:text-ink" aria-label="Cerrar">
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiers.map((tier) => {
          const look = tierLook(tier.level);
          const affordable = balance === null || balance >= tier.cents;
          const active = selected === tier.cents;

          return (
            <button
              key={tier.cents}
              type="button"
              disabled={!affordable}
              aria-pressed={active}
              onClick={() => onSelect(active ? null : tier.cents)}
              className={cn(
                "relative flex flex-col items-start gap-0.5 overflow-hidden rounded-xl border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45",
                look.card,
                active ? cn("ring-2", look.ring) : "hover:brightness-105",
              )}
            >
              {look.sheen && <span className={cn("animate-sheen pointer-events-none absolute inset-0", look.accent)} aria-hidden />}
              <span className={cn("relative text-[0.65rem] font-bold tracking-wide uppercase", look.accent)}>{look.name}</span>
              <span className="relative font-display text-base font-semibold text-ink tabular">{formatMoney(tier.cents)}</span>
              <span className="relative text-[0.68rem] text-muted">{affordable ? pinLabel(tier.pin_seconds) : "Saldo insuficiente"}</span>
              {active && <Check className={cn("absolute top-2 right-2 size-3.5", look.accent)} aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-raised px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <Wallet className="size-3.5 text-gold" /> Tu saldo
          {balance === null ? <Loader2 className="size-3 animate-spin" aria-label="Cargando saldo" /> : <strong className="text-ink tabular">{formatMoney(balance)}</strong>}
        </span>
        <Link href="/billetera" className="font-medium text-ink underline-offset-4 hover:underline">
          Recargar
        </Link>
      </div>
    </div>
  );
}
