import type { Station } from "@/types";

export type StoryKind = "image" | "video" | "text";

export type StoryBackground = "signal" | "royal" | "ocean" | "aurora" | "sunset" | "night";

/** App\Http\Resources\StoryResource */
export interface Story {
  id: string;
  kind: StoryKind;
  media_url: string | null;
  poster_url: string | null;
  text: string | null;
  background: StoryBackground | null;
  duration_ms: number;
  created_at: string;
  expires_at: string;
  seen: boolean;
}

/** App\Http\Resources\Studio\StoryResource */
export interface StudioStory extends Story {
  views_count: number;
  posted_by: string | null;
}

/** A station of the rail (GET /estados). */
export interface StoryRailItem {
  station: Station;
  count: number;
  latest_at: string;
  seen: boolean;
}

/** GET /radio/{slug}/estados */
export interface StationStories {
  station: Station;
  stories: Story[];
  report_reasons: { value: string; label: string }[];
}

/** What the viewer plays: one station and its stories, in order. */
export interface StoryReel {
  station: Station;
  stories: Story[];
}

export interface StoryLimits {
  max_active: number;
  max_text: number;
  lifetime_hours: number;
  image_types: string[];
  max_image_mb: number;
  video_types: string[];
  max_video_mb: number;
  max_video_seconds: number;
  backgrounds: { value: StoryBackground; label: string }[];
}
