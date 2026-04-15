import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProductSummary } from "@/store/types";
import { ProductCard } from "./ProductCard";

const sampleProduct: ProductSummary = {
  id: 1,
  title: "Phone",
  description: "Nice",
  brand: "Apple",
  price: 999,
  thumbnail: "https://example.com/p.jpg",
};

describe("ProductCard", () => {
  it("renders title and price", () => {
    render(<ProductCard product={sampleProduct} />);

    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("$999.00")).toBeInTheDocument();
  });

  it("renders a 'View product' link with the DummyJSON URL and safe rel", () => {
    render(<ProductCard product={sampleProduct} />);

    const link = screen.getByRole("link", { name: /view product/i });
    expect(link).toHaveAttribute("href", "https://dummyjson.com/products/1");
    expect(link).toHaveAttribute("target", "_blank");
    const rel = link.getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
  });
});
