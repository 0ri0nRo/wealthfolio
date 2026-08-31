import { Icons } from "@wealthfolio/ui/components/ui/icons";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { cn } from "@/lib/utils";

export interface InfiniteScrollTriggerProps {
  onLoadMore: () => void;
  hasNextPage: boolean;
  /** Any fetch in flight for this list, including a background refetch. */
  isFetching: boolean;
  /** The next page specifically loading; drives the spinner. */
  isFetchingNextPage: boolean;
  className?: string;
}

/**
 * Shared infinite-scroll trigger for paginated lists. Owns the sentinel,
 * the observer lifecycle, the fetch guard, and the loading indicator; the
 * list keeps control of placement, scroll container, and query state.
 * Render it inside the list's row flow, directly after the rows.
 */
export function InfiniteScrollTrigger({
  onLoadMore,
  hasNextPage,
  isFetching,
  isFetchingNextPage,
  className,
}: InfiniteScrollTriggerProps) {
  const { t } = useTranslation();

  // Guard on isFetching (not just isFetchingNextPage) so a next-page
  // request can't start while a background refetch is in flight.
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) onLoadMore();
  }, [hasNextPage, isFetching, onLoadMore]);

  const sentinelRef = useIntersectionObserver(loadMore, {
    enabled: hasNextPage && !isFetching,
    rootMargin: "800px",
  });

  if (!hasNextPage && !isFetchingNextPage) return null;

  return (
    <div className={cn("flex w-full flex-col items-center", className)}>
      {hasNextPage && <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />}
      {isFetchingNextPage && (
        <span className="text-muted-foreground flex items-center gap-2 text-sm">
          <Icons.Spinner className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("common:loading")}
        </span>
      )}
    </div>
  );
}
