import type { PointerEvent } from "react";
import { useEffect, useRef } from "react";
import type { Cut } from "@/lib/media/editor/recipe";

interface Props {
  peaks: Int8Array | null;
  perSecond: number;
  duration: number;
  view: Cut;
  cuts: Cut[];
  selection: Cut | null;
  playhead: number;
  fadeIn: number;
  fadeOut: number;
  onSeek: (time: number) => void;
  onSelect: (range: Cut | null) => void;
}

/** Design tokens as they apply to the element, so the canvas follows the (dark) studio theme. */
function token(element: Element, name: string, fallback: string) {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

/**
 * The audio drawn from the server peaks (a minimum and a maximum per slice) for the visible range:
 * the parts that are cut out are dimmed, the selection is highlighted and the playhead follows the audio.
 * Click to move the playhead; drag to select.
 */
export function Waveform({ peaks, perSecond, duration, view, cuts, selection, playhead, fadeIn, fadeOut, onSeek, onSelect }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ from: number; x: number } | null>(null);
  const [from, to] = view;
  const span = Math.max(0.01, to - from);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = element.clientWidth;
      const height = element.clientHeight;
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      const context = element.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const x = (time: number) => ((time - from) / span) * width;
      const middle = height / 2;
      const color = (name: string, fallback: string) => token(element, name, fallback);
      const wave = color("--signal", "#888");
      const muted = color("--faint", "#555");
      const danger = color("--danger", "#c33");

      context.fillStyle = color("--line", "#333");
      context.fillRect(0, middle, width, 1);

      if (peaks && peaks.length > 1) {
        const slices = peaks.length / 2;
        for (let column = 0; column < width; column++) {
          const start = from + (column / width) * span;
          const end = from + ((column + 1) / width) * span;
          const first = Math.max(0, Math.floor(start * perSecond));
          const last = Math.min(slices - 1, Math.max(first, Math.ceil(end * perSecond) - 1));
          if (first >= slices) break;
          let low = 0;
          let high = 0;
          for (let slice = first; slice <= last; slice++) {
            low = Math.min(low, peaks[slice * 2]);
            high = Math.max(high, peaks[slice * 2 + 1]);
          }
          const isCut = cuts.some(([a, b]) => start >= a && start < b);
          context.fillStyle = isCut ? muted : wave;
          const top = middle - (high / 128) * middle;
          const bottom = middle - (low / 128) * middle;
          context.fillRect(column, top, 1, Math.max(1, bottom - top));
        }
      }

      context.fillStyle = danger;
      context.globalAlpha = 0.18;
      for (const [a, b] of cuts) {
        if (b < from || a > to) continue;
        context.fillRect(x(a), 0, x(b) - x(a), height);
      }
      context.globalAlpha = 0.12;
      context.fillStyle = color("--ink", "#fff");
      if (fadeIn > 0) {
        context.beginPath();
        context.moveTo(x(0), 0);
        context.lineTo(x(fadeIn), 0);
        context.lineTo(x(0), height);
        context.fill();
      }
      if (fadeOut > 0) {
        context.beginPath();
        context.moveTo(x(duration), 0);
        context.lineTo(x(duration - fadeOut), 0);
        context.lineTo(x(duration), height);
        context.fill();
      }
      context.globalAlpha = 1;

      if (selection) {
        context.fillStyle = color("--info", "#39f");
        context.globalAlpha = 0.25;
        context.fillRect(x(selection[0]), 0, x(selection[1]) - x(selection[0]), height);
        context.globalAlpha = 1;
      }

      if (playhead >= from && playhead <= to) {
        context.fillStyle = color("--onair", "#3c6");
        context.fillRect(Math.round(x(playhead)), 0, 2, height);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [peaks, perSecond, duration, from, to, span, cuts, selection, playhead, fadeIn, fadeOut]);

  const timeAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(duration, from + ((event.clientX - box.left) / box.width) * span));
  };

  return (
    <canvas
      ref={canvas}
      className="h-40 w-full cursor-crosshair touch-none rounded-xl bg-canvas"
      aria-label="Forma de onda del audio"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { from: timeAt(event), x: event.clientX };
      }}
      onPointerMove={(event) => {
        if (!drag.current || Math.abs(event.clientX - drag.current.x) < 4) return;
        const time = timeAt(event);
        onSelect([Math.min(drag.current.from, time), Math.max(drag.current.from, time)]);
      }}
      onPointerUp={(event) => {
        const start = drag.current;
        drag.current = null;
        if (!start) return;
        if (Math.abs(event.clientX - start.x) < 4) {
          onSelect(null);
          onSeek(start.from);
        }
      }}
    />
  );
}
