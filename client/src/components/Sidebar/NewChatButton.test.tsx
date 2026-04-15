import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/api/chatClient", () => ({
  postChat: vi.fn(),
}));

import { _resetChatStoreForTests, useChatStore } from "@/store/chatStore";
import { NewChatButton } from "./NewChatButton";

beforeEach(() => {
  _resetChatStoreForTests();
  try {
    localStorage.removeItem("bazak.chat.v1");
  } catch {
    // ignore
  }
});

describe("NewChatButton", () => {
  it("creates a new session on click and makes it the active one", () => {
    render(<NewChatButton />);

    expect(useChatStore.getState().sessionOrder).toHaveLength(0);

    act(() => {
      fireEvent.click(screen.getByTestId("new-chat-button"));
    });

    const { sessionOrder, activeSessionId } = useChatStore.getState();
    expect(sessionOrder).toHaveLength(1);
    expect(activeSessionId).toBe(sessionOrder[0]);
  });

  it("prepends additional sessions to sessionOrder", () => {
    render(<NewChatButton />);

    act(() => {
      fireEvent.click(screen.getByTestId("new-chat-button"));
    });
    const firstId = useChatStore.getState().sessionOrder[0]!;

    act(() => {
      fireEvent.click(screen.getByTestId("new-chat-button"));
    });

    const { sessionOrder, activeSessionId } = useChatStore.getState();
    expect(sessionOrder).toHaveLength(2);
    expect(sessionOrder[0]).not.toBe(firstId);
    expect(sessionOrder[1]).toBe(firstId);
    expect(activeSessionId).toBe(sessionOrder[0]);
  });
});
