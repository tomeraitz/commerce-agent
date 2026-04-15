import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProductSummary, Recommendation } from "@/store/types";
import { RecommendationBanner } from "./RecommendationBanner";

const topPick: ProductSummary = {
  id: 42,
  title: "Olive Phone Pro",
  description: "A great phone",
  brand: "Olive",
  price: 799,
  thumbnail: "https://example.com/p.jpg",
};

function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    top_pick: topPick,
    alternatives: [],
    message: "Best balance of price and battery life.",
    ...overrides,
  };
}

describe("RecommendationBanner", () => {
  it("renders the top_pick title and reasoning text", () => {
    render(
      <RecommendationBanner recommendation={makeRecommendation()} />,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: /top pick: olive phone pro/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/best balance of price and battery life/i),
    ).toBeInTheDocument();
  });

  it("does NOT render the 'You might also like' block when cross_sell is null/undefined", () => {
    render(
      <RecommendationBanner
        recommendation={makeRecommendation({ cross_sell: undefined })}
      />,
    );

    expect(screen.queryByText(/you might also like/i)).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("recommendation-cross-sell"),
    ).not.toBeInTheDocument();
  });

  it("renders the 'You might also like' block when cross_sell is present", () => {
    render(
      <RecommendationBanner
        recommendation={makeRecommendation({
          cross_sell: "Pair it with the Olive Charger 65W.",
        })}
      />,
    );

    expect(screen.getByText(/you might also like/i)).toBeInTheDocument();
    expect(
      screen.getByText(/pair it with the olive charger 65w\./i),
    ).toBeInTheDocument();
  });
});
