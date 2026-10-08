import { ArrowLeft, ChevronRight, Music } from "lucide-react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { Input, Select } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import type { LibraryTrack, Option } from "@/types/media";
import { plain } from "./song-tools";

/** How the library is browsed: every audio, the songs of each author, or the songs of each genre. */
export type LibraryView = "audios" | "authors" | "styles";

/** An author or a genre with its songs: `main` are those where the author is the main one (all, for a genre). */
export interface Shelf {
  key: string;
  name: string;
  family?: string;
  songs: LibraryTrack[];
  main: number;
  seconds: number;
  covers: string[];
  tags: string[];
}

export const NO_STYLE = "sin-estilo";

/** «45 min», «3 h 05 min»: how long a set of songs plays. */
export function longDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return `${Math.round(seconds)} s`;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

function count(value: number, one: string, many: string) {
  return `${value} ${value === 1 ? one : many}`;
}

/** The names that come up most among the songs, most frequent first. */
function mostCommon(names: string[], limit: number) {
  const tally = new Map<string, { name: string; times: number }>();
  for (const name of names) {
    const entry = tally.get(plain(name)) ?? { name, times: 0 };
    entry.times++;
    tally.set(plain(name), entry);
  }
  return [...tally.values()]
    .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name, "es"))
    .slice(0, limit)
    .map((entry) => entry.name);
}

function shelf(key: string, name: string, songs: LibraryTrack[], main: number, tags: string[], family?: string): Shelf {
  return {
    key,
    name,
    family,
    songs,
    main,
    seconds: songs.reduce((sum, track) => sum + track.duration, 0),
    covers: [...new Set(songs.map((track) => track.cover_url).filter((cover): cover is string => Boolean(cover)))].slice(0, 4),
    tags,
  };
}

/** Each author with the songs they sing, as main author or as a guest; the same name written alike counts once. */
export function artistShelves(songs: LibraryTrack[]): Shelf[] {
  const found = new Map<string, { name: string; songs: LibraryTrack[]; main: number }>();
  for (const track of songs) {
    const credits = [track.artist ?? "", ...track.featured].map((name) => name.trim()).filter(Boolean);
    credits.forEach((name, index) => {
      const key = plain(name);
      const entry = found.get(key) ?? { name, songs: [], main: 0 };
      if (entry.songs.includes(track)) return;
      entry.songs.push(track);
      if (index === 0) entry.main++;
      found.set(key, entry);
    });
  }
  return [...found.entries()].map(([key, entry]) =>
    shelf(
      key,
      entry.name,
      entry.songs,
      entry.main,
      mostCommon(
        entry.songs.flatMap((track) => track.genres.map((genre) => genre.name)),
        2,
      ),
    ),
  );
}

/** Each genre with its songs, and the songs still without a genre apart. */
export function styleShelves(songs: LibraryTrack[]): Shelf[] {
  const found = new Map<string, { name: string; family: string; songs: LibraryTrack[] }>();
  for (const track of songs) {
    for (const genre of track.genres) {
      const entry = found.get(genre.id) ?? { name: genre.name, family: genre.family, songs: [] };
      entry.songs.push(track);
      found.set(genre.id, entry);
    }
  }
  const authors = (list: LibraryTrack[]) =>
    mostCommon(
      list.map((track) => track.artist ?? "").filter(Boolean),
      3,
    );
  const shelves = [...found.entries()].map(([key, entry]) => shelf(key, entry.name, entry.songs, entry.songs.length, authors(entry.songs), entry.family));
  const loose = songs.filter((track) => !track.genres.length);
  return loose.length ? [...shelves, shelf(NO_STYLE, "Sin género asignado", loose, loose.length, authors(loose))] : shelves;
}

/** «5 canciones · 2 como invitado · 23 min» */
function summary(item: Shelf, authors: boolean) {
  const guest = item.songs.length - item.main;
  return [count(item.songs.length, "canción", "canciones"), authors && guest ? `${guest} como invitado` : "", longDuration(item.seconds)].filter(Boolean).join(" · ");
}

function initial(name: string) {
  const letter = plain(name).match(/[a-z]/)?.[0];
  return letter ? letter.toUpperCase() : "#";
}

/** The authors or genres as cards to open: sorted by songs or by name, authors by letter, genres grouped by family. */
export function ShelfBrowser({ view, shelves, families, query, onQuery, onOpen }: { view: Exclude<LibraryView, "audios">; shelves: Shelf[]; families: Option[]; query: string; onQuery: (query: string) => void; onOpen: (key: string) => void }) {
  const [order, setOrder] = useState<"songs" | "name">("songs");
  const [family, setFamily] = useState("");
  const authors = view === "authors";
  const needle = plain(query.trim());
  const shown = shelves
    .filter((item) => (!family || item.family === family) && (!needle || plain(`${item.name} ${item.tags.join(" ")}`).includes(needle)))
    .sort((a, b) => (order === "songs" ? b.songs.length - a.songs.length : 0) || a.name.localeCompare(b.name, "es"));
  const usedFamilies = families.filter((option) => shelves.some((item) => item.family === option.value));
  const groups = authors
    ? order === "name"
      ? [...new Set(shown.map((item) => initial(item.name)))].map((letter) => ({ key: letter, label: letter, items: shown.filter((item) => initial(item.name) === letter) }))
      : [{ key: "all", label: "", items: shown }]
    : [
        ...usedFamilies.map((option) => ({ key: option.value, label: option.label, items: shown.filter((item) => item.family === option.value) })),
        { key: NO_STYLE, label: "Por clasificar", items: shown.filter((item) => item.key === NO_STYLE) },
      ].filter((group) => group.items.length);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={query} onChange={(event) => onQuery(event.target.value)} placeholder={authors ? "Buscar autor o agrupación…" : "Buscar género…"} aria-label={authors ? "Buscar autor" : "Buscar género"} className="min-w-0 flex-1 sm:w-72 sm:flex-none" />
        {!authors && usedFamilies.length > 1 && (
          <Select value={family} onChange={(event) => setFamily(event.target.value)} className="w-auto" aria-label="Filtrar por familia">
            <option value="">Todas las familias</option>
            {usedFamilies.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
        <Select value={order} onChange={(event) => setOrder(event.target.value as "songs" | "name")} className="w-auto sm:ml-auto" aria-label="Ordenar">
          <option value="songs">Con más canciones primero</option>
          <option value="name">Por nombre (A–Z)</option>
        </Select>
      </div>

      {groups.length === 0 && (
        <p className="mt-5 rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          {shelves.length === 0 ? (authors ? "Aún no hay canciones con autor." : "Aún no hay canciones.") : authors ? "No hay autores con ese nombre." : "No hay géneros con ese nombre."}
        </p>
      )}
      {groups.map((group) => (
        <div key={group.key} className="mt-5">
          {group.label && (
            <h3 className="text-[0.68rem] font-semibold tracking-[0.12em] text-muted uppercase">
              {group.label} · {group.items.length}
            </h3>
          )}
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => (
              <li key={item.key}>
                <button type="button" onClick={() => onOpen(item.key)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 text-left transition hover:border-line-strong hover:bg-raised">
                  <Artwork covers={item.covers} name={item.name} round={authors} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-semibold", item.key === NO_STYLE && "text-warning")}>{item.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">{summary(item, authors)}</span>
                    {item.tags.length > 0 && <span className="mt-0.5 block truncate text-xs text-faint">{item.tags.join(" · ")}</span>}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The top of an open author or genre: back to every card, its picture, and what it holds. */
export function ShelfHeader({ view, shelf: item, families, onBack }: { view: Exclude<LibraryView, "audios">; shelf: Shelf; families: Option[]; onBack: () => void }) {
  const authors = view === "authors";
  const kicker = authors
    ? item.main === item.songs.length
      ? "Autor"
      : item.main
        ? "Autor e invitado"
        : "Invitado"
    : item.family
      ? (families.find((option) => option.value === item.family)?.label ?? "Género")
      : "Por clasificar";

  return (
    <div>
      <Button size="sm" variant="ghost" icon={<ArrowLeft className="size-3.5" />} onClick={onBack}>
        {authors ? "Todos los autores" : "Todos los géneros"}
      </Button>
      <div className="mt-2 flex items-center gap-4 rounded-2xl bg-raised p-4">
        <Artwork covers={item.covers} name={item.name} round={authors} size="size-20" />
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold tracking-[0.12em] text-muted uppercase">{kicker}</p>
          <h2 className="mt-1 truncate font-display text-2xl font-semibold">{item.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {summary(item, authors)}
            {item.tags.length > 0 && ` · ${authors ? "" : "Sobre todo "}${item.tags.join(", ")}`}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Up to four covers of the songs; without covers, the initials of an author or a note for a genre. */
function Artwork({ covers, name, round, size = "size-14" }: { covers: string[]; name: string; round: boolean; size?: string }) {
  const shape = cn(size, "shrink-0 overflow-hidden bg-raised", round ? "rounded-full" : "rounded-xl");
  if (covers.length >= 4) {
    return (
      <span className={cn(shape, "grid grid-cols-2 grid-rows-2")}>
        {covers.map((cover) => (
          <img key={cover} src={cover} alt="" className="size-full object-cover" loading="lazy" />
        ))}
      </span>
    );
  }
  if (covers.length) {
    return (
      <span className={shape}>
        <img src={covers[0]} alt="" className="size-full object-cover" loading="lazy" />
      </span>
    );
  }
  const letters = name
    .split(/\s+/)
    .filter((word) => /\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => word.match(/\p{L}/u)?.[0]?.toUpperCase())
    .join("");
  return <span className={cn(shape, "grid place-items-center border border-line text-muted")}>{round && letters ? <span className="text-sm font-semibold tracking-wide">{letters}</span> : <Music className="size-5" />}</span>;
}
