import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import snowflake from "snowflake-sdk";

const REGIONS = {
  HKMC: new Set(["HK", "MC"]),
  TW: new Set(["TW"]),
} as const;

const ACTUAL_SALES_ACCOUNT_NAME = "\uC2E4\uB9E4\uCD9C\uC561";
const TAG_SALES_ACCOUNT_NAME = "Tag\uB9E4\uCD9C\uC561";
const OPERATING_PROFIT_ACCOUNT_NAME = "\uC601\uC5C5\uC774\uC775";

const PROFIT_ACCOUNT_NAMES = new Set([
  "Tag\uB9E4\uCD9C\uC561",
  "\uD560\uC778\uC728",
  "\uC2E4\uB9E4\uCD9C\uC561",
  "\uB9E4\uCD9C\uC6D0\uAC00\uD569\uACC4",
  "\uB9E4\uCD9C\uCD1D\uC774\uC775",
  "\uC601\uC5C5\uC774\uC775",
  "\uD310\uB9E4\uAD00\uB9AC\uBE44",
  "1. \uAE09 \uC5EC",
  "2. TRAVEL & MEAL",
  "3. \uD53C\uBCF5\uBE44(\uC720\uB2C8\uD3FC)",
  "4. \uC784\uCC28\uB8CC",
  "5. \uC720\uC9C0\uBCF4\uC218\uBE44",
  "6. \uC218\uB3C4\uAD11\uC5F4\uBE44",
  "7. \uC18C\uBAA8\uD488\uBE44",
  "8. \uD1B5\uC2E0\uBE44",
  "9. \uAD11\uACE0\uC120\uC804\uBE44",
  "10. \uC9C0\uAE09\uC218\uC218\uB8CC",
  "11. \uC6B4\uBC18\uBE44",
  "12. \uAE30\uD0C0 \uC218\uC218\uB8CC(\uB9E4\uC7A5\uAD00\uB9AC\uBE44 \uC678)",
  "13. \uBCF4\uD5D8\uB8CC",
  "14. \uAC10\uAC00\uC0C1\uAC01\uBE44",
  "15. \uBA74\uC138\uC810 \uC9C1\uC811\uBE44",
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

type OperatingProfitSummary = Record<
  string,
  Record<
    string,
    {
      monthlyOperatingProfit: Record<string, number>;
      monthlySales: Record<string, number>;
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

function getSnowflakeActualsCachePath(actualYear: number, actualMonth: number) {
  return join(
    process.cwd(),
    "data",
    "cache",
    "snowflake-actuals",
    `${actualYear}-${String(actualMonth).padStart(2, "0")}.json`,
  );
}

function readSnowflakeActualsCache(storeCodes: string[], actualYear: number, actualMonth: number) {
  const filePath = getSnowflakeActualsCachePath(actualYear, actualMonth);
  if (!existsSync(filePath)) return null;

  const payload = JSON.parse(readFileSync(filePath, "utf-8")) as {
    storeCodes?: string[];
    monthlyActuals?: Record<string, Record<string, number>>;
  };

  const cachedStoreCodes = [...(payload.storeCodes ?? [])].sort();
  const requestedStoreCodes = [...storeCodes].sort();
  if (cachedStoreCodes.length !== requestedStoreCodes.length) return null;
  if (cachedStoreCodes.some((code, index) => code !== requestedStoreCodes[index])) return null;

  return payload.monthlyActuals ?? null;
}

function writeSnowflakeActualsCache(
  storeCodes: string[],
  actualYear: number,
  actualMonth: number,
  monthlyActuals: Record<string, Record<string, number>>,
) {
  const filePath = getSnowflakeActualsCachePath(actualYear, actualMonth);
  mkdirSync(join(process.cwd(), "data", "cache", "snowflake-actuals"), { recursive: true });
  writeFileSync(
    filePath,
    JSON.stringify(
      {
        storeCodes: [...storeCodes].sort(),
        monthlyActuals,
      },
      null,
      2,
    ),
    "utf-8",
  );
}

function connectSnowflake() {
  const privateKey = process.env.SNOWFLAKE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  return snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT ?? "",
    username: process.env.SNOWFLAKE_USERNAME ?? "",
    authenticator: "SNOWFLAKE_JWT",
    privateKey: privateKey ?? "",
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

  const cached = readSnowflakeActualsCache(storeCodes, actualYear, actualMonth);
  if (cached) return cached;

  if (!process.env.SNOWFLAKE_ACCOUNT || !process.env.SNOWFLAKE_USERNAME || !process.env.SNOWFLAKE_PRIVATE_KEY) {
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

    writeSnowflakeActualsCache(storeCodes, actualYear, actualMonth, monthlyActuals);
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

    const convertedAmount = rawAmount;

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
      if (store.country === "TW") {
        store.monthlySales = sortPeriodMap({ ...store.monthlySales });
        store.monthlyTagSales = sortPeriodMap({ ...store.monthlyTagSales });
        store.annualTotals = buildAnnualTotals(store.monthlySales);
        store.annualTagTotals = buildAnnualTotals(store.monthlyTagSales);
        continue;
      }

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
    return baseline;
  }
}

export function loadProfitCardData() {
  const payload: ProfitCardData = { HKMC: {}, TW: {} };

  for (const row of readNormalizedMonthlyPnlRows()) {
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
  return payload;
}

export function loadOperatingProfitSummary() {
  const payload: OperatingProfitSummary = {
    HKMC: {},
    TW: {},
  };

  for (const row of readNormalizedMonthlyPnlRows()) {
    const region = resolveRegion(row.country);
    if (!region) continue;
    if (!row.period_key) continue;

    const amount = Number(row.amount);
    if (Number.isNaN(amount)) continue;

    const brandKey = row.brand || "ALL";
    const targetBrands = ["ALL", brandKey];
    for (const key of targetBrands) {
      const bucket = (payload[region][key] ??= {
        monthlyOperatingProfit: {},
        monthlySales: {},
      });

      if (row.account_name_clean === OPERATING_PROFIT_ACCOUNT_NAME) {
        bucket.monthlyOperatingProfit[row.period_key] = roundTo((bucket.monthlyOperatingProfit[row.period_key] ?? 0) + amount, 4);
      }

      if (row.account_name_clean === ACTUAL_SALES_ACCOUNT_NAME) {
        bucket.monthlySales[row.period_key] = roundTo((bucket.monthlySales[row.period_key] ?? 0) + amount, 4);
      }
    }
  }
  return payload;
}
