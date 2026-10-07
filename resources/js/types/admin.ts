import type { StreamStatusValue } from "@/types";

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

export type FrequencyStatusValue = "available" | "reserved" | "active" | "suspended" | "maintenance";

export type MonitorStatusValue = "free" | "reserved" | "live" | "online" | "connecting" | "offline" | "error" | "maintenance" | "suspended";

export interface FrequencyRef {
  label: string;
  slug: string;
  band: string;
  display: string;
}

/** App\Http\Resources\Admin\StationRowResource */
export interface StationRow {
  id: number;
  name: string;
  display_name: string;
  frequency: FrequencyRef;
  logo_url: string | null;
  accent_color: string | null;
  owner: { id: number; name: string; email: string };
  status: "active" | "suspended";
  status_label: string;
  stream_status: { value: StreamStatusValue; label: string; audible: boolean };
  listener_count: number;
  peak_listener_count: number;
  follower_count: number;
  last_heartbeat_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  deleted_at: string | null;
}

/** App\Http\Resources\Admin\UserRowResource */
export interface UserRow {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  country: string | null;
  role: string;
  role_label: string;
  is_staff: boolean;
  status: "active" | "suspended";
  status_label: string;
  suspended_at: string | null;
  suspension_reason: string | null;
  email_verified: boolean;
  two_factor_enabled: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  memberships_count?: number;
  created_at: string;
}

/** App\Http\Resources\Admin\AuditLogResource */
export interface AuditEntry {
  id: number;
  action: string;
  actor: { id: number; name: string; email: string } | null;
  subject: { type: string; id: string } | null;
  station: { id: number; name: string; frequency: string } | null;
  ip_address: string | null;
  user_agent: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

/** App\Http\Resources\Admin\FrequencyRequestResource */
export interface FrequencyRequestRow {
  id: number;
  kind: "new_station" | "frequency_change";
  kind_label: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  status_label: string;
  user: { id: number; name: string; email: string };
  frequency: FrequencyRef & { status: FrequencyStatusValue; status_label: string };
  conflict: boolean;
  station_name: string;
  pitch: string | null;
  categories: string[];
  station: { id: number; display_name: string; slug: string } | null;
  reviewer: { id: number; name: string } | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  alternatives?: string[];
}

/** App\Http\Resources\Admin\ReportResource */
export interface ReportRow {
  id: number;
  reason: string;
  reason_label: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  status_label: string;
  reporter: { id: number; name: string } | null;
  resolver: { id: number; name: string } | null;
  resolved_at: string | null;
  resolution_note: string | null;
  target: {
    type: string;
    type_label: string;
    title: string;
    excerpt: string | null;
    station: { id: number; display_name: string; status: string } | null;
    hidden: boolean;
  };
  created_at: string;
}

/** App\Http\Resources\Admin\CategoryResource */
export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  group: string;
  group_label: string;
  sort_order: number;
  active: boolean;
  stations_count?: number;
}

/** One frequency of the live monitor (App\Domain\Streaming\Monitor\StreamMonitor::cell). */
export interface MonitorCell {
  id: number;
  label: string;
  slug: string;
  mhz: number;
  status: MonitorStatusValue;
  station: { id: number; name: string; listeners: number; stale: boolean } | null;
}

export interface MonitorDetail {
  cell: MonitorCell;
  frequency: { label: string; slug: string; display: string; status: FrequencyStatusValue; status_label: string; reserved_at: string | null; activated_at: string | null };
  station: {
    id: number;
    name: string;
    display_name: string;
    logo_url: string | null;
    accent_color: string | null;
    owner: { id: number; name: string; email: string };
    status: string;
    status_label: string;
    stream_status: StreamStatusValue;
    stream_status_label: string;
    listeners: number;
    peak_listeners: number;
    followers: number;
    last_heartbeat_at: string | null;
    heartbeat_age_seconds: number | null;
    stale: boolean;
    latency_ms: number | null;
    bitrate_kbps: number | null;
    went_live_at: string | null;
    topic: { title: string; hashtags: string[] } | null;
  } | null;
  session: { source: string; title: string | null; host: string | null; started_at: string; ended_at: string | null; peak_listeners: number } | null;
}

export interface DialCell {
  label: string;
  slug: string;
  mhz: number;
  status: FrequencyStatusValue;
}

export interface PlatformDay {
  day: string;
  sessions: number;
  hours: number;
  signups: number;
  gifts: number;
  revenue_cents: number;
  fee_cents: number;
}

export interface Broadcast {
  id: number;
  source: string;
  title: string | null;
  host: string | null;
  started_at: string;
  ended_at: string | null;
  peak_listeners: number;
}
