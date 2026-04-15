import { useSendMessage } from "@/hooks/useSendMessage";
import { MascotAvatar } from "./MascotAvatar";
import { SuggestionChips } from "./SuggestionChips";

export function WelcomeScreen() {
  const { send } = useSendMessage();

  return (
    <div
      className="flex-1 flex items-center justify-center px-6 py-10"
      data-testid="welcome-screen"
    >
      <div className="flex flex-col items-center gap-6 text-center max-w-2xl">
        <MascotAvatar size={220} />
        <h1 className="text-2xl font-semibold text-text">
          Hi, I&apos;m Olive. What are we shopping for today?
        </h1>
        <SuggestionChips onPick={send} />
      </div>
    </div>
  );
}

export default WelcomeScreen;
