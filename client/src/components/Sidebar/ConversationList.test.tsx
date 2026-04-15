import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/api/chatClient", () => ({
  postChat: vi.fn(),
}));

import { _resetChatStoreForTests, useChatStore } from "@/store/chatStore";
import { ConversationList } from "./ConversationList";

beforeEach(() => {
  _resetChatStoreForTests();
  try {
    localStorage.removeItem("bazak.chat.v1");
  } catch {
    // ignore
  }
});

describe("ConversationList", () => {
  it("renders one item per session in sessionOrder", () => {
    act(() => {
      useChatStore.getState().startNewSession();
      useChatStore.getState().startNewSession();
      useChatStore.getState().startNewSession();
    });

    render(<ConversationList />);
    expect(screen.getAllByTestId("conversation-list-item")).toHaveLength(3);
  });

  it("clicking a non-active item makes it active", () => {
    let firstId = "";
    act(() => {
      firstId = useChatStore.getState().startNewSession();
      useChatStore.getState().startNewSession();
      useChatStore.getState().startNewSession(); // active = this one
    });

    render(<ConversationList />);

    // Sanity: firstId is not currently active.
    expect(useChatStore.getState().activeSessionId).not.toBe(firstId);

    const items = screen.getAllByTestId("conversation-list-item");
    const firstItem = items.find(
      (el) => el.getAttribute("data-session-id") === firstId,
    );
    expect(firstItem).toBeDefined();

    act(() => {
      fireEvent.click(firstItem!);
    });

    expect(useChatStore.getState().activeSessionId).toBe(firstId);
  });

  it("renders nothing when there are zero sessions", () => {
    const { container } = render(<ConversationList />);
    expect(container).toBeEmptyDOMElement();
  });
});
