import { readFileSync } from "node:fs";
import { join } from "node:path";

import snowflake from "snowflake-sdk";

const REGIONS = {
  HKMC: new Set(["HK", "MC"]),
  TW: new Set(["TW"]),
} as const;

const ACTUAL_SALES_ACCOUNT_NAME = "실매출액";
const TAG_SALES_ACCOUNT_NAME = "Tag매출액";

const PROFIT_ACCOUNT_NAMES = new Set([
  "Tag매출액",
  "할인율",
  "실매출액",
  "매출원가합계",
  "매출총이익",
  "영업이익",
  "판매관리비",
  "1. 급 여",
  "2. TRAVEL & MEAL",
  "3. 피복비(유니폼)",
  "4. 임차료",
  "5. 유지보수비",
  "6. 수도광열비",
  "7. 소모품비",
  "8. 통신비",
  "9. 광고선전비",
  "10. 지급수수료",
  "11. 운반비",
  "12. 기타 수수료(매장관리비 외)",
  "13. 보험료",
  "14. 감가상각비",
  "15. 면세점 직접비",
]);

type StoreMonthlySales = Record<
  string,
  Record<
    string,
    {
      brand: string;
      country: string;
      channel: string;
      storeName: string;
      monthlySales: Record<string, number>;
      annualTotals: Record<string, number>;
      monthlyTagSales: Record<string, number>;
      annualTagTotals: Record<string, number>;
    }
  >
>;

type ProfitCardData = Record<
  string,
  Record<
    string,
    {
      brand: string;
      country: string;
      channel: string;
      storeName: string;
      accounts: Record<string, Record<string, number>>;
    }
  >
>;

type CsvRow = {
  brand: string;
  country: string;
  channel: string;
  store_code: string;
  store_name: string;
  account_name_clean: string;
  period_key: string;
  amount: string;
};

type BaselineStore = {
  brand: string;
  country: string;
  channel: string;
  storeName: string;
  monthlySales: Record<string, number>;
  annualTotals: Record<string, number>;
  monthlyTagSales: Record<string, number>;
  annualTagTotals: Record<string, number>;
};

let cachedProfitCardData: ProfitCardData | null = null;
const storeMonthlySalesCache = new Map<string, Promise<StoreMonthlySales>>();

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function resolveRegion(country: string) {
  if (REGIONS.HKMC.has(country)) return "HKMC";
  if (REGIONS.TW.has(country)) return "TW";
  return null;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function readNormalizedMonthlyPnlRows() {
  const filePath = join(process.cwd(), "data", "normalized", "monthly_pnl.csv");
  const raw = readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const [headerLine, ...dataLines] = lines;
  const headers = parseCsvLine(headerLine);
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  return dataLines.map((line) => {
    const cells = parseCsvLine(line);
    const get = (name: keyof CsvRow) => cells[headerIndex.get(name) ?? -1] ?? "";

    return {
      brand: get("brand"),
      country: get("country"),
      channel: get("channel"),
      store_code: get("store_code"),
      store_name: get("store_name"),
      account_name_clean: get("account_name_clean"),
      period_key: get("period_key"),
      amount: get("amount"),
    } satisfies CsvRow;
  });
}

function parseActualPeriod(actualPeriod: string) {
  const [yearText, monthText] = actualPeriod.split("-", 2);
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid actualPeriod: ${actualPeriod}`);
  }

  return { year, month };
}

function yymmFromPeriodKey(periodKey: string, referenceYear?: number) {
  const [year, month] = periodKey.split("-");
  const targetYear = String(referenceYear ?? Number(year)).slice(-2);
  return `${targetYear}${month}`;
}

function resolveTwRate(periodKey: string, exchangeRates: Record<string, number>, referenceYear?: number) {
  const yymm = yymmFromPeriodKey(periodKey, referenceYear);
  if (yymm in exchangeRates) return exchangeRates[yymm];

  const available = Object.keys(exchangeRates).sort();
  if (available.length === 0) {
    throw new Error("TW exchange rates are empty");
  }

  const earlier = available.filter((key) => key <= yymm);
  const fallbackKey = earlier.length > 0 ? earlier[earlier.length - 1] : available[0];
  return exchangeRates[fallbackKey];
}

function convertAmount(
  amount: number,
  country: string,
  periodKey: string,
  exchangeRates: Record<string, number>,
  referenceYear?: number,
) {
  if (country !== "TW") return amount;
  return amount * resolveTwRate(periodKey, exchangeRates, referenceYear);
}

function buildAnnualTotals(monthlySource: Record<string, number>) {
  const annualTotals: Record<string, number> = {};

  for (const [periodKey, amount] of Object.entries(monthlySource)) {
    const year = periodKey.slice(0, 4);
    annualTotals[year] = (annualTotals[year] ?? 0) + Number(amount || 0);
  }

  return Object.fromEntries(
    Object.entries(annualTotals)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([year, total]) => [year, roundTo(total, 2)]),
  );
}

function sortPeriodMap(source: Record<string, number>) {
  return Object.fromEntries(Object.entries(source).sort(([left], [right]) => left.localeCompare(right)));
}

function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

function connectSnowflake() {
  return snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT ?? "",
    username: process.env.SNOWFLAKE_USERNAME ?? "",
    password: process.env.SNOWFLAKE_PASSWORD ?? "",
    warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? "",
    database: process.env.SNOWFLAKE_DATABASE ?? "",
    schema: process.env.SNOWFLAKE_SCHEMA ?? "",
  });
}

function executeSnowflake(connection: snowflake.Connection, sqlText: string) {
  return new Promise<Record<string, unknown>[]>((resolve, reject) => {
    connection.execute({
      sqlText,
      complete: (err, _stmt, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve((rows ?? []) as Record<string, unknown>[]);
      },
    });
  });
}

async function fetchSqlActuals(storeCodes: string[], actualYear: number, actualMonth: number) {
  if (storeCodes.length === 0) return {} as Record<string, Record<string, number>>;
  if (!process.env.SNOWFLAKE_ACCOUNT || !process.env.SNOWFLAKE_USERNAME || !process.env.SNOWFLAKE_PASSWORD) {
    throw new Error("Snowflake credentials are not configured");
  }

  const startYear = actualYear - 2;
  const endDate = new Date(actualYear, actualMonth, 0);
  const endDateText = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  const storeCodeList = storeCodes.map((code) => `'${escapeSqlLiteral(code)}'`).join(", ");
  const sqlText = `
    SELECT
      LOCAL_SHOP_CD AS STORE_CODE,
      YEAR(SALE_DT) AS SALE_YEAR,
      MONTH(SALE_DT) AS SALE_MONTH,
      SUM(ACT_SALE_AMT) / 1000 AS ACTUAL_SALES
    FROM SAP_FNF.DW_HMD_SALE_D
    WHERE LOCAL_SHOP_CD IN (${storeCodeList})
      AND SALE_DT BETWEEN TO_DATE('${startYear}-01-01') AND TO_DATE('${endDateText}')
    GROUP BY LOCAL_SHOP_CD, YEAR(SALE_DT), MONTH(SALE_DT)
    ORDER BY LOCAL_SHOP_CD, SALE_YEAR, SALE_MONTH
  `;

  const connection = connectSnowflake();

  await new Promise<void>((resolve, reject) => {
    connection.connect((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  try {
    const rows = await executeSnowflake(connection, sqlText);
    const monthlyActuals: Record<string, Record<string, number>> = {};

    for (const row of rows) {
      const storeCode = String(row.STORE_CODE ?? "");
      const saleYear = Number(row.SALE_YEAR);
      const saleMonth = Number(row.SALE_MONTH);
      const amount = Number(row.ACTUAL_SALES ?? 0);
      if (!storeCode || !Number.isInteger(saleYear) || !Number.isInteger(saleMonth)) continue;

      const periodKey = `${saleYear.toString().padStart(4, "0")}-${saleMonth.toString().padStart(2, "0")}`;
      const storeActuals = (monthlyActuals[storeCode] ??= {});
      storeActuals[periodKey] = amount;
    }

    return monthlyActuals;
  } finally {
    connection.destroy(() => {});
  }
}

function loadExcelBaseline(exchangeRates: Record<string, number>, referenceYear: number, actualMonth: number) {
  const payload: StoreMonthlySales = { HKMC: {}, TW: {} };

  for (const row of readNormalizedMonthlyPnlRows()) {
    if (row.account_name_clean !== ACTUAL_SALES_ACCOUNT_NAME && row.account_name_clean !== TAG_SALES_ACCOUNT_NAME) continue;

    const country = row.country;
    const region = resolveRegion(country);
    if (!region) continue;

    const storeCode = row.store_code;
    const rawAmount = Number(row.amount);
    if (!storeCode || !row.period_key || Number.isNaN(rawAmount)) continue;

    const periodYear = Number(row.period_key.slice(0, 4));
    const periodMonth = Number(row.period_key.slice(5, 7));
    const useRawAmount = country === "TW" && periodYear === referenceYear && periodMonth > actualMonth;
    const convertedAmount = useRawAmount
      ? rawAmount
      : convertAmount(rawAmount, country, row.period_key, exchangeRates, referenceYear);

    const store = (payload[region][storeCode] ??= {
      brand: row.brand,
      country,
      channel: row.channel,
      storeName: row.store_name || row.channel,
      monthlySales: {},
      annualTotals: {},
      monthlyTagSales: {},
      annualTagTotals: {},
    });

    const targetKey = row.account_name_clean === ACTUAL_SALES_ACCOUNT_NAME ? "monthlySales" : "monthlyTagSales";
    const targetMap = store[targetKey];
    targetMap[row.period_key] = roundTo((targetMap[row.period_key] ?? 0) + convertedAmount, 2);
  }

  for (const regionPayload of Object.values(payload)) {
    for (const store of Object.values(regionPayload)) {
      store.monthlySales = sortPeriodMap(store.monthlySales);
      store.monthlyTagSales = sortPeriodMap(store.monthlyTagSales);
      store.annualTotals = buildAnnualTotals(store.monthlySales);
      store.annualTagTotals = buildAnnualTotals(store.monthlyTagSales);
    }
  }

  return payload;
}

function mergeSources(
  payload: StoreMonthlySales,
  sqlActuals: Record<string, Record<string, number>>,
  actualYear: number,
  actualMonth: number,
  exchangeRates: Record<string, number>,
) {
  for (const regionPayload of Object.values(payload)) {
    for (const [storeCode, store] of Object.entries(regionPayload)) {
      const monthlySales = { ...store.monthlySales };
      const monthlyTagSales = { ...store.monthlyTagSales };
      const sqlMonths = sqlActuals[storeCode] ?? {};

      for (const [periodKey, rawAmount] of Object.entries(sqlMonths)) {
        const year = Number(periodKey.slice(0, 4));
        const month = Number(periodKey.slice(5, 7));
        const useSql = year < actualYear || (year === actualYear && month <= actualMonth);
        if (!useSql) continue;

        const baselineSales = monthlySales[periodKey];
        const baselineTagSales = monthlyTagSales[periodKey];
        const convertedSales = roundTo(
          convertAmount(rawAmount, store.country, periodKey, exchangeRates, actualYear),
          2,
        );

        monthlySales[periodKey] = convertedSales;

        if (baselineSales !== undefined && baselineSales !== 0 && baselineTagSales !== undefined) {
          monthlyTagSales[periodKey] = roundTo(convertedSales * (baselineTagSales / baselineSales), 2);
        }
      }

      store.monthlySales = sortPeriodMap(monthlySales);
      store.monthlyTagSales = sortPeriodMap(monthlyTagSales);
      store.annualTotals = buildAnnualTotals(store.monthlySales);
      store.annualTagTotals = buildAnnualTotals(store.monthlyTagSales);
    }
  }

  return payload;
}

function loadSnapshotStoreMonthlySales() {
  const filePath = join(process.cwd(), "data", "store-monthly-sales.json");
  return JSON.parse(readFileSync(filePath, "utf-8")) as StoreMonthlySales;
}

export async function loadStoreMonthlySales(actualPeriod: string, exchangeRates: Record<string, number>) {
  const cacheKey = JSON.stringify([actualPeriod, exchangeRates]);
  const cached = storeMonthlySalesCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const { year: actualYear, month: actualMonth } = parseActualPeriod(actualPeriod);
    const baseline = loadExcelBaseline(exchangeRates, actualYear, actualMonth);
    const storeCodes = Object.values(baseline).flatMap((stores) => Object.keys(stores)).sort();

    try {
      const sqlActuals = await fetchSqlActuals(storeCodes, actualYear, actualMonth);
      return mergeSources(baseline, sqlActuals, actualYear, actualMonth, exchangeRates);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Falling back to snapshot store monthly sales:", error);
      }
      return loadSnapshotStoreMonthlySales();
    }
  })();

  storeMonthlySalesCache.set(cacheKey, promise);
  return promise;
}

export function loadProfitCardData() {
  if (cachedProfitCardData) return cachedProfitCardData;

  const payload: ProfitCardData = { HKMC: {}, TW: {} };

  for (const row of readNormalizedMonthlyPnlRows()) {
    if (!PROFIT_ACCOUNT_NAMES.has(row.account_name_clean)) continue;

    const region = resolveRegion(row.country);
    if (!region) continue;

    const storeCode = row.store_code || `${row.brand}__${row.country}__${row.channel}`;
    const amount = Number(row.amount);
    if (!storeCode || !row.period_key || Number.isNaN(amount)) continue;

    const store = (payload[region][storeCode] ??= {
      brand: row.brand,
      country: row.country,
      channel: row.channel,
      storeName: row.store_name || row.channel,
      accounts: {},
    });

    const periods = (store.accounts[row.account_name_clean] ??= {});
    periods[row.period_key] = roundTo((periods[row.period_key] ?? 0) + amount, 4);
  }

  cachedProfitCardData = payload;
  return cachedProfitCardData;
}
