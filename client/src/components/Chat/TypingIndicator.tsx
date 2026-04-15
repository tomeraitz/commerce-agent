const KEYFRAMES = `
@keyframes bazak-typing-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
}
.bazak-typing-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: var(--color-text-muted);
  animation: bazak-typing-bounce 1s infinite ease-in-out;
}
`;

export function TypingIndicator() {
  return (
    <div
      className="inline-flex items-center gap-1 bg-surface border border-border rounded-2xl px-4 py-3"
      role="status"
      aria-label="Olive is thinking"
    >
      <style>{KEYFRAMES}</style>
      <span
        className="bazak-typing-dot"
        data-testid="typing-dot"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="bazak-typing-dot"
        data-testid="typing-dot"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="bazak-typing-dot"
        data-testid="typing-dot"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

export default TypingIndicator;
