import { useCallback, useLayoutEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 56;

/**
 * Keeps a message list pinned to its newest message while the reader is at
 * the bottom. Once they scroll up to read, new messages stop moving the list
 * and are counted instead, for a "new messages" pill.
 */
export function useStickToBottom(lastId: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const previous = useRef<string | undefined>(undefined);
  const [unseen, setUnseen] = useState(0);
  const [detached, setDetached] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    const list = ref.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
    setDetached(false);
    setUnseen(0);
  }, []);

  const onScroll = useCallback(() => {
    const list = ref.current;
    if (!list) return;
    const near = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
    atBottom.current = near;
    setDetached(!near);
    if (near) setUnseen(0);
  }, []);

  useLayoutEffect(() => {
    if (lastId === previous.current) return;
    const first = previous.current === undefined;
    previous.current = lastId;
    if (atBottom.current) {
      scrollToBottom(!first);
    } else if (lastId !== undefined) {
      setUnseen((count) => count + 1);
    }
  }, [lastId, scrollToBottom]);

  return { ref, onScroll, scrollToBottom, unseen, detached };
}
