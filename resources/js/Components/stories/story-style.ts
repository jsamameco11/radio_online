import type { StoryBackground } from "@/types/stories";

/** Backdrops of text stories, painted only with the design tokens. */
export const storyBackgrounds: Record<StoryBackground, string> = {
  signal: "linear-gradient(160deg, var(--signal), var(--royal))",
  royal: "linear-gradient(160deg, var(--royal), var(--info))",
  ocean: "linear-gradient(160deg, var(--info), var(--onair))",
  aurora: "linear-gradient(160deg, var(--onair), var(--royal))",
  sunset: "linear-gradient(160deg, var(--gold), var(--signal))",
  night: "linear-gradient(160deg, color-mix(in oklab, var(--info) 35%, black), color-mix(in oklab, var(--royal) 30%, black))",
};

/** The ring around a station with stories not seen yet. */
export const unseenRing = "conic-gradient(from 210deg, var(--signal), var(--gold), var(--royal), var(--signal))";

/** Font size of a text story, relative to the stage width so the preview and the viewer match. */
export function storyTextSize(text: string): string {
  const length = text.trim().length;
  if (length <= 40) return "10cqw";
  if (length <= 90) return "8cqw";
  if (length <= 160) return "6.5cqw";
  return "5.5cqw";
}

/** "Quedan 5 h", "Quedan 12 min" */
export function timeLeft(expiresAt: string): string {
  const minutes = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
  if (minutes < 1) return "Vence ahora";
  if (minutes < 60) return `Quedan ${minutes} min`;
  return `Quedan ${Math.round(minutes / 60)} h`;
}

const SEEN_KEY = "stories:seen";
const MUTED_KEY = "stories:muted";

function seenMap(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Up to which story (its date) this browser watched each station, so a guest whose session
 * changed still sees the ring muted. The server keeps the authoritative record.
 */
export function seenUntil(stationId: number): string | null {
  return seenMap()[String(stationId)] ?? null;
}

export function rememberSeen(stationId: number, createdAt: string) {
  const map = seenMap();
  const previous = map[String(stationId)];
  if (previous && previous >= createdAt) return;
  map[String(stationId)] = createdAt;
  const entries = Object.entries(map)
    .sort(([, a], [, b]) => (a < b ? 1 : -1))
    .slice(0, 200);
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(entries)));
}

export function storedMuted(): boolean {
  return window.localStorage.getItem(MUTED_KEY) !== "0";
}

export function storeMuted(muted: boolean) {
  window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
}
