import { useEffect, useLayoutEffect, useRef } from "react";

export type EditorCommands = {
  togglePlay: () => void;
  cutSelection: () => void;
  mark: (edge: 0 | 1) => void;
  toggleLoop: () => void;
  toggleBypass: () => void;
  zoomBy: (factor: number) => void;
  seek: (time: number) => void;
  seekBy: (seconds: number) => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;
  openGuide: () => void;
};

export const ZOOM_STEP = 1.6;

function typing(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  return target.tagName === "INPUT" && (target as HTMLInputElement).type !== "range";
}

/** Shortcuts of a professional editor; they do nothing while typing in a field or with a dialog open. */
export function useEditorKeys(commands: EditorCommands, { enabled, duration }: { enabled: boolean; duration: number }) {
  const latest = useRef(commands);
  useLayoutEffect(() => {
    latest.current = commands;
  });

  useEffect(() => {
    if (!enabled) return;
    const keydown = (event: KeyboardEvent) => {
      if (typing(event.target) || document.querySelector("dialog[open]")) return;
      const run = latest.current;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      if (command && key === "z") {
        event.preventDefault();
        if (event.shiftKey) run.redo();
        else run.undo();
      } else if (command && key === "y") {
        event.preventDefault();
        run.redo();
      } else if (command || event.altKey) {
        return;
      } else if (event.key === "?") {
        run.openGuide();
      } else if (event.key === " ") {
        event.preventDefault();
        run.togglePlay();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        run.cutSelection();
      } else if (key === "i") run.mark(0);
      else if (key === "o") run.mark(1);
      else if (key === "l") run.toggleLoop();
      else if (key === "b") run.toggleBypass();
      else if (event.key === "+" || event.key === "=") run.zoomBy(ZOOM_STEP);
      else if (event.key === "-" || event.key === "−") run.zoomBy(1 / ZOOM_STEP);
      else if (event.key === "Escape") run.clearSelection();
      else if (event.target instanceof HTMLInputElement) return;
      else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        run.seek(event.key === "Home" ? 0 : duration);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        run.seekBy((event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 5 : 1));
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [enabled, duration]);
}
