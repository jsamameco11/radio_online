import { Clock, Sticker, X } from "lucide-react";
import type { KeyboardEvent, RefObject } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { StickerArt } from "@/Components/chat/stickers/sticker-art";
import { cn } from "@/lib/cn";
import { usePersistedList } from "@/lib/persisted";
import type { ChatStickerOption, ChatStickerRef } from "@/types/chat";

const RECENT_KEY = "turadio.chat.stickers.recent";
const RECENT_MAX = 12;
const RECENT_TAB = "recent";

const GRID_STEPS: Record<string, "next" | "previous" | "down" | "up" | undefined> = {
  ArrowRight: "next",
  ArrowLeft: "previous",
  ArrowDown: "down",
  ArrowUp: "up",
};

interface StickerPickerProps {
  stickers: ChatStickerOption[];
  onPick: (sticker: ChatStickerRef) => void;
  onClose: () => void;
  /** The button that opens the picker: pressing it is not an outside click. */
  toggle?: RefObject<HTMLElement | null>;
}

/**
 * The sticker drawer above a chat composer: the stickers used lately and
 * one tab per pack. Escape or a click outside closes it.
 */
export function StickerPicker({ stickers, onPick, onClose, toggle }: StickerPickerProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [recentKeys, remember] = usePersistedList(RECENT_KEY, RECENT_MAX);

  const packs = useMemo(() => {
    const labels = new Map<string, string>();
    stickers.forEach((sticker) => labels.set(sticker.pack, sticker.pack_label));
    return Array.from(labels, ([value, label]) => ({ value, label }));
  }, [stickers]);
  const recent = useMemo(() => recentKeys.flatMap((key) => stickers.filter((sticker) => sticker.key === key)), [recentKeys, stickers]);
  const tabs = recent.length > 0 ? [{ value: RECENT_TAB, label: "Recientes" }, ...packs] : packs;
  const [tab, setTab] = useState(() => (recent.length > 0 ? RECENT_TAB : (packs[0]?.value ?? RECENT_TAB)));
  const shown = tab === RECENT_TAB ? recent : stickers.filter((sticker) => sticker.pack === tab);

  useEffect(() => {
    grid.current?.querySelector("button")?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || panel.current?.contains(event.target) || toggle?.current?.contains(event.target)) return;
      onClose();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      toggle?.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, toggle]);

  const pick = (sticker: ChatStickerOption) => {
    remember(sticker.key);
    onPick({ key: sticker.key, label: sticker.label });
  };

  const onTabsKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = tabs.findIndex((item) => item.value === tab);
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    setTab(next.value);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next.value}"]`)?.focus();
  };

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = GRID_STEPS[event.key];
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const index = buttons.findIndex((button) => button === document.activeElement);
    if (step === undefined || index < 0) return;
    event.preventDefault();
    const columns = Math.max(1, buttons.filter((button) => button.offsetTop === buttons[0].offsetTop).length);
    const offset = { next: 1, previous: -1, down: columns, up: -columns }[step];
    buttons[Math.min(buttons.length - 1, Math.max(0, index + offset))].focus();
  };

  return (
    <div ref={panel} role="dialog" aria-label="Stickers" className="space-y-2.5 rounded-2xl border border-line bg-surface p-3 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sticker className="size-4 text-royal" /> Stickers
        </p>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-raised hover:text-ink" aria-label="Cerrar stickers">
          <X className="size-4" />
        </button>
      </div>

      <div role="tablist" aria-label="Paquetes de stickers" onKeyDown={onTabsKey} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {tabs.map((item) => {
          const active = item.value === tab;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              data-tab={item.value}
              id={`${id}-${item.value}`}
              aria-selected={active}
              aria-controls={`${id}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(item.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition",
                active ? "bg-primary text-on-primary" : "bg-raised text-muted hover:text-ink",
              )}
            >
              {item.value === RECENT_TAB && <Clock className="size-3" aria-hidden />}
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        ref={grid}
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}`}
        onKeyDown={onGridKey}
        className="grid max-h-60 grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1 overflow-y-auto overscroll-contain p-0.5"
      >
        {shown.map((sticker) => (
          <button
            key={sticker.key}
            type="button"
            onClick={() => pick(sticker)}
            aria-label={`Sticker «${sticker.label}»`}
            title={sticker.label}
            className="group flex items-center justify-center rounded-xl p-1.5 transition hover:bg-raised focus-visible:bg-raised"
          >
            <StickerArt sticker={sticker} size="sm" pop={false} decorative className="transition-transform group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none" />
          </button>
        ))}
      </div>
    </div>
  );
}
