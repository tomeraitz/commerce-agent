import type { Role } from "@/store/types";

interface MessageBubbleProps {
  role: Role;
  text: string;
}

export function MessageBubble({ role, text }: MessageBubbleProps) {
  const isUser = role === "user";

  const containerClass = isUser ? "flex justify-end" : "flex justify-start";

  const bubbleClass = isUser
    ? "bg-primary-soft text-text rounded-2xl px-4 py-3 max-w-[42rem] whitespace-pre-wrap break-words"
    : "bg-surface border border-border text-text rounded-2xl px-4 py-3 max-w-[42rem] whitespace-pre-wrap break-words";

  return (
    <div className={containerClass}>
      <div className={bubbleClass} data-role={role}>
        {text}
      </div>
    </div>
  );
}

export default MessageBubble;
