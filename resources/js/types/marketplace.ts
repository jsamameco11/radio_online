import type { Station } from "./index";
import type { PayoutMethodValue } from "./growth";

export type ListingStatus = "active" | "sold" | "cancelled";

/** App\Http\Resources\FrequencyListingResource */
export interface StationListing {
  id: number;
  /** A free frequency the platform sells: no station until someone buys it. */
  by_platform: boolean;
  status: ListingStatus;
  status_label: string;
  price_cents: number;
  currency: string;
  pitch: string | null;
  listed_at: string | null;
  sold_at: string | null;
  frequency: { label: string; slug: string; band: string; display: string };
  station: Station | null;
  episode_count: number;
  track_count: number;
}

/** The listing of the open studio, as its owner edits it. */
export interface OwnListing {
  id: number;
  price_cents: number;
  pitch: string | null;
  payout_method: PayoutMethodValue;
  holder: string;
  account: string;
  bank: string;
  destination: string;
  listed_at: string | null;
  public_url: string;
}

export type SaleTab = "to_pay" | "active" | "platform" | "paid" | "cancelled";

/** App\Http\Resources\Admin\FrequencySaleRowResource */
export interface SaleRow {
  id: number;
  by_platform: boolean;
  frequency: string;
  station: string | null;
  public_url: string;
  seller: { name: string; email: string } | null;
  buyer: { name: string; email: string } | null;
  status: { value: ListingStatus; label: string };
  payout_status: { value: "pending" | "paid"; label: string } | null;
  currency: string;
  price_cents: number;
  processor_fee_cents: number | null;
  fee_cents: number | null;
  tax_cents: number | null;
  settled_balance_cents: number | null;
  payout_cents: number | null;
  payout_method: { value: PayoutMethodValue; label: string } | null;
  payout_details: { holder: string; account: string; bank?: string } | null;
  payout_reference: string | null;
  payout_note: string | null;
  payer: string | null;
  listed_at: string | null;
  sold_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
}
