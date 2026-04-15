import { useCallback } from "react";
import { useChatStore } from "@/store/chatStore";

export interface UseSendMessageApi {
  send: (text: string) => void;
  stop: () => void;
  isThinking: boolean;
}

/**
 * Thin adapter around {@link useChatStore} that exposes only what the chat UI
 * needs. Uses per-slice selectors so unrelated store changes (e.g. session
 * edits) don't re-render consumers.
 */
export function useSendMessage(): UseSendMessageApi {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGeneration = useChatStore((s) => s.stopGeneration);
  const isThinking = useChatStore((s) => s.isThinking);

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      void sendMessage(text);
    },
    [sendMessage],
  );

  const stop = useCallback(() => {
    stopGeneration();
  }, [stopGeneration]);

  return { send, stop, isThinking };
}

export default useSendMessage;
