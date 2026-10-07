import type { ProgramItem } from "@/types/studio";

const locale = "es-PE";

/** "18:30" (or "18:30:15") of a moment in the station timezone. */
export function clock(ms: number, timeZone: string, seconds = false): string {
  return new Date(ms).toLocaleTimeString(locale, { timeZone, hour: "2-digit", minute: "2-digit", second: seconds ? "2-digit" : undefined, hour12: false });
}

/** Calendar day (Y-m-d) of a moment in the station timezone. */
export function localDate(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

/** "Hoy", "Mañana" or "jue. 9 oct." */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Hoy";
  if (date === addDays(today, 1)) return "Mañana";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** "45 s", "12 min", "1 h 20 min" */
export function longDuration(seconds: number): string {
  if (seconds > 0 && seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Short name for tight spots (decks, pads): the title cut at a word boundary. */
export function shortTitle(title: string, max = 26): string {
  const clean = title.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.55 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** The item on air; during a crossfade, the one coming in. */
export function currentItem<T extends Pick<ProgramItem, "start" | "end">>(queue: T[], now: number): T | null {
  let found: T | null = null;
  for (const item of queue) if (item.start <= now && now < item.end) found = item;
  return found;
}
