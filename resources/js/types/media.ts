export type TrackKind = "song" | "jingle" | "effect" | "commercial" | "program";

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

export interface GenreBrief {
  id: string;
  name: string;
  family: string;
}

export interface LibraryTrack {
  id: string;
  kind: TrackKind;
  kind_label: string;
  title: string;
  artist: string | null;
  featured: string[];
  credit: string | null;
  album: string | null;
  year: number | null;
  duration: number;
  size_bytes: number | null;
  audio_url: string | null;
  cover_url: string | null;
  rotation: boolean;
  duck: boolean;
  genres: GenreBrief[];
  confidence: "high" | "medium" | "low" | null;
  edited: boolean;
  edit_status: "processing" | "failed" | null;
  problem: Option | null;
  created_at: string | null;
}

export interface UploadLimits {
  direct: boolean;
  max_mb: number;
  max_cover_mb: number;
  max_duration: number;
  types: string[];
}

export interface LibraryLimits extends UploadLimits {
  max_featured: number;
  max_genres: number;
}

export interface Identity {
  confidence: "high" | "medium" | "low";
  score: number;
  sources: string[];
  ids: Record<string, string>;
  artist: { kind?: string; country?: string; musicbrainz_id?: string };
}

export interface Identification {
  found: boolean;
  confidence: Identity["confidence"] | null;
  score: number | null;
  sources: string[];
  title: string | null;
  artist: string | null;
  featured: string[];
  album: string | null;
  year: number | null;
  cover_url: string | null;
  genres: GenreBrief[];
  identity: Identity | null;
}

export type DuplicateVerdict = "same" | "version" | "possible";

export interface DuplicateMatch {
  id: string;
  title: string;
  artist: string | null;
  duration: number;
  verdict: DuplicateVerdict;
}

export interface DuplicateResult {
  matches: DuplicateMatch[];
  batch: { key: string; verdict: DuplicateVerdict } | null;
}

export interface PlaylistSong {
  id: string;
  title: string;
  credit: string | null;
  duration: number;
  playable: boolean;
}

export interface PlaylistItem {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  tracks: PlaylistSong[];
}

export interface RecordingItem {
  id: string;
  status: Option;
  convertible: boolean;
  deletable: boolean;
  audio_url: string | null;
  duration: number | null;
  bytes: number;
  started_at: string | null;
  finished_at: string | null;
  host: string | null;
  track: { id: string; title: string; kind: string } | null;
}

export type EpisodeStatus = "draft" | "scheduled" | "published" | "archived";

export interface EpisodeItem {
  id: string;
  uuid: string;
  title: string;
  program: string | null;
  description: string | null;
  cover_url: string | null;
  audio_url: string | null;
  duration: number;
  season: number | null;
  number: number | null;
  hashtags: string[];
  status: Option<EpisodeStatus>;
  aired_on: string | null;
  publish_at: string | null;
  published_at: string | null;
  track: { id: string; title: string; kind: TrackKind };
}

export interface EpisodeAudio {
  id: string;
  title: string;
  kind: string;
  duration: number;
}

export interface ReadyRecording {
  id: string;
  duration: number;
  started_at: string | null;
}

export interface EpisodeLimits extends UploadLimits {
  max_hashtags: number;
  hashtag_length: number;
}

export interface CatalogGenre extends GenreBrief {
  songs: number;
}

export interface CatalogArtist {
  id: string;
  name: string;
  kind: string | null;
  country: string | null;
  source: string;
  genres: GenreBrief[];
}

export interface CatalogSong {
  id: string;
  title: string;
  credit: string | null;
  genre_ids: string[];
}

export interface EditorTrack {
  id: string;
  title: string;
  credit: string | null;
  kind: string;
  duration: number;
  source_duration: number;
  source_url: string | null;
  audio_url: string | null;
  cover_url: string | null;
  edited: boolean;
  edit: unknown;
  edit_status: "processing" | "failed" | null;
  edit_error: string | null;
  edited_at: string | null;
}

export interface EditorListItem {
  id: string;
  title: string;
  credit: string | null;
  kind: string;
  duration: number;
  edited: boolean;
  edit_status: EditorTrack["edit_status"];
}

export interface EditorLimits {
  max_cuts: number;
  min_length: number;
  max_fade: number;
  max_join: number;
  max_gain: number;
  preview_seconds: number;
}

export interface EditorAnalysis {
  perSecond: number;
  peaks: string;
  duration: number;
  loudness: number | null;
  peak: number | null;
}
