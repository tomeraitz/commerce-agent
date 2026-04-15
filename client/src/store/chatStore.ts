import { create } from "zustand";
import { persist, type PersistOptions } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { postChat } from "@/api/chatClient";
import { ChatClientError } from "@/api/types";
import type { Message, Role, Session } from "./types";

const HISTORY_TURNS = 10; // design doc §6: send last ~10 turns
const TITLE_MAX_CHARS = 40;

export interface ChatState {
  sessions: Record<string, Session>;
  sessionOrder: string[]; // most-recent-first
  activeSessionId: string | null;
  isThinking: boolean;
  abortController: AbortController | null;

  startNewSession: () => string;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
  stopGeneration: () => void;
}

type PersistedChatState = Pick<
  ChatState,
  "sessions" | "sessionOrder" | "activeSessionId"
>;

const persistOptions: PersistOptions<ChatState, PersistedChatState> = {
  name: "bazak.chat.v1",
  version: 1,
  partialize: (s) => ({
    sessions: s.sessions,
    sessionOrder: s.sessionOrder,
    activeSessionId: s.activeSessionId,
  }),
  // Stub migration for future schema changes — kept so a v2 bump is local.
  migrate: (persistedState, _version) => {
    return persistedState as PersistedChatState;
  },
};

function makeMessage(role: Role, text: string, extra: Partial<Message> = {}): Message {
  return {
    id: uuidv4(),
    role,
    text,
    createdAt: Date.now(),
    ...extra,
  };
}

function makeSession(): Session {
  const now = Date.now();
  return {
    id: uuidv4(),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function pruneHistory(messages: Message[]): Array<{ role: Role; text: string }> {
  return messages
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, text: m.text }));
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: {},
      sessionOrder: [],
      activeSessionId: null,
      isThinking: false,
      abortController: null,

      startNewSession: () => {
        const session = makeSession();
        set((state) => ({
          sessions: { ...state.sessions, [session.id]: session },
          sessionOrder: [session.id, ...state.sessionOrder],
          activeSessionId: session.id,
        }));
        return session.id;
      },

      selectSession: (id) => {
        if (!get().sessions[id]) return;
        set({ activeSessionId: id });
      },

      deleteSession: (id) => {
        set((state) => {
          if (!state.sessions[id]) return state;
          const sessions = { ...state.sessions };
          delete sessions[id];
          const sessionOrder = state.sessionOrder.filter((sid) => sid !== id);
          let activeSessionId = state.activeSessionId;
          if (activeSessionId === id) {
            activeSessionId = sessionOrder[0] ?? null;
          }
          return { sessions, sessionOrder, activeSessionId };
        });
      },

      sendMessage: async (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const state = get();
        const sessionId = state.activeSessionId;
        if (!sessionId) return;
        const session = state.sessions[sessionId];
        if (!session) return;

        const isFirstUserMessage = session.messages.every(
          (m) => m.role !== "user",
        );

        const userMessage = makeMessage("user", trimmed);
        const controller = new AbortController();
        const now = Date.now();

        set((s) => {
          const current = s.sessions[sessionId];
          if (!current) return s;
          const updated: Session = {
            ...current,
            title:
              isFirstUserMessage && current.title === "New chat"
                ? trimmed.slice(0, TITLE_MAX_CHARS)
                : current.title,
            messages: [...current.messages, userMessage],
            updatedAt: now,
          };
          return {
            sessions: { ...s.sessions, [sessionId]: updated },
            sessionOrder: [
              sessionId,
              ...s.sessionOrder.filter((sid) => sid !== sessionId),
            ],
            isThinking: true,
            abortController: controller,
          };
        });

        // Build the request from the freshly-updated session.
        const updatedSession = get().sessions[sessionId];
        const history = updatedSession ? pruneHistory(updatedSession.messages) : [];

        try {
          const response = await postChat(
            { sessionId, message: trimmed, history },
            controller.signal,
          );

          const assistantMessage = makeMessage("assistant", response.message, {
            products: response.products,
            recommendation: response.recommendation,
          });
          appendAssistantMessage(set, sessionId, assistantMessage);
        } catch (err) {
          const isAbort =
            err instanceof ChatClientError && err.kind === "abort";
          const errorTag = isAbort ? "stopped" : "failed";
          const friendlyText = isAbort
            ? ""
            : "Something went wrong — please try again.";
          const assistantMessage = makeMessage("assistant", friendlyText, {
            error: errorTag,
          });
          if (import.meta.env.DEV && !isAbort) {
            // eslint-disable-next-line no-console
            console.error("[chatStore] postChat failed", err);
          }
          appendAssistantMessage(set, sessionId, assistantMessage);
        } finally {
          set({ isThinking: false, abortController: null });
        }
      },

      stopGeneration: () => {
        const controller = get().abortController;
        if (controller) controller.abort();
      },
    }),
    persistOptions,
  ),
);

function appendAssistantMessage(
  set: (
    partial:
      | Partial<ChatState>
      | ((state: ChatState) => Partial<ChatState>),
  ) => void,
  sessionId: string,
  message: Message,
) {
  set((s) => {
    const current = s.sessions[sessionId];
    if (!current) return s;
    const updated: Session = {
      ...current,
      messages: [...current.messages, message],
      updatedAt: Date.now(),
    };
    return {
      sessions: { ...s.sessions, [sessionId]: updated },
      sessionOrder: [
        sessionId,
        ...s.sessionOrder.filter((sid) => sid !== sessionId),
      ],
    };
  });
}

// Test helpers — kept here so tests can reset cleanly without UI involvement.
export function _resetChatStoreForTests(): void {
  useChatStore.setState({
    sessions: {},
    sessionOrder: [],
    activeSessionId: null,
    isThinking: false,
    abortController: null,
  });
}

export const _persistOptionsForTests = persistOptions;
