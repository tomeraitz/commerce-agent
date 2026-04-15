import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/chatClient", () => ({
  postChat: vi.fn(),
}));

import { postChat } from "@/api/chatClient";
import { ChatClientError, type ChatResponse } from "@/api/types";
import {
  _persistOptionsForTests,
  _resetChatStoreForTests,
  useChatStore,
} from "./chatStore";

const mockedPostChat = postChat as unknown as ReturnType<typeof vi.fn>;

const happyResponse: ChatResponse = {
  message: "Here are some phones.",
  products: [
    {
      id: 1,
      title: "Phone X",
      description: "A phone",
      price: 499,
      thumbnail: "https://example.com/phone.jpg",
    },
  ],
  recommendation: null,
};

beforeEach(() => {
  _resetChatStoreForTests();
  mockedPostChat.mockReset();
  // Clear persisted state between tests so localStorage doesn't leak.
  try {
    localStorage.removeItem("bazak.chat.v1");
  } catch {
    // ignore in non-DOM environments
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe("chatStore — sessions", () => {
  it("startNewSession creates a session titled 'New chat' with no messages", () => {
    const id = useChatStore.getState().startNewSession();
    const state = useChatStore.getState();

    expect(state.activeSessionId).toBe(id);
    expect(state.sessionOrder[0]).toBe(id);
    const session = state.sessions[id];
    expect(session).toBeDefined();
    expect(session!.title).toBe("New chat");
    expect(session!.messages).toEqual([]);
  });

  it("deleteSession removes from sessions/order and falls back to next active", () => {
    const a = useChatStore.getState().startNewSession();
    const b = useChatStore.getState().startNewSession(); // now active = b
    expect(useChatStore.getState().activeSessionId).toBe(b);

    useChatStore.getState().deleteSession(b);
    let state = useChatStore.getState();
    expect(state.sessions[b]).toBeUndefined();
    expect(state.sessionOrder).not.toContain(b);
    expect(state.activeSessionId).toBe(a);

    useChatStore.getState().deleteSession(a);
    state = useChatStore.getState();
    expect(state.activeSessionId).toBeNull();
    expect(state.sessionOrder).toEqual([]);
  });
});

describe("chatStore — sendMessage happy path", () => {
  it("appends user msg, toggles isThinking, then appends assistant msg", async () => {
    mockedPostChat.mockResolvedValueOnce(happyResponse);

    useChatStore.getState().startNewSession();
    const sessionId = useChatStore.getState().activeSessionId!;

    const sendPromise = useChatStore
      .getState()
      .sendMessage("I want a new phone");

    // While in-flight, isThinking should be true and user message present.
    {
      const state = useChatStore.getState();
      expect(state.isThinking).toBe(true);
      const msgs = state.sessions[sessionId]!.messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.role).toBe("user");
      expect(msgs[0]!.text).toBe("I want a new phone");
    }

    await sendPromise;

    const state = useChatStore.getState();
    expect(state.isThinking).toBe(false);
    expect(state.abortController).toBeNull();
    const msgs = state.sessions[sessionId]!.messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1]!.role).toBe("assistant");
    expect(msgs[1]!.text).toBe(happyResponse.message);
    expect(msgs[1]!.products).toEqual(happyResponse.products);
    expect(msgs[1]!.recommendation).toBeNull();

    // Verify history was sent — user turn just added.
    const calledArg = mockedPostChat.mock.calls[0]![0] as {
      sessionId: string;
      message: string;
      history: Array<{ role: string; text: string }>;
    };
    expect(calledArg.sessionId).toBe(sessionId);
    expect(calledArg.message).toBe("I want a new phone");
    expect(calledArg.history).toEqual([
      { role: "user", text: "I want a new phone" },
    ]);
  });

  it("first user message sets session.title (40 chars); later messages don't overwrite", async () => {
    mockedPostChat.mockResolvedValue(happyResponse);

    useChatStore.getState().startNewSession();
    const sessionId = useChatStore.getState().activeSessionId!;

    const longText =
      "Looking for a really nice premium smartphone with a great camera and battery life";
    await useChatStore.getState().sendMessage(longText);

    let title = useChatStore.getState().sessions[sessionId]!.title;
    expect(title).toBe(longText.slice(0, 40));
    expect(title.length).toBe(40);

    await useChatStore.getState().sendMessage("And tell me more");

    title = useChatStore.getState().sessions[sessionId]!.title;
    expect(title).toBe(longText.slice(0, 40));
  });

  it("updatedAt advances and sessionOrder re-sorts most-recent-first", async () => {
    mockedPostChat.mockResolvedValue(happyResponse);

    const a = useChatStore.getState().startNewSession();
    const b = useChatStore.getState().startNewSession();
    // initial order: [b, a]
    expect(useChatStore.getState().sessionOrder).toEqual([b, a]);

    // Switch active to `a` and send — order should bubble `a` to the front.
    useChatStore.getState().selectSession(a);
    const beforeUpdatedAt = useChatStore.getState().sessions[a]!.updatedAt;
    // Advance the clock so updatedAt strictly increases on platforms with
    // coarse Date.now resolution.
    await new Promise((r) => setTimeout(r, 5));
    await useChatStore.getState().sendMessage("hi");

    const state = useChatStore.getState();
    expect(state.sessionOrder[0]).toBe(a);
    expect(state.sessions[a]!.updatedAt).toBeGreaterThan(beforeUpdatedAt);
  });
});

describe("chatStore — sendMessage error path", () => {
  it("sets assistant message error and clears isThinking on HTTP failure", async () => {
    mockedPostChat.mockRejectedValueOnce(
      new ChatClientError({ status: 500, kind: "http", message: "boom" }),
    );

    useChatStore.getState().startNewSession();
    const sessionId = useChatStore.getState().activeSessionId!;

    await useChatStore.getState().sendMessage("hello");

    const state = useChatStore.getState();
    expect(state.isThinking).toBe(false);
    const msgs = state.sessions[sessionId]!.messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1]!.role).toBe("assistant");
    expect(msgs[1]!.error).toBe("failed");
  });

  it("re-sending after an error appends exactly one user + one assistant message (no double-append)", async () => {
    // First turn fails, second turn succeeds. Total growth must be:
    //   after 1st send → 2 messages (user + failed-assistant)
    //   after 2nd send → 4 messages (prev two + new user + new assistant)
    mockedPostChat
      .mockRejectedValueOnce(
        new ChatClientError({ status: 500, kind: "http", message: "boom" }),
      )
      .mockResolvedValueOnce(happyResponse);

    useChatStore.getState().startNewSession();
    const sessionId = useChatStore.getState().activeSessionId!;

    await useChatStore.getState().sendMessage("first try");
    const afterFirst = useChatStore.getState().sessions[sessionId]!.messages;
    expect(afterFirst).toHaveLength(2);
    expect(afterFirst[0]!.role).toBe("user");
    expect(afterFirst[0]!.text).toBe("first try");
    expect(afterFirst[1]!.role).toBe("assistant");
    expect(afterFirst[1]!.error).toBe("failed");

    await useChatStore.getState().sendMessage("second try");
    const afterSecond = useChatStore.getState().sessions[sessionId]!.messages;

    // EXACTLY 4, not 5 — the aborted turn must not leave behind any pending
    // user message that would duplicate on the next send.
    expect(afterSecond).toHaveLength(4);
    expect(afterSecond[2]!.role).toBe("user");
    expect(afterSecond[2]!.text).toBe("second try");
    expect(afterSecond[3]!.role).toBe("assistant");
    expect(afterSecond[3]!.error).toBeUndefined();
    expect(afterSecond[3]!.text).toBe(happyResponse.message);

    // And the store must be clean afterwards.
    const state = useChatStore.getState();
    expect(state.isThinking).toBe(false);
    expect(state.abortController).toBeNull();
  });
});

describe("chatStore — stopGeneration", () => {
  it("aborts in-flight call and records a stopped assistant message", async () => {
    let externalSignal: AbortSignal | undefined;
    mockedPostChat.mockImplementationOnce(
      (_req: unknown, signal?: AbortSignal) => {
        externalSignal = signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(
              new ChatClientError({
                status: 0,
                kind: "abort",
                message: "Request was aborted by the user.",
              }),
            );
          });
        });
      },
    );

    useChatStore.getState().startNewSession();
    const sessionId = useChatStore.getState().activeSessionId!;

    const sendPromise = useChatStore.getState().sendMessage("hi");
    expect(useChatStore.getState().isThinking).toBe(true);
    expect(useChatStore.getState().abortController).not.toBeNull();

    useChatStore.getState().stopGeneration();
    await sendPromise;

    expect(externalSignal?.aborted).toBe(true);
    const state = useChatStore.getState();
    expect(state.isThinking).toBe(false);
    expect(state.abortController).toBeNull();
    const msgs = state.sessions[sessionId]!.messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1]!.role).toBe("assistant");
    expect(msgs[1]!.error).toBe("stopped");
  });
});

describe("chatStore — persist", () => {
  it("partialize excludes isThinking and abortController", () => {
    const fakeState = {
      sessions: { x: { id: "x" } } as never,
      sessionOrder: ["x"],
      activeSessionId: "x",
      isThinking: true,
      abortController: new AbortController(),
      startNewSession: () => "x",
      selectSession: () => undefined,
      deleteSession: () => undefined,
      sendMessage: async () => undefined,
      stopGeneration: () => undefined,
    } as never;

    const partial = _persistOptionsForTests.partialize!(fakeState);
    const serialized = JSON.stringify(partial);

    expect(partial).toEqual({
      sessions: { x: { id: "x" } },
      sessionOrder: ["x"],
      activeSessionId: "x",
    });
    expect(serialized).not.toContain("isThinking");
    expect(serialized).not.toContain("abortController");
  });
});
