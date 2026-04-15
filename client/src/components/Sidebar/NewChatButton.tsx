import { useChatStore } from "@/store/chatStore";

export function NewChatButton() {
  const startNewSession = useChatStore((s) => s.startNewSession);

  return (
    <button
      type="button"
      onClick={() => startNewSession()}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      data-testid="new-chat-button"
    >
      <span aria-hidden className="text-base leading-none">+</span>
      <span>New chat</span>
    </button>
  );
}

export default NewChatButton;
