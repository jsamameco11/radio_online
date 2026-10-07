import { Link, usePage } from "@inertiajs/react";
import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { onWalletChange } from "@/Components/wallet/wallet-events";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { http } from "@/lib/http";
import type { SharedProps } from "@/types";

/**
 * Balance of the signed-in listener for the site header. Loads from
 * /billetera/saldo and follows the "wallet:changed" window event, so a gift
 * sent from the modal updates it at once. Renders nothing for guests.
 */
export function WalletChip({ className }: { className?: string }) {
  const { auth, app } = usePage<SharedProps>().props;
  const [balance, setBalance] = useState<number | null>(null);
  const signedIn = Boolean(auth.user?.email_verified);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    http
      .get<{ balance_cents: number }>("/billetera/saldo")
      .then((data) => active && setBalance(data.balance_cents))
      .catch(() => active && setBalance(null));
    const unsubscribe = onWalletChange(setBalance);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [signedIn]);

  if (!signedIn) return null;

  return (
    <Link
      href="/billetera"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface pr-3.5 pl-1 text-sm font-medium text-ink transition hover:border-line-strong hover:bg-raised",
        className,
      )}
      aria-label="Mi billetera"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-gold-soft text-gold">
        <Wallet className="size-3.5" />
      </span>
      <span className="tabular">{balance === null ? "—" : money(balance, app.currency)}</span>
    </Link>
  );
}
