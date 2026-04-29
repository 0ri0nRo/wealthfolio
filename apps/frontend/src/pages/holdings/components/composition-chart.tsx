import { useBalancePrivacy } from "@/hooks/use-balance-privacy";
import { useSettingsContext } from "@/lib/settings-provider";
import { Holding } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatAmount, formatPercent } from "@wealthfolio/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@wealthfolio/ui/components/ui/card";
import { EmptyPlaceholder } from "@wealthfolio/ui/components/ui/empty-placeholder";
import { Icons } from "@wealthfolio/ui/components/ui/icons";
import { Skeleton } from "@wealthfolio/ui/components/ui/skeleton";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Tooltip as ChartTooltip, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";

interface PortfolioCompositionProps {
  holdings: Holding[];
  isLoading?: boolean;
}

interface CompositionItem {
  id?: string;
  symbol: string;
  name?: string | null;
  value: number;
  share: number;
  gain: number;
  asOfDate?: string;
  color: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: CompositionItem }[];
  isBalanceHidden: boolean;
  currency: string;
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
];

const CompositionTooltip = ({ active, payload, isBalanceHidden, currency }: TooltipProps) => {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;

  return (
    <div className="bg-popover border-border shadow-lg rounded-md border px-3 py-2 text-xs">
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="font-semibold">{item.symbol}</span>
        <span className="text-muted-foreground tabular-nums">{formatPercent(item.share)}</span>
      </div>
      {item.name && <p className="text-muted-foreground mb-2 max-w-60 truncate leading-tight">{item.name}</p>}
      <div className="space-y-1 border-t pt-2">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Market value</span>
          <span className="font-semibold">{isBalanceHidden ? "••••" : formatAmount(item.value, currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Share</span>
          <span className="font-semibold">{formatPercent(item.share)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Return</span>
          <span className={cn("font-semibold", item.gain >= 0 ? "text-success" : "text-destructive")}>
            {item.gain >= 0 ? "+" : ""}
            {formatPercent(item.gain)}
          </span>
        </div>
      </div>
    </div>
  );
};

function CompositionLegend({
  items,
  activeIndex,
  onHover,
  currency,
  isBalanceHidden,
}: {
  items: CompositionItem[];
  activeIndex: number | undefined;
  onHover: (index: number | undefined) => void;
  currency: string;
  isBalanceHidden: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((item, index) => {
        const isActive = activeIndex === index;

        return (
          <Link
            key={item.symbol}
            to={`/holdings/${encodeURIComponent(item.id || item.symbol)}`}
            className="hover:bg-muted/60 flex items-center gap-2 rounded px-2 py-1 transition-opacity"
            style={{ opacity: activeIndex !== undefined && !isActive ? 0.45 : 1 }}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(undefined)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">
              {item.symbol}
              {item.name ? <span className="text-muted-foreground"> · {item.name}</span> : null}
            </span>
            <span className="font-mono tabular-nums text-xs text-muted-foreground">{formatPercent(item.share)}</span>
            <span className="font-mono tabular-nums text-xs text-muted-foreground">
              {isBalanceHidden ? "••••" : formatAmount(item.value, currency)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderSlice = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, index, payload } = props;
  const isActive = index === payload?.__activeIndex;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={isActive ? outerRadius + 6 : outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={isActive ? 1 : 0.8}
      />
      {isActive && (
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={outerRadius + 10}
          outerRadius={outerRadius + 14}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          opacity={0.35}
        />
      )}
    </g>
  );
};

export function PortfolioComposition({ holdings, isLoading }: PortfolioCompositionProps) {
  const { isBalanceHidden } = useBalancePrivacy();
  const { settings } = useSettingsContext();
  const baseCurrency = settings?.baseCurrency ?? "USD";
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const data = useMemo(() => {
    const processedData = holdings
      .map((holding) => {
        const symbol = holding.instrument?.symbol;
        if (!symbol) return null;

        const value = Number(holding.marketValue?.base) || 0;
        const gain = Number(holding.totalGainPct) || 0;

        if (!Number.isFinite(value) || value <= 0) return null;

        return {
          id: holding.instrument?.id,
          symbol,
          name: holding.instrument?.name ?? null,
          value,
          gain,
          asOfDate: holding.asOfDate,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.value - a.value);

    const totalValue = processedData.reduce((sum, item) => sum + item.value, 0);

    return processedData.map((item, index) => ({
      ...item,
      share: totalValue > 0 ? item.value / totalValue : 0,
      color: COLORS[index % COLORS.length],
    }));
  }, [holdings]);

  const totalValue = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center space-x-2">
            <Icons.LayoutDashboard className="text-muted-foreground h-4 w-4" />
            <CardTitle className="text-muted-foreground text-sm font-medium uppercase tracking-wider">
              Composition
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Skeleton className="mx-auto h-52 w-52 shrink-0 rounded-full md:mx-0" />
            <div className="flex-1 space-y-2 pt-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center space-x-2">
            <Icons.LayoutDashboard className="text-muted-foreground h-4 w-4" />
            <CardTitle className="text-md font-medium">Composition</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex h-125 items-center justify-center">
          <EmptyPlaceholder
            icon={<Icons.BarChart className="h-10 w-10" />}
            title="No holdings data"
            description="There is no holdings data available for your portfolio."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider">Composition</CardTitle>
        <p className="text-muted-foreground text-xs">ETF allocation by market value</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="mx-auto h-56 w-56 shrink-0 md:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart
                onMouseLeave={() => setActiveIndex(undefined)}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="symbol"
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="82%"
                  paddingAngle={3}
                  stroke="hsl(var(--background))"
                  strokeWidth={1}
                  shape={(props) => renderSlice({ ...props, payload: { ...props.payload, __activeIndex: activeIndex } })}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                >
                  {data.map((item) => (
                    <Cell key={item.symbol} fill={item.color} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <CompositionTooltip
                      isBalanceHidden={isBalanceHidden}
                      currency={baseCurrency}
                    />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {data.length} ETF{data.length === 1 ? "" : "s"}
              </span>
              <span>{isBalanceHidden ? "••••" : formatAmount(totalValue, baseCurrency)}</span>
            </div>
            <CompositionLegend
              items={data}
              activeIndex={activeIndex}
              onHover={setActiveIndex}
              currency={baseCurrency}
              isBalanceHidden={isBalanceHidden}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
