/** Live chat: the shapes App\Domain\Chat\ChatFeed, the chat resources and the chat broadcasts return. */
import type { Labeled } from "@/types/wallet";

export type ChatAuthor = "listener" | "station";

export interface ChatUser {
  id: number;
  name: string;
  avatar_url: string | null;
}

/** The message a reply answers; body is null once that message was hidden. */
export interface ChatReplyRef {
  id: string;
  author: ChatAuthor;
  name: string | null;
  body: string | null;
}

/** config('platform.chat.highlight_tiers'), cheapest first. */
export interface HighlightTier {
  cents: number;
  pin_seconds: number;
  level: number;
}

/** App\Http\Resources\ChatMessageResource: a message as listeners see it. */
export interface ChatMessage {
  id: string;
  author: ChatAuthor;
  body: string;
  user: ChatUser | null;
  highlight: { cents: number; level: number; pinned_until: string | null } | null;
  reply_to: ChatReplyRef | null;
  created_at: string;
}

/** GET /radio/{frequency}/chat and the "chat" prop of the station page. */
export interface ChatSnapshot {
  open: boolean;
  messages: ChatMessage[];
  pinned: ChatMessage[];
  viewer: { signed_in: boolean; verified: boolean; muted: boolean; muted_until: string | null };
  limits: { max_length: number; tiers: HighlightTier[] };
}

/** POST /radio/{frequency}/chat */
export interface PostedChatMessage {
  message: ChatMessage;
  balance_cents: number | null;
}

export type ChatMessageStatus = "visible" | "hidden";

/** App\Http\Resources\Studio\ChatMessageResource: only what a highlight credited to the station. */
export interface StudioChatMessage {
  id: string;
  author: ChatAuthor;
  body: string;
  user: ChatUser | null;
  highlight: { level: number; credited_cents: number; pinned_until: string | null } | null;
  reply_to: ChatReplyRef | null;
  status: Labeled<ChatMessageStatus>;
  sent_by?: string | null;
  hidden_by?: string | null;
  hidden_at: string | null;
  created_at: string;
}

export interface ChatMuteEntry {
  user_id: number;
  name: string;
  until: string | null;
}

/** GET /estudio/{frequency}/chat/mensajes */
export interface StudioChatFeed {
  open: boolean;
  messages: StudioChatMessage[];
  pinned: StudioChatMessage[];
  mutes: ChatMuteEntry[];
  limits: { max_length: number };
}

/** ChatFeed::summary(): the chat of the live transmission on air (or the last one). */
export interface ChatSummary {
  session: { title: string | null; started_at: string; ended_at: string | null } | null;
  messages: number;
  writers: number;
  highlighted: number;
  earned_cents: number;
  supporters: { id: number; name: string; avatar_url: string | null; highlights: number; earned_cents: number }[];
}

/** Broadcast "chat.visibility" on station.{id} and studio.{id}. */
export interface ChatVisibilityEvent {
  id: string;
  visible: boolean;
  message: ChatMessage | null;
}
