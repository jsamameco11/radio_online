import { useEffect, useRef } from "react";
import { wavePalette, type WavePalette } from "../palette";
import { useAnimationFrame } from "../use-animation-frame";

export type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number, palette: WavePalette) => void;

/** A canvas redrawn every frame at the screen's pixel density, with the theme colours at hand. */
export function useCanvasLoop(draw: Draw) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const palette = useRef<WavePalette | null>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      element.width = Math.max(1, Math.round(element.clientWidth * ratio));
      element.height = Math.max(1, Math.round(element.clientHeight * ratio));
      palette.current = wavePalette(element);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, []);

  useAnimationFrame(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx || !palette.current) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(ctx, element.width / ratio, element.height / ratio, palette.current);
  });

  return canvas;
}
