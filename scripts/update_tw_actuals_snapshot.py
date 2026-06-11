"""Incrementally refresh the TW TWD actual-sales snapshot.

Why: TW actual sales come from Snowflake in TWD. Instead of querying on every
page request, we keep a snapshot (data/tw-actuals-twd.json) of past TWD actuals
and only top it up when the performance base month (actualPeriod) advances.

Flow:
  1. read TW store codes from data/normalized/monthly_pnl.csv
  2. read actualPeriod from data/store-view-settings.json
  3. run scripts/fetch_snowflake_actuals.mjs (range = actualYear-2 .. actualMonth)
  4. merge the returned TWD cells into the snapshot (new/closed months overwrite,
     existing past cells are preserved)

The merge is idempotent: re-running only refreshes the queried range and keeps
everything older untouched. Conversion to HKD (base-year common rate) happens at
runtime in lib/server-data.ts, not here.

Usage:
  python scripts/update_tw_actuals_snapshot.py
"""
from __future__ import annotations

import csv
import json
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MONTHLY_CSV = ROOT / "data" / "normalized" / "monthly_pnl.csv"
SETTINGS = ROOT / "data" / "store-view-settings.json"
SNAPSHOT = ROOT / "data" / "tw-actuals-twd.json"
HELPER = ROOT / "scripts" / "fetch_snowflake_actuals.mjs"


def load_tw_store_codes() -> list[str]:
    codes: set[str] = set()
    with MONTHLY_CSV.open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            if row["country"].strip() == "TW" and row["store_code"].strip():
                codes.add(row["store_code"].strip())
    return sorted(codes)


def load_actual_period() -> tuple[int, int]:
    raw = str(json.loads(SETTINGS.read_text(encoding="utf-8")).get("actualPeriod") or "")
    year_text, month_text = raw.split("-", 1)
    return int(year_text), int(month_text)


def fetch_rows(store_codes: list[str], actual_year: int, actual_month: int) -> list[dict]:
    payload = json.dumps({"storeCodes": store_codes, "actualYear": actual_year, "actualMonth": actual_month})
    result = subprocess.run(
        ["node", str(HELPER)],
        input=payload,
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(ROOT),
    )
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        raise SystemExit(f"snowflake helper failed (exit {result.returncode})")

    # The snowflake-sdk prints log lines to stdout; the JSON array is the line that
    # starts with '['.
    for line in result.stdout.splitlines():
        line = line.strip()
        if line.startswith("["):
            return json.loads(line)
    raise SystemExit("snowflake helper returned no JSON array")


def load_snapshot() -> dict:
    if SNAPSHOT.exists():
        return json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    return {"_meta": {}, "stores": {}}


def main() -> None:
    store_codes = load_tw_store_codes()
    actual_year, actual_month = load_actual_period()
    rows = fetch_rows(store_codes, actual_year, actual_month)

    snapshot = load_snapshot()
    stores: dict[str, dict[str, float]] = {
        code: dict(periods) for code, periods in snapshot.get("stores", {}).items()
    }

    added = 0
    for row in rows:
        code = str(row["STORE_CODE"])
        period_key = f"{int(row['SALE_YEAR']):04d}-{int(row['SALE_MONTH']):02d}"
        amount = round(float(row["ACTUAL_SALES"]), 3)
        if stores.get(code, {}).get(period_key) != amount:
            added += 1
        stores.setdefault(code, {})[period_key] = amount

    ordered = OrderedDict()
    for code in sorted(stores):
        ordered[code] = OrderedDict(sorted(stores[code].items()))

    periods = sorted({p for store in ordered.values() for p in store})
    output = OrderedDict()
    output["_meta"] = {
        "unit": "1k TWD",
        "account": "실매출액",
        "source": "SAP_FNF.DW_HMD_SALE_D.ACT_SALE_AMT/1000",
        "throughPeriod": f"{actual_year:04d}-{actual_month:02d}",
        "note": "TW actual sales in TWD(thousands). Convert to HKD at base(actual)-year same-month rate per STORE_DASHBOARD_LOGIC 6.1.",
    }
    output["stores"] = ordered
    SNAPSHOT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"TW snapshot updated: {len(ordered)} stores, {periods[0]}..{periods[-1]}, {added} cells changed")


if __name__ == "__main__":
    main()
