import type { PointerEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Cut } from "@/lib/media/editor/recipe";
import { alpha, readTokens } from "./canvas-tokens";
import { drawWave, prepare } from "./wave-draw";

const HEIGHT = 38;

interface Props {
  peaks: Int8Array;
  perSecond: number;
  duration: number;
  cuts: Cut[];
  time: number;
  view: Cut;
  onMove: (center: number) => void;
}

/** The whole audio in small, with the part shown above framed; click or drag to move there. */
export function Overview({ peaks, perSecond, duration, cuts, time, view, onMove }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = canvas.current?.parentElement;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element || width === 0) return;
    const context = prepare(element, width, HEIGHT);
    if (!context) return;
    const tokens = readTokens(element);
    const scale = width / duration;
    context.fillStyle = tokens.raised;
    context.fillRect(0, 0, width, HEIGHT);
    const cutColor = alpha(tokens.danger, 0.45);
    const keptColor = alpha(tokens.ink, 0.5);
    drawWave(context, peaks, perSecond, width, 3, HEIGHT - 6, 0, scale, (moment) => (cuts.some(([from, to]) => moment >= from && moment < to) ? cutColor : keptColor));
    context.fillStyle = alpha(tokens.info, 0.16);
    context.strokeStyle = tokens.info;
    context.lineWidth = 1.5;
    context.fillRect(view[0] * scale, 0, (view[1] - view[0]) * scale, HEIGHT);
    context.strokeRect(view[0] * scale + 0.75, 0.75, Math.max(2, (view[1] - view[0]) * scale - 1.5), HEIGHT - 1.5);
    context.fillStyle = tokens.signal;
    context.fillRect(time * scale - 1, 0, 2, HEIGHT);
  }, [peaks, perSecond, duration, cuts, time, view, width]);

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onMove(((event.clientX - box.left) / box.width) * duration);
  };

  return (
    <div className="mt-2">
      <canvas
        ref={canvas}
        style={{ width, height: HEIGHT }}
        className="block cursor-pointer touch-none rounded-xl border border-line"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event);
        }}
        onPointerMove={(event) => event.buttons === 1 && move(event)}
        aria-label="Vista general del audio"
      />
    </div>
  );
}
