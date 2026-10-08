import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import type { Story } from "@/types/stories";
import { storyBackgrounds, storyTextSize } from "./story-style";

type StageStory = Pick<Story, "kind" | "media_url" | "poster_url" | "text" | "background">;

interface StoryStageProps {
  story: StageStory;
  /** Video only: the element the viewer drives (play, pause, progress). */
  videoRef?: Ref<HTMLVideoElement>;
  muted?: boolean;
  /** Shows the poster frame instead of playing a video, for thumbnails. */
  still?: boolean;
  /** Plays the video in a loop by itself, for previews. */
  loop?: boolean;
  /** The photo or video can be shown (or failed); never called for text, which is ready at once. */
  onReady?: () => void;
  onEnded?: () => void;
  className?: string;
  children?: ReactNode;
}

/**
 * A story drawn on a 9:16 stage: the photo or video fitted over a blurred copy of itself,
 * or the text over its backdrop. Text sizes follow the stage width (container units), so a
 * preview in the studio looks exactly like the viewer.
 */
export function StoryStage({ story, videoRef, muted = true, still = false, loop = false, onReady, onEnded, className, children }: StoryStageProps) {
  const backdrop = story.kind === "video" ? story.poster_url : story.kind === "image" ? story.media_url : null;
  const caption = story.kind !== "text" && story.text;

  return (
    <div className={cn("relative aspect-[9/16] overflow-hidden bg-black [container-type:inline-size]", className)}>
      {story.kind === "text" ? (
        <div
          className="absolute inset-0 flex items-center justify-center p-[8cqw] text-center"
          style={{ background: storyBackgrounds[story.background ?? "signal"] }}
        >
          <p className="font-display leading-tight font-semibold break-words whitespace-pre-line text-white" style={{ fontSize: storyTextSize(story.text ?? "") }}>
            {story.text}
          </p>
        </div>
      ) : (
        <>
          {backdrop && <img src={backdrop} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl" />}
          {story.kind === "image" || still ? (
            (story.kind === "image" ? story.media_url : story.poster_url) && (
              <img
                src={(story.kind === "image" ? story.media_url : story.poster_url) ?? undefined}
                alt={story.text ?? ""}
                className="absolute inset-0 size-full object-contain"
                onLoad={onReady}
                onError={onReady}
                draggable={false}
              />
            )
          ) : (
            <video
              ref={videoRef}
              src={story.media_url ?? undefined}
              poster={story.poster_url ?? undefined}
              className="absolute inset-0 size-full object-contain"
              muted={muted}
              loop={loop}
              autoPlay={loop}
              playsInline
              preload="auto"
              onLoadedData={onReady}
              onError={onReady}
              onEnded={onEnded}
            />
          )}
          {caption && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-[6cqw] pt-[16cqw] pb-[20cqw]">
              <p className="text-center leading-snug break-words whitespace-pre-line text-white" style={{ fontSize: "4.4cqw" }}>
                {caption}
              </p>
            </div>
          )}
        </>
      )}
      {children}
    </div>
  );
}
