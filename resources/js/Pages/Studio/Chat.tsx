import { router, usePage } from "@inertiajs/react";
import { HandHeart, MessageCircleOff, MessagesSquare, Radio, ShieldCheck, Sparkles, Users, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { StreamStatusBadge } from "@/Components/station/station-identity";
import { StudioChatThread } from "@/Components/studio/chat/studio-chat-thread";
import { useStudioChat } from "@/Components/studio/chat/use-studio-chat";
import { Avatar } from "@/Components/ui/avatar";
import { Button, ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel, Stat } from "@/Components/ui/panel";
import StudioLayout, { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { count, dateTime, money } from "@/lib/format";
import type { SharedProps } from "@/types";
import type { ChatSummary, StudioChatFeed } from "@/types/chat";

const SUMMARY_REFRESH_MS = 5_000;

interface Props {
  feed: StudioChatFeed;
  summary: ChatSummary;
}

/** Estudio › Chat en vivo: the whole chat of the live transmission, its moderation and its numbers. */
export default function Chat({ feed, summary }: Props) {
  const { studio, app } = usePage<SharedProps>().props;
  const url = useStudioUrl();
  const can = useStudioCan();
  const refreshing = useRef<number | null>(null);
  const formatMoney = (cents: number) => money(cents, app.currency);

  const refreshSummary = useCallback(() => {
    if (refreshing.current !== null) return;
    refreshing.current = window.setTimeout(() => {
      refreshing.current = null;
      router.reload({ only: ["summary"] });
    }, SUMMARY_REFRESH_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(refreshing.current ?? undefined), []);

  const chat = useStudioChat({ initial: feed, onIncoming: refreshSummary });

  if (!studio) return null;
  const station = studio.station;
  const mutes = chat.feed?.mutes ?? [];

  return (
    <StudioLayout title="Chat en vivo">
      <div className="space-y-6">
        <PageHeader
          eyebrow="En vivo"
          title="Chat en vivo"
          description="Lo que tus oyentes te escriben mientras estás al aire. Responde como la radio, destaca a quienes te apoyan y modera la conversación."
          actions={chat.open ? <StreamStatusBadge status="live" /> : undefined}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Mensajes" value={count(summary.messages)} icon={<MessagesSquare className="size-4" />} hint={summary.session ? `Desde las ${dateTime(summary.session.started_at, { timeStyle: "short" })}` : "En esta transmisión"} />
          <Stat label="Oyentes que escribieron" value={count(summary.writers)} icon={<Users className="size-4" />} />
          <Stat label="Destacados" value={count(summary.highlighted)} icon={<Sparkles className="size-4" />} hint="Mensajes remarcados por tus oyentes" />
          <Stat label="Para la radio" value={formatMoney(summary.earned_cents)} icon={<HandHeart className="size-4" />} hint="Acreditado por mensajes destacados" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="flex h-[calc(100vh-17rem)] min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <MessagesSquare className="size-4 text-signal" /> Conversación
              </h2>
              {summary.session?.title && <span className="truncate text-xs text-muted">{summary.session.title}</span>}
            </header>
            {chat.open || (chat.feed?.messages.length ?? 0) > 0 ? (
              <>
                {!chat.open && (
                  <p className="flex items-center gap-2 border-b border-line bg-raised px-4 py-2 text-xs text-muted">
                    <MessageCircleOff className="size-3.5" /> El chat está cerrado: se abre cuando sales en vivo. Esto es lo último que te escribieron.
                  </p>
                )}
                <StudioChatThread chat={chat} station={station} className="flex-1" />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  icon={<MessageCircleOff className="size-6" />}
                  title="El chat se abre cuando sales en vivo"
                  description="Abre una transmisión en vivo desde la consola y tus oyentes podrán escribirte aquí al instante."
                  action={
                    <ButtonLink href={url("/consola")} size="sm" icon={<Radio className="size-4" />}>
                      Ir a la consola
                    </ButtonLink>
                  }
                />
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <Panel title="Quienes más te apoyan" description="Por mensajes destacados en esta transmisión" padded={false}>
              {summary.supporters.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">Aún no hay mensajes destacados.</p>
              ) : (
                <ol className="divide-y divide-line">
                  {summary.supporters.map((supporter, index) => (
                    <li key={supporter.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-4 text-xs font-semibold text-faint tabular">{index + 1}</span>
                      <Avatar name={supporter.name} src={supporter.avatar_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{supporter.name}</p>
                        <p className="text-xs text-muted">
                          {supporter.highlights} {supporter.highlights === 1 ? "destacado" : "destacados"}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-onair tabular">+{formatMoney(supporter.earned_cents)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title="Oyentes silenciados" padded={false}>
              {mutes.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">Nadie está silenciado.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {mutes.map((mute) => (
                    <li key={mute.user_id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{mute.name}</p>
                        <p className="text-xs text-muted">{mute.until ? `Hasta ${dateTime(mute.until)}` : "Hasta que lo reactives"}</p>
                      </div>
                      <Button size="sm" variant="secondary" icon={<Volume2 className="size-3.5" />} onClick={() => void chat.unmute(mute.user_id)}>
                        Reactivar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Moderación">
              <div className="space-y-3 text-sm text-muted">
                <p className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-onair" />
                  Las palabras bloqueadas se ocultan, los enlaces se pueden bloquear y el modo lento espacia los mensajes de cada oyente. Los mensajes destacados no esperan el modo lento.
                </p>
                {can("station.settings") && (
                  <ButtonLink href={url("/configuracion/moderacion")} size="sm" variant="secondary">
                    Ajustar moderación
                  </ButtonLink>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </StudioLayout>
  );
}
