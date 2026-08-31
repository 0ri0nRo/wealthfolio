import { useEffect, useRef, useState } from "react";

/**
 * Custom hook for intersection observer (infinite scroll trigger).
 *
 * Returns a callback ref to attach to the sentinel element. Using a callback
 * ref (rather than a ref object) lets the observer reconnect when the sentinel
 * node is replaced — e.g. when a layout switch unmounts one sentinel and
 * mounts another.
 */
export function useIntersectionObserver(
  callback: () => void,
  options?: {
    enabled?: boolean;
    rootMargin?: string;
  },
) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const { enabled = true, rootMargin = "100px" } = options ?? {};

  // Always invoke the latest callback so an observer entry delivered between
  // a state change and the next effect run cannot call a stale closure.
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled || !node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          callbackRef.current();
        }
      },
      { rootMargin },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [node, enabled, rootMargin]);

  return setNode;
}
