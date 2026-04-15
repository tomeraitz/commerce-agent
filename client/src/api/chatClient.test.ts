import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postChat } from "./chatClient";
import { ChatClientError, type ChatRequest, type ChatResponse } from "./types";

const sampleRequest: ChatRequest = {
  sessionId: "00000000-0000-0000-0000-000000000001",
  message: "I want a new phone",
  history: [],
};

const sampleResponse: ChatResponse = {
  message: "Sure, here are some options.",
  products: [],
  recommendation: null,
};

function makeJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

type FetchMock = ReturnType<typeof vi.fn>;

describe("postChat", () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchMock: FetchMock;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("returns parsed ChatResponse on a 200", async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse(sampleResponse));

    const result = await postChat(sampleRequest);

    expect(result).toEqual(sampleResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/chat$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(sampleRequest);
  });

  it("throws ChatClientError with kind:'http' on 500", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));

    await expect(postChat(sampleRequest)).rejects.toMatchObject({
      name: "ChatClientError",
      kind: "http",
      status: 500,
    });
  });

  it("throws kind:'abort' when the caller aborts", async () => {
    const controller = new AbortController();

    fetchMock.mockImplementationOnce((_input: unknown, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const sig = init?.signal;
        sig?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const promise = postChat(sampleRequest, controller.signal);
    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(ChatClientError);
    await expect(promise).rejects.toMatchObject({ kind: "abort" });
  });

  it("throws kind:'timeout' when the 25 s cap fires", async () => {
    vi.useFakeTimers();

    fetchMock.mockImplementationOnce((_input: unknown, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const sig = init?.signal;
        sig?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const promise = postChat(sampleRequest);
    const assertion = expect(promise).rejects.toMatchObject({
      name: "ChatClientError",
      kind: "timeout",
    });

    await vi.advanceTimersByTimeAsync(25_000);
    await assertion;
  });

  it("throws kind:'network' on fetch rejection", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(postChat(sampleRequest)).rejects.toMatchObject({
      name: "ChatClientError",
      kind: "network",
    });
  });
});
