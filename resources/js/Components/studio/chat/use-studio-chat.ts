import { usePage } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from "@/lib/http";
import { realtime } from "@/lib/realtime";
import type { SharedProps } from "@/types";
import type { ChatMuteEntry, ChatVisibilityEvent, StudioChatFeed, StudioChatMessage } from "@/types/chat";

const POLL_WITHOUT_SOCKET_MS = 4_000;
const POLL_WITH_SOCKET_MS = 30_000;
const POLL_CLOSED_MS = 30_000;
const KEEP_MESSAGES = 200;

function upsert(list: StudioChatMessage[], message: StudioChatMessage): StudioChatMessage[] {
  const next = list.filter((item) => item.id !== message.id);
  next.push(message);
  return next.sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-KEEP_MESSAGES);
}

/**
 * The station team's live chat: loads the feed, takes new messages from the
 * private studio channel (polling without WebSocket), follows the station
 * going live or off, and answers and moderates through the studio endpoints.
 * onIncoming fires once per new listener message (for unread counts and cues).
 */
export function useStudioChat({ initial, onIncoming }: { initial?: StudioChatFeed; onIncoming?: (message: StudioChatMessage) => void } = {}) {
  const { studio } = usePage<SharedProps>().props;
  const stationId = studio?.station.id;
  const base = studio ? `/${studio.station.frequency.slug}/chat` : null;
  const [feed, setFeed] = useState<StudioChatFeed | null>(initial ?? null);
  const known = useRef<Set<string>>(new Set(initial?.messages.map((message) => message.id) ?? []));
  const loaded = useRef(initial !== undefined);
  const incoming = useRef(onIncoming);

  useEffect(() => {
    incoming.current = onIncoming;
  }, [onIncoming]);

  const accept = useCallback((message: StudioChatMessage) => {
    const fresh = !known.current.has(message.id);
    known.current.add(message.id);
    setFeed((current) =>
      current && {
        ...current,
        messages: upsert(current.messages, message),
        pinned: message.highlight?.pinned_until ? upsert(current.pinned, message) : current.pinned.map((item) => (item.id === message.id ? message : item)),
      },
    );
    if (fresh && message.author === "listener") incoming.current?.(message);
  }, []);

  const load = useCallback(() => {
    if (!base) return;
    http
      .get<StudioChatFeed>(`${base}/mensajes`)
      .then((data) => {
        const fresh = data.messages.filter((message) => !known.current.has(message.id) && message.author === "listener");
        data.messages.forEach((message) => known.current.add(message.id));
        setFeed(data);
        if (loaded.current) fresh.forEach((message) => incoming.current?.(message));
        loaded.current = true;
      })
      .catch(() => undefined);
  }, [base]);

  const open = feed?.open ?? studio?.station.stream_status.value === "live";

  useEffect(() => {
    if (!base || stationId === undefined) return;
    load();

    const channel = realtime()?.private(`studio.${stationId}`);
    channel
      ?.listen(".chat.received", (event: { message: StudioChatMessage }) => accept(event.message))
      .listen(".chat.visibility", (event: ChatVisibilityEvent) => {
        const status: StudioChatMessage["status"] = event.visible ? { value: "visible", label: "Visible" } : { value: "hidden", label: "Oculto" };
        const restyle = (message: StudioChatMessage) => (message.id === event.id ? { ...message, status } : message);
        setFeed((current) => current && { ...current, messages: current.messages.map(restyle), pinned: current.pinned.map(restyle) });
      })
      .listen(".StreamStarted", load)
      .listen(".StreamStopped", load);

    const timer = window.setInterval(load, !open ? POLL_CLOSED_MS : channel ? POLL_WITH_SOCKET_MS : POLL_WITHOUT_SOCKET_MS);

    return () => {
      window.clearInterval(timer);
      channel?.stopListening(".chat.received").stopListening(".chat.visibility").stopListening(".StreamStarted").stopListening(".StreamStopped");
    };
  }, [base, stationId, open, load, accept]);

  const reply = useCallback(
    async (body: string, clientKey: string, replyTo: string | null) => {
      if (!base) return;
      const result = await http.post<{ message: StudioChatMessage }>(`${base}/mensajes`, { body, client_key: clientKey, reply_to: replyTo });
      accept(result.message);
    },
    [base, accept],
  );

  const setVisibility = useCallback(
    async (id: string, visible: boolean) => {
      if (!base) return;
      const result = await http.patch<{ message: StudioChatMessage }>(`${base}/mensajes/${id}/visibilidad`, { visible });
      accept(result.message);
    },
    [base, accept],
  );

  const mute = useCallback(
    async (userId: number, minutes: number | null) => {
      if (!base) return;
      const result = await http.post<{ mute: ChatMuteEntry }>(`${base}/silenciados`, { user_id: userId, minutes });
      setFeed((current) => current && { ...current, mutes: [result.mute, ...current.mutes.filter((entry) => entry.user_id !== userId)] });
    },
    [base],
  );

  const unmute = useCallback(
    async (userId: number) => {
      if (!base) return;
      await http.delete(`${base}/silenciados/${userId}`);
      setFeed((current) => current && { ...current, mutes: current.mutes.filter((entry) => entry.user_id !== userId) });
    },
    [base],
  );

  return { feed, open, reply, setVisibility, mute, unmute, reload: load };
}

export type StudioChat = ReturnType<typeof useStudioChat>;
