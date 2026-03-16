from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from pathlib import Path

DB_PATH = Path("data/store_dashboard.sqlite")
REGIONS = {
    "HKMC": {"HK", "MC"},
    "TW": {"TW"},
}


def resolve_region(country: str) -> str | None:
    for region, countries in REGIONS.items():
        if country in countries:
            return region
    return None


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        monthly_rows = conn.execute(
            """
            SELECT brand, country, channel, store_code, store_name, period_key, SUM(CAST(amount AS REAL)) AS amount
            FROM monthly_pnl
            WHERE account_name_clean = ?
            GROUP BY brand, country, channel, store_code, store_name, period_key
            ORDER BY country, store_code, period_key
            """,
            ("실매출액",),
        ).fetchall()
        annual_rows = conn.execute(
            """
            SELECT brand, country, channel, store_code, store_name, year, SUM(CAST(amount AS REAL)) AS amount
            FROM annual_pnl
            WHERE account_name_clean = ?
            GROUP BY brand, country, channel, store_code, store_name, year
            ORDER BY country, store_code, year
            """,
            ("실매출액",),
        ).fetchall()
    finally:
        conn.close()

    payload: dict[str, dict[str, dict[str, object]]] = {"HKMC": {}, "TW": {}}

    for row in monthly_rows:
        region = resolve_region(row["country"])
        if region is None:
            continue
        store = payload[region].setdefault(
            row["store_code"],
            {
                "brand": row["brand"],
                "channel": row["channel"],
                "storeName": row["store_name"],
                "monthlySales": {},
                "annualTotals": {},
            },
        )
        store["brand"] = row["brand"]
        store["channel"] = row["channel"]
        store["storeName"] = row["store_name"]
        store["monthlySales"][row["period_key"]] = float(row["amount"] or 0)

    for row in annual_rows:
        region = resolve_region(row["country"])
        if region is None:
            continue
        store = payload[region].setdefault(
            row["store_code"],
            {
                "brand": row["brand"],
                "channel": row["channel"],
                "storeName": row["store_name"],
                "monthlySales": {},
                "annualTotals": {},
            },
        )
        store["brand"] = row["brand"]
        store["channel"] = row["channel"]
        store["storeName"] = row["store_name"]
        store["annualTotals"][str(row["year"])] = float(row["amount"] or 0)

    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
