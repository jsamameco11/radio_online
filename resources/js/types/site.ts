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
export interface FrequencyRequestItem {
  id: number;
  station_name: string;
  frequency: { label: string; slug: string; display: string };
  status: "pending" | "approved" | "rejected" | "cancelled";
  status_label: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
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
  studioUrl: string | null;
  shareUrl: string;
  reportReasons: Option[];
}

export interface DialBand {
  name: string;
  min: number;
  max: number;
}
