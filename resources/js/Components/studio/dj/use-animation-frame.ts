import { useEffect, useRef } from "react";

/** Runs `frame` on every screen refresh while the component is mounted (always the latest `frame`). */
export function useAnimationFrame(frame: () => void): void {
  const latest = useRef(frame);
  latest.current = frame;

  useEffect(() => {
    let id = 0;
    const loop = () => {
      latest.current();
      id = window.requestAnimationFrame(loop);
    };
    id = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(id);
  }, []);
}
