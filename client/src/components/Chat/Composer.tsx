import {
  useEffect,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useSendMessage } from "@/hooks/useSendMessage";

export function Composer() {
  const { send, stop, isThinking } = useSendMessage();
  const [value, setValue] = useState("");
  // Tracks the brief window between "user clicked Stop" and "store flipped
  // isThinking=false". Prevents a double-abort if the user rage-clicks Stop.
  const [isStopping, setIsStopping] = useState(false);

  // Once the store confirms we're no longer thinking, clear the local flag.
  useEffect(() => {
    if (!isThinking) {
      setIsStopping(false);
    }
  }, [isThinking]);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !isThinking;

  const submit = () => {
    if (!trimmed) return;
    send(trimmed);
    setValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  };

  const handleButtonClick = () => {
    if (isThinking) {
      if (isStopping) return; // already aborting — reject further clicks
      setIsStopping(true);
      stop();
      return;
    }
    submit();
  };

  const stopDisabled = isThinking && isStopping;
  const buttonDisabled = isThinking ? stopDisabled : !canSend;

  const buttonClass = isThinking
    ? [
        "rounded-xl px-4 py-2 bg-surface border border-border text-text transition-colors",
        stopDisabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-surface-muted",
      ].join(" ")
    : "rounded-xl px-4 py-2 bg-primary hover:bg-primary-hover text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

  return (
    <div
      className="border-t border-border bg-bg px-4 py-3"
      data-testid="composer"
    >
      <div className="max-w-3xl mx-auto flex items-end gap-2 bg-surface border border-border rounded-2xl p-2">
        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isThinking}
          placeholder="Type your message..."
          rows={2}
          aria-label="Message"
          className="flex-1 resize-none bg-transparent text-text placeholder:text-text-muted px-2 py-1 outline-none disabled:opacity-60"
          data-testid="composer-textarea"
        />
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={buttonDisabled}
          aria-disabled={buttonDisabled}
          aria-label={isThinking ? "Stop" : "Send"}
          className={buttonClass}
          data-testid="composer-action"
        >
          {isThinking ? "Stop" : "Send"}
        </button>
      </div>
    </div>
  );
}

export default Composer;
