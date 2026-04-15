import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

vi.mock("@/api/chatClient", () => ({
  postChat: vi.fn(),
}));

import { _resetChatStoreForTests, useChatStore } from "@/store/chatStore";
import App from "./App";

beforeEach(() => {
  _resetChatStoreForTests();
  try {
    localStorage.removeItem("bazak.chat.v1");
  } catch {
    // ignore
  }
});

describe("App — session bootstrap", () => {
  it("auto-creates exactly one session on first load when storage is empty", () => {
    expect(useChatStore.getState().sessionOrder).toHaveLength(0);

    act(() => {
      render(<App />);
    });

    const { sessionOrder, activeSessionId } = useChatStore.getState();
    expect(sessionOrder).toHaveLength(1);
    expect(activeSessionId).toBe(sessionOrder[0]);
  });

  it("does NOT create a new session when a persisted session already exists", () => {
    // Seed the store to simulate a rehydrated persisted state.
    let preExistingId = "";
    act(() => {
      preExistingId = useChatStore.getState().startNewSession();
    });
    expect(useChatStore.getState().sessionOrder).toHaveLength(1);

    act(() => {
      render(<App />);
    });

    const { sessionOrder, activeSessionId } = useChatStore.getState();
    expect(sessionOrder).toHaveLength(1);
    expect(sessionOrder[0]).toBe(preExistingId);
    expect(activeSessionId).toBe(preExistingId);
  });
});
