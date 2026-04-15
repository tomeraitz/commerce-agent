import { useChatStore } from "@/store/chatStore";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { Message } from "./Message";
import { TypingIndicator } from "./TypingIndicator";

export function MessageList() {
  const messages = useChatStore((s) => {
    const id = s.activeSessionId;
    if (!id) return null;
    const session = s.sessions[id];
    return session ? session.messages : null;
  });
  const isThinking = useChatStore((s) => s.isThinking);

  const scrollRef = useAutoScroll<HTMLDivElement>([
    messages?.length ?? 0,
    isThinking,
  ]);

  if (!messages) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-6"
      data-testid="message-list"
    >
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        {isThinking ? (
          <div className="flex items-start gap-2" data-testid="thinking-row">
            <TypingIndicator />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default MessageList;
