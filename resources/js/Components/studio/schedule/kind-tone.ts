import type { ProgramKind } from "@/types/studio";

/** Fill of each kind on the lanes of the day. */
export const KIND_TONE: Partial<Record<ProgramKind, string>> = {
  song: "bg-signal/70",
  jingle: "bg-gold/70",
  effect: "bg-info/70",
  commercial: "bg-warning/70",
  program: "bg-info/50",
  live: "bg-onair/70",
  auto: "bg-raised border border-dashed border-line-strong",
};

/** Dot of each kind on the rows of the timeline, the same hue as its lane. */
export const KIND_DOT: Record<ProgramKind, string> = {
  song: "bg-signal",
  jingle: "bg-gold",
  effect: "bg-info",
  commercial: "bg-warning",
  program: "bg-info/60",
  live: "bg-onair",
  auto: "bg-signal/40 ring-1 ring-signal",
  fill: "bg-signal/40",
};
