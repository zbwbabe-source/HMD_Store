# Store Dashboard Data Pipeline

This workspace includes an Excel-first import pipeline for the raw store P&L workbook.

## What it does

- Reads `Store_Rawdata.xlsx`
- Unpivots monthly columns like `2201`, `2307`, `2603`
- Separates annual total columns like `22? ??`
- Writes normalized CSV files
- Builds a SQLite database for dashboard queries
- Tracks each import batch so later uploads are traceable
- Rebuilds dashboard-ready data for the local HTML dashboard

## Run

```powershell
python .\scripts\import_store_rawdata.py
```

## Outputs

- `data/normalized/monthly_pnl.csv`
- `data/normalized/annual_pnl.csv`
- `data/store_dashboard.sqlite`
- `dashboard/data.js`

## SQLite schema

- `import_batches`: one row per Excel upload
- `stores`: store master data derived from the workbook
- `accounts`: normalized account hierarchy derived from the workbook
- `monthly_pnl`: monthly fact table with `import_batch_id`, `store_id`, `account_id`
- `annual_pnl`: annual fact table with `import_batch_id`, `store_id`, `account_id`

## Dashboard

- Open `dashboard/index.html`
- Switch between `HKMC` and `TW`
- Review top 5 KPI cards and click them for modal drilldowns
- Compare yearly monthly trends for actual sales, discount rate, and direct profit
- Review the 3-month forecast panel and store-level YOY table

## Why this shape

- Keeps the current Excel upload format unchanged
- Makes future sales updates appendable and auditable by batch
- Separates store/account metadata from fact data so logic changes are easier later
- Keeps a simple path from SQLite now to Postgres later

## Recommended next schema additions

- `account_mapping`: map raw accounts into reporting groups and KPI logic
- `forecast_rules`: fixed cost and variable cost logic for future projections
- `asof_snapshots`: cached results for selected reporting dates
