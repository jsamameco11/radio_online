import { Loader2 } from "lucide-react";
import { Badge, type Tone } from "@/Components/ui/badge";
import { http } from "@/lib/http";
import { fieldErrors } from "@/lib/media/errors";
import type { Identification } from "@/types/media";

/** «Canción» and «cancion» are the same search. */
export function plain(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Four-digit year, or empty. */
export function cleanYear(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

/** Names of both lists without repeating anyone, keeping the first spelling. */
export function mergeNames(first: string[], second: string[], max: number) {
  const seen = new Set<string>();
  return [...first, ...second]
    .map((name) => name.trim())
    .filter((name) => {
      const key = plain(name).replace(/[^a-z0-9]/g, "");
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

export type LookupState = { status: "searching" } | { status: "found"; result: Identification } | { status: "missing" } | { status: "error"; error: string };

/** Asks the music catalogs (Apple Music, Deezer, MusicBrainz, Wikidata) and the station catalog who sings a song, its album and its genres. */
export async function identifySong(url: string, song: { title: string; artist: string; featured: string[]; duration?: number | null; genre?: string }): Promise<LookupState> {
  try {
    const result = await http.post<Identification>(url, {
      title: song.title.trim(),
      artist: song.artist.trim() || null,
      featured: song.featured.map((name) => name.trim()).filter(Boolean),
      duration: song.duration || null,
      genre: song.genre || null,
    });
    return result.found || result.genres.length ? { status: "found", result } : { status: "missing" };
  } catch (error) {
    return { status: "error", error: fieldErrors(error).message };
  }
}

const SOURCE_NAMES: Record<string, string> = { itunes: "Apple Music", deezer: "Deezer", musicbrainz: "MusicBrainz", wikidata: "Wikidata" };
const ARTIST_KINDS: Record<string, string> = { solo: "Solista", group: "Agrupación" };

/** How sure the internet lookup is, with the sources that confirmed it and what it only guessed. */
export function LookupBadge({ state }: { state: LookupState | null }) {
  if (!state) return null;
  if (state.status === "searching") {
    return (
      <Badge tone="info">
        <Loader2 className="size-3 animate-spin" /> Buscando en internet…
      </Badge>
    );
  }
  if (state.status === "error") {
    return (
      <span title={state.error}>
        <Badge tone="danger">No se pudo buscar en internet</Badge>
      </span>
    );
  }
  if (state.status === "missing") {
    return (
      <span title="Ninguna fuente la reconoció con seguridad. Revisa los datos.">
        <Badge>No la encontramos en internet</Badge>
      </span>
    );
  }
  const { result } = state;
  const sources = result.sources.map((source) => SOURCE_NAMES[source] ?? source).join(", ");
  const artist = result.identity?.artist;
  const who = [artist?.kind ? ARTIST_KINDS[artist.kind] : "", artist?.country ?? ""].filter(Boolean).join(" · ");
  const guessed = result.guessed ?? result.identity?.guessed ?? [];
  const [tone, text]: [Tone, string] = !result.found
    ? ["neutral", guessed.includes("genres") ? "No la encontramos en internet" : "Género según su autor"]
    : result.confidence === "high"
      ? ["onair", "Identificada en internet"]
      : result.confidence === "medium"
        ? ["warning", "Identificada · revísala"]
        : ["danger", "Coincidencia dudosa · revísala"];

  return (
    <>
      <span title={sources ? `Confirmado por: ${sources}` : undefined}>
        <Badge tone={tone}>{text}</Badge>
      </span>
      {who && <Badge>{who}</Badge>}
      {guessed.includes("genres") && (
        <span title="Ninguna fuente dijo su género, así que le pusimos uno probable para que no quede sin clasificar. Cámbialo si conoces el correcto.">
          <Badge tone="warning">Género sugerido · revísalo</Badge>
        </span>
      )}
      {guessed.includes("year") && (
        <span title="Las fuentes no coinciden en el álbum; el año es el del lanzamiento más antiguo de esta misma grabación. Corrígelo si sabes otro.">
          <Badge tone="warning">Año probable · revísalo</Badge>
        </span>
      )}
    </>
  );
}
