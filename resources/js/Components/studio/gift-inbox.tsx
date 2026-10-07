import { Link, usePage } from "@inertiajs/react";
import { Gift as GiftIcon, Mail, Play, Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Equalizer } from "@/Components/station/station-identity";
import { Avatar } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { cn } from "@/lib/cn";
import { ago, duration, money } from "@/lib/format";
import { http } from "@/lib/http";
import { realtime } from "@/lib/realtime";
import type { SharedProps } from "@/types";
import type { ReceivedGift } from "@/types/wallet";

const POLL_WITHOUT_SOCKET_MS = 10_000;
const POLL_WITH_SOCKET_MS = 60_000;
const HIGHLIGHT_MS = 6_000;

interface PlayedEvent {
  message_id: string;
  played_at: string;
  played_by: string | null;
}

/**
 * Live gift inbox for the studio console: the latest gifts arrive over the
 * private studio channel (with polling as a fallback) and each voice message
 * has an "ESCUCHAR MENSAJE" button that plays it and marks it as heard.
 */
export function StudioGiftInbox({ className }: { className?: string }) {
  const { studio, app } = usePage<SharedProps>().props;
  const stationId = studio?.station.id;
  const base = studio ? `/${studio.station.frequency.slug}` : null;
  const [gifts, setGifts] = useState<ReceivedGift[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const known = useRef<Set<string>>(new Set());

  const highlight = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setFresh((current) => new Set([...current, ...ids]));
    window.setTimeout(() => setFresh((current) => new Set([...current].filter((id) => !ids.includes(id)))), HIGHLIGHT_MS);
  }, []);

  const merge = useCallback(
    (incoming: ReceivedGift[]) => {
      const added = incoming.filter((gift) => !known.current.has(gift.id)).map((gift) => gift.id);
      incoming.forEach((gift) => known.current.add(gift.id));
      setGifts((current) => {
        const byId = new Map(current.map((gift) => [gift.id, gift]));
        incoming.forEach((gift) => byId.set(gift.id, gift));
        return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30);
      });
      return added;
    },
    [],
  );

  const markPlayed = useCallback((event: PlayedEvent) => {
    setGifts((current) =>
      current.map((gift) =>
        gift.message?.id === event.message_id ? { ...gift, message: { ...gift.message, played_at: event.played_at, played_by: event.played_by } } : gift,
      ),
    );
  }, []);

  useEffect(() => {
    if (!base || stationId === undefined) return;
    let active = true;
    let first = true;

    const load = () =>
      http
        .get<{ gifts: ReceivedGift[] }>(`${base}/regalos/recientes`)
        .then((data) => {
          if (!active) return;
          const added = merge(data.gifts);
          if (!first) highlight(added);
          first = false;
          setLoaded(true);
        })
        .catch(() => active && setLoaded(true));

    load();

    const echo = realtime();
    const channelName = `studio.${stationId}`;
    const channel = echo?.private(channelName);
    channel
      ?.listen(".gift.received", (event: { gift: ReceivedGift }) => highlight(merge([event.gift])))
      .listen(".gift.message.played", markPlayed);

    const timer = window.setInterval(load, channel ? POLL_WITH_SOCKET_MS : POLL_WITHOUT_SOCKET_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
      channel?.stopListening(".gift.received").stopListening(".gift.message.played");
    };
  }, [base, stationId, merge, highlight, markPlayed]);

  useEffect(() => () => audio.current?.pause(), []);

  const play = (gift: ReceivedGift) => {
    const message = gift.message;
    if (!base || !message?.has_voice) return;

    if (playing === message.id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }

    audio.current?.pause();
    const player = new Audio(`${base}/mensajes/${message.id}/audio`);
    audio.current = player;
    setPlayError(null);
    player.onended = () => setPlaying(null);
    player.onerror = () => {
      setPlaying(null);
      setPlayError("No pudimos reproducir el mensaje. Inténtalo de nuevo.");
    };
    player
      .play()
      .then(() => {
        setPlaying(message.id);
        if (!message.played_at) {
          http.post<{ played_at: string; played_by: string | null }>(`${base}/mensajes/${message.id}/reproducido`).then((result) =>
            markPlayed({ message_id: message.id, played_at: result.played_at, played_by: result.played_by }),
          );
        }
      })
      .catch(() => setPlayError("El navegador bloqueó la reproducción. Pulsa de nuevo para escuchar."));
  };

  if (!studio || !base) return null;

  const pendingVoices = gifts.filter((gift) => gift.message?.has_voice && gift.message.status.value === "visible" && !gift.message.played_at).length;

  return (
    <section className={cn("flex min-h-0 flex-col rounded-2xl border border-line bg-surface", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <GiftIcon className="size-4 text-gold" />
          <h2 className="text-sm font-semibold">Regalos en vivo</h2>
          {pendingVoices > 0 && (
            <Badge tone="signal">
              <Volume2 className="size-3" /> {pendingVoices} por escuchar
            </Badge>
          )}
        </div>
        <Link href={`${base}/mensajes`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
          <Mail className="size-3.5" /> Mensajes
        </Link>
      </header>

      {playError && <p className="border-b border-line bg-danger-soft px-4 py-2 text-xs text-danger">{playError}</p>}

      <ol className="min-h-0 flex-1 divide-y divide-line overflow-y-auto" aria-live="polite">
        {!loaded && <li className="px-4 py-8 text-center text-sm text-muted">Cargando regalos…</li>}
        {loaded && gifts.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted">Aún no llegan regalos. Cuando un oyente envíe uno, aparecerá aquí al instante.</li>
        )}
        {gifts.map((gift) => {
          const message = gift.message;
          const visible = message?.status.value === "visible";
          const isPlaying = message !== null && message !== undefined && playing === message.id;

          return (
            <li key={gift.id} className={cn("space-y-2 px-4 py-3 transition-colors", fresh.has(gift.id) && "bg-gold-soft")}>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none" aria-hidden>
                  {gift.gift?.emoji ?? "🎁"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{gift.sender?.name ?? "Oyente anónimo"}</span>
                    <span className="text-muted"> envió </span>
                    <span className="font-medium">
                      {gift.gift?.name}
                      {gift.quantity > 1 && ` ×${gift.quantity}`}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {ago(gift.created_at)} · <span className="tabular">{money(gift.station_amount_cents, app.currency)}</span> para la radio
                  </p>
                </div>
                {gift.sender && <Avatar name={gift.sender.name} src={gift.sender.avatar_url} size="sm" />}
              </div>

              {message && !visible && <p className="text-xs text-faint italic">Mensaje {message.status.label.toLowerCase()}.</p>}
              {message && visible && message.body && <p className="rounded-xl bg-raised px-3 py-2 text-sm">“{message.body}”</p>}
              {message && visible && message.has_voice && (
                <button
                  type="button"
                  onClick={() => play(gift)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-bold tracking-[0.12em] transition",
                    isPlaying ? "bg-signal text-white" : message.played_at ? "bg-raised text-muted hover:text-ink" : "bg-signal-soft text-signal hover:bg-signal hover:text-white",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {isPlaying ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
                    {isPlaying ? "DETENER" : "ESCUCHAR MENSAJE"}
                    {isPlaying && <Equalizer />}
                  </span>
                  <span className="font-medium tracking-normal tabular">
                    {message.voice_duration ? duration(message.voice_duration) : ""}
                    {message.played_at && !isPlaying && ` · escuchado${message.played_by ? ` por ${message.played_by}` : ""}`}
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
