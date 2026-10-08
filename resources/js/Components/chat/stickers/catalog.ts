import type { LucideIcon } from "lucide-react";
import {
  BicepsFlexed,
  Bird,
  CalendarHeart,
  Cake,
  Disc3,
  Flame,
  Hand,
  HandHeart,
  Headphones,
  Heart,
  ListMusic,
  MapPin,
  MessageCircleHeart,
  MicVocal,
  MoonStar,
  Music,
  PartyPopper,
  RadioTower,
  Repeat2,
  Sparkles,
  Sticker,
  Sunrise,
  Sunset,
  ThumbsUp,
  TreePalm,
  Volume2,
  Wine,
} from "lucide-react";

export type StickerTone = "signal" | "gold" | "royal" | "onair" | "info" | "warning" | "danger";

/** The art of one sticker: a lucide icon or a short glyph ("100"), its tone, tilt and caption. */
export interface StickerLook {
  icon: LucideIcon | null;
  glyph: string | null;
  tone: StickerTone;
  tilt: string;
  caption: string;
}

export const stickerTones: Record<StickerTone, string> = {
  signal: "bg-signal",
  gold: "bg-gold",
  royal: "bg-royal",
  onair: "bg-onair",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
};

function icon(art: LucideIcon, tone: StickerTone, tilt: string, caption: string): StickerLook {
  return { icon: art, glyph: null, tone, tilt, caption };
}

function glyph(text: string, tone: StickerTone, tilt: string, caption: string): StickerLook {
  return { icon: null, glyph: text, tone, tilt, caption };
}

/** Keyed by App\Domain\Chat\Enums\ChatSticker values. */
const looks: Record<string, StickerLook> = {
  "hello-booth": icon(Hand, "info", "-rotate-3", "¡Hola, cabina!"),
  "good-morning": icon(Sunrise, "gold", "rotate-2", "Buenos días"),
  "good-afternoon": icon(Sunset, "warning", "-rotate-2", "Buenas tardes"),
  "good-night": icon(MoonStar, "royal", "rotate-3", "Buenas noches"),
  "hello-from-my-city": icon(MapPin, "signal", "-rotate-3", "Desde mi ciudad"),
  thanks: icon(HandHeart, "onair", "rotate-2", "¡Gracias!"),
  "on-air": icon(RadioTower, "signal", "-rotate-2", "Al aire"),
  banger: icon(Disc3, "royal", "rotate-3", "¡Temazo!"),
  "request-song": icon(ListMusic, "info", "-rotate-3", "Pide tu canción"),
  "volume-up": icon(Volume2, "warning", "rotate-2", "Sube el volumen"),
  dedication: icon(MessageCircleHeart, "signal", "-rotate-2", "Dedicatoria"),
  encore: icon(Repeat2, "onair", "rotate-3", "¡Otra!"),
  "mic-drop": icon(MicVocal, "danger", "-rotate-6", "Mic drop"),
  listening: icon(Headphones, "info", "rotate-2", "Te escucho"),
  fire: icon(Flame, "warning", "-rotate-3", "¡Fuego!"),
  "love-it": icon(Heart, "signal", "rotate-3", "Me encanta"),
  lol: glyph("JAJA", "gold", "-rotate-6", "Jajaja"),
  wow: icon(Sparkles, "royal", "rotate-2", "¡Wow!"),
  applause: icon(ThumbsUp, "onair", "-rotate-2", "¡Aplausos!"),
  blessings: icon(Bird, "info", "rotate-3", "Bendiciones"),
  strength: icon(BicepsFlexed, "danger", "-rotate-3", "¡Fuerza!"),
  hundred: glyph("100", "signal", "rotate-6", "¡Al cien!"),
  "lets-dance": icon(Music, "royal", "-rotate-3", "¡A bailar!"),
  "happy-birthday": icon(Cake, "signal", "rotate-2", "Feliz cumple"),
  cheers: icon(Wine, "gold", "-rotate-2", "¡Salud!"),
  party: icon(PartyPopper, "warning", "rotate-3", "¡Fiesta!"),
  friday: icon(CalendarHeart, "onair", "-rotate-3", "¡Viernes!"),
  weekend: icon(TreePalm, "info", "rotate-2", "¡Finde!"),
};

/** The art of a sticker; one the backend added before its art shows a generic sticker with its name. */
export function stickerLook(key: string, label: string): StickerLook {
  return looks[key] ?? icon(Sticker, "royal", "-rotate-2", label);
}
