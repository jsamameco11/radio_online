export interface AudienceSummary {
  sessions: number;
  listeners: number;
  hours: number;
  average_minutes: number;
  new_followers: number;
  pending_followers: number;
  peak_listeners: number;
  listeners_now: number;
  followers: number;
}

export interface AudienceDay {
  day: string;
  sessions: number;
  hours: number;
  listeners: number;
}

export interface FollowerDay {
  day: string;
  new: number;
  total: number;
}

export interface TopFollower {
  id: number;
  name: string;
  avatar_url: string | null;
  followed_at: string;
  hours: number;
  sessions: number;
}

/** App\Http\Resources\Stations\TopicResource */
export interface Topic {
  id: number;
  title: string;
  hashtags: string[];
  author: string | null;
  started_at: string;
  ended_at: string | null;
}

/** App\Http\Resources\Stations\StationMemberResource */
export interface TeamMember {
  id: number;
  role: "owner" | "manager" | "host" | "editor";
  role_label: string;
  joined_at: string | null;
  user: {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
    two_factor_enabled: boolean;
    last_login_at: string | null;
    suspended: boolean;
  };
}

export interface CategoryGroupOption {
  value: string;
  label: string;
  categories: { id: number; name: string }[];
}

export type SocialLinks = Record<"website" | "instagram" | "facebook" | "tiktok" | "youtube" | "x" | "whatsapp", string>;
