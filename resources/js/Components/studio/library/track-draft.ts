import { appendField } from "@/lib/media/upload";
import type { Identification, Identity, LibraryTrack, TrackKind } from "@/types/media";

/** What the library form edits for one audio, before it is sent. */
export interface TrackDraft {
  kind: TrackKind;
  title: string;
  artist: string;
  featured: string[];
  album: string;
  year: string;
  genreIds: string[];
  rotation: boolean;
  cover: Blob | null;
  coverUrl: string | null;
  removeCover: boolean;
  identity: Identity | null;
}

export function emptyDraft(kind: TrackKind): TrackDraft {
  return { kind, title: "", artist: "", featured: [], album: "", year: "", genreIds: [], rotation: false, cover: null, coverUrl: null, removeCover: false, identity: null };
}

export function draftFromTrack(track: LibraryTrack): TrackDraft {
  return {
    kind: track.kind,
    title: track.title,
    artist: track.artist ?? "",
    featured: track.featured,
    album: track.album ?? "",
    year: track.year ? String(track.year) : "",
    genreIds: track.genres.map((genre) => genre.id),
    rotation: track.rotation,
    cover: null,
    coverUrl: null,
    removeCover: false,
    identity: null,
  };
}

/** Fills the draft with what the identification found, keeping what the user already chose. */
export function applyIdentification(draft: TrackDraft, found: Identification, maxGenres: number): TrackDraft {
  if (!found.found) return { ...draft, genreIds: draft.genreIds.length ? draft.genreIds : found.genres.map((genre) => genre.id).slice(0, maxGenres) };
  return {
    ...draft,
    title: found.title ?? draft.title,
    artist: found.artist ?? draft.artist,
    featured: found.featured.length ? found.featured : draft.featured,
    album: found.album ?? draft.album,
    year: found.year ? String(found.year) : draft.year,
    genreIds: draft.genreIds.length ? draft.genreIds : found.genres.map((genre) => genre.id).slice(0, maxGenres),
    coverUrl: draft.cover ? null : found.cover_url,
    identity: found.identity,
  };
}

/** The draft as the library endpoints read it. */
export function draftForm(draft: TrackDraft, duration: number | null): FormData {
  const form = new FormData();
  const song = draft.kind === "song";
  appendField(form, "kind", draft.kind);
  appendField(form, "title", draft.title.trim());
  appendField(form, "artist", draft.artist.trim());
  if (song) {
    appendField(form, "featured", draft.featured);
    appendField(form, "album", draft.album.trim());
    appendField(form, "year", draft.year);
    appendField(form, "genre_ids", draft.genreIds);
    appendField(form, "rotation", draft.rotation);
    appendField(form, "identity", draft.identity);
  }
  appendField(form, "duration", duration);
  if (draft.cover) form.append("cover", draft.cover, draft.cover instanceof File ? draft.cover.name : `portada.${draft.cover.type.split("/")[1] || "jpg"}`);
  else appendField(form, "cover_url", draft.coverUrl);
  if (draft.removeCover) appendField(form, "remove_cover", true);
  return form;
}
