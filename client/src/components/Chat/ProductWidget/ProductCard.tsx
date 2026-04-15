import type { ProductSummary } from "@/store/types";

interface ProductCardProps {
  product: ProductSummary;
}

export function ProductCard({ product }: ProductCardProps) {
  const href = `https://dummyjson.com/products/${product.id}`;

  return (
    <article
      className="snap-start min-w-[260px] max-w-[280px] flex-shrink-0 bg-surface border border-border rounded-2xl p-3 flex flex-col gap-2"
      data-testid="product-card"
    >
      <div className="w-full aspect-square overflow-hidden rounded-xl bg-surface-muted">
        <img
          src={product.thumbnail}
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>

      <h3 className="text-base font-semibold text-text truncate" title={product.title}>
        {product.title}
      </h3>

      <p className="text-sm text-text-muted line-clamp-2">{product.description}</p>

      {product.brand ? (
        <span className="text-xs text-text-muted">{product.brand}</span>
      ) : null}

      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-lg font-semibold text-accent">
          ${product.price.toFixed(2)}
        </span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:text-primary-hover"
        >
          View product
        </a>
      </div>
    </article>
  );
}

export default ProductCard;
