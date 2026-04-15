import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProductSummary } from "@/store/types";
import { ProductWidget } from "./ProductWidget";

const products: ProductSummary[] = [
  {
    id: 1,
    title: "Phone",
    description: "A nice phone",
    brand: "Apple",
    price: 999,
    thumbnail: "https://example.com/p1.jpg",
  },
  {
    id: 2,
    title: "Laptop",
    description: "A nice laptop",
    brand: "Dell",
    price: 1299,
    thumbnail: "https://example.com/p2.jpg",
  },
  {
    id: 3,
    title: "Headphones",
    description: "Noise cancelling",
    brand: "Sony",
    price: 299,
    thumbnail: "https://example.com/p3.jpg",
  },
];

describe("ProductWidget", () => {
  it("renders one card title per product", () => {
    render(<ProductWidget products={products} />);

    for (const product of products) {
      expect(screen.getByText(product.title)).toBeInTheDocument();
    }
  });

  it("renders nothing when given an empty product list", () => {
    const { container } = render(<ProductWidget products={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
