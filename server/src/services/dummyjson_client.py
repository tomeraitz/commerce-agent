from __future__ import annotations

import asyncio
import time
from typing import Self

import httpx
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from src.schemas.product import Product
from src.schemas.search_plan import SearchPlan

_CATEGORY_CACHE_TTL_SECONDS = 3600.0  # 1 hour
_CATALOG_SNAPSHOT_TTL_SECONDS = 3600.0  # 1 hour
_CATALOG_SNAPSHOT_LIMIT = 200  # DummyJSON has ~194 products; room to grow.


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, (httpx.ConnectError, httpx.ReadTimeout)):
        return True
    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code >= 500:
        return True
    return False


_retry_policy = retry(
    stop=stop_after_attempt(3),  # 1 initial + 2 retries
    wait=wait_exponential(multiplier=0.5, max=2),
    retry=retry_if_exception(_is_retryable),
    reraise=True,
)


class DummyJsonClient:
    def __init__(self, base_url: str = "https://dummyjson.com") -> None:
        self._base_url = base_url
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(connect=3.0, read=10.0, write=3.0, pool=3.0),
        )
        self._categories_cache: list[str] | None = None
        self._categories_cache_at: float = 0.0
        self._categories_lock = asyncio.Lock()
        self._catalog_snapshot_cache: dict[str, list[str]] | None = None
        self._catalog_snapshot_cache_at: float = 0.0
        self._catalog_snapshot_lock = asyncio.Lock()

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.close()

    @_retry_policy
    async def _request(self, path: str) -> dict:
        response = await self._client.get(path)
        response.raise_for_status()
        return response.json()

    def _parse_products(self, data: dict) -> list[Product]:
        if "products" in data:
            return [Product(**p) for p in data["products"]]
        return [Product(**data)]

    async def get_by_category(self, slug: str, limit: int = 20) -> list[Product]:
        data = await self._request(f"/products/category/{slug}?limit={limit}")
        return self._parse_products(data)

    async def search(self, query: str, limit: int = 20) -> list[Product]:
        data = await self._request(f"/products/search?q={query}&limit={limit}")
        return self._parse_products(data)

    async def get_by_id(self, product_id: int) -> Product:
        data = await self._request(f"/products/{product_id}")
        return Product(**data)

    async def get_products(self, limit: int = 20) -> list[Product]:
        data = await self._request(f"/products?limit={limit}")
        return self._parse_products(data)

    async def get_categories(self) -> list[str]:
        """Return the list of category slugs from DummyJSON, cached for 1 hour."""
        now = time.monotonic()
        if (
            self._categories_cache is not None
            and now - self._categories_cache_at < _CATEGORY_CACHE_TTL_SECONDS
        ):
            return self._categories_cache

        async with self._categories_lock:
            # Re-check after acquiring the lock in case another task populated it.
            now = time.monotonic()
            if (
                self._categories_cache is not None
                and now - self._categories_cache_at < _CATEGORY_CACHE_TTL_SECONDS
            ):
                return self._categories_cache

            data = await self._request("/products/categories")
            # DummyJSON returns a list of {slug, name, url} objects; tolerate a
            # plain list-of-strings response shape too.
            slugs: list[str] = []
            for entry in data if isinstance(data, list) else []:
                if isinstance(entry, dict) and "slug" in entry:
                    slugs.append(str(entry["slug"]))
                elif isinstance(entry, str):
                    slugs.append(entry)
            self._categories_cache = slugs
            self._categories_cache_at = time.monotonic()
            return slugs

    async def get_catalog_snapshot(self) -> dict[str, list[str]]:
        """Return `{category_slug: [product_title, ...]}` for the catalog, cached 1h.

        Used to ground the sales agent so it only offers product types that
        actually exist instead of hallucinating "canvas pictures" when the
        home-decoration category contains no pictures at all.
        """
        now = time.monotonic()
        if (
            self._catalog_snapshot_cache is not None
            and now - self._catalog_snapshot_cache_at < _CATALOG_SNAPSHOT_TTL_SECONDS
        ):
            return self._catalog_snapshot_cache

        async with self._catalog_snapshot_lock:
            now = time.monotonic()
            if (
                self._catalog_snapshot_cache is not None
                and now - self._catalog_snapshot_cache_at < _CATALOG_SNAPSHOT_TTL_SECONDS
            ):
                return self._catalog_snapshot_cache

            products = await self.get_products(limit=_CATALOG_SNAPSHOT_LIMIT)
            snapshot: dict[str, list[str]] = {}
            for product in products:
                snapshot.setdefault(product.category, []).append(product.title)
            self._catalog_snapshot_cache = snapshot
            self._catalog_snapshot_cache_at = time.monotonic()
            return snapshot

    async def execute_plan(self, plan: SearchPlan) -> list[Product]:
        tasks = [self._request(call.path) for call in plan.api_calls]
        results = await asyncio.gather(*tasks)

        seen_ids: set[int] = set()
        products: list[Product] = []
        for data in results:
            for product in self._parse_products(data):
                if product.id not in seen_ids:
                    seen_ids.add(product.id)
                    products.append(product)

        return products
