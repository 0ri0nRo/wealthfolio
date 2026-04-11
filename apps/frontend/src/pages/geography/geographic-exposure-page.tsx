import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CountryExposure {
  code: string;
  name: string;
  value: number;
  region: GeographicRegion;
  color: string;
}

type GeographicRegion = "Europe" | "Americas" | "Asia" | "Oceania" | "Africa" | "Other";

// ── NEW: Market classification type ──────────────────────────────────────────
// "Unclassified" catches any country whose ISO code is not in MARKET_TYPE,
// ensuring the three displayed buckets always sum to exactly 100%.
// "CashOther" = 100% minus sum of all country %, representing Cash / Digital
// Assets / any non-geographic allocation that has no country breakdown.
type MarketType = "Developed" | "Emerging" | "Frontier" | "Unclassified" | "CashOther";


interface RegionSummary {
  name: GeographicRegion;
  value: number;
  countries: CountryExposure[];
  color: string;
}

interface GeographicExposurePageProps {
  accountId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — all CSS vars from global.css, light/dark auto
// ─────────────────────────────────────────────────────────────────────────────

const REGION_COLORS: Record<GeographicRegion, string> = {
  Europe:   "var(--chart-5)",
  Americas: "var(--chart-3)",
  Asia:     "var(--chart-6)",
  Oceania:  "var(--chart-4)",
  Africa:   "var(--chart-2)",
  Other:    "var(--chart-8)",
};

// ── NEW: Static country → market type mapping (MSCI-aligned) ─────────────────
// Developed: MSCI Developed Markets members
// Emerging:  MSCI Emerging Markets members
// Frontier:  remaining / pre-emerging
const MARKET_TYPE: Record<string, MarketType> = {
  // Developed
  US: "Developed", CA: "Developed", GB: "Developed", DE: "Developed",
  FR: "Developed", CH: "Developed", NL: "Developed", SE: "Developed",
  DK: "Developed", IE: "Developed", IT: "Developed", ES: "Developed",
  NO: "Developed", BE: "Developed", FI: "Developed", AT: "Developed",
  PT: "Developed", LU: "Developed", JP: "Developed", AU: "Developed",
  NZ: "Developed", HK: "Developed", SG: "Developed",
  // Emerging
  CN: "Emerging", IN: "Emerging", KR: "Emerging", TW: "Emerging",
  BR: "Emerging", MX: "Emerging", ZA: "Emerging", SA: "Emerging",
  AE: "Emerging", MY: "Emerging", TH: "Emerging", ID: "Emerging",
  PL: "Emerging", MO: "Emerging",
  // Frontier
  VN: "Frontier", NG: "Frontier", KE: "Frontier", PK: "Frontier",
  BD: "Frontier", MA: "Frontier", EG: "Frontier", LK: "Frontier",
  BH: "Frontier", KW: "Frontier", OM: "Frontier", TN: "Frontier",
};

const CHART_TOKENS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
  "var(--chart-7)", "var(--chart-8)", "var(--chart-9)",
];

const FLAGS: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", JP: "🇯🇵", DE: "🇩🇪", CN: "🇨🇳",
  CA: "🇨🇦", FR: "🇫🇷", AU: "🇦🇺", CH: "🇨🇭", KR: "🇰🇷",
  NL: "🇳🇱", SE: "🇸🇪", DK: "🇩🇰", IE: "🇮🇪", SG: "🇸🇬",
  IT: "🇮🇹", ES: "🇪🇸", HK: "🇭🇰", IN: "🇮🇳", BR: "🇧🇷",
  TW: "🇹🇼", MX: "🇲🇽", ZA: "🇿🇦", NZ: "🇳🇿", SA: "🇸🇦",
  AE: "🇦🇪", MY: "🇲🇾", TH: "🇹🇭", ID: "🇮🇩", PL: "🇵🇱",
  NO: "🇳🇴", BE: "🇧🇪", FI: "🇫🇮", AT: "🇦🇹", PT: "🇵🇹",
  LU: "🇱🇺",
};

const MAP_PATHS: Record<string, string> = {
  US: "M 160 130 L 230 130 L 235 160 L 225 180 L 195 185 L 165 170 Z",
  CA: "M 155  80 L 235  75 L 240 125 L 230 130 L 165 128 Z",
  MX: "M 165 185 L 210 185 L 215 210 L 195 218 L 162 205 Z",
  BR: "M 235 230 L 280 225 L 285 280 L 260 295 L 232 275 Z",
  GB: "M 430 100 L 438  98 L 442 110 L 437 118 L 430 115 Z",
  DE: "M 455 108 L 468 108 L 470 120 L 458 122 L 455 115 Z",
  FR: "M 442 115 L 458 115 L 460 130 L 448 135 L 440 128 Z",
  CH: "M 456 122 L 466 122 L 467 128 L 457 130 Z",
  NL: "M 453 104 L 462 103 L 464 110 L 454 112 Z",
  SE: "M 462  78 L 470  76 L 473 100 L 465 103 L 460  95 Z",
  DK: "M 460  92 L 467  90 L 468  98 L 462 100 Z",
  IE: "M 425 102 L 432 100 L 432 112 L 426 113 Z",
  IT: "M 462 130 L 470 128 L 472 148 L 465 152 L 460 143 Z",
  ES: "M 432 128 L 448 126 L 450 140 L 435 143 Z",
  PL: "M 470 100 L 482 100 L 483 114 L 470 116 Z",
  NO: "M 452  72 L 462  68 L 465  84 L 454  88 Z",
  BE: "M 447 106 L 455 106 L 456 113 L 447 114 Z",
  FI: "M 468  65 L 480  62 L 482  82 L 469  84 Z",
  AT: "M 463 118 L 474 118 L 475 124 L 463 125 Z",
  PT: "M 428 130 L 434 130 L 435 144 L 428 144 Z",
  LU: "M 452 111 L 456 111 L 456 116 L 452 116 Z",
  JP: "M 685 115 L 695 110 L 700 130 L 692 138 L 684 130 Z",
  CN: "M 620 115 L 665 110 L 670 155 L 645 165 L 615 150 Z",
  TW: "M 672 155 L 678 153 L 680 162 L 673 163 Z",
  KR: "M 668 128 L 678 126 L 680 140 L 670 142 Z",
  IN: "M 580 145 L 615 140 L 618 180 L 598 190 L 578 172 Z",
  SA: "M 530 155 L 560 152 L 562 178 L 533 180 Z",
  AE: "M 562 168 L 572 166 L 573 174 L 562 175 Z",
  MY: "M 648 182 L 665 180 L 666 192 L 648 193 Z",
  TH: "M 635 162 L 650 160 L 651 178 L 635 179 Z",
  HK: "M 662 148 L 668 146 L 669 152 L 662 153 Z",
  SG: "M 658 185 L 665 183 L 666 188 L 660 190 Z",
  ID: "M 655 194 L 700 192 L 702 206 L 655 207 Z",
  AU: "M 650 230 L 700 225 L 715 270 L 695 285 L 650 275 Z",
  NZ: "M 718 278 L 726 274 L 728 292 L 718 293 Z",
  ZA: "M 470 268 L 500 265 L 502 292 L 470 293 Z",
};

// ─────────────────────────────────────────────────────────────────────────────
// API types
// ─────────────────────────────────────────────────────────────────────────────

interface AllocationCategory {
  categoryId: string;
  categoryName: string;
  color: string;
  value: number;
  percentage: number;
  children?: AllocationCategory[];
}

interface AllocationsResponse {
  regions:      { categories: AllocationCategory[] };
  assetClasses: { categories: AllocationCategory[] };
}

const REGION_ID_MAP: Record<string, GeographicRegion> = {
  R10: "Europe",
  R20: "Americas",
  R30: "Asia",
  R40: "Africa",
  R50: "Oceania",
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

function useGeographicExposure(accountId: string) {
  const [countries,   setCountries]   = useState<CountryExposure[]>([]);
  const [totalPct,    setTotalPct]    = useState<number>(100);
  const [cashPct,     setCashPct]     = useState<number>(0);
  const [digitalPct,  setDigitalPct]  = useState<number>(0);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch(`/api/v1/allocations?${new URLSearchParams({ accountId })}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<AllocationsResponse>;
      })
      .then((data) => {
        // ── Asset class percentages ───────────────────────────────────────
        let cash = 0, digital = 0;
        for (const ac of data.assetClasses?.categories ?? []) {
          if (ac.categoryId === "CASH")           cash    = ac.percentage;
          if (ac.categoryId === "DIGITAL_ASSETS") digital = ac.percentage;
        }
        setCashPct(cash);
        setDigitalPct(digital);

        // ── Country breakdown ─────────────────────────────────────────────
        let idx = 0;
        const result: CountryExposure[] = [];
        let sumPct = 0;

        for (const region of data.regions.categories) {
          if (region.categoryId === "__UNKNOWN__") continue;
          if (!region.children?.length) continue;

          const mappedRegion: GeographicRegion = REGION_ID_MAP[region.categoryId] ?? "Other";
          for (const child of region.children) {
            if (child.categoryId === "__UNKNOWN__") continue;

            const code = child.categoryId.startsWith("country_")
              ? child.categoryId.slice(8).toUpperCase()
              : child.categoryId.toUpperCase();
            result.push({
              code,
              name:   child.categoryName,
              value:  child.percentage,
              region: mappedRegion,
              color:  CHART_TOKENS[idx % CHART_TOKENS.length],
            });
            sumPct += child.percentage;
            idx++;
          }
        }

        result.sort((a, b) => b.value - a.value);
        setCountries(result);
        setTotalPct(parseFloat(sumPct.toFixed(2)));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [accountId]);

  return { countries, totalPct, cashPct, digitalPct, isLoading, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Active donut shape
// ─────────────────────────────────────────────────────────────────────────────

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  return (
    <g>
      <text x={cx} y={cy - 16} textAnchor="middle"
        fill="var(--foreground)" fontSize={13} fontWeight={600}>
        {FLAGS[payload.code] ?? "🌐"} {payload.name}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle"
        fill={fill} fontSize={20} fontWeight={800}>
        {payload.value.toFixed(1)}%
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle"
        fill="var(--muted-foreground)" fontSize={10}>
        {payload.region}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 10} outerRadius={outerRadius + 13}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.35} />
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WorldMap — desktop only
// ─────────────────────────────────────────────────────────────────────────────

function WorldMap({
  countries,
  hoveredCountry,
  selectedRegion,
  onHover,
}: {
  countries: CountryExposure[];
  hoveredCountry: CountryExposure | null;
  selectedRegion: GeographicRegion | null;
  onHover: (c: CountryExposure | null) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-card p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        World Map
      </p>
      <svg viewBox="0 0 860 380" className="w-full h-auto">
        <rect width="860" height="380" fill="var(--muted)" rx="6" opacity="0.35" />
        {[95, 190, 285].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="860" y2={y}
            stroke="var(--border)" strokeWidth="0.6" />
        ))}
        {[215, 430, 645].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="380"
            stroke="var(--border)" strokeWidth="0.6" />
        ))}
        <ellipse cx="190" cy="155" rx="78" ry="68" fill="var(--accent)" opacity="0.8" />
        <ellipse cx="248" cy="268" rx="44" ry="60" fill="var(--accent)" opacity="0.8" />
        <ellipse cx="455" cy="118" rx="42" ry="42" fill="var(--accent)" opacity="0.8" />
        <ellipse cx="472" cy="222" rx="52" ry="72" fill="var(--accent)" opacity="0.8" />
        <ellipse cx="632" cy="138" rx="112" ry="66" fill="var(--accent)" opacity="0.8" />
        <ellipse cx="682" cy="258" rx="54" ry="38" fill="var(--accent)" opacity="0.8" />
        {countries.map((country, i) => {
          const path = MAP_PATHS[country.code];
          if (!path) return null;
          const isHovered = hoveredCountry?.code === country.code;
          const isFiltered = selectedRegion !== null && country.region !== selectedRegion;
          const parts = path.split(" ");
          const lx = parseFloat(parts[1]) + 18;
          const ly = parseFloat(parts[2]) + 30;
          return (
            <g key={country.code}>
              <path
                d={path}
                fill={country.color}
                opacity={isFiltered ? 0.06 : isHovered ? 1 : 0.75}
                stroke="var(--card)"
                strokeWidth="0.8"
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => onHover(country)}
                onMouseLeave={() => onHover(null)}
              />
              {i < 3 && !isFiltered && (
                <circle cx={lx} cy={ly - 10}
                  r={Math.min(country.value / 2.5 + 5, 18)}
                  fill="none" stroke={country.color} strokeWidth="1.5" opacity="0.2" />
              )}
              {i < 6 && !isFiltered && (
                <text x={lx} y={ly} fill="var(--card)" fontSize="8" fontWeight="700"
                  textAnchor="middle" style={{ pointerEvents: "none" }}>
                  {country.value.toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hoveredCountry && (
        <div className="absolute bottom-4 left-4 rounded-md border bg-popover p-3 shadow-md text-popover-foreground">
          <p className="text-sm font-semibold">
            {FLAGS[hoveredCountry.code] ?? "🌐"} {hoveredCountry.name}
          </p>
          <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color: hoveredCountry.color }}>
            {hoveredCountry.value.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">{hoveredCountry.region}</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {(Object.entries(REGION_COLORS) as [GeographicRegion, string][]).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RegionCards
// ─────────────────────────────────────────────────────────────────────────────

function RegionCards({
  regionData,
  selectedRegion,
  onSelect,
}: {
  regionData: RegionSummary[];
  selectedRegion: GeographicRegion | null;
  onSelect: (r: GeographicRegion | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
      {regionData.map((r) => {
        const active = selectedRegion === r.name;
        return (
          <button
            key={r.name}
            onClick={() => onSelect(active ? null : r.name)}
            className="rounded-md border p-2.5 text-left transition-all hover:bg-accent"
            style={{
              borderColor: active ? r.color : "var(--border)",
              background: active ? "var(--accent)" : "var(--card)",
              outline: active ? `1px solid ${r.color}` : "none",
            }}
          >
            <p className="truncate text-xs font-medium text-muted-foreground">{r.name}</p>
            <p className="mt-0.5 text-base font-bold tabular-nums leading-tight"
              style={{ color: r.color }}>
              {r.value.toFixed(1)}%
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {r.countries.length} {r.countries.length === 1 ? "country" : "countries"}
            </p>
            <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full"
                style={{ width: `${Math.min(r.value, 100)}%`, background: r.color }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: MarketTypePieChart
// Full donut chart (Recharts) for Developed / Emerging / Frontier breakdown.
// Active slice shows name + % in the centre; legend on the right lists every
// bucket with icon, count and top-5 flags.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// MarketTypeChart
// Professional donut + structured legend with drill-down.
// Slices: Developed | Emerging | Frontier | Cash | Digital Assets | (Other)
// ─────────────────────────────────────────────────────────────────────────────

// Colour palette — all CSS vars, no emoji
const MARKET_PALETTE: Record<string, string> = {
  Developed:      "var(--chart-3)",
  Emerging:       "var(--chart-6)",
  Frontier:       "var(--chart-2)",
  Unclassified:   "var(--chart-8)",
  Cash:           "var(--chart-4)",
  "Digital Assets": "var(--chart-1)",
};

interface MarketSlice {
  id:          string;          // unique key
  label:       string;          // display name
  value:       number;          // percentage
  color:       string;
  countries:   CountryExposure[] | null; // null = non-geographic slice
}

const renderMarketActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  const sub = payload.countries != null
    ? `${payload.countries.length} ${payload.countries.length === 1 ? "country" : "countries"}`
    : "Non-geographic";
  return (
    <g>
      <text x={cx} y={cy - 16} textAnchor="middle"
        fill="var(--foreground)" fontSize={11} fontWeight={700} letterSpacing="0.02em">
        {payload.label}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle"
        fill={fill} fontSize={24} fontWeight={800}>
        {payload.value.toFixed(1)}%
      </text>
      <text x={cx} y={cy + 27} textAnchor="middle"
        fill="var(--muted-foreground)" fontSize={9} letterSpacing="0.03em">
        {sub.toUpperCase()}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 9} outerRadius={outerRadius + 11}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.4} />
    </g>
  );
};

function MarketTypeChart({
  countries,
  totalPct,
  cashPct,
  digitalPct,
}: {
  countries:   CountryExposure[];
  totalPct:    number;
  cashPct:     number;
  digitalPct:  number;
}) {
  const [activeIndex,   setActiveIndex]   = useState(0);
  const [drillTarget,   setDrillTarget]   = useState<MarketSlice | null>(null);

  // ── Build slices ────────────────────────────────────────────────────────────
  const slices = useMemo<MarketSlice[]>(() => {
    // Equity buckets
    const buckets = new Map<string, { value: number; countries: CountryExposure[] }>();
    for (const id of ["Developed", "Emerging", "Frontier", "Unclassified"]) {
      buckets.set(id, { value: 0, countries: [] });
    }
    for (const c of countries) {
      const key = MARKET_TYPE[c.code] ?? "Unclassified";
      const b   = buckets.get(key)!;
      b.value  += c.value;
      b.countries.push(c);
    }

    const result: MarketSlice[] = [];

    for (const [id, b] of buckets) {
      if (b.value < 0.005) continue;
      result.push({
        id,
        label:    id,
        value:    parseFloat(b.value.toFixed(2)),
        color:    MARKET_PALETTE[id] ?? "var(--chart-8)",
        countries: b.countries.sort((a, z) => z.value - a.value),
      });
    }

    // Sort equity buckets desc
    result.sort((a, z) => z.value - a.value);

    // Non-geographic slices
    if (cashPct > 0.005) {
      result.push({
        id:        "Cash",
        label:     "Cash",
        value:     parseFloat(cashPct.toFixed(2)),
        color:     MARKET_PALETTE["Cash"],
        countries: null,
      });
    }
    if (digitalPct > 0.005) {
      result.push({
        id:        "Digital Assets",
        label:     "Digital Assets",
        value:     parseFloat(digitalPct.toFixed(2)),
        color:     MARKET_PALETTE["Digital Assets"],
        countries: null,
      });
    }

    // Floating residual (rounding gaps, etc.)
    const used = result.reduce((s, e) => s + e.value, 0);
    const residual = parseFloat((100 - used).toFixed(2));
    if (residual > 0.1) {
      result.push({
        id:        "Other",
        label:     "Other",
        value:     residual,
        color:     "var(--muted-foreground)",
        countries: null,
      });
    }

    return result;
  }, [countries, totalPct, cashPct, digitalPct]);

  if (countries.length === 0) return null;

  // ── Drill-down panel ────────────────────────────────────────────────────────
  if (drillTarget?.countries) {
    const s = drillTarget;
    const countries = drillTarget.countries;
    const maxVal = countries[0]?.value ?? 1;

    return (
      <div className="rounded-lg border bg-card p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: s.color }}
            />
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
              {s.label}
            </p>
            <span className="text-xs text-muted-foreground">
              — {s.value.toFixed(1)}% of portfolio
            </span>
          </div>
          <button
            onClick={() => setDrillTarget(null)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-border rounded px-2 py-0.5"
          >
            Back
          </button>
        </div>

        {/* Country rows */}
        <div className="flex flex-col gap-0.5">
          {countries.map((c) => (
            <div key={c.code} className="flex items-center gap-2.5 px-1 py-1.5">
              <span className="shrink-0 text-sm" style={{ minWidth: 22 }}>
                {FLAGS[c.code] ?? ""}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-foreground">{c.name}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: s.color }}>
                    {c.value.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 h-px overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(c.value / maxVal) * 100}%`, background: s.color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main view ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Section title */}
      <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Market type
      </p>

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">

        {/* ── Donut ─────────────────────────────────────────────────────── */}
        <div className="mx-auto h-52 w-52 shrink-0 md:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                {...({ activeIndex, activeShape: renderMarketActiveShape } as any)}
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={86}
                dataKey="value"
                onMouseEnter={(_: any, i: number) => setActiveIndex(i)}
                onClick={(_: any, i: number) => {
                  const s = slices[i];
                  if (s.countries !== null) setDrillTarget(s);
                }}
                style={{ cursor: "pointer" }}
              >
                {slices.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={entry.color}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* ── Legend ────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Column headers */}
          <div className="mb-2 grid grid-cols-[1fr_56px_80px] items-center gap-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Segment
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Alloc.
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Countries
            </span>
          </div>

          {/* Divider */}
          <div className="mb-2 h-px bg-border" />

          {/* Rows */}
          <div className="flex flex-col">
            {slices.map((s, i) => {
              const isDrillable = s.countries !== null;
              const isActive    = activeIndex === i;
              return (
                <div
                  key={s.id}
                  className={`grid grid-cols-[1fr_56px_80px] items-center gap-2 rounded-md px-1 py-2 transition-colors ${
                    isActive ? "bg-accent/60" : "hover:bg-accent/30"
                  } ${isDrillable ? "cursor-pointer" : "cursor-default"}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => { if (isDrillable) setDrillTarget(s); }}
                >
                  {/* Colour + label */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: s.color }}
                    />
                    <span className="text-xs font-semibold text-foreground truncate">
                      {s.label}
                    </span>
                    {/* "No geographic data" badge for non-drillable */}
                    {!isDrillable && (
                      <span className="hidden sm:inline-block shrink-0 rounded border border-border px-1 py-px text-[9px] text-muted-foreground">
                        non-geographic
                      </span>
                    )}
                  </div>

                  {/* Allocation % */}
                  <span
                    className="text-right text-xs font-bold tabular-nums"
                    style={{ color: s.color }}
                  >
                    {s.value.toFixed(1)}%
                  </span>

                  {/* Country count or dash + drill hint */}
                  <div className="flex items-center justify-end gap-1">
                    {isDrillable ? (
                      <>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {s.countries!.length}
                        </span>
                        <svg
                          width="10" height="10" viewBox="0 0 10 10"
                          className="shrink-0 text-muted-foreground"
                          fill="none" stroke="currentColor" strokeWidth="1.5"
                        >
                          <path d="M3.5 2.5 L6.5 5 L3.5 7.5" />
                        </svg>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider + total */}
          <div className="mt-2 h-px bg-border" />
          <div className="mt-2 grid grid-cols-[1fr_56px_80px] items-center gap-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Total
            </span>
            <span className="text-right text-xs font-bold tabular-nums text-foreground">
              {slices.reduce((s, e) => s + e.value, 0).toFixed(1)}%
            </span>
            <span />
          </div>

          {/* Drill hint */}
          <p className="mt-3 text-[10px] text-muted-foreground">
            Click a market segment to view individual country breakdown.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CountryList
// ─────────────────────────────────────────────────────────────────────────────

function CountryList({
  countries,
  maxValue,
  hoveredCountry,
  showAll,
  selectedRegion,
  onHover,
  onActiveIndex,
  onToggleShowAll,
}: {
  countries: CountryExposure[];
  maxValue: number;
  hoveredCountry: CountryExposure | null;
  showAll: boolean;
  selectedRegion: GeographicRegion | null;
  onHover: (c: CountryExposure | null) => void;
  onActiveIndex: (i: number) => void;
  onToggleShowAll: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-0.5">
        {countries.map((country) => {
          const isHovered = hoveredCountry?.code === country.code;
          return (
            <div
              key={country.code}
              className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 transition-colors ${
                isHovered ? "bg-accent" : "hover:bg-accent/50"
              }`}
              onMouseEnter={() => {
                onHover(country);
                onActiveIndex(countries.indexOf(country));
              }}
              onMouseLeave={() => onHover(null)}
            >
              <span className="shrink-0 text-base" style={{ minWidth: 22 }}>
                {FLAGS[country.code] ?? "🌐"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {country.name}
                  </span>
                  <span
                    className="shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: country.color }}
                  >
                    {country.value.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${(country.value / maxValue) * 100}%`,
                      background: country.color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!selectedRegion && (
        <button
          onClick={onToggleShowAll}
          className="mt-3 w-full rounded-md border border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {showAll ? "▲ Show less" : "▼ Show all countries"}
        </button>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = "split" | "map" | "chart";

export default function GeographicExposurePage({ accountId }: GeographicExposurePageProps) {
  const { countries: allCountries, totalPct, cashPct, digitalPct, isLoading, error } = useGeographicExposure(accountId);

  const [activeIndex, setActiveIndex]       = useState(0);
  const [showAll, setShowAll]               = useState(false);
  const [view, setView]                     = useState<ViewMode>("split");
  const [hoveredCountry, setHoveredCountry] = useState<CountryExposure | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<GeographicRegion | null>(null);

  // ── All hooks before any conditional return ───────────────────────────────

  const regionData = useMemo<RegionSummary[]>(() => {
    const map = new Map<GeographicRegion, RegionSummary>();
    allCountries.forEach((c) => {
      if (!map.has(c.region)) {
        map.set(c.region, {
          name: c.region,
          value: 0,
          countries: [],
          color: REGION_COLORS[c.region],
        });
      }
      const r = map.get(c.region)!;
      r.value += c.value;
      r.countries.push(c);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [allCountries]);

  const visibleCountries = useMemo(() => {
    const base = selectedRegion
      ? allCountries.filter((c) => c.region === selectedRegion)
      : allCountries;
    if (!showAll && !selectedRegion) return base.slice(0, 8);
    return base;
  }, [allCountries, selectedRegion, showAll]);

  const pieData = useMemo(() => {
    if (selectedRegion) return allCountries.filter((c) => c.region === selectedRegion);
    return allCountries.slice(0, 12);
  }, [allCountries, selectedRegion]);

  const maxValue = allCountries[0]?.value ?? 100;

  // ── Conditional renders ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Loading geographic data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-destructive">
        Failed to load allocations: {error}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col gap-4 p-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)" }}
    >

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Geographic Exposure
          </h3>
          <p className="text-xs text-muted-foreground">
            {allCountries.length} countries · allocation by market
          </p>
        </div>

        {/* View toggle — desktop only */}
        <div className="hidden md:flex gap-0.5 rounded-md border border-border bg-muted p-0.5">
          {(["split", "map", "chart"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "map" ? "🌍 Map" : v === "chart" ? "Chart" : "Split"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Region filter pills ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
        <button
          onClick={() => setSelectedRegion(null)}
          className={`col-span-2 sm:col-auto rounded-full border px-3 py-1 text-xs font-medium text-center transition-colors ${
            !selectedRegion
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
          }`}
        >
          All regions
        </button>
        {regionData.map((r) => {
          const active = selectedRegion === r.name;
          return (
            <button
              key={r.name}
              onClick={() => setSelectedRegion(active ? null : r.name)}
              className="truncate rounded-full border px-2 py-1 text-xs font-medium text-center transition-colors"
              style={{
                borderColor: active ? r.color : "var(--border)",
                color: active ? r.color : "var(--muted-foreground)",
                background: active
                  ? `color-mix(in srgb, ${r.color} 12%, transparent)`
                  : "transparent",
              }}
            >
              {r.name} <span className="opacity-60">{r.value.toFixed(0)}%</span>
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MOBILE layout (< md)                                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      <div className="md:hidden">
        <RegionCards
          regionData={regionData}
          selectedRegion={selectedRegion}
          onSelect={setSelectedRegion}
        />
      </div>

      <div className="md:hidden rounded-lg border bg-card p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Allocation
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                {...({ activeIndex, activeShape: renderActiveShape } as any)}
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={78}
                dataKey="value"
                onMouseEnter={(_: any, index: number) => setActiveIndex(index)}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.code} fill={entry.color}
                    stroke="var(--card)" strokeWidth={1.5} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="md:hidden rounded-lg border bg-card p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Countries
        </p>
        <CountryList
          countries={visibleCountries}
          maxValue={maxValue}
          hoveredCountry={hoveredCountry}
          showAll={showAll}
          selectedRegion={selectedRegion}
          onHover={setHoveredCountry}
          onActiveIndex={setActiveIndex}
          onToggleShowAll={() => setShowAll((p) => !p)}
        />
      </div>

      {/* ── Market type chart — mobile ─────────────────────────────────── */}
      <div className="md:hidden">
        <MarketTypeChart
          countries={allCountries}
          totalPct={totalPct}
          cashPct={cashPct}
          digitalPct={digitalPct}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DESKTOP layout (≥ md)                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      <div
        className="hidden md:grid gap-4"
        style={{ gridTemplateColumns: view === "split" ? "1fr 1fr" : "1fr" }}
      >
        {(view === "map" || view === "split") && (
          <WorldMap
            countries={allCountries}
            hoveredCountry={hoveredCountry}
            selectedRegion={selectedRegion}
            onHover={setHoveredCountry}
          />
        )}

        {(view === "chart" || view === "split") && (
          <div className="flex flex-col rounded-lg border bg-card p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Allocation Breakdown
            </p>

            <div className="h-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    {...({ activeIndex, activeShape: renderActiveShape } as any)}
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={66}
                    outerRadius={88}
                    dataKey="value"
                    onMouseEnter={(_: any, index: number) => setActiveIndex(index)}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.code} fill={entry.color}
                        stroke="var(--card)" strokeWidth={1.5} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div
              className="mt-2 overflow-y-auto"
              style={!showAll && !selectedRegion ? { maxHeight: 320 } : undefined}
            >
              <CountryList
                countries={visibleCountries}
                maxValue={maxValue}
                hoveredCountry={hoveredCountry}
                showAll={showAll}
                selectedRegion={selectedRegion}
                onHover={setHoveredCountry}
                onActiveIndex={setActiveIndex}
                onToggleShowAll={() => setShowAll((p) => !p)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Region summary cards — desktop */}
      <div className="hidden md:block">
        <RegionCards
          regionData={regionData}
          selectedRegion={selectedRegion}
          onSelect={setSelectedRegion}
        />
      </div>

      {/* ── Market type chart — desktop ────────────────────────────────── */}
      <div className="hidden md:block">
        <MarketTypeChart
          countries={allCountries}
          totalPct={totalPct}
          cashPct={cashPct}
          digitalPct={digitalPct}
        />
      </div>

    </div>
  );
}
