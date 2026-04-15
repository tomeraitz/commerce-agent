import { useChatStore } from "@/store/chatStore";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { WelcomeScreen } from "./WelcomeScreen";

export function ChatPane() {
  const isEmptySession = useChatStore((s) => {
    const id = s.activeSessionId;
    if (!id) return false;
    const session = s.sessions[id];
    if (!session) return false;
    return session.messages.length === 0;
  });
  const hasActiveSession = useChatStore((s) => {
    const id = s.activeSessionId;
    return !!(id && s.sessions[id]);
  });

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg" data-testid="chat-pane">
      {hasActiveSession && isEmptySession ? <WelcomeScreen /> : <MessageList />}
      <Composer />
    </div>
  );
}

export default ChatPane;
