import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "@/store/chatStore";
import { ConversationListItem } from "./ConversationListItem";

interface ConversationRow {
  id: string;
  title: string;
  isActive: boolean;
}

export function ConversationList() {
  // Narrow selector: only depends on id + title + whether active.
  // Adding a message to a session does NOT change any of these, so the
  // sidebar won't re-render on every new message bubble.
  const rows = useChatStore(
    useShallow((state): ConversationRow[] =>
      state.sessionOrder
        .map<ConversationRow | null>((id) => {
          const session = state.sessions[id];
          if (!session) return null;
          return {
            id,
            title: session.title,
            isActive: state.activeSessionId === id,
          };
        })
        .filter((r): r is ConversationRow => r !== null),
    ),
  );

  if (rows.length === 0) return null;

  return (
    <ul
      className="flex flex-col gap-1 px-2 py-2"
      data-testid="conversation-list"
    >
      {rows.map((row) => (
        <li key={row.id}>
          <ConversationListItem
            sessionId={row.id}
            title={row.title}
            isActive={row.isActive}
          />
        </li>
      ))}
    </ul>
  );
}

export default ConversationList;
