import { FacetedFilter } from "@wealthfolio/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { HoldingsVisibilityFilter } from "./holdings-visibility";

interface HoldingsVisibilityFacetProps {
  value: HoldingsVisibilityFilter[];
  onChange: (value: HoldingsVisibilityFilter[]) => void;
}

export function HoldingsVisibilityFacet({ value, onChange }: HoldingsVisibilityFacetProps) {
  const { t } = useTranslation();
  const options = useMemo(
    () => [
      { value: "open", label: t("holdings:open") },
      { value: "closed", label: t("holdings:closed") },
      { value: "cash", label: t("holdings:cash") },
    ],
    [t],
  );

  return (
    <FacetedFilter
      title={t("common:view")}
      options={options}
      selectedValues={new Set(value)}
      onFilterChange={(values) => {
        const nextValues = Array.from(values) as HoldingsVisibilityFilter[];
        onChange(nextValues.length > 0 ? nextValues : ["open"]);
      }}
    />
  );
}
