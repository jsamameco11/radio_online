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
  active: boolean;
  genres: GenreBrief[];
  confidence: "high" | "medium" | "low" | null;
  identity: { confidence: Identity["confidence"] | null; sources: string[]; guessed: Guess[] } | null;
  /** Upcoming schedule blocks that play it. */
  upcoming: number;
  /** Published episodes made from it. */
  episodes_count: number;
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
  max_description: number;
}

export interface LibraryStats {
  total: number;
  songs: number;
  /** Songs of the automatic music, and how long it plays before repeating. */
  rotation: number;
  rotation_seconds: number;
  /** Commercials, jingles and effects. */
  spots: number;
  programs: number;
  authors: number;
}

/** Details the identification guessed instead of reading them from a source. */
export type Guess = "genres" | "year";

export interface Identity {
  confidence: "high" | "medium" | "low";
  score: number;
  sources: string[];
  ids: Record<string, string>;
  artist: { kind?: string; country?: string; musicbrainz_id?: string };
  guessed?: Guess[];
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
  guessed?: Guess[];
}

export type DuplicateVerdict = "same" | "version" | "possible";

/** A library song an upload may repeat, with what is needed to compare them. */
export interface DuplicateTrack {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  duration: number;
  genres: string[];
  cover_url: string | null;
  audio_url: string | null;
}

/** A song of the library (`track`) or an earlier song of the same upload (`batch`, its key) that a song repeats. */
export interface DuplicateMatch {
  verdict: DuplicateVerdict;
  reasons: string[];
  track?: DuplicateTrack;
  batch?: string;
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
  artist: string | null;
  kind: TrackKind;
  duration: number;
}

/** Episodes of the station by status, whatever page or filter is shown. */
export type EpisodeStats = Record<EpisodeStatus, number>;

export interface ReadyRecording {
  id: string;
  duration: number;
  started_at: string | null;
}

export interface EpisodeLimits extends UploadLimits {
  max_hashtags: number;
  hashtag_length: number;
  max_description: number;
}

/** GET /{frequency}/catalogo: a style of the shared catalog; `editable` when the station added it. */
export interface CatalogGenre extends GenreBrief {
  aliases: string[];
  custom: boolean;
  editable: boolean;
  /** Songs of the station with this style. */
  songs: number;
  /** Artists of the catalog with this style. */
  artists: number;
}

export interface CatalogArtist {
  id: string;
  name: string;
  aliases: string[];
  kind: string | null;
  country: string | null;
  source: string;
  editable: boolean;
  /** Songs of the station credited to this artist under any of its names. */
  songs: number;
  /** Main genre first. */
  genres: GenreBrief[];
}

export interface CatalogStats {
  genres: number;
  custom: number;
  own_genres: number;
  in_use: number;
  artists: number;
  learned: number;
  own_artists: number;
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
  kind: TrackKind;
  kind_label: string;
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
  upcoming: number;
  episodes: number;
}

export interface EditorListItem {
  id: string;
  title: string;
  credit: string | null;
  kind: TrackKind;
  kind_label: string;
  cover_url: string | null;
  duration: number;
  edited: boolean;
  edit_status: EditorTrack["edit_status"];
}

export interface EditorKindCount {
  value: TrackKind;
  label: string;
  count: number;
}

export interface EditorLimits {
  max_cuts: number;
  min_length: number;
  max_fade: number;
  max_join: number;
  max_gain: number;
  preview_seconds: number;
  target_lufs: number;
}

export interface EditorAnalysis {
  perSecond: number;
  peaks: string;
  duration: number;
  loudness: number | null;
  peak: number | null;
}
