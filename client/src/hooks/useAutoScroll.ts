import { useEffect, useRef } from "react";

const BOTTOM_TOLERANCE_PX = 120;

/**
 * Keeps a scrollable element pinned to the bottom whenever `deps` change,
 * unless the user has scrolled up past {@link BOTTOM_TOLERANCE_PX}, in which
 * case we respect their position and skip the auto-scroll.
 */
export function useAutoScroll<T extends HTMLElement>(
  deps: unknown[],
): React.RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    if (distanceFromBottom > BOTTOM_TOLERANCE_PX) {
      return;
    }

    el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

export default useAutoScroll;
