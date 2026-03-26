import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DashboardShell } from "@/components/dashboard-shell";

function loadStoreMonthlySales() {
  const scriptPath = join(process.cwd(), "scripts", "export_store_monthly_sales_sql.py");
  const output = execFileSync("python", ["-X", "utf8", scriptPath], {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
  });

  return JSON.parse(output);
}

function loadViewSettings() {
  const settingsPath = join(process.cwd(), "data", "store-view-settings.json");
  return JSON.parse(readFileSync(settingsPath, "utf-8")) as { actualPeriod?: string };
}

function loadTwExchangeRates() {
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

  return rates;
}

export default function Home() {
  const dataPath = join(process.cwd(), "data", "dashboard-data.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));
  const storeMonthlySales = loadStoreMonthlySales();
  const viewSettings = loadViewSettings();
  const twExchangeRates = loadTwExchangeRates();

  return (
    <DashboardShell
      data={data}
      storeMonthlySales={storeMonthlySales}
      twExchangeRates={twExchangeRates}
      initialActualPeriod={viewSettings.actualPeriod}
      canEditPeriod={process.env.NODE_ENV !== "production"}
    />
  );
}
