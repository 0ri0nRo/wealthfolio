import { ActivityType, InstrumentType } from "@/lib/constants";
import { roundDecimal } from "@/lib/utils";

// Mirrors Asset::contract_multiplier in assets_model.rs - the app-wide
// multiplier defaults (option 100, everything else 1). Bonds deliberately
// default to 1: provider quotes are stored as a FRACTION of par, so a
// percent-of-par default would double-apply the /100. Percent-of-par is
// opt-in per asset via explicit contractMultiplier metadata.
export function resolveActivityCashMultiplier(
  instrumentType: unknown,
  explicitMultiplier?: unknown,
): number {
  const explicit = Number(explicitMultiplier);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const normalizedType =
    typeof instrumentType === "string" ? instrumentType.trim().toUpperCase() : "";
  return normalizedType === InstrumentType.OPTION ? 100 : 1;
}

export function calculateTradeFinalAmount({
  activityType,
  instrumentType,
  quantity,
  unitPrice,
  fee,
  tax,
  contractMultiplier,
}: {
  activityType: ActivityType;
  instrumentType: string;
  quantity: unknown;
  unitPrice: unknown;
  fee: unknown;
  tax: unknown;
  contractMultiplier?: unknown;
}): number | undefined {
  const q = Number(quantity);
  const price = Number(unitPrice);
  if (!(q > 0) || !(price > 0)) return undefined;

  const gross = q * price * resolveActivityCashMultiplier(instrumentType, contractMultiplier);
  const charges = Math.abs(Number(fee) || 0) + Math.abs(Number(tax) || 0);
  const final = activityType === ActivityType.BUY ? gross + charges : Math.abs(gross - charges);
  return roundDecimal(final);
}

export function calculateIncomeFinalAmount(
  quantity: unknown,
  unitPrice: unknown,
  instrumentType?: unknown,
  contractMultiplier?: unknown,
): number | undefined {
  const q = Number(quantity);
  const price = Number(unitPrice);
  if (!(q > 0) || !(price > 0)) return undefined;
  // Mirrors calculate_composite_final_cash (economic_events.rs) with the
  // multiplier defaults from Asset::contract_multiplier (assets_model.rs), which
  // includes the asset's unit multiplier.
  return roundDecimal(
    q * price * resolveActivityCashMultiplier(instrumentType, contractMultiplier),
  );
}
