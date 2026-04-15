import { useEffect, useRef } from "react";
import type { Message as MessageModel } from "@/store/types";
import { MascotAvatar } from "./MascotAvatar";
import { MessageBubble } from "./MessageBubble";
import { ProductWidget } from "./ProductWidget/ProductWidget";
import { RecommendationBanner } from "./RecommendationBanner";

interface MessageProps {
  message: MessageModel;
}

export function Message({ message }: MessageProps) {
  const isAssistant = message.role === "assistant";
  const hasProducts =
    isAssistant && Array.isArray(message.products) && message.products.length > 0;
  const hasRecommendation =
    isAssistant && message.recommendation != null;

  const isStopped = isAssistant && message.error === "stopped";
  const isFailed =
    isAssistant && !!message.error && message.error !== "stopped";

  // Dev-only: log the raw error kind/tag exactly once per message so developers
  // see the detail that we deliberately hide from users. Guard with a ref so
  // React 18 StrictMode / re-renders don't spam the console.
  const loggedRef = useRef(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!message.error || message.error === "stopped") return;
    if (loggedRef.current) return;
    loggedRef.current = true;
    // eslint-disable-next-line no-console
    console.error(
      "[Message] assistant turn failed:",
      message.error,
      { id: message.id },
    );
  }, [message.error, message.id]);

  // When the assistant turn was stopped and carries no text, the bubble would
  // just be an empty white rectangle — show only the "Stopped." line instead.
  const showBubble = !(isStopped && message.text.length === 0);

  return (
    <div
      className={
        isAssistant
          ? "flex items-start gap-2"
          : "flex items-start gap-2 justify-end"
      }
      data-testid="chat-message"
      data-role={message.role}
    >
      {isAssistant ? (
        <div className="pt-1 shrink-0">
          <MascotAvatar size={32} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 min-w-0 max-w-full">
        {showBubble ? (
          <MessageBubble role={message.role} text={message.text} />
        ) : null}

        {hasProducts ? (
          <ProductWidget products={message.products ?? []} />
        ) : null}

        {hasRecommendation && message.recommendation ? (
          <RecommendationBanner recommendation={message.recommendation} />
        ) : null}

        {isStopped ? (
          <p
            className="text-sm italic text-text-muted"
            data-testid="message-stopped"
          >
            Stopped.
          </p>
        ) : null}

        {isFailed ? (
          <p
            className="text-sm text-text border-l-2 border-danger pl-2"
            data-testid="message-error"
            role="alert"
          >
            Something went wrong — please try again.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default Message;
