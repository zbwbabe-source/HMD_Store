import fs from "node:fs";
import path from "node:path";
import snowflake from "snowflake-sdk";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  const lines = raw.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (value.startsWith('"') && !value.endsWith('"')) {
      while (index + 1 < lines.length) {
        index += 1;
        value += `\n${lines[index]}`;
        if (lines[index].trim().endsWith('"')) break;
      }
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function readInput() {
  const raw = fs.readFileSync(0, "utf-8").trim();
  return raw ? JSON.parse(raw) : {};
}

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function connect() {
  const privateKey = process.env.SNOWFLAKE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  return snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USERNAME,
    authenticator: "SNOWFLAKE_JWT",
    privateKey,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA,
  });
}

function execute(connection, sqlText) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      complete: (err, _stmt, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      },
    });
  });
}

async function main() {
  loadDotEnv();
  const { storeCodes = [], actualYear, actualMonth } = readInput();
  if (!Array.isArray(storeCodes) || storeCodes.length === 0) {
    process.stdout.write("[]");
    return;
  }

  const startYear = Number(actualYear) - 2;
  const endDate = new Date(Number(actualYear), Number(actualMonth), 0);
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

  const connection = connect();
  await new Promise((resolve, reject) => {
    connection.connect((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(null);
    });
  });

  try {
    const rows = await execute(connection, sqlText);
    process.stdout.write(JSON.stringify(rows));
  } finally {
    connection.destroy(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

