import type { Autopilot, BroadcastPlaylist, ProgramKind } from "@/types/studio";

export const KIND_LABEL: Record<ProgramKind, string> = {
  song: "Canción",
  jingle: "Jingle",
  effect: "Efecto",
  commercial: "Comercial",
  program: "Programa grabado",
  live: "En vivo",
  auto: "Música automática",
  fill: "Música automática",
};

/** Colour that tells each kind of audio apart in the console. */
export const KIND_DOT: Record<ProgramKind, string> = {
  song: "bg-signal",
  jingle: "bg-gold",
  effect: "bg-royal",
  commercial: "bg-info",
  program: "bg-onair",
  live: "bg-danger",
  auto: "bg-signal",
  fill: "bg-signal",
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind as ProgramKind] ?? kind;
}

/** What the automatic music plays, in words: «Lista «Éxitos» · aleatorio» or «Canciones aleatorias». */
export function sourceLabel(playlists: BroadcastPlaylist[], playlist: string | null, shuffle: boolean): string {
  const list = playlists.find((item) => item.id === playlist);
  return list ? `Lista «${list.name}» · ${shuffle ? "aleatorio" : "en orden"}` : "Canciones aleatorias";
}

/** What the operator should know when the automatic music sounds from a fallback, or files left the air. */
export function fallbackMessages(autopilot: Autopilot): string[] {
  const messages: string[] = [];
  if (autopilot.level === "library") messages.push("Tus listas no tienen canciones disponibles: las canciones aleatorias salen de toda la biblioteca.");
  if (autopilot.level === "none") {
    messages.push(
      autopilot.playlist
        ? "La lista elegida no tiene canciones disponibles: los espacios libres quedan en silencio. Agrégale canciones o elige otra."
        : "No hay canciones disponibles: los espacios libres quedan en silencio. Sube música a la biblioteca.",
    );
  }
  if (autopilot.broken > 0) {
    messages.push(`${autopilot.broken} ${autopilot.broken === 1 ? "audio salió" : "audios salieron"} del aire porque su archivo no se pudo reproducir. Revísalos en la biblioteca.`);
  }
  if (autopilot.finished) messages.push("La música automática terminó su vuelta y no se repite: los espacios libres quedan en silencio hasta que la inicies de nuevo.");
  return messages;
}
