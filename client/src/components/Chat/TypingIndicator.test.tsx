import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TypingIndicator } from "./TypingIndicator";

describe("TypingIndicator", () => {
  it("renders three dot elements", () => {
    render(<TypingIndicator />);
    const dots = screen.getAllByTestId("typing-dot");
    expect(dots).toHaveLength(3);
  });

  it("staggers the dot animation delays", () => {
    render(<TypingIndicator />);
    const dots = screen.getAllByTestId("typing-dot");
    expect(dots[0]?.style.animationDelay).toBe("0ms");
    expect(dots[1]?.style.animationDelay).toBe("150ms");
    expect(dots[2]?.style.animationDelay).toBe("300ms");
  });

  it("exposes a status role for accessibility", () => {
    render(<TypingIndicator />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
