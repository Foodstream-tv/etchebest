import type { ChatMessage } from "@/services/streaming";

/** Messages kept in memory (and rendered); older ones are dropped. */
export const MAX_CHAT_MESSAGES = 300;

/**
 * State updater for a polled chat: keeps the previous array (so React skips the
 * re-render) when nothing new arrived, and caps what is held in memory.
 */
export function mergeChatMessages(
  previous: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const next =
    incoming.length > MAX_CHAT_MESSAGES
      ? incoming.slice(-MAX_CHAT_MESSAGES)
      : incoming;

  const sameLength = previous.length === next.length;
  const sameLast =
    next.length === 0 || previous[previous.length - 1]?.id === next[next.length - 1]?.id;

  return sameLength && sameLast ? previous : next;
}
