/**
 * The broadcast engine as the studio console, the schedule and the listener
 * engine see it (shapes of App\Domain\Studio\Broadcast\StationBroadcast).
 * Every moment is UTC milliseconds of the server clock.
 */
export type TrackKind = "song" | "jingle" | "effect" | "commercial" | "program";

export type ProgramKind = TrackKind | "live" | "auto" | "fill";

export interface ProgramItem {
  id: string;
  kind: ProgramKind;
  title: string;
  artist: string | null;
  src: string | null;
  cover?: string | null;
  start: number;
  end: number;
  origin: number;
  seek?: number;
  bed: boolean;
  block: string | null;
  slot: string | null;
  /** Library audio that sounds; a song of the automatic music when `slot` is null. */
  track?: string | null;
}

export type LayerSource = "live" | "schedule";

/** A sound on top of the program: a console pad, player or bed, or an overlay block of the schedule. */
export interface ProgramLayer {
  id: string;
  lane: string;
  track_id: string | null;
  title: string;
  kind: string;
  src: string;
  start: number;
  end: number;
  volume: number;
  duck: boolean;
  source: LayerSource;
  fade_in?: number;
  fade_out?: number;
  loop?: boolean;
  /** One pass of a looped layer, in ms. */
  length?: number;
  fading?: boolean;
}

/** Gains of the program between 0 and 1; `voice` is what everything drops to while the host speaks. */
export interface ProgramMix {
  music: number;
  fx: number;
  pads?: number;
  bed: number;
  duck: number;
  voice?: number;
}

export type LiveMode = "auto" | "manual";

export type LiveSource = "console" | "external";

/** A cut of the automatic music for the live signal: from `start` until `end` (null until the music comes back). */
export interface LiveWindow {
  start: number;
  end: number | null;
  auto: boolean;
  bed: boolean;
  slot: string | null;
  title: string;
}

export interface BroadcastLive {
  on: boolean;
  session: string | null;
  title: string;
  host: string | null;
  mic: boolean;
  started_at: number | null;
  rev: number;
  mode: LiveMode;
  source: LiveSource;
  cut: boolean;
  window: LiveWindow | null;
  url: string | null;
}

export interface ReserveSong {
  id: string;
  title: string;
  artist: string | null;
  src: string;
  ms: number;
}

export type VoiceState = "idle" | "waiting" | "offering" | "offered" | "answered" | "connected";

/** What every listener polls from /radio/{frequency}/estado. */
export interface BroadcastState {
  now: number;
  station: { id: number; name: string; frequency: string | null };
  show_titles: boolean;
  on_air: boolean;
  stream: string | null;
  previous: ProgramItem | null;
  queue: ProgramItem[];
  recent: ProgramItem[];
  fallback: ReserveSong[];
  layers: ProgramLayer[];
  next_show: { title: string; kind: ProgramKind; start: number } | null;
  live: BroadcastLive;
  mix: ProgramMix;
  listeners: number;
  ice: RTCIceServer[];
  voice?: { state: VoiceState; offer: string | null; since?: number | null };
}

/** The console's own live state: faders, layers fired from the console and the live cut. */
export interface DeskState {
  session: string | null;
  host: string;
  host_id: number | null;
  title: string;
  started_at: number | null;
  music: number;
  overlay: number;
  pads: number;
  muted: boolean;
  bed: boolean;
  mic: boolean;
  layers: ProgramLayer[];
  window: LiveWindow | null;
  hold: number | null;
  rev: number;
}

export interface BroadcastConfig {
  on_air: boolean;
  show_titles: boolean;
  live_mode: LiveMode;
  live_source: LiveSource;
  live_url: string;
  max_voice: number;
  crossfade: number;
  bed_level: number;
  fx_level: number;
  duck_level: number;
  pads: string[] | null;
  autofill: boolean;
  auto_playlist: string | null;
  auto_shuffle: boolean;
  auto_repeat: boolean;
  stream_url: string;
  bitrate_kbps: number;
}

export type AutopilotLevel = "playlist" | "lists" | "library" | "none";

/** The automatic music of the gaps. While a change is scheduled, `pending` says when it lands. */
export interface Autopilot {
  mode: "playlist" | "random";
  playlist: string | null;
  shuffle: boolean;
  start: string | null;
  label: string;
  since: number;
  pending: { label: string; at: number } | null;
  paused: boolean;
  repeat: boolean;
  until: number | null;
  finished: boolean;
  level: AutopilotLevel;
  broken: number;
}

export interface ScheduleBlock {
  id: string;
  kind: ProgramKind;
  layer: number;
  title: string;
  artist: string | null;
  note: string | null;
  bed: boolean;
  duck: boolean;
  volume: number;
  duration: number;
  track_id: string | null;
  playlist_id: string | null;
  playlist: string | null;
  shuffle: boolean;
  src: string | null;
  inactive: boolean;
  start: number;
  end: number;
}

/** A block of the main program the console warns about; `held` waits for the live transmission to end. */
export interface UpcomingBlock extends ScheduleBlock {
  held: boolean;
}

/** What the console polls and every console action answers with. */
export interface ConsoleSnapshot {
  radio: BroadcastState;
  live: DeskState;
  voice: number;
  config: BroadcastConfig;
  autopilot: Autopilot;
  upcoming: UpcomingBlock[];
}

export interface ConsoleSignal {
  pending: string[];
  answers: { id: string; answer: string }[];
  alive: string[];
}

export interface BroadcastTrack {
  id: string;
  kind: TrackKind;
  kind_label: string;
  title: string;
  artist: string | null;
  duration: number;
  duck: boolean;
  /** A song that repeats in the automatic music («Música continua»). */
  rotation: boolean;
  src: string | null;
  cover_url: string | null;
  playable: boolean;
}

export interface BroadcastPlaylist {
  id: string;
  name: string;
  songs: number;
}

export interface Option<T extends string | number = string> {
  value: T;
  label: string;
}

/** A song boundary of the automatic music where a change of source can land. */
export interface SwitchPoint {
  at: number;
  after: { title: string; artist: string | null; kind: string } | null;
}

export type RecordingState = "recording" | "ready" | "saving" | "saved" | "discarded";

export interface CaptureBrief {
  id: string;
  session: string;
  status: RecordingState;
  status_label: string;
  bytes: number;
  parts: number;
  duration: number | null;
  started_at: string | null;
  stale?: boolean;
}

export interface ConsoleLimits {
  pads: number;
  fade: number;
  operator_timeout: number;
  chunk_mb: number;
  recording_mb: number;
  /** Characters of the episode description when the console keeps its recording. */
  description: number;
  cover_mb: number;
}

export interface ConsoleResponse {
  message: string | null;
  snapshot: ConsoleSnapshot;
}
