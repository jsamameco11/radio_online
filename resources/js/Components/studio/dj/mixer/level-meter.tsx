/** A vertical level meter; `cover` receives the element that hides the gradient above the level. */
export function LevelMeter({ cover, label }: { cover: (element: HTMLSpanElement | null) => void; label: string }) {
  return (
    <div role="meter" aria-label={label} className="relative h-36 w-2.5 overflow-hidden rounded-full bg-gradient-to-t from-onair via-gold to-danger">
      <span ref={cover} className="absolute inset-x-0 top-0 h-full bg-raised transition-[height] duration-75" />
    </div>
  );
}
