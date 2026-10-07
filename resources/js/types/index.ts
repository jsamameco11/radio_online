/** Props shared with every page by App\Http\Middleware\HandleInertiaRequests. */
export interface SharedProps {
  app: {
    name: string;
    host: "public" | "control";
    urls: { public: string; control: string };
    currency: string;
  };
  auth: { user: AuthUser | null };
  flash: { success: string | null; error: string | null; status: string | null };
  studio: StudioContext | null;
  /** Platform-wide maintenance notice set by the staff. */
  notice: string | null;
  [key: string]: unknown;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  email_verified: boolean;
  two_factor_enabled: boolean;
  is_staff: boolean;
  roles: string[];
  permissions: string[];
  has_studio: boolean;
}

export type StreamStatusValue = "live" | "online" | "connecting" | "offline" | "error" | "maintenance";

/** App\Http\Resources\StationResource */
export interface Station {
  id: number;
  name: string;
  display_name: string;
  frequency: { label: string; slug: string; band: string; display: string };
  tagline: string | null;
  logo_url: string | null;
  cover_url: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  accent_color: string | null;
  status: "active" | "suspended";
  stream_status: { value: StreamStatusValue; label: string; audible: boolean };
  listener_count: number;
  follower_count: number;
  categories?: { id: number; name: string; slug: string }[];
  hashtags?: string[];
  current_topic?: { title: string; started_at: string; hashtags: string[] } | null;
}

export type StationPermission =
  | "console.operate"
  | "schedule.manage"
  | "library.manage"
  | "episodes.manage"
  | "station.profile"
  | "station.settings"
  | "station.members"
  | "gifts.view"
  | "finance.view"
  | "analytics.view";

export interface StudioContext {
  station: Station;
  role: string | null;
  role_label: string;
  permissions: StationPermission[];
  stations: { name: string; frequency: string; slug: string }[];
}

/** Laravel's length-aware paginator as Inertia receives it. */
export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
  links: { url: string | null; label: string; active: boolean }[];
}
