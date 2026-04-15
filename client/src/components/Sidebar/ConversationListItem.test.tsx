import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/api/chatClient", () => ({
  postChat: vi.fn(),
}));

import { _resetChatStoreForTests, useChatStore } from "@/store/chatStore";
import { ConversationListItem } from "./ConversationListItem";

beforeEach(() => {
  _resetChatStoreForTests();
  try {
    localStorage.removeItem("bazak.chat.v1");
  } catch {
    // ignore
  }
});

describe("ConversationListItem", () => {
  it("clicking the delete button removes the session and does not change active via select", () => {
    let targetId = "";
    let otherId = "";
    act(() => {
      targetId = useChatStore.getState().startNewSession();
      otherId = useChatStore.getState().startNewSession(); // active = other
    });
    expect(useChatStore.getState().activeSessionId).toBe(otherId);

    render(
      <ConversationListItem
        sessionId={targetId}
        title="Some title"
        isActive={false}
      />,
    );

    act(() => {
      fireEvent.click(screen.getByTestId("delete-conversation"));
    });

    const state = useChatStore.getState();
    expect(state.sessions[targetId]).toBeUndefined();
    expect(state.sessionOrder).not.toContain(targetId);
    // Active session should remain otherId (delete stopPropagation prevented
    // select being triggered on the now-deleted id).
    expect(state.activeSessionId).toBe(otherId);
  });
});
