import { Link, usePage } from "@inertiajs/react";
import { AlertCircle, Flag, LogIn, MailCheck, MessageCircleOff, MessagesSquare, SendHorizontal, Sparkles, Sticker, VolumeX, Wallet, X } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessageItem, MessageAction, NewMessagesPill } from "@/Components/chat/chat-message";
import { HighlightPicker } from "@/Components/chat/highlight-picker";
import { newClientKey, tierLook } from "@/Components/chat/highlight-tiers";
import type { PinnedItem } from "@/Components/chat/pinned-strip";
import { PinnedStrip } from "@/Components/chat/pinned-strip";
import { ReportMessageDialog } from "@/Components/chat/report-message-dialog";
import { messagePreview } from "@/Components/chat/stickers/preview";
import { StickerArt } from "@/Components/chat/stickers/sticker-art";
import { StickerPicker } from "@/Components/chat/stickers/sticker-picker";
import { useStickToBottom } from "@/Components/chat/use-stick-to-bottom";
import { StreamStatusBadge } from "@/Components/station/station-identity";
import { Button, ButtonLink } from "@/Components/ui/button";
import { announceWalletChange, onWalletChange } from "@/Components/wallet/wallet-events";
import { cn } from "@/lib/cn";
import { dateTime, money } from "@/lib/format";
import { HttpError, http } from "@/lib/http";
import { realtime } from "@/lib/realtime";
import { useSignInUrl } from "@/lib/sign-in";
import type { SharedProps, Station } from "@/types";
import type { ChatMessage, ChatSnapshot, ChatStickerRef, ChatVisibilityEvent, PostedChatMessage } from "@/types/chat";
import type { Option } from "@/types/site";

const POLL_WITHOUT_SOCKET_MS = 4_000;
const POLL_WITH_SOCKET_MS = 30_000;
const KEEP_MESSAGES = 150;

function upsert(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const next = list.filter((item) => item.id !== message.id);
  next.push(message);
  return next.sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-KEEP_MESSAGES);
}

/**
 * The live chat of a station page: listeners read it while the station is
 * live and, signed in with a verified email, write to the host or pay to
 * highlight their message. Messages arrive over the public station channel
 * (polling when there is no WebSocket).
 */
export function LiveChat({ station, initial, reportReasons, className }: { station: Station; initial: ChatSnapshot; reportReasons: Option[]; className?: string }) {
  const { auth, app } = usePage<SharedProps>().props;
  const url = `/radio/${station.frequency.slug}/chat`;
  const [chat, setChat] = useState(initial);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const formatMoney = useCallback((cents: number) => money(cents, app.currency), [app.currency]);
  const open = chat.open;

  const refresh = useCallback(() => {
    http
      .get<ChatSnapshot>(url)
      .then(setChat)
      .catch(() => undefined);
  }, [url]);

  const receive = useCallback((message: ChatMessage) => {
    setChat((current) => ({
      ...current,
      messages: upsert(current.messages, message),
      pinned: message.highlight?.pinned_until ? upsert(current.pinned, message) : current.pinned,
    }));
  }, []);

  const drop = useCallback((id: string) => {
    setChat((current) => ({ ...current, messages: current.messages.filter((item) => item.id !== id), pinned: current.pinned.filter((item) => item.id !== id) }));
  }, []);

  useEffect(() => {
    const channel = realtime()?.channel(`station.${station.id}`);
    channel
      ?.listen(".chat.message", (event: { message: ChatMessage }) => receive(event.message))
      .listen(".chat.visibility", (event: ChatVisibilityEvent) => (event.visible && event.message ? receive(event.message) : drop(event.id)))
      .listen(".StreamStarted", refresh)
      .listen(".StreamStopped", refresh);

    const timer = window.setInterval(refresh, channel || !open ? POLL_WITH_SOCKET_MS : POLL_WITHOUT_SOCKET_MS);

    return () => {
      window.clearInterval(timer);
      channel?.stopListening(".chat.message").stopListening(".chat.visibility").stopListening(".StreamStarted").stopListening(".StreamStopped");
    };
  }, [station.id, open, receive, drop, refresh]);

  const lastId = chat.messages.at(-1)?.id;
  const scroll = useStickToBottom(lastId);

  const pinned: PinnedItem[] = useMemo(
    () =>
      chat.pinned.flatMap((message) =>
        message.highlight?.pinned_until
          ? [
              {
                id: message.id,
                level: message.highlight.level,
                amount: formatMoney(message.highlight.cents),
                name: message.user?.name ?? "Oyente",
                body: messagePreview(message),
                createdAt: message.created_at,
                pinnedUntil: message.highlight.pinned_until,
              },
            ]
          : [],
      ),
    [chat.pinned, formatMoney],
  );

  return (
    <section className={cn("flex flex-col overflow-hidden rounded-2xl border border-line bg-surface", chat.open ? "h-[36rem]" : "", className)} aria-labelledby="chat-en-vivo">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="chat-en-vivo" className="flex items-center gap-2 text-sm font-semibold">
          <MessagesSquare className="size-4 text-signal" /> Chat en vivo
        </h2>
        {chat.open ? <StreamStatusBadge status="live" /> : <span className="text-xs text-faint">Cerrado</span>}
      </header>

      {!chat.open ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-raised text-muted">
            <MessageCircleOff className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold">El chat se abre cuando la radio está en vivo</p>
            <p className="text-sm text-muted">Cuando la cabina salga en vivo podrás escribirle al locutor y conversar con los demás oyentes.</p>
          </div>
        </div>
      ) : (
        <>
          <PinnedStrip items={pinned} />

          <div className="relative min-h-0 flex-1">
            <div ref={scroll.ref} onScroll={scroll.onScroll} className="h-full space-y-1 overflow-y-auto px-2 py-3" aria-live="polite">
              {chat.messages.length === 0 && (
                <p className="px-6 py-12 text-center text-sm text-muted">Aún no hay mensajes. ¡Saluda a la cabina y empieza la conversación!</p>
              )}
              {chat.messages.map((message) => {
                const mine = auth.user !== null && message.user?.id === auth.user.id;
                return (
                  <ChatMessageItem
                    key={message.id}
                    author={message.author}
                    body={message.body}
                    sticker={message.sticker}
                    user={message.user}
                    station={station}
                    highlight={message.highlight ? { level: message.highlight.level, amount: formatMoney(message.highlight.cents) } : null}
                    replyTo={message.reply_to}
                    createdAt={message.created_at}
                    mine={mine}
                    actions={
                      auth.user && !mine && message.author === "listener" ? (
                        <MessageAction label="Reportar mensaje" tone="danger" onClick={() => setReporting(message)}>
                          <Flag className="size-3.5" />
                        </MessageAction>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
            {scroll.detached && <NewMessagesPill count={scroll.unseen} onClick={() => scroll.scrollToBottom()} />}
          </div>

          <Composer
            chat={chat}
            url={url}
            formatMoney={formatMoney}
            onPosted={(message) => {
              receive(message);
              window.requestAnimationFrame(() => scroll.scrollToBottom());
            }}
          />
        </>
      )}

      {reporting && <ReportMessageDialog url={`${url}/${reporting.id}/reportar`} message={reporting} reasons={reportReasons} onClose={() => setReporting(null)} />}
    </section>
  );
}

function Composer({ chat, url, formatMoney, onPosted }: { chat: ChatSnapshot; url: string; formatMoney: (cents: number) => string; onPosted: (message: ChatMessage) => void }) {
  const { viewer, limits } = chat;
  const [body, setBody] = useState("");
  const [tier, setTier] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [sticker, setSticker] = useState<ChatStickerRef | null>(null);
  const [stickering, setStickering] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ text: string; topUp: boolean } | null>(null);
  const clientKey = useRef<string | null>(null);
  const stickerToggle = useRef<HTMLButtonElement>(null);
  const closeStickers = useCallback(() => setStickering(false), []);
  const signInUrl = useSignInUrl();

  useEffect(() => {
    clientKey.current = null;
  }, [body, tier, sticker]);

  useEffect(() => onWalletChange(setBalance), []);

  useEffect(() => {
    if (!picking || balance !== null) return;
    http
      .get<{ balance_cents: number }>("/billetera/saldo")
      .then((data) => setBalance(data.balance_cents))
      .catch(() => setBalance(0));
  }, [picking, balance]);

  if (!viewer.signed_in) {
    return (
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-raised px-4 py-3">
        <p className="text-sm text-muted">Inicia sesión para escribirle a la cabina.</p>
        <ButtonLink href={signInUrl} size="sm" icon={<LogIn className="size-3.5" />}>
          Ingresar
        </ButtonLink>
      </footer>
    );
  }

  if (!viewer.verified) {
    return (
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-raised px-4 py-3">
        <p className="text-sm text-muted">Verifica tu correo para escribir en el chat.</p>
        <ButtonLink href="/verificar-correo" size="sm" variant="secondary" icon={<MailCheck className="size-3.5" />}>
          Verificar
        </ButtonLink>
      </footer>
    );
  }

  if (viewer.muted) {
    return (
      <footer className="flex items-start gap-2 border-t border-line bg-raised px-4 py-3 text-sm text-muted">
        <VolumeX className="mt-0.5 size-4 shrink-0" />
        <span>
          La emisora pausó tus mensajes en este chat
          {viewer.muted_until ? ` hasta las ${dateTime(viewer.muted_until, { timeStyle: "short" })}` : ""}. Puedes seguir leyendo la conversación.
        </span>
      </footer>
    );
  }

  const selected = tier === null ? null : (limits.tiers.find((item) => item.cents === tier) ?? null);
  const look = selected ? tierLook(selected.level) : null;
  const trimmed = body.trim();

  /** Sends the composer; `instant` is a sticker picked with nothing else to send, which goes out at once. */
  const send = async (event?: FormEvent, instant?: ChatStickerRef) => {
    event?.preventDefault();
    const attached = instant ?? sticker;
    if ((!trimmed && !attached) || sending) return;
    const key = instant ? newClientKey() : (clientKey.current ??= newClientKey());

    setSending(true);
    setError(null);
    try {
      const result = await http.post<PostedChatMessage>(url, { body: trimmed, sticker: attached?.key ?? null, client_key: key, highlight_cents: tier });
      onPosted(result.message);
      if (result.balance_cents !== null) {
        setBalance(result.balance_cents);
        announceWalletChange(result.balance_cents);
      }
      setBody("");
      setTier(null);
      setSticker(null);
      setPicking(false);
      clientKey.current = null;
    } catch (failure) {
      if (instant) setSticker(instant);
      if (failure instanceof HttpError) {
        const topUp = failure.body.reason === "insufficient_balance";
        setError({ text: failure.firstError(), topUp });
        if (topUp) setBalance(null);
      } else {
        setError({ text: "Se perdió la conexión. Revisa tu internet e inténtalo otra vez.", topUp: false });
      }
    } finally {
      setSending(false);
    }
  };

  const pickSticker = (choice: ChatStickerRef) => {
    setStickering(false);
    if (!trimmed && tier === null && !sending) {
      void send(undefined, choice);
    } else {
      setSticker(choice);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <footer className="relative border-t border-line px-3 pt-2.5 pb-3">
      {picking && (
        <div className="absolute inset-x-2 bottom-full z-10 mb-2">
          <HighlightPicker tiers={limits.tiers} selected={tier} balance={balance} formatMoney={formatMoney} onSelect={setTier} onClose={() => setPicking(false)} />
        </div>
      )}

      {stickering && (
        <div className="absolute inset-x-2 bottom-full z-10 mb-2">
          <StickerPicker stickers={limits.stickers} onPick={pickSticker} onClose={closeStickers} toggle={stickerToggle} />
        </div>
      )}

      {error && (
        <p className="mb-2 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          <span className="flex-1">{error.text}</span>
          {error.topUp && (
            <Link href="/billetera" className="inline-flex shrink-0 items-center gap-1 font-semibold underline-offset-2 hover:underline">
              <Wallet className="size-3.5" /> Recargar
            </Link>
          )}
        </p>
      )}

      {selected && look && (
        <div className={cn("mb-2 flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs", look.card)}>
          <Sparkles className={cn("size-3.5", look.accent)} />
          <span className="font-semibold text-ink">Destacado {look.name}</span>
          <span className={cn("rounded-full px-1.5 py-px font-bold tabular", look.badge)}>{formatMoney(selected.cents)}</span>
          <button type="button" onClick={() => setTier(null)} className="ml-auto rounded p-0.5 text-muted hover:text-ink" aria-label="Quitar destacado">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {sticker && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-line bg-raised py-1.5 pr-2.5 pl-2">
          <StickerArt sticker={sticker} size="sm" />
          <span className="min-w-0 flex-1 text-xs">
            <span className="block truncate font-semibold text-ink">Sticker «{sticker.label}»</span>
            <span className="block text-muted">Va con tu próximo mensaje.</span>
          </span>
          <button type="button" onClick={() => setSticker(null)} className="rounded p-0.5 text-muted hover:text-ink" aria-label="Quitar sticker">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={send} className={cn("rounded-xl border bg-surface transition focus-within:border-ink", look ? cn("ring-2", look.ring, "border-transparent") : "border-line-strong")}>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={limits.max_length}
          rows={2}
          placeholder={selected ? "Escribe el superchat que quieres que se lea en voz alta…" : sticker ? "Acompaña tu sticker con un mensaje (opcional)…" : "Escríbele a la cabina…"}
          aria-label="Mensaje para el chat"
          className="block w-full resize-none bg-transparent px-3 pt-2 text-sm text-ink placeholder:text-faint focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPicking((open) => !open);
                setStickering(false);
              }}
              aria-expanded={picking}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
                selected && look ? cn(look.badge) : "bg-gold-soft text-gold hover:bg-gold hover:text-white",
              )}
            >
              <Sparkles className="size-3.5" /> {selected ? formatMoney(selected.cents) : "Superchat"}
            </button>
            <button
              ref={stickerToggle}
              type="button"
              onClick={() => {
                setStickering((open) => !open);
                setPicking(false);
              }}
              aria-expanded={stickering}
              aria-haspopup="dialog"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
                stickering || sticker ? "bg-royal text-white" : "bg-royal-soft text-royal hover:bg-royal hover:text-white",
              )}
            >
              <Sticker className="size-3.5" /> Stickers
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-[0.68rem] tabular", body.length >= limits.max_length ? "text-danger" : "text-faint")}>
              {body.length}/{limits.max_length}
            </span>
            <Button type="submit" size="sm" variant={selected ? "signal" : "primary"} loading={sending} disabled={!trimmed && !sticker} icon={<SendHorizontal className="size-3.5" />}>
              {selected ? "Enviar superchat" : "Enviar"}
            </Button>
          </div>
        </div>
      </form>
    </footer>
  );
}
