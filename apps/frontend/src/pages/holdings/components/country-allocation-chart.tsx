import type { TaxonomyAllocation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@wealthfolio/ui/components/ui/card";
import { Skeleton } from "@wealthfolio/ui/components/ui/skeleton";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CountryEntry {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OTHER_COLOR = "#b0a8a0";
const TOP_N = 17;

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCountries(regions: TaxonomyAllocation): CountryEntry[] {
  const countries: CountryEntry[] = [];

  for (const region of regions.categories) {
    if (!region.children) continue;
    for (const child of region.children) {
      if (child.categoryId.startsWith("country_") && child.value > 0) {
        countries.push({
          name: child.categoryName,
          value: child.value,
          percentage: child.percentage,
          color: child.color,
        });
      }
    }
  }

  return countries.sort((a, b) => b.percentage - a.percentage);
}

function groupCountries(countries: CountryEntry[]): CountryEntry[] {
  if (countries.length <= TOP_N) return countries;

  const top = countries.slice(0, TOP_N);
  const rest = countries.slice(TOP_N);

  return [
    ...top,
    {
      name: `Other (${rest.length})`,
      value: rest.reduce((s, c) => s + c.value, 0),
      percentage: rest.reduce((s, c) => s + c.percentage, 0),
      color: OTHER_COLOR,
    },
  ];
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d: CountryEntry = payload[0].payload;
  return (
    <div className="bg-popover border-border shadow-lg rounded-md border px-3 py-2 text-xs">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground">{d.percentage.toFixed(2)}%</p>
    </div>
  );
};

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({
  data,
  activeIndex,
  onHover,
}: {
  data: CountryEntry[];
  activeIndex: number | undefined;
  onHover: (i: number | undefined) => void;
}) {
  const half = Math.ceil(data.length / 2);
  const cols = [data.slice(0, half), data.slice(half)];

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
      {cols.map((col, ci) => (
        <div key={ci} className="space-y-0.5">
          {col.map((entry, ri) => {
            const idx = ci * half + ri;
            const isActive = activeIndex === idx;
            return (
              <button
                key={entry.name}
                type="button"
                className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/50"
                style={{ opacity: activeIndex !== undefined && !isActive ? 0.4 : 1 }}
                onMouseEnter={() => onHover(idx)}
                onMouseLeave={() => onHover(undefined)}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="flex-1 truncate text-foreground/80">{entry.name}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {entry.percentage.toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface CountryAllocationChartProps {
  allocation: TaxonomyAllocation | undefined;
  isLoading?: boolean;
  onCountryClick?: (countryName: string) => void;
}

export function CountryAllocationChart({
  allocation,
  isLoading,
  onCountryClick,
}: CountryAllocationChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const countries = useMemo(
    () => (allocation ? groupCountries(extractCountries(allocation)) : []),
    [allocation],
  );

  // activeShape receives all sector props + index; we use it to drive the
  // "active" visual without relying on the `activeIndex` prop on <Pie>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderShape = (props: any) => {
    const {
      cx, cy,
      innerRadius, outerRadius,
      startAngle, endAngle,
      fill,
      index,        // recharts injects this
      payload,
    } = props;

    const isActive = index === activeIndex;

    if (!isActive) {
      // Default (non-active) sector
      return (
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          opacity={activeIndex !== undefined ? 0.45 : 1}
        />
      );
    }

    // Active sector: expanded + ring + center label
    return (
      <g>
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 11, fontWeight: 600 }}
          fill="currentColor"
        >
          {payload.name}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 11, opacity: 0.6 }}
          fill="currentColor"
        >
          {payload.percentage.toFixed(2)}%
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={outerRadius + 10}
          outerRadius={outerRadius + 14}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          opacity={0.4}
        />
      </g>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Skeleton className="h-52 w-52 flex-shrink-0 rounded-full mx-auto sm:mx-0" />
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

  if (!allocation || countries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Country Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          {/* Donut */}
          <div className="h-52 w-52 flex-shrink-0 mx-auto md:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={countries}
                  dataKey="percentage"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="54%"
                  outerRadius="78%"
                  strokeWidth={1}
                  stroke="hsl(var(--background))"
                  shape={renderShape}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                  onClick={(entry) => {
                    if (!String(entry.name).startsWith("Other (")) {
                      onCountryClick?.(entry.name as string);
                    }
                  }}
                  style={{ cursor: onCountryClick ? "pointer" : "default" }}
                >
                  {countries.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                {activeIndex === undefined && <Tooltip content={<CustomTooltip />} />}
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 min-w-0">
            <Legend
              data={countries}
              activeIndex={activeIndex}
              onHover={setActiveIndex}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
