import { useCallback, useEffect, useState } from "react";
import { StationLogo } from "@/Components/station/station-identity";
import { cn } from "@/lib/cn";
import { http } from "@/lib/http";
import type { Station } from "@/types";
import type { StationStories, Story } from "@/types/stories";
import { StoryRing } from "./story-ring";
import { seenUntil } from "./story-style";
import { StoryViewer } from "./story-viewer";

/**
 * The large logo of a station page. When the station has estados it gets the ring and
 * opens them; otherwise it is the plain logo.
 */
export function StoryLogo({ station, className }: { station: Station; className?: string }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [reasons, setReasons] = useState<StationStories["report_reasons"]>([]);
  const [seen, setSeen] = useState(false);
  const [open, setOpen] = useState(false);
  const slug = station.frequency.slug;

  useEffect(() => {
    let active = true;
    http
      .get<StationStories>(`/radio/${slug}/estados`)
      .then((data) => {
        if (!active) return;
        const until = seenUntil(station.id);
        const newest = data.stories.at(-1);
        setStories(data.stories);
        setReasons(data.report_reasons);
        setSeen(newest !== undefined && (data.stories.every((story) => story.seen) || (until !== null && until >= newest.created_at)));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [slug, station.id]);

  const markSeen = useCallback((_station: Station, _story: Story, last: boolean) => {
    if (last) setSeen(true);
  }, []);

  if (stories.length === 0) return <StationLogo station={station} size="lg" className={className} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative z-10 shrink-0 rounded-[1.9rem] transition hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal motion-reduce:transition-none motion-reduce:hover:scale-100 sm:rounded-[2.4rem]"
        aria-label={`Ver los estados de ${station.display_name}`}
      >
        <StoryRing seen={seen} gap="bg-surface" className="rounded-[inherit]">
          <StationLogo station={station} size="lg" className={cn(className, "ring-0 shadow-none")} />
        </StoryRing>
      </button>
      {open && <StoryViewer stations={[station]} initial={{ [slug]: stories }} reportReasons={reasons} onClose={() => setOpen(false)} onSeen={markSeen} />}
    </>
  );
}
