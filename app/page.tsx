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

function loadProfitCardData() {
  const pythonScript = `
import json
import sqlite3
from collections import defaultdict

REGIONS = {"HKMC": {"HK", "MC"}, "TW": {"TW"}}
ACCOUNT_NAMES = [
    "Tag매출액", "할인율", "실매출액", "매출원가합계", "매출총이익", "영업이익", "판매관리비",
    "1. 급 여", "2. TRAVEL & MEAL", "3. 피복비(유니폼)", "4. 임차료", "5. 유지보수비",
    "6. 수도광열비", "7. 소모품비", "8. 통신비", "9. 광고선전비", "10. 지급수수료",
    "11. 운반비", "12. 기타 수수료(매장관리비 외)", "13. 보험료", "14. 감가상각비", "15. 면세점 직접비",
]

def resolve_region(country):
    for region, countries in REGIONS.items():
        if country in countries:
            return region
    return None

conn = sqlite3.connect("data/store_dashboard.sqlite")
conn.row_factory = sqlite3.Row
placeholders = ", ".join("?" for _ in ACCOUNT_NAMES)
rows = conn.execute(
    f"""
    SELECT brand, country, channel, period_key, account_name_clean, SUM(CAST(amount AS REAL)) AS amount
    FROM monthly_pnl
    WHERE account_name_clean IN ({placeholders})
    GROUP BY brand, country, channel, period_key, account_name_clean
    ORDER BY country, channel, period_key, account_name_clean
    """,
    ACCOUNT_NAMES,
).fetchall()
conn.close()

payload = {"HKMC": {}, "TW": {}}
for row in rows:
    region = resolve_region(str(row["country"]))
    if region is None:
        continue
    store_code = f'{row["brand"]}__{row["country"]}__{row["channel"]}'
    store = payload[region].setdefault(store_code, {
        "brand": str(row["brand"]),
        "country": str(row["country"]),
        "channel": str(row["channel"]),
        "storeName": str(row["channel"]),
        "accounts": defaultdict(dict),
    })
    store["accounts"][str(row["account_name_clean"])][str(row["period_key"])] = round(float(row["amount"] or 0.0), 4)

normalized = {}
for region, stores in payload.items():
    normalized[region] = {}
    for store_code, store in stores.items():
        normalized[region][store_code] = {
            "brand": store["brand"],
            "country": store["country"],
            "channel": store["channel"],
            "storeName": store["storeName"],
            "accounts": {account: dict(periods) for account, periods in dict(store["accounts"]).items()},
        }

print(json.dumps(normalized, ensure_ascii=False))
`;
  const output = execFileSync("python", ["-X", "utf8", "-c", pythonScript], {
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
  return JSON.parse(readFileSync(settingsPath, "utf-8")) as { actualPeriod?: string; twExchangeRates?: Record<string, number> };
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

export default function Home() {
  const dataPath = join(process.cwd(), "data", "dashboard-data.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));
  const storeMonthlySales = loadStoreMonthlySales();
  const profitCardData = loadProfitCardData();
  const viewSettings = loadViewSettings();
  const twExchangeRates = loadTwExchangeRates(viewSettings.twExchangeRates);

  return (
    <DashboardShell
      data={data}
      storeMonthlySales={storeMonthlySales}
      profitCardData={profitCardData}
      twExchangeRates={twExchangeRates}
      initialActualPeriod={viewSettings.actualPeriod}
      canEditPeriod={process.env.NODE_ENV !== "production"}
    />
  );
}
