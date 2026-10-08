import { Link, usePage } from "@inertiajs/react";
import { AudioLines, Bell, BellOff, Maximize2, MessagesSquare, Minus, Sparkles, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { tierLook } from "@/Components/chat/highlight-tiers";
import { Equalizer, StreamStatusBadge } from "@/Components/station/station-identity";
import { credited, StudioChatThread } from "@/Components/studio/chat/studio-chat-thread";
import { useStudioChat } from "@/Components/studio/chat/use-studio-chat";
import { useSuperchat } from "@/Components/studio/chat/use-superchat";
import { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { usePersistedFlag } from "@/lib/persisted";
import type { SharedProps } from "@/types";
import type { StudioChatMessage } from "@/types/chat";

const PREVIEW_MS = 6_000;
const OPEN_EVENT = "turadio:chat-dock";

/** Opens the floating live chat from anywhere in the studio, such as the console bar. */
export function openLiveChat(): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/** A short, quiet two-note chime for highlighted messages (no audio file needed). */
function chime(): void {
  try {
    const context = new AudioContext();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    oscillator.connect(gain).connect(context.destination);
    oscillator.onended = () => void context.close();
    oscillator.start(now);
    oscillator.stop(now + 0.55);
  } catch {
    return;
  }
}

/**
 * The floating chat window of the studio: while the station is live, the
 * host keeps the chat at hand on every studio page (the console included),
 * with unread counts, highlighted messages called out, answers and moderation.
 */
export function LiveChatDock() {
  const { url: page } = usePage();
  const can = useStudioCan();
  const studioUrl = useStudioUrl();

  if (!can("console.operate") || page.split("?")[0] === studioUrl("/chat")) return null;

  return <Dock />;
}

function Dock() {
  const { studio, app } = usePage<SharedProps>().props;
  const studioUrl = useStudioUrl();
  const slug = studio?.station.frequency.slug ?? "";
  const [expanded, setExpanded] = usePersistedFlag(`studio-chat:${slug}:open`, false);
  const [sound, setSound] = usePersistedFlag(`studio-chat:${slug}:sound`, true);
  const [unread, setUnread] = useState(0);
  const [preview, setPreview] = useState<StudioChatMessage | null>(null);
  const superchat = useSuperchat();

  const onIncoming = useCallback(
    (message: StudioChatMessage) => {
      if (!expanded) setUnread((count) => count + 1);
      if (message.highlight) {
        if (sound) chime();
        if (!expanded) setPreview(message);
        superchat.offer(message);
      }
    },
    [expanded, sound, superchat],
  );

  const chat = useStudioChat({ onIncoming });

  useEffect(() => {
    if (!preview) return;
    const timer = window.setTimeout(() => setPreview(null), PREVIEW_MS);
    return () => window.clearTimeout(timer);
  }, [preview]);

  const open = (value: boolean) => {
    setExpanded(value);
    if (value) {
      setUnread(0);
      setPreview(null);
    }
  };

  useEffect(() => {
    const show = () => open(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  if (!studio) return null;
  const station = studio.station;
  const previewLook = preview?.highlight ? tierLook(preview.highlight.level) : null;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 text-ink">
      {expanded ? (
        <section className="flex h-[36rem] max-h-[calc(100vh-6rem)] w-[26rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-28px_rgba(0,0,0,0.7)]" aria-label="Chat en vivo">
          <header className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/70 px-3 py-2.5">
            <MessagesSquare className="size-4 text-signal" />
            <h2 className="text-sm font-semibold">Chat en vivo</h2>
            <StreamStatusBadge status={chat.open ? "live" : station.stream_status.value} className="ml-1" />
            <div className="ml-auto flex items-center gap-0.5">
              {superchat.current ? (
                <button type="button" onClick={superchat.stop} className="rounded-lg p-1.5 text-royal hover:bg-royal-soft" aria-label="Detener la lectura del superchat" title="Detener la lectura">
                  <Square className="size-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSound(!sound)}
                className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink"
                aria-label={sound ? "Silenciar aviso de destacados" : "Activar aviso de destacados"}
                title={sound ? "Aviso sonoro de destacados activado" : "Aviso sonoro de destacados desactivado"}
              >
                {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
              </button>
              <Link href={studioUrl("/chat")} className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Abrir el chat completo" title="Abrir el chat completo">
                <Maximize2 className="size-4" />
              </Link>
              <button type="button" onClick={() => open(false)} className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Minimizar chat">
                <Minus className="size-4" />
              </button>
            </div>
          </header>
          {superchat.supported ? (
            <div className="flex items-center gap-2 border-b border-royal/25 bg-royal-soft px-3 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-royal text-white">
                {superchat.current ? <Equalizer className="text-white" /> : <AudioLines className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-ink">Superchat</span>
                <span className="block text-[11px] leading-snug text-muted">
                  {superchat.current ? "Leyendo en voz alta el texto que pagó un oyente." : "Escucha aquí el texto de quien pague para que su mensaje hable."}
                </span>
              </span>
              <button
                type="button"
                aria-pressed={superchat.auto}
                onClick={() => superchat.setAuto(!superchat.auto)}
                title={superchat.auto ? "Cada superchat se lee en voz alta al llegar. Clic para leerlos solo cuando tú lo pidas." : "Leer en voz alta cada mensaje que un oyente pague."}
                className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", superchat.auto ? "bg-royal text-white" : "bg-surface text-muted ring-1 ring-line hover:text-ink")}
              >
                {superchat.auto ? "Automático" : "Manual"}
              </button>
            </div>
          ) : (
            <p className="border-b border-line px-3 py-2 text-[11px] text-muted">Este navegador no puede leer los superchats en voz alta. Ábrelo en Chrome, Edge o Firefox.</p>
          )}
          {!chat.open ? (
            <p className="border-b border-line bg-raised px-3 py-2 text-[11px] leading-snug text-muted">El chat de los oyentes se enciende cuando la radio está en vivo. Abre la transmisión y aquí verás cada mensaje, incluido el superchat.</p>
          ) : null}
          <StudioChatThread chat={chat} station={station} className="flex-1" superchat={superchat} />
        </section>
      ) : (
        <>
          {preview && previewLook && preview.highlight && (
            <button
              type="button"
              onClick={() => open(true)}
              className={cn("relative w-72 overflow-hidden rounded-2xl border px-3 py-2.5 text-left shadow-2xl", previewLook.card)}
            >
              {previewLook.sheen && <span className={cn("animate-sheen pointer-events-none absolute inset-0", previewLook.accent)} aria-hidden />}
              <span className="relative flex items-center gap-1.5 text-xs">
                <Sparkles className={cn("size-3.5", previewLook.accent)} />
                <span className="truncate font-semibold">{preview.user?.name ?? "Oyente"}</span>
                <span className={cn("ml-auto rounded-full px-1.5 py-px text-[0.65rem] font-bold tabular", previewLook.badge)}>
                  Superchat {credited(preview.highlight.credited_cents, app.currency)}
                </span>
              </span>
              <span className="relative mt-1 line-clamp-2 block text-sm">{preview.body}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => open(true)}
            className={cn(
              "relative inline-flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold shadow-2xl transition hover:bg-raised",
              preview && "ring-2 ring-gold/60",
            )}
            aria-label={unread > 0 ? `Abrir chat en vivo, ${unread} sin leer` : "Abrir chat en vivo"}
          >
            <MessagesSquare className="size-5 text-signal" />
            Chat en vivo
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-signal px-1.5 text-[0.68rem] font-bold text-white tabular">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );
}
