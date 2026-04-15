import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

vi.mock("@/api/chatClient", () => ({
  postChat: vi.fn(),
}));

import { _resetChatStoreForTests, useChatStore } from "@/store/chatStore";
import type { Message } from "@/store/types";
import { MessageList } from "./MessageList";

beforeEach(() => {
  _resetChatStoreForTests();
  try {
    localStorage.removeItem("bazak.chat.v1");
  } catch {
    // ignore
  }
});

function seedSessionWithMessage(): string {
  let id = "";
  act(() => {
    id = useChatStore.getState().startNewSession();
    const userMsg: Message = {
      id: "seed",
      role: "user",
      text: "hi there",
      createdAt: Date.now(),
    };
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        [id]: { ...s.sessions[id]!, messages: [userMsg] },
      },
    }));
  });
  return id;
}

describe("MessageList", () => {
  it("renders no TypingIndicator when isThinking is false", () => {
    seedSessionWithMessage();

    render(<MessageList />);

    expect(screen.queryByTestId("thinking-row")).not.toBeInTheDocument();
    expect(screen.getByText("hi there")).toBeInTheDocument();
  });

  it("renders TypingIndicator at the bottom when isThinking is true", () => {
    seedSessionWithMessage();
    act(() => {
      useChatStore.setState({ isThinking: true });
    });

    render(<MessageList />);

    expect(screen.getByTestId("thinking-row")).toBeInTheDocument();
    // TypingIndicator uses role="status".
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders nothing when there is no active session", () => {
    const { container } = render(<MessageList />);
    expect(container.firstChild).toBeNull();
  });
});
