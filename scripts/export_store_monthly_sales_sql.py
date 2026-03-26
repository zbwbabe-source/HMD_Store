from __future__ import annotations

import calendar
import csv
import json
import sqlite3
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

DB_PATH = Path("data/store_dashboard.sqlite")
SETTINGS_PATH = Path("data/store-view-settings.json")
EXCHANGE_RATE_CSV = Path("TW_Exchange Rate.csv")
SNOWFLAKE_HELPER = Path("scripts/fetch_snowflake_actuals.mjs")
REGIONS = {
    "HKMC": {"HK", "MC"},
    "TW": {"TW"},
}
ACTUAL_SALES_ACCOUNT_NAME = "실매출액"
TAG_SALES_ACCOUNT_NAME = "Tag매출액"


def resolve_region(country: str) -> str | None:
    for region, countries in REGIONS.items():
        if country in countries:
            return region
    return None


def load_settings() -> dict[str, object]:
    return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))


def load_actual_period(settings: dict[str, object]) -> tuple[int, int]:
    raw = str(settings.get("actualPeriod") or "")
    year_text, month_text = raw.split("-", 1)
    year = int(year_text)
    month = int(month_text)
    if month < 1 or month > 12:
        raise ValueError(f"Invalid actualPeriod month: {raw}")
    return year, month


def load_tw_exchange_rates(settings: dict[str, object]) -> dict[str, float]:
    rates: dict[str, float] = {}
    with EXCHANGE_RATE_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        for row in reader:
            if len(row) < 2:
                continue
            period = row[0].strip()
            rate_raw = row[1].strip()
            if not period or not rate_raw:
                continue
            rates[period] = float(rate_raw)

    overrides = settings.get("twExchangeRates")
    if isinstance(overrides, dict):
        for period, rate in overrides.items():
            period_key = str(period).strip()
            try:
                rate_value = float(rate)
            except (TypeError, ValueError):
                continue
            if period_key:
                rates[period_key] = rate_value

    return rates


def yymm_from_period_key(period_key: str, reference_year: int | None = None) -> str:
    year, month = period_key.split("-")
    target_year = str(reference_year)[-2:] if reference_year is not None else year[-2:]
    return f"{target_year}{month}"


def resolve_tw_rate(period_key: str, exchange_rates: dict[str, float], reference_year: int | None = None) -> float:
    yymm = yymm_from_period_key(period_key, reference_year=reference_year)
    if yymm in exchange_rates:
        return exchange_rates[yymm]

    available = sorted(exchange_rates.keys())
    if not available:
        raise KeyError("TW exchange rates are empty")

    earlier = [key for key in available if key <= yymm]
    if earlier:
        return exchange_rates[earlier[-1]]
    return exchange_rates[available[0]]


def convert_amount(
    amount: float,
    country: str,
    period_key: str,
    exchange_rates: dict[str, float],
    reference_year: int | None = None,
) -> float:
    if country != "TW":
        return amount
    return amount * resolve_tw_rate(period_key, exchange_rates, reference_year=reference_year)


def build_annual_totals(monthly_source: dict[str, float]) -> dict[str, float]:
    annual_totals: dict[str, float] = defaultdict(float)
    for period_key, amount in monthly_source.items():
        annual_totals[period_key[:4]] += float(amount or 0.0)
    return {year: round(total, 2) for year, total in sorted(annual_totals.items())}


def load_excel_baseline(exchange_rates: dict[str, float], reference_year: int, actual_month: int) -> dict[str, dict[str, dict[str, object]]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        monthly_rows = conn.execute(
            """
            SELECT brand, country, channel, store_code, store_name, period_key, account_name_clean, SUM(CAST(amount AS REAL)) AS amount
            FROM monthly_pnl
            WHERE account_name_clean IN (?, ?)
            GROUP BY brand, country, channel, store_code, store_name, period_key, account_name_clean
            ORDER BY country, store_code, period_key, account_name_clean
            """,
            (ACTUAL_SALES_ACCOUNT_NAME, TAG_SALES_ACCOUNT_NAME),
        ).fetchall()
    finally:
        conn.close()

    payload: dict[str, dict[str, dict[str, object]]] = {"HKMC": {}, "TW": {}}
    for row in monthly_rows:
        country = str(row["country"])
        region = resolve_region(country)
        if region is None:
            continue
        store_code = str(row["store_code"])
        store = payload[region].setdefault(
            store_code,
            {
                "brand": row["brand"],
                "country": country,
                "channel": row["channel"],
                "storeName": row["store_name"],
                "monthlySales": {},
                "annualTotals": {},
                "monthlyTagSales": {},
                "annualTagTotals": {},
            },
        )
        period_key = str(row["period_key"])
        raw_amount = float(row["amount"] or 0.0)
        period_year = int(period_key[:4])
        period_month = int(period_key[5:7])
        use_raw_amount = country == "TW" and period_year == reference_year and period_month > actual_month
        converted_amount = raw_amount if use_raw_amount else convert_amount(
            raw_amount,
            country,
            period_key,
            exchange_rates,
            reference_year=reference_year,
        )
        target_key = "monthlySales" if row["account_name_clean"] == ACTUAL_SALES_ACCOUNT_NAME else "monthlyTagSales"
        store[target_key][period_key] = round(converted_amount, 2)

    for region_payload in payload.values():
        for store in region_payload.values():
            store["annualTotals"] = build_annual_totals(dict(store.get("monthlySales", {})))
            store["annualTagTotals"] = build_annual_totals(dict(store.get("monthlyTagSales", {})))
    return payload


def flatten_store_dimensions(payload: dict[str, dict[str, dict[str, object]]]) -> dict[str, dict[str, object]]:
    dimensions: dict[str, dict[str, object]] = {}
    for region_payload in payload.values():
        for store_code, store in region_payload.items():
            dimensions[store_code] = store
    return dimensions


def fetch_sql_actuals(store_dimensions: dict[str, dict[str, object]], actual_year: int, actual_month: int) -> dict[str, dict[str, float]]:
    if not store_dimensions:
        return {}

    request_payload = {
        "storeCodes": sorted(store_dimensions.keys()),
        "actualYear": actual_year,
        "actualMonth": actual_month,
    }
    result = subprocess.run(
        ["node", str(SNOWFLAKE_HELPER)],
        input=json.dumps(request_payload, ensure_ascii=False),
        capture_output=True,
        text=True,
        check=True,
        cwd=Path.cwd(),
        env={**dict(**__import__("os").environ), "PYTHONIOENCODING": "utf-8"},
    )
    stdout_lines = [line for line in (result.stdout or "").splitlines() if line.strip()]
    rows = json.loads(stdout_lines[-1]) if stdout_lines else []
    monthly_actuals: dict[str, dict[str, float]] = defaultdict(dict)
    for row in rows:
        store_code = str(row.get("STORE_CODE") or "")
        sale_year = int(row.get("SALE_YEAR"))
        sale_month = int(row.get("SALE_MONTH"))
        period_key = f"{sale_year:04d}-{sale_month:02d}"
        monthly_actuals[store_code][period_key] = float(row.get("ACTUAL_SALES") or 0.0)
    return monthly_actuals


def merge_sources(
    payload: dict[str, dict[str, dict[str, object]]],
    sql_actuals: dict[str, dict[str, float]],
    actual_year: int,
    actual_month: int,
    exchange_rates: dict[str, float],
    reference_year: int,
) -> dict[str, dict[str, dict[str, object]]]:
    for region_payload in payload.values():
        for store_code, store in region_payload.items():
            country = str(store["country"])
            monthly_sales: dict[str, float] = dict(store.get("monthlySales", {}))
            monthly_tag_sales: dict[str, float] = dict(store.get("monthlyTagSales", {}))
            sql_months = sql_actuals.get(store_code, {})

            for period_key, raw_amount in sql_months.items():
                year = int(period_key[:4])
                month = int(period_key[5:7])
                use_sql = year < actual_year or (year == actual_year and month <= actual_month)
                if not use_sql:
                    continue
                monthly_sales[period_key] = round(convert_amount(raw_amount, country, period_key, exchange_rates, reference_year=reference_year), 2)

            store["monthlySales"] = dict(sorted(monthly_sales.items()))
            store["annualTotals"] = build_annual_totals(store["monthlySales"])
            store["monthlyTagSales"] = dict(sorted(monthly_tag_sales.items()))
            store["annualTagTotals"] = build_annual_totals(store["monthlyTagSales"])

    return payload


def main() -> None:
    settings = load_settings()
    actual_year, actual_month = load_actual_period(settings)
    exchange_rates = load_tw_exchange_rates(settings)
    payload = load_excel_baseline(exchange_rates, reference_year=actual_year, actual_month=actual_month)
    store_dimensions = flatten_store_dimensions(payload)
    sql_actuals = fetch_sql_actuals(store_dimensions, actual_year, actual_month)
    merged = merge_sources(payload, sql_actuals, actual_year, actual_month, exchange_rates, reference_year=actual_year)
    print(json.dumps(merged, ensure_ascii=False))


if __name__ == "__main__":
    main()
