import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DashboardShell } from "@/components/dashboard-shell";
import { loadOperatingProfitSummary, loadProfitCardData, loadStoreMonthlySales } from "@/lib/server-data";

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function loadViewSettings() {
  const settingsPath = join(process.cwd(), "data", "store-view-settings.json");
  return JSON.parse(readFileSync(settingsPath, "utf-8")) as { actualPeriod?: string; twExchangeRates?: Record<string, number> };
}

function resolveActualPeriod(
  searchParamValue: string | string[] | undefined,
  fallback?: string,
) {
  const candidate = Array.isArray(searchParamValue) ? searchParamValue[0] : searchParamValue;
  if (candidate && PERIOD_PATTERN.test(candidate)) return candidate;
  return fallback;
}

function loadTwExchangeRates(overrides?: Record<string, number>) {
  const exchangeRatePath = join(process.cwd(), "TW_Exchange Rate.csv");
  const raw = readFileSync(exchangeRatePath, "utf-8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).slice(1);
  const rates: Record<string, number> = {};

  for (const line of lines) {
    if (!line.trim()) continue;
    const [periodRaw, rateRaw] = line.split(",");
    const period = periodRaw?.trim();
    const rate = Number(rateRaw?.trim());
    if (!period || Number.isNaN(rate)) continue;
    rates[period] = rate;
  }

  return { ...rates, ...(overrides ?? {}) };
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ actualPeriod?: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const dataPath = join(process.cwd(), "data", "dashboard-data.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));
  const viewSettings = loadViewSettings();
  const actualPeriod = resolveActualPeriod(resolvedSearchParams.actualPeriod, viewSettings.actualPeriod) ?? "2026-03";
  const twExchangeRates = loadTwExchangeRates(viewSettings.twExchangeRates);
  const storeMonthlySales = await loadStoreMonthlySales(actualPeriod, twExchangeRates);
  const profitCardData = loadProfitCardData();
  const operatingProfitSummary = loadOperatingProfitSummary();

  return (
    <DashboardShell
      data={data}
      storeMonthlySales={storeMonthlySales}
      profitCardData={profitCardData}
      operatingProfitSummary={operatingProfitSummary}
      twExchangeRates={twExchangeRates}
      initialActualPeriod={actualPeriod}
      canEditPeriod
      canPersistSettings={process.env.NODE_ENV !== "production"}
    />
  );
}
