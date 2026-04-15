import type { Recommendation } from "@/store/types";

interface RecommendationBannerProps {
  recommendation: Recommendation;
}

export function RecommendationBanner({ recommendation }: RecommendationBannerProps) {
  const { top_pick, cross_sell } = recommendation;

  // The design doc spec calls this field `reasoning`; the current Recommendation
  // type uses `message`. Tolerate both so we stay forward-compatible.
  const withReasoning = recommendation as Recommendation & { reasoning?: string };
  const reasoningText = withReasoning.reasoning ?? recommendation.message ?? "";

  const hasCrossSell =
    typeof cross_sell === "string" && cross_sell.trim().length > 0;

  return (
    <section
      aria-label="Recommendation"
      className="bg-primary-soft border border-accent/40 rounded-2xl p-4 flex flex-col gap-3"
      data-testid="recommendation-banner"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-text">
          Top pick: {top_pick.title}
        </h3>
        {reasoningText ? (
          <p className="text-sm text-text">{reasoningText}</p>
        ) : null}
      </div>

      {hasCrossSell ? (
        <div
          className="bg-surface border border-border rounded-xl p-3 flex flex-col gap-1"
          data-testid="recommendation-cross-sell"
        >
          <h4 className="text-sm font-semibold text-accent">
            You might also like
          </h4>
          <p className="text-sm text-text">{cross_sell}</p>
        </div>
      ) : null}
    </section>
  );
}

export default RecommendationBanner;
