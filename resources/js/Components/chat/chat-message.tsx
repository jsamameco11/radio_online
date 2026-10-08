import { ArrowDown, CornerDownRight, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { tierLook } from "@/Components/chat/highlight-tiers";
import { StickerArt } from "@/Components/chat/stickers/sticker-art";
import { StationLogo } from "@/Components/station/station-identity";
import { Avatar } from "@/Components/ui/avatar";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";
import type { Station } from "@/types";
import type { ChatAuthor, ChatReplyRef, ChatStickerRef, ChatUser } from "@/types/chat";

export type ChatStation = Pick<Station, "name" | "logo_url" | "accent_color" | "frequency">;

interface ChatMessageItemProps {
  author: ChatAuthor;
  body: string;
  sticker: ChatStickerRef | null;
  user: ChatUser | null;
  station: ChatStation;
  /** Tier level and the amount the viewer may see (the price for listeners, the credit for the team). */
  highlight: { level: number; amount: string } | null;
  replyTo: ChatReplyRef | null;
  createdAt: string;
  mine?: boolean;
  dimmed?: boolean;
  note?: ReactNode;
  actions?: ReactNode;
}

function time(iso: string): string {
  return dateTime(iso, { timeStyle: "short" });
}

/** One message of a live chat, shared by the station page and the studio windows. */
export function ChatMessageItem({ author, body, sticker, user, station, highlight, replyTo, createdAt, mine = false, dimmed = false, note, actions }: ChatMessageItemProps) {
  const fromStation = author === "station";
  const name = fromStation ? station.name : (user?.name ?? "Oyente");
  const look = highlight ? tierLook(highlight.level) : null;

  const reply = replyTo && (
    <p className="mb-1 flex min-w-0 items-center gap-1 text-[0.7rem] text-faint">
      <CornerDownRight className="size-3 shrink-0" aria-hidden />
      <span className="shrink-0">Responde a {replyTo.author === "station" ? station.name : (replyTo.name ?? "un oyente")}:</span>
      <span className="truncate italic">{replyTo.body ?? "mensaje oculto"}</span>
    </p>
  );

  const avatar = fromStation ? <StationLogo station={station} size="xs" /> : <Avatar name={name} src={user?.avatar_url} size="sm" />;
  const art = sticker && <StickerArt sticker={sticker} size="lg" className="my-1.5 ml-1 block" />;

  if (look && highlight) {
    return (
      <article className={cn("group relative overflow-hidden rounded-2xl border px-3 py-2.5", look.card, dimmed && "opacity-50")}>
        {look.sheen && <span className={cn("animate-sheen pointer-events-none absolute inset-0", look.accent)} aria-hidden />}
        <div className="relative flex items-start gap-2.5">
          {avatar}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm font-semibold text-ink">{name}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-bold tabular", look.badge)}>
                <Sparkles className="size-3" aria-hidden /> {highlight.amount}
              </span>
              <span className={cn("text-[0.68rem] font-semibold tracking-wide uppercase", look.accent)}>{look.name}</span>
            </div>
            {reply}
            {art}
            {body && <p className="mt-1 text-[0.95rem] leading-snug font-medium break-words whitespace-pre-line text-ink">{body}</p>}
            <p className="mt-1 text-[0.68rem] text-muted">
              {time(createdAt)}
              {mine && " · tu mensaje"}
            </p>
            {note}
          </div>
        </div>
        {actions && <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">{actions}</div>}
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group relative flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-raised",
        fromStation && "border-l-2 border-signal bg-signal-soft/60 pl-2.5 hover:bg-signal-soft",
        dimmed && "opacity-50",
      )}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-sm font-semibold", fromStation ? "text-signal" : "text-ink")}>
            {fromStation ? (
              <>
                <span className="font-display tabular">{station.frequency.label}</span> · {station.name}
              </>
            ) : (
              name
            )}
          </span>
          {fromStation && <span className="rounded-md bg-signal px-1.5 py-px text-[0.6rem] font-bold tracking-[0.12em] text-white">EMISORA</span>}
          {mine && <span className="text-[0.68rem] text-faint">tú</span>}
          <span className="ml-auto shrink-0 text-[0.68rem] text-faint group-hover:invisible">{time(createdAt)}</span>
        </div>
        {reply}
        {art}
        {body && <p className="text-sm leading-snug break-words whitespace-pre-line text-ink">{body}</p>}
        {note}
      </div>
      {actions && <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">{actions}</div>}
    </article>
  );
}

/** Small icon button for the actions that appear over a message. */
export function MessageAction({ label, onClick, children, tone = "default" }: { label: string; onClick: () => void; children: ReactNode; tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-lg border border-line bg-surface p-1 text-muted shadow-sm transition hover:text-ink",
        tone === "danger" && "hover:border-danger/40 hover:text-danger",
      )}
    >
      {children}
    </button>
  );
}

/** "3 mensajes nuevos" pill shown while the reader is scrolled up. */
export function NewMessagesPill({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-lg transition hover:opacity-90"
    >
      <ArrowDown className="size-3.5" />
      {count > 0 ? `${count} ${count === 1 ? "mensaje nuevo" : "mensajes nuevos"}` : "Ir al final"}
    </button>
  );
}
