import type { ProductSummary } from "@/store/types";
import { ProductCard } from "./ProductCard";

interface ProductWidgetProps {
  products: ProductSummary[];
}

export function ProductWidget({ products }: ProductWidgetProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div
      className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2"
      data-testid="product-widget"
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export default ProductWidget;
