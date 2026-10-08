/** Wallet, payments and gifts: the shapes the Laravel resources and JSON endpoints return. */

export interface Labeled<T extends string = string> {
  value: T;
  label: string;
}

export type WalletTransactionType =
  | "deposit"
  | "gift_purchase"
  | "gift_earning"
  | "refund"
  | "admin_adjustment"
  | "withdrawal"
  | "withdrawal_reversal"
  | "highlight_purchase"
  | "highlight_earning"
  | "station_purchase"
  | "sale_settlement";

/** App\Http\Resources\WalletTransactionResource */
export interface WalletTransaction {
  id: number;
  type: Labeled<WalletTransactionType>;
  amount_cents: number;
  balance_before_cents: number;
  balance_after_cents: number;
  currency: string;
  description: string | null;
  created_at: string;
  owner?: { type: "user" | "station"; id: number; name: string } | null;
  actor?: string | null;
  idempotency_key?: string;
}

export type PaymentStatus = "pending" | "succeeded" | "failed" | "cancelled" | "refunded";

/** App\Http\Resources\PaymentResource */
export interface Payment {
  id: string;
  provider: string;
  amount_cents: number;
  currency: string;
  status: Labeled<PaymentStatus>;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
  user?: { id: number; name: string; email: string };
  provider_reference?: string | null;
}

/** What /billetera/recarga/{payment} needs to collect a pending top-up. */
export interface TopUpCheckout {
  driver: "culqi" | "sandbox";
  amount_cents: number;
  currency: string;
  email: string;
  charge_url: string;
  public_key?: string;
  title?: string;
}

/** POST /billetera/recarga/{payment}/cargo */
export interface TopUpChargeResponse {
  payment: Payment;
  balance_cents: number;
}

/** App\Http\Resources\GiftResource */
export interface GiftItem {
  id: number;
  name: string;
  slug: string;
  emoji: string | null;
  image_url: string | null;
  price_cents: number;
  animation: string | null;
  sort_order: number;
  active: boolean;
}

export type GiftMessageStatus = "visible" | "hidden" | "reported";

/** App\Http\Resources\GiftMessageResource */
export interface GiftMessage {
  id: string;
  body: string | null;
  has_voice: boolean;
  voice_duration: number | null;
  status: Labeled<GiftMessageStatus>;
  played_at: string | null;
  played_by?: string | null;
  created_at: string;
}

/** App\Http\Resources\GiftTransactionResource: a gift a station received (only its credited amount). */
export interface ReceivedGift {
  id: string;
  quantity: number;
  station_amount_cents: number;
  anonymous: boolean;
  gift?: { id: number; name: string; emoji: string | null; animation: string | null };
  sender?: { id: number; name: string; avatar_url: string | null } | null;
  message?: GiftMessage | null;
  created_at: string;
}

/** GET /radio/{frequency}/regalos */
export interface GiftCatalog {
  gifts: GiftItem[];
  balance_cents: number;
  station: { accepts_gifts: boolean; min_gift_cents: number; accepts_text: boolean; accepts_voice: boolean };
  limits: { max_quantity: number; max_message_length: number; max_voice_seconds: number; max_voice_kilobytes: number; min_deposit_cents: number };
}

/** POST /radio/{frequency}/regalos */
export interface SentGift {
  gift: { id: string; name: string; emoji: string | null; animation: string | null; quantity: number; total_cents: number };
  balance_cents: number;
  thank_you_message: string;
}

/** Public broadcast "gift.celebrated" on the station.{id} channel. */
export interface GiftCelebration {
  id: string;
  gift: { name: string; emoji: string | null; animation: string | null };
  quantity: number;
  sender_name: string | null;
  created_at: string;
}

/** Detail of the window event "wallet:changed", fired after any balance change in the page. */
export interface WalletChangedDetail {
  balance_cents: number;
}
