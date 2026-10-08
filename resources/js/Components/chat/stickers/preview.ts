import type { ChatStickerRef } from "@/types/chat";

/** A message as one line of text: its body, or "Sticker «Temazo»" when it is only a sticker. */
export function messagePreview(message: { body: string; sticker: ChatStickerRef | null }): string {
  return message.body === "" && message.sticker ? `Sticker «${message.sticker.label}»` : message.body;
}
