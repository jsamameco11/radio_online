import { cn } from "@/lib/cn";

/** Initials of the first two meaningful words of a title: «La fe que mueve montañas» → «FM». */
function initials(title: string): string {
  const words = title.split(/\s+/).filter((word) => word.length > 2);
  return (words.length ? words : title.split(/\s+/).filter(Boolean))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/** Square cover of an episode; without an image it shows the initials of the title. */
export function EpisodeCover({ src, title, className }: { src: string | null; title: string; className?: string }) {
  if (src) return <img src={src} alt="" loading="lazy" className={cn("shrink-0 object-cover", className)} />;
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center bg-signal-soft font-display font-semibold tracking-wide text-signal ring-1 ring-line ring-inset", className)}>
      <span>{initials(title) || "EP"}</span>
    </span>
  );
}
