import type { TaxonomyAllocation } from "@/lib/types";

interface CountryAllocationChartProps {
  allocation: TaxonomyAllocation | undefined;
  isLoading?: boolean;
  onCountryClick?: (countryName: string) => void;
}

export function CountryAllocationChart(_: CountryAllocationChartProps) {
  return null;
}
