import { useCallback, useState } from "react";
import { sameRecipe, type Recipe } from "@/lib/media/editor/recipe";

const LIMIT = 150;
/** Changes with the same control closer than this (dragging a slider) undo as one step. */
const GROUP_MS = 1200;

type History = { past: Recipe[]; present: Recipe; future: Recipe[]; group: string | null; at: number };

export function useRecipeHistory(initial: Recipe) {
  const [state, setState] = useState<History>({ past: [], present: initial, future: [], group: null, at: 0 });

  const change = useCallback((next: Recipe | ((recipe: Recipe) => Recipe), group?: string) => {
    setState((history) => {
      const value = typeof next === "function" ? next(history.present) : next;
      if (sameRecipe(value, history.present) && value.preset === history.present.preset) return history;
      const now = Date.now();
      const merge = group !== undefined && history.group === group && now - history.at < GROUP_MS;
      return { past: merge ? history.past : [...history.past.slice(-(LIMIT - 1)), history.present], present: value, future: [], group: group ?? null, at: now };
    });
  }, []);

  const undo = useCallback(() => {
    setState((history) =>
      history.past.length ? { past: history.past.slice(0, -1), present: history.past[history.past.length - 1], future: [history.present, ...history.future], group: null, at: 0 } : history,
    );
  }, []);

  const redo = useCallback(() => {
    setState((history) => (history.future.length ? { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1), group: null, at: 0 } : history));
  }, []);

  return { recipe: state.present, change, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
