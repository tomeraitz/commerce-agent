import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useChatStore } from "@/store/chatStore";

export default function App() {
  useEffect(() => {
    // Auto-create a session on first load only when storage is empty.
    // Check length BEFORE calling so we don't double-create when a
    // persisted session already exists.
    const { sessionOrder, startNewSession } = useChatStore.getState();
    if (sessionOrder.length === 0) {
      startNewSession();
    }
  }, []);

  return <AppShell />;
}
