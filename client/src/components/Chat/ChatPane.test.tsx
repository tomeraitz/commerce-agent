import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("@/api/chatClient", () => ({
  postChat: vi.fn(),
}));

import { _resetChatStoreForTests, useChatStore } from "@/store/chatStore";
import type { Message } from "@/store/types";
import { ChatPane } from "./ChatPane";

beforeEach(() => {
  _resetChatStoreForTests();
  try {
    localStorage.removeItem("bazak.chat.v1");
  } catch {
    // ignore
  }
});

describe("ChatPane", () => {
  it("renders WelcomeScreen on a fresh (empty) session and not MessageList", () => {
    act(() => {
      useChatStore.getState().startNewSession();
    });

    render(<ChatPane />);

    expect(screen.getByTestId("welcome-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("message-list")).not.toBeInTheDocument();
  });

  it("renders MessageList (not WelcomeScreen) once a message exists", () => {
    act(() => {
      const id = useChatStore.getState().startNewSession();
      const userMsg: Message = {
        id: "m1",
        role: "user",
        text: "hello",
        createdAt: Date.now(),
      };
      useChatStore.setState((s) => ({
        sessions: {
          ...s.sessions,
          [id]: { ...s.sessions[id]!, messages: [userMsg] },
        },
      }));
    });

    render(<ChatPane />);

    expect(screen.queryByTestId("welcome-screen")).not.toBeInTheDocument();
    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
