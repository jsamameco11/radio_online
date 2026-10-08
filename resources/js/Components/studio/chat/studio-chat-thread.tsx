import { usePage } from "@inertiajs/react";
import { AlertCircle, AudioLines, CornerUpLeft, Eye, EyeOff, SendHorizontal, Square, Volume2, VolumeX, X } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useMemo, useRef, useState } from "react";
import type { ChatStation } from "@/Components/chat/chat-message";
import { ChatMessageItem, MessageAction, NewMessagesPill } from "@/Components/chat/chat-message";
import { newClientKey } from "@/Components/chat/highlight-tiers";
import type { PinnedItem } from "@/Components/chat/pinned-strip";
import { PinnedStrip } from "@/Components/chat/pinned-strip";
import { useStickToBottom } from "@/Components/chat/use-stick-to-bottom";
import type { StudioChat } from "@/Components/studio/chat/use-studio-chat";
import { Button } from "@/Components/ui/button";
import { cn } from "@/lib/cn";
import { dateTime, money } from "@/lib/format";
import { HttpError } from "@/lib/http";
import type { SharedProps } from "@/types";
import type { StudioChatMessage } from "@/types/chat";

/** Reads a paid message aloud. `current` is the Superchat being spoken right now. */
export interface SuperchatControls {
  supported: boolean;
  current: string | null;
  speak: (message: StudioChatMessage) => void;
  stop: () => void;
}

export const MUTE_TERMS: { minutes: number | null; label: string }[] = [
  { minutes: 10, label: "10 minutos" },
  { minutes: 60, label: "1 hora" },
  { minutes: 1440, label: "24 horas" },
  { minutes: null, label: "Hasta que lo reactive" },
];

/** "+US$ 0.85": what a highlight credited to the station. */
export function credited(cents: number, currency: string): string {
  return `+${money(cents, currency)}`;
}

/**
 * The team's view of the live chat: highlights pinned on top, every message
 * with its moderation actions (answer, hide, silence its author) and a
 * composer that writes as the station.
 */
export function StudioChatThread({ chat, station, className, superchat }: { chat: StudioChat; station: ChatStation; className?: string; superchat?: SuperchatControls }) {
  const { app } = usePage<SharedProps>().props;
  const { feed } = chat;
  const [replyTo, setReplyTo] = useState<StudioChatMessage | null>(null);
  const [muting, setMuting] = useState<StudioChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messages = useMemo(() => feed?.messages ?? [], [feed]);
  const scroll = useStickToBottom(messages.at(-1)?.id);
  const mutedIds = new Set(feed?.mutes.map((entry) => entry.user_id) ?? []);

  const pinned: PinnedItem[] = useMemo(
    () =>
      (feed?.pinned ?? []).flatMap((message) =>
        message.highlight?.pinned_until && message.status.value === "visible"
          ? [
              {
                id: message.id,
                level: message.highlight.level,
                amount: credited(message.highlight.credited_cents, app.currency),
                name: message.user?.name ?? "Oyente",
                body: message.body,
                createdAt: message.created_at,
                pinnedUntil: message.highlight.pinned_until,
              },
            ]
          : [],
      ),
    [feed, app.currency],
  );

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof HttpError ? failure.firstError() : "Se perdió la conexión. Inténtalo otra vez.");
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <PinnedStrip items={pinned} />

      {error && (
        <p className="flex items-start gap-2 border-b border-line bg-danger-soft px-4 py-2 text-xs text-danger" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" /> <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso">
            <X className="size-3.5" />
          </button>
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={scroll.ref} onScroll={scroll.onScroll} className="h-full space-y-1 overflow-y-auto px-2 py-3" aria-live="polite">
          {feed === null && <p className="px-6 py-12 text-center text-sm text-muted">Cargando el chat…</p>}
          {feed !== null && messages.length === 0 && (
            <p className="px-6 py-12 text-center text-sm text-muted">Aún no hay mensajes. Invita a tus oyentes a escribirte desde la página de la radio.</p>
          )}
          {messages.map((message) => {
            const hidden = message.status.value === "hidden";
            const author = message.user;
            const muted = author !== null && mutedIds.has(author.id);
            const speaking = superchat?.current === message.id;
            const canSpeak = Boolean(superchat?.supported && message.highlight && !hidden);

            return (
              <ChatMessageItem
                key={message.id}
                author={message.author}
                body={message.body}
                user={message.user}
                station={station}
                highlight={message.highlight ? { level: message.highlight.level, amount: credited(message.highlight.credited_cents, app.currency) } : null}
                replyTo={message.reply_to}
                createdAt={message.created_at}
                dimmed={hidden}
                note={
                  hidden || muted || (message.author === "station" && message.sent_by) || canSpeak ? (
                    <div className="mt-1 space-y-1">
                      {hidden || muted || (message.author === "station" && message.sent_by) ? (
                        <p className="text-[0.68rem] text-faint">
                          {[
                            hidden && `Oculto${message.hidden_by ? ` por ${message.hidden_by}` : " por reportes"}`,
                            muted && "Autor silenciado",
                            message.author === "station" && message.sent_by && `Escrito por ${message.sent_by}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                      {canSpeak ? (
                        <button
                          type="button"
                          onClick={() => (speaking ? superchat?.stop() : superchat?.speak(message))}
                          title="Se escucha en los altavoces de esta consola"
                          className="inline-flex items-center gap-1 rounded-full bg-royal px-2 py-0.5 text-[0.68rem] font-semibold text-white hover:opacity-90"
                        >
                          {speaking ? <Square className="size-3" /> : <AudioLines className="size-3" />}
                          {speaking ? "Detener superchat" : "Escuchar superchat"}
                        </button>
                      ) : null}
                    </div>
                  ) : undefined
                }
                actions={
                  <>
                    {canSpeak ? (
                      <MessageAction label={speaking ? "Detener superchat" : "Escuchar superchat"} onClick={() => (speaking ? superchat?.stop() : superchat?.speak(message))}>
                        {speaking ? <Square className="size-3.5" /> : <AudioLines className="size-3.5" />}
                      </MessageAction>
                    ) : null}
                    {message.author === "listener" && !hidden && (
                      <MessageAction label="Responder" onClick={() => setReplyTo(message)}>
                        <CornerUpLeft className="size-3.5" />
                      </MessageAction>
                    )}
                    <MessageAction label={hidden ? "Mostrar de nuevo" : "Ocultar mensaje"} tone={hidden ? "default" : "danger"} onClick={() => run(() => chat.setVisibility(message.id, hidden))}>
                      {hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </MessageAction>
                    {author && (
                      <MessageAction
                        label={muted ? "Quitar silencio" : "Silenciar al oyente"}
                        tone={muted ? "default" : "danger"}
                        onClick={() => (muted ? void run(() => chat.unmute(author.id)) : setMuting(message))}
                      >
                        {muted ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                      </MessageAction>
                    )}
                  </>
                }
              />
            );
          })}
        </div>
        {scroll.detached && <NewMessagesPill count={scroll.unseen} onClick={() => scroll.scrollToBottom()} />}

        {muting?.user && (
          <div className="absolute inset-x-2 bottom-2 z-10 space-y-2 rounded-2xl border border-line bg-surface p-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Silenciar a {muting.user.name}</p>
              <button type="button" onClick={() => setMuting(null)} className="rounded-lg p-1 text-muted hover:bg-raised hover:text-ink" aria-label="Cancelar">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted">No podrá escribir en tu chat durante ese tiempo. Seguirá escuchando y leyendo.</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MUTE_TERMS.map((term) => (
                <Button
                  key={term.label}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const user = muting.user;
                    setMuting(null);
                    if (user) void run(() => chat.mute(user.id, term.minutes));
                  }}
                >
                  {term.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <StationComposer
        disabled={!chat.open}
        maxLength={feed?.limits.max_length ?? 200}
        station={station}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={async (body, key) => {
          await chat.reply(body, key, replyTo?.id ?? null);
          setReplyTo(null);
          window.requestAnimationFrame(() => scroll.scrollToBottom());
        }}
      />
    </div>
  );
}

interface StationComposerProps {
  disabled: boolean;
  maxLength: number;
  station: ChatStation;
  replyTo: StudioChatMessage | null;
  onCancelReply: () => void;
  onSend: (body: string, clientKey: string) => Promise<void>;
}

function StationComposer({ disabled, maxLength, station, replyTo, onCancelReply, onSend }: StationComposerProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientKey = useRef<string | null>(null);
  const trimmed = body.trim();

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!trimmed || sending || disabled) return;
    const key = (clientKey.current ??= newClientKey());
    setSending(true);
    setError(null);
    try {
      await onSend(trimmed, key);
      setBody("");
      clientKey.current = null;
    } catch (failure) {
      setError(failure instanceof HttpError ? failure.firstError() : "Se perdió la conexión. Inténtalo otra vez.");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <footer className="border-t border-line px-3 pt-2.5 pb-3">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-raised px-2.5 py-1.5 text-xs">
          <CornerUpLeft className="size-3.5 shrink-0 text-signal" />
          <span className="shrink-0 font-semibold">{replyTo.user?.name ?? "Oyente"}</span>
          <span className="truncate text-muted">{replyTo.body}</span>
          <span className="ml-auto shrink-0 text-faint">{dateTime(replyTo.created_at, { timeStyle: "short" })}</span>
          <button type="button" onClick={onCancelReply} className="rounded p-0.5 text-muted hover:text-ink" aria-label="Cancelar respuesta">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {error && (
        <p className="mb-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={send} className={cn("rounded-xl border border-line-strong bg-surface transition focus-within:border-ink", disabled && "opacity-60")}>
        <textarea
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            clientKey.current = null;
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          maxLength={maxLength}
          rows={2}
          placeholder={disabled ? "Sal en vivo para escribir en el chat" : replyTo ? `Responde a ${replyTo.user?.name ?? "este oyente"}…` : `Escribe como ${station.name}…`}
          aria-label="Mensaje de la emisora"
          className="block w-full resize-none bg-transparent px-3 pt-2 text-sm text-ink placeholder:text-faint focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <span className="truncate text-[0.68rem] text-faint">
            Publicas como <span className="font-display font-semibold text-muted tabular">{station.frequency.label}</span> · {station.name}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn("text-[0.68rem] tabular", body.length >= maxLength ? "text-danger" : "text-faint")}>
              {body.length}/{maxLength}
            </span>
            <Button type="submit" size="sm" variant="signal" loading={sending} disabled={!trimmed || disabled} icon={<SendHorizontal className="size-3.5" />}>
              {replyTo ? "Responder" : "Enviar"}
            </Button>
          </div>
        </div>
      </form>
    </footer>
  );
}
