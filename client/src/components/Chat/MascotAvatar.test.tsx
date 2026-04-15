import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MascotAvatar } from "./MascotAvatar";

describe("MascotAvatar", () => {
  it("renders with default size of 32", () => {
    render(<MascotAvatar />);
    const img = screen.getByAltText("Olive");
    expect(img).toHaveAttribute("width", "32");
    expect(img).toHaveAttribute("height", "32");
  });

  it("renders with custom size", () => {
    render(<MascotAvatar size={220} />);
    const img = screen.getByAltText("Olive");
    expect(img).toHaveAttribute("width", "220");
    expect(img).toHaveAttribute("height", "220");
  });

  it("uses the mascot svg as src", () => {
    render(<MascotAvatar />);
    const img = screen.getByAltText("Olive") as HTMLImageElement;
    expect(img.src).toMatch(/mascot/);
  });
});
