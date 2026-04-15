import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SuggestionChips } from "./SuggestionChips";

describe("SuggestionChips", () => {
  it("renders four buttons", () => {
    render(<SuggestionChips onPick={() => {}} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
  });

  it("calls onPick with the chip's exact text when clicked", () => {
    const onPick = vi.fn();
    render(<SuggestionChips onPick={onPick} />);

    fireEvent.click(
      screen.getByRole("button", { name: "I'm looking for a new smartphone" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Recommend a gift under $50" }),
    );

    expect(onPick).toHaveBeenNthCalledWith(1, "I'm looking for a new smartphone");
    expect(onPick).toHaveBeenNthCalledWith(2, "Recommend a gift under $50");
    expect(onPick).toHaveBeenCalledTimes(2);
  });
});
