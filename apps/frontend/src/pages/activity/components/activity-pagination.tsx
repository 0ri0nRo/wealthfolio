import { Icons } from "@wealthfolio/ui";
import { useTranslation } from "react-i18next";

interface ActivityPaginationProps {
  isFetching: boolean;
  totalFetched: number;
  totalCount: number;
}

export function ActivityPagination({
  isFetching,
  totalFetched,
  totalCount,
}: ActivityPaginationProps) {
  const { t } = useTranslation();
  return (
    <div className="my-3 flex shrink-0 items-center justify-center">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        {isFetching ? <Icons.Spinner className="h-4 w-4 animate-spin" /> : null}
        <span>{t("activity:pagination_count", { fetched: totalFetched, total: totalCount })}</span>
      </div>
    </div>
  );
}
