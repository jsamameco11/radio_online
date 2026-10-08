import type { Station } from "@/types";

/** App\Domain\Discovery\Queries\CategoryCatalog::present() */
export interface CategoryCard {
  id: number;
  name: string;
  slug: string;
  group: string;
  station_count: number;
}

export interface CategoryGroup {
  value: string;
  label: string;
  categories: CategoryCard[];
}

/** App\Domain\Discovery\Queries\TrendingHashtags */
export interface TrendingHashtag {
  name: string;
  slug: string;
  uses_count: number;
  on_air: number;
}

/** App\Http\Resources\Site\EpisodeCardResource */
export interface EpisodeCard {
  id: string;
  title: string;
  program: string | null;
  description: string | null;
  cover_url: string | null;
  season: number | null;
  number: number | null;
  aired_on: string;
  published_at: string | null;
  duration: number;
  audio_url: string | null;
  hashtags: string[];
  station?: Station;
}

/** App\Http\Resources\Site\FrequencyRequestResource */
export type FrequencyRequestStatus = "pending" | "awaiting_payment" | "approved" | "rejected" | "cancelled";

export type FrequencyPaymentStatus = "card_required" | "card_saved" | "paid" | "failed" | "unconfirmed" | "cancelled";

/** App\Http\Resources\FrequencyPaymentResource: the price of a priced frequency and its payment. */
export interface FrequencyPaymentInfo {
  id: number;
  amount_cents: number;
  currency: string;
  amount: string;
  status: { value: FrequencyPaymentStatus; label: string };
  needs_attention: boolean;
  card: string | null;
  card_saved_at: string | null;
  charged_at: string | null;
  failure_reason: string | null;
  failed_at: string | null;
  attempts: number;
}

export interface FrequencyRequestItem {
  id: number;
  station_name: string;
  frequency: { label: string; slug: string; display: string };
  status: FrequencyRequestStatus;
  status_label: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  payment?: FrequencyPaymentInfo | null;
  payment_url?: string | null;
}

/** App\Http\Resources\Site\ListeningResource */
export interface ListeningEntry {
  id: number;
  started_at: string;
  ended_at: string | null;
  seconds: number;
  station: Station;
}

export interface StationFiltersState {
  categoria: string | null;
  hashtag: string | null;
  en_vivo: boolean;
  orden: string;
}

export interface Option {
  value: string;
  label: string;
}

/** Shared by the station and episode pages (StationController::context). */
export interface StationContext {
  station: Station;
  isFollowing: boolean;
  myRating: number | null;
  studioUrl: string | null;
  /** Only for whoever may edit the station profile. */
  coverEditUrl: string | null;
  /** The listing when its owner is selling the station. */
  forSale: { url: string; price_cents: number; currency: string } | null;
  shareUrl: string;
  reportReasons: Option[];
}

export interface DialBand {
  min: number;
  max: number;
}
