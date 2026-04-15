import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Message as MessageModel, ProductSummary } from "@/store/types";
import { Message } from "./Message";

function makeMessage(overrides: Partial<MessageModel> = {}): MessageModel {
  return {
    id: "m-1",
    role: "assistant",
    text: "",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

const sampleProduct: ProductSummary = {
  id: 42,
  title: "Acme Phone",
  description: "A nice phone",
  price: 499,
  thumbnail: "https://example.com/phone.jpg",
  brand: "Acme",
};

describe("Message", () => {
  it("renders a normal assistant message with a product widget", () => {
    const message = makeMessage({
      text: "Here are some phones.",
      products: [sampleProduct],
    });

    render(<Message message={message} />);

    expect(screen.getByText("Here are some phones.")).toBeInTheDocument();
    expect(screen.getByTestId("product-widget")).toBeInTheDocument();
    expect(screen.queryByTestId("message-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("message-stopped")).not.toBeInTheDocument();
  });

  it("renders a stopped message with italic muted 'Stopped.' text and no error styling", () => {
    const message = makeMessage({ text: "", error: "stopped" });

    render(<Message message={message} />);

    const stopped = screen.getByTestId("message-stopped");
    expect(stopped).toHaveTextContent("Stopped.");
    expect(stopped.className).toContain("italic");
    expect(stopped.className).toContain("text-text-muted");
    // Crucially: no red accent / error row.
    expect(stopped.className).not.toContain("border-danger");
    expect(screen.queryByTestId("message-error")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Something went wrong/i),
    ).not.toBeInTheDocument();
  });

  it("stopped message with empty text does NOT render an empty white bubble", () => {
    const message = makeMessage({ text: "", error: "stopped" });

    render(<Message message={message} />);

    // No MessageBubble role container when the stopped message is empty.
    expect(screen.queryByRole("generic", { name: "assistant" })).toBeNull();
    // Defensive: the only visible text for this message should be "Stopped.".
    const row = screen.getByTestId("chat-message");
    expect(row.textContent?.trim()).toBe("Stopped.");
  });

  it("renders a failed message with friendly text, danger accent, and no raw error detail", () => {
    const rawErrorTag = "failed";
    const message = makeMessage({ text: "", error: rawErrorTag });

    // Silence the dev-mode console.error the component emits.
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<Message message={message} />);

    const errorNode = screen.getByTestId("message-error");
    expect(errorNode).toHaveTextContent(
      "Something went wrong — please try again.",
    );
    // Styling: thin danger border on the left + readable body text.
    expect(errorNode.className).toContain("border-l-2");
    expect(errorNode.className).toContain("border-danger");
    expect(errorNode.className).toContain("text-text");

    // Raw error tag / status codes must never leak into the DOM.
    const row = screen.getByTestId("chat-message");
    expect(row.textContent ?? "").not.toContain(rawErrorTag);
    expect(row.textContent ?? "").not.toMatch(/HTTP\s*\d{3}/);
    expect(row.textContent ?? "").not.toMatch(/\b500\b/);

    consoleSpy.mockRestore();
  });

  it("error and stopped messages render distinctly (different text AND different accent)", () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { unmount } = render(
      <Message
        message={makeMessage({ id: "m-stop", text: "", error: "stopped" })}
      />,
    );
    const stoppedNode = screen.getByTestId("message-stopped");
    const stoppedClasses = stoppedNode.className;
    const stoppedText = stoppedNode.textContent;
    unmount();

    render(
      <Message
        message={makeMessage({ id: "m-fail", text: "", error: "http-500" })}
      />,
    );
    const errorNode = screen.getByTestId("message-error");
    expect(errorNode.textContent).not.toBe(stoppedText);
    expect(errorNode.className).not.toBe(stoppedClasses);
    expect(stoppedClasses).not.toContain("border-danger");
    expect(errorNode.className).toContain("border-danger");

    consoleSpy.mockRestore();
  });
});
