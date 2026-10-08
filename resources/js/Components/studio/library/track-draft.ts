import { appendField } from "@/lib/media/upload";
import type { Identification, Identity, LibraryTrack, TrackKind } from "@/types/media";
import { mergeNames, plain } from "./song-tools";

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
  duck: boolean;
  active: boolean;
  cover: Blob | null;
  coverUrl: string | null;
  removeCover: boolean;
  identity: Identity | null;
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
    duck: track.duck,
    active: track.active,
    cover: null,
    coverUrl: null,
    removeCover: false,
    identity: null,
  };
}

/**
 * Fills the draft with what a lookup asked on purpose found: a sure answer (high or medium confidence) replaces the
 * details, a doubtful one only fills what is empty. The cover is taken when the song has none of its own.
 */
export function applyLookup(draft: TrackDraft, found: Identification, limits: { max_genres: number; max_featured: number }, hasCover: boolean): TrackDraft {
  const sure = found.found && (found.confidence === "high" || found.confidence === "medium");
  const next = { ...draft };
  if (found.found) {
    if (sure && found.title) next.title = found.title;
    if (found.artist && (sure || !draft.artist.trim())) next.artist = found.artist;
    if (found.album && (sure || !draft.album.trim())) next.album = found.album;
    if (found.year && (sure || !draft.year)) next.year = String(found.year);
    const main = plain(next.artist);
    next.featured = mergeNames(
      draft.featured.filter((name) => plain(name) !== main),
      found.featured,
      limits.max_featured,
    );
    if (found.cover_url && !draft.cover && (!hasCover || draft.removeCover || draft.coverUrl)) {
      next.coverUrl = found.cover_url;
      next.removeCover = false;
    }
    next.identity = found.identity ? { ...found.identity, guessed: found.guessed } : null;
  }
  if (found.genres.length && (sure || draft.genreIds.length === 0)) next.genreIds = found.genres.map((genre) => genre.id).slice(0, limits.max_genres);
  return next;
}

/** The draft as the library endpoints read it. */
export function draftForm(draft: TrackDraft, duration: number | null): FormData {
  const form = new FormData();
  const song = draft.kind === "song";
  appendField(form, "kind", draft.kind);
  appendField(form, "title", draft.title.trim());
  appendField(form, "artist", draft.artist.trim());
  appendField(form, "duck", draft.duck);
  appendField(form, "active", draft.active);
  if (song) {
    appendField(form, "featured", draft.featured);
    appendField(form, "album", draft.album.trim());
    appendField(form, "year", draft.year);
    appendField(form, "genre_ids", draft.genreIds);
    appendField(form, "rotation", draft.rotation && draft.active);
    appendField(form, "identity", draft.identity);
  }
  appendField(form, "duration", duration);
  if (draft.cover) form.append("cover", draft.cover, draft.cover instanceof File ? draft.cover.name : `portada.${draft.cover.type.split("/")[1] || "jpg"}`);
  else appendField(form, "cover_url", draft.coverUrl);
  if (draft.removeCover) appendField(form, "remove_cover", true);
  return form;
}
