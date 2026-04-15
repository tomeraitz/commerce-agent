import {
  ChatClientError,
  type ChatRequest,
  type ChatResponse,
} from "./types";

// Per design doc §6: client-side cap of 25 s (server budget 20 s + 5 s slack).
const CLIENT_TIMEOUT_MS = 25_000;

function getApiBaseUrl(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> })
    .env?.VITE_API_BASE_URL;
  return fromEnv ?? "http://localhost:8000";
}

/**
 * Send a chat turn to the server. Combines the caller's `signal` with an
 * internal 25-second timeout. Throws `ChatClientError` for every failure mode
 * so callers can branch on `.kind`.
 */
export async function postChat(
  req: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, CLIENT_TIMEOUT_MS);

  // Forward an external abort to our internal controller so `fetch` only
  // receives one signal but we can still tell the two reasons apart.
  let externalAborted = signal?.aborted ?? false;
  const onExternalAbort = () => {
    externalAborted = true;
    timeoutController.abort();
  };
  if (signal) {
    if (signal.aborted) {
      timeoutController.abort();
    } else {
      signal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const url = `${getApiBaseUrl()}/chat`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: timeoutController.signal,
    });

    if (!res.ok) {
      const text = await safeReadText(res);
      throw new ChatClientError({
        status: res.status,
        kind: "http",
        message: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      });
    }

    return (await res.json()) as ChatResponse;
  } catch (err) {
    if (err instanceof ChatClientError) {
      throw err;
    }

    if (isAbortError(err)) {
      if (externalAborted) {
        throw new ChatClientError({
          status: 0,
          kind: "abort",
          message: "Request was aborted by the user.",
        });
      }
      if (timedOut) {
        throw new ChatClientError({
          status: 0,
          kind: "timeout",
          message: `Request timed out after ${CLIENT_TIMEOUT_MS} ms.`,
        });
      }
      // Defensive: an unexpected abort with no flag set — treat as abort.
      throw new ChatClientError({
        status: 0,
        kind: "abort",
        message: "Request was aborted.",
      });
    }

    throw new ChatClientError({
      status: 0,
      kind: "network",
      message: err instanceof Error ? err.message : "Network error",
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: string }).name === "AbortError"
  );
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
