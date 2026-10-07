import type { WalletChangedDetail } from "@/types/wallet";

/** Window event every wallet-aware component listens to (header chip, gift modal…). */
export const WALLET_CHANGED_EVENT = "wallet:changed";

export function announceWalletChange(balance_cents: number): void {
  window.dispatchEvent(new CustomEvent<WalletChangedDetail>(WALLET_CHANGED_EVENT, { detail: { balance_cents } }));
}

/** Subscribes to balance changes; returns the unsubscribe function. */
export function onWalletChange(listener: (balance_cents: number) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<WalletChangedDetail>).detail.balance_cents);
  window.addEventListener(WALLET_CHANGED_EVENT, handler);
  return () => window.removeEventListener(WALLET_CHANGED_EVENT, handler);
}
