import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { meterLevel } from "@/lib/radio/voice";

/** A live level bar of an analyser (the microphone or the monitor), drawn without re-rendering React. */
export function LevelMeter({ analyser, className, label }: { analyser: AnalyserNode | null; className?: string; label: string }) {
  const bar = useRef<HTMLSpanElement>(null);
  const peak = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!analyser) {
      if (bar.current) bar.current.style.width = "0%";
      if (peak.current) peak.current.style.left = "0%";
      return;
    }
    const buffer = new Float32Array(analyser.fftSize);
    let frame = 0;
    let held = 0;
    const draw = () => {
      const { level } = meterLevel(analyser, buffer);
      held = Math.max(level, held - 0.008);
      if (bar.current) bar.current.style.width = `${Math.round(level * 100)}%`;
      if (peak.current) peak.current.style.left = `${Math.round(held * 100)}%`;
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [analyser]);

  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} className={cn("relative h-2 overflow-hidden rounded-full bg-raised", className)}>
      <span ref={bar} className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-onair via-gold to-danger transition-[width] duration-75" />
      <span ref={peak} className="absolute inset-y-0 w-0.5 bg-ink/70" />
    </div>
  );
}
