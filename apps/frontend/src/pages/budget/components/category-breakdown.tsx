// src/pages/Budget/components/CategoryBreakdown.tsx
import { BudgetSummary } from '@/lib/types/budget';
import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';

interface CategoryBreakdownProps {
  summary: BudgetSummary | null;
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ summary }) => {
  const [showAll, setShowAll] = useState(false);

  if (!summary || !summary.categoryBreakdown || summary.categoryBreakdown.length === 0) {
    return (
      <div className="bg-background rounded-md border border-transparent px-3 py-3 md:border-border md:px-4 md:py-4">
        <h3 className="text-foreground mb-3 text-sm font-semibold md:text-base">
          Category Breakdown
        </h3>
        <div className="text-muted-foreground flex h-48 flex-col items-center justify-center md:h-60">
          <div className="mb-2 text-3xl opacity-40 md:text-4xl">📊</div>
          <p className="text-foreground text-xs font-medium md:text-sm">No data available</p>
          <p className="text-muted-foreground mt-0.5 text-[10px] md:text-xs">Add transactions to see breakdown</p>
        </div>
      </div>
    );
  }

  const displayItems = showAll
    ? summary.categoryBreakdown
    : summary.categoryBreakdown.slice(0, 8);

  return (
    <div className="bg-background rounded-md border border-transparent px-3 py-3 md:border-border md:px-4 md:py-4">
      <div className="mb-3 md:mb-4">
        <h3 className="text-foreground mb-0.5 text-sm font-semibold md:text-base">
          Category Breakdown
        </h3>
        <p className="text-muted-foreground text-[11px] md:text-xs">
          Top {displayItems.length} spending categories
        </p>
      </div>

      <div className="space-y-2.5 md:space-y-3">
        {displayItems.map((item, index) => {
          const percentage = item.percentage || 0;

          return (
            <div key={index} className="group">
              {/* Header */}
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-2.5">
                  {/* Icon - stile dashboard */}
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full md:h-8 md:w-8"
                    style={{
                      backgroundColor: `${item.category.color}10`,
                    }}
                  >
                    <span className="text-sm md:text-base">{item.category.icon}</span>
                  </div>

                  {/* Category info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-xs font-medium md:text-sm">
                      {item.category.name}
                    </p>
                    <p className="text-muted-foreground text-[10px] md:text-[11px]">
                      {item.transactions} tx
                    </p>
                  </div>
                </div>

                {/* Amount - stile dashboard con allineamento a destra */}
                <div className="flex-shrink-0 text-right">
                  <p
                    className={`text-xs font-semibold md:text-sm ${
                      item.category.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    €{item.total.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-muted-foreground text-[10px] font-medium md:text-[11px]">
                    {percentage.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Progress bar - più sottile e minimal */}
              <div className="bg-muted/50 relative h-1 w-full overflow-hidden rounded-full md:h-1.5">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: item.category.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more/less button */}
      {summary.categoryBreakdown.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/50 mt-3 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition-colors md:text-xs"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span>Show less</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span>Show all {summary.categoryBreakdown.length}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
