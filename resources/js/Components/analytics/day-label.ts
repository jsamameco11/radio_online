import { dateTime } from "@/lib/format";

/** "2026-10-07" (a platform-timezone day) → "7 oct" */
export function dayLabel(day: string): string {
  return dateTime(`${day}T12:00:00-05:00`, { day: "numeric", month: "short" });
}
