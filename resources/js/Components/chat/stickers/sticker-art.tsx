import { stickerLook, stickerTones } from "@/Components/chat/stickers/catalog";
import { cn } from "@/lib/cn";
import type { ChatStickerRef } from "@/types/chat";

export type StickerSize = "sm" | "md" | "lg";

const sizes: Record<StickerSize, { box: string; border: string; icon: string; glyph: string; caption: string }> = {
  sm: { box: "size-16", border: "border-[3px]", icon: "size-6", glyph: "text-lg", caption: "text-[0.5rem]" },
  md: { box: "size-20", border: "border-4", icon: "size-8", glyph: "text-2xl", caption: "text-[0.6rem]" },
  lg: { box: "size-26", border: "border-[5px]", icon: "size-11", glyph: "text-3xl", caption: "text-[0.75rem]" },
};

interface StickerArtProps {
  sticker: ChatStickerRef;
  size?: StickerSize;
  /** Lands with a small bounce when it mounts (never with reduced motion). */
  pop?: boolean;
  /** Inside a control that already names the sticker. */
  decorative?: boolean;
  className?: string;
}

/** A chat sticker: a tilted die-cut badge with a white outline, its art and a bold caption. */
export function StickerArt({ sticker, size = "md", pop = true, decorative = false, className }: StickerArtProps) {
  const look = stickerLook(sticker.key, sticker.label);
  const scale = sizes[size];
  const Icon = look.icon;

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `Sticker «${sticker.label}»`}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : sticker.label}
      className={cn("inline-block shrink-0 select-none", scale.box, look.tilt, className)}
    >
      <span
        className={cn(
          "relative flex size-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[30%] border-white px-1 text-white shadow-lg ring-1 shadow-black/25 ring-black/10",
          scale.border,
          stickerTones[look.tone],
          pop && "animate-sticker-pop",
        )}
      >
        <span className="pointer-events-none absolute -top-1/3 -left-1/4 size-3/4 rounded-full bg-white/20" aria-hidden />
        {Icon ? (
          <Icon className={cn("relative drop-shadow-sm", scale.icon)} strokeWidth={2.5} aria-hidden />
        ) : (
          <span className={cn("relative font-display leading-none font-black tracking-tight drop-shadow-sm", scale.glyph)}>{look.glyph}</span>
        )}
        <span className={cn("relative text-center font-display leading-[1.05] font-bold tracking-tight uppercase", scale.caption)}>{look.caption}</span>
      </span>
    </span>
  );
}
