import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageBubble } from "./MessageBubble";

describe("MessageBubble", () => {
  it("renders the provided text", () => {
    render(<MessageBubble role="user" text="hello world" />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("applies emerald-soft background for user role", () => {
    render(<MessageBubble role="user" text="hi" />);
    const bubble = screen.getByText("hi");
    expect(bubble.className).toContain("bg-primary-soft");
    expect(bubble.className).not.toContain("bg-surface");
  });

  it("applies surface background and border for assistant role", () => {
    render(<MessageBubble role="assistant" text="hi" />);
    const bubble = screen.getByText("hi");
    expect(bubble.className).toContain("bg-surface");
    expect(bubble.className).toContain("border");
    expect(bubble.className).not.toContain("bg-primary-soft");
  });

  it("preserves whitespace and newlines", () => {
    render(<MessageBubble role="assistant" text={"line1\nline2"} />);
    const bubble = screen.getByText(/line1/);
    expect(bubble.className).toContain("whitespace-pre-wrap");
  });
});
