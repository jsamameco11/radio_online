import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { unseenRing } from "./story-style";

interface StoryRingProps {
  seen: boolean;
  /** Round the ring like the logo it wraps ("rounded-full", "rounded-3xl"…). */
  className?: string;
  /** Color of the gap between ring and logo: the surface the ring sits on. */
  gap?: string;
  children: ReactNode;
}

/** The ring around a station logo with stories: colored while some are not seen, muted after. */
export function StoryRing({ seen, className, gap = "bg-canvas", children }: StoryRingProps) {
  return (
    <span className={cn("block p-[3px]", seen && "bg-line-strong", className)} style={seen ? undefined : { background: unseenRing }}>
      <span className={cn("block rounded-[inherit] p-[2px]", gap)}>{children}</span>
    </span>
  );
}
