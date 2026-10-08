import { AudioLines } from "lucide-react";
import { cn } from "@/lib/cn";

/** The cover of an audio, or a waveform glyph when it has none. */
export function Cover({ src, className }: { src: string | null; className?: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={cn("shrink-0 rounded-xl object-cover", className)} />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl bg-raised text-faint", className)}>
      <AudioLines className="size-5" />
    </span>
  );
}
