/**
 * The look of each highlight tier, by level (1 is the cheapest tier of
 * config('platform.chat.highlight_tiers')). Every tier gets its own tone
 * from the design tokens; the two most valuable ones also shine.
 */
export interface TierLook {
  name: string;
  card: string;
  accent: string;
  badge: string;
  bar: string;
  ring: string;
  sheen: boolean;
}

const looks: TierLook[] = [
  { name: "Destello", card: "border-info/30 bg-info-soft", accent: "text-info", badge: "bg-info text-white", bar: "bg-info", ring: "ring-info/40", sheen: false },
  { name: "Brillo", card: "border-onair/30 bg-onair-soft", accent: "text-onair", badge: "bg-onair text-white", bar: "bg-onair", ring: "ring-onair/40", sheen: false },
  { name: "Oro", card: "border-gold/40 bg-gold-soft", accent: "text-gold", badge: "bg-gold text-white", bar: "bg-gold", ring: "ring-gold/50", sheen: false },
  { name: "Fuego", card: "border-warning/40 bg-warning-soft", accent: "text-warning", badge: "bg-warning text-white", bar: "bg-warning", ring: "ring-warning/50", sheen: false },
  { name: "Estrella", card: "border-signal/40 bg-signal-soft", accent: "text-signal", badge: "bg-signal text-white", bar: "bg-signal", ring: "ring-signal/50", sheen: true },
  { name: "Leyenda", card: "border-royal/50 bg-royal-soft", accent: "text-royal", badge: "bg-royal text-white", bar: "bg-royal", ring: "ring-royal/60", sheen: true },
];

export function tierLook(level: number): TierLook {
  return looks[Math.min(Math.max(level, 1), looks.length) - 1];
}

/** 0 → "Sin fijar", 45 → "Fijado 45 s", 300 → "Fijado 5 min" */
export function pinLabel(seconds: number): string {
  if (seconds <= 0) return "Sin fijar";
  if (seconds < 60) return `Fijado ${seconds} s`;
  return `Fijado ${Math.round(seconds / 60)} min`;
}

/** Random key per message: a retried request is posted (and charged) once. */
export function newClientKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
