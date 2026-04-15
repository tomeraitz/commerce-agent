import { useChatStore } from "@/store/chatStore";

interface ConversationListItemProps {
  sessionId: string;
  title: string;
  isActive: boolean;
}

export function ConversationListItem({
  sessionId,
  title,
  isActive,
}: ConversationListItemProps) {
  const selectSession = useChatStore((s) => s.selectSession);
  const deleteSession = useChatStore((s) => s.deleteSession);

  const base =
    "group relative flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors cursor-pointer";
  const state = isActive
    ? "bg-primary-soft text-text"
    : "text-text-muted hover:bg-surface-muted";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => selectSession(sessionId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectSession(sessionId);
        }
      }}
      className={`${base} ${state}`}
      data-testid="conversation-list-item"
      data-session-id={sessionId}
      data-active={isActive ? "true" : "false"}
    >
      <span className="flex-1 truncate pr-6">{title}</span>
      <button
        type="button"
        aria-label="Delete conversation"
        data-testid="delete-conversation"
        onClick={(e) => {
          e.stopPropagation();
          deleteSession(sessionId);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted opacity-0 transition-opacity hover:bg-surface hover:text-text group-hover:opacity-100"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default ConversationListItem;
