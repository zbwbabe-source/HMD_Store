from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean

DB_PATH = Path("data/store_dashboard.sqlite")
OUTPUT_PATH = Path("dashboard/data.js")
JSON_OUTPUT_PATH = Path("data/dashboard-data.json")

ACCOUNT_HEX_MAP = {
    "actualSales": "EC8BA4EBA7A4ECB69CEC95A1",
    "tagSales": "546167EBA7A4ECB69CEC95A1",
    "discountRateRaw": "ED95A0EC9DB8EC9CA8",
    "grossProfit": "EBA7A4ECB69CEC9DB4EC9DB5",
    "directCost": "31352E20EBA9B4EC84B8ECA09020ECA781ECA091EBB984",
    "operatingProfit": "EC9881EC9785EC9DB4EC9DB5",
    "rent": "342E20EC9E84ECB0A8EBA38C",
    "payroll": "312E20EAB88920EC97AC",
    "sga": "ED8C90EBA7A4EAB480EBA6ACEBB984",
}

REGIONS = {
    "HKMC": {"label": "홍콩/마카오", "countries": {"HK", "MC"}},
    "TW": {"label": "대만", "countries": {"TW"}},
}

METRIC_META = {
    "actualSales": {"label": "실매출", "type": "currency"},
    "discountRate": {"label": "할인율", "type": "percent"},
    "directProfit": {"label": "직접이익", "type": "currency"},
    "yoyGrowth": {"label": "YoY 성장률", "type": "percent"},
    "forecastSales": {"label": "3개월 매출 전망", "type": "currency"},
}


def month_label(period_key: str) -> str:
    _, month = period_key.split("-")
    return f"{int(month)}월"


def add_months(period_key: str, offset: int) -> str:
    year, month = map(int, period_key.split("-"))
    month += offset
    year += (month - 1) // 12
    month = ((month - 1) % 12) + 1
    return f"{year:04d}-{month:02d}"


def safe_round(value: float | None, digits: int = 2) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def linear_forecast(values: list[float], horizon: int) -> list[float]:
    if not values:
        return [0.0] * horizon
    if len(values) == 1:
        return [values[-1]] * horizon

    count = len(values)
    xs = list(range(count))
    x_mean = mean(xs)
    y_mean = mean(values)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    slope = 0.0 if denominator == 0 else sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, values)) / denominator
    intercept = y_mean - slope * x_mean
    return [max(0.0, intercept + slope * idx) for idx in range(count, count + horizon)]


def format_currency(value: float | None) -> str:
    if value is None:
        return "-"
    abs_value = abs(value)
    if abs_value >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if abs_value >= 1_000:
        return f"{value / 1_000:.1f}K"
    return f"{value:.0f}"


def format_percent(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value * 100:.1f}%"


def summarize_region(label: str, latest_period: str, latest: dict[str, object], forecast_total: float) -> str:
    yoy = latest.get("yoyGrowth")
    discount = latest.get("discountRate")
    direct_margin = latest.get("directMargin")

    yoy_text = "전년 대비 성장세 유지" if yoy is not None and yoy >= 0 else "전년 대비 역성장 구간"
    discount_text = "할인 통제가 안정적" if discount is not None and discount <= 0.18 else "할인 부담이 커진 상태"
    margin_text = "직접이익 방어가 양호" if direct_margin is not None and direct_margin >= 0.45 else "수익성 관리가 필요한 상태"

    return (
        f"{label} 최근 실적은 {latest_period} 기준으로, {yoy_text}입니다. "
        f"현재 할인율은 {format_percent(discount)} 수준으로 {discount_text}이며, "
        f"직접이익률은 {format_percent(direct_margin)}로 {margin_text}입니다. "
        f"향후 3개월 매출 전망 합계는 {format_currency(forecast_total)}입니다."
    )


def build_store_insight(month_values: list[float | None]) -> tuple[str, str]:
    clean_values = [value for value in month_values if value is not None]
    if not clean_values:
        return "flat", "비교 가능한 전년 데이터가 아직 충분하지 않습니다."

    recent = clean_values[-3:] if len(clean_values) >= 3 else clean_values
    avg_recent = mean(recent)
    spread = max(clean_values) - min(clean_values)

    if avg_recent >= 0.1:
        trend = "up"
    elif avg_recent <= -0.1:
        trend = "down"
    else:
        trend = "flat"

    if trend == "up":
        return trend, f"최근 월별 YOY가 우상향이며, 변동 폭은 {spread * 100:.0f}%p 수준입니다."
    if trend == "down":
        return trend, f"최근 월별 YOY가 둔화 흐름이며, 변동 폭은 {spread * 100:.0f}%p 수준입니다."
    return trend, f"최근 월별 흐름이 비교적 안정적이며, 변동 폭은 {spread * 100:.0f}%p 수준입니다."


def classify_bep(achievement: float | None) -> tuple[str, str]:
    if achievement is None:
        return "unknown", "산출 불가"
    if achievement >= 1.1:
        return "safe", "BEP 상회"
    if achievement >= 0.95:
        return "watch", "관찰"
    return "risk", "개선 필요"


def build_bep_summary(label: str, latest_period: str, stores: list[dict[str, object]]) -> dict[str, object]:
    valid = [store for store in stores if store["bepAchievement"] is not None]
    safe = sum(1 for store in valid if store["bepAchievement"] >= 1.1)
    watch = sum(1 for store in valid if 0.95 <= store["bepAchievement"] < 1.1)
    risk = sum(1 for store in valid if store["bepAchievement"] < 0.95)
    avg_achievement = mean([store["bepAchievement"] for store in valid]) if valid else None
    avg_rent_ratio = mean([store["rentRatio"] for store in valid if store["rentRatio"] is not None]) if valid else None
    avg_payroll_ratio = mean([store["payrollRatio"] for store in valid if store["payrollRatio"] is not None]) if valid else None

    summary = (
        f"{label} {latest_period} 기준 평균 BEP 달성률은 {format_percent(avg_achievement)}이며, "
        f"안정 {safe}개, 관찰 {watch}개, 개선 필요 {risk}개 매장으로 구분됩니다. "
        f"평균 임차료 비중은 {format_percent(avg_rent_ratio)}, 평균 급여 비중은 {format_percent(avg_payroll_ratio)}입니다."
    )
    return {
        "title": "BEP 운영 진단",
        "description": "매장별 손익구조를 기준으로 손익분기점 달성 수준과 고정비 부담을 함께 확인합니다.",
        "note": "BEP 달성률은 실매출 대비 손익분기점 매출의 비율입니다. 값이 높을수록 현재 매출 여력이 더 크다는 뜻입니다.",
        "summary": summary,
        "avgAchievement": safe_round(avg_achievement, 4),
        "safeCount": safe,
        "watchCount": watch,
        "riskCount": risk,
    }


def empty_region_payload(label: str) -> dict[str, object]:
    return {
        "label": label,
        "latestPeriod": "-",
        "defaultYear": 2025,
        "years": [2025],
        "summary": f"{label} 데이터가 아직 준비되지 않았습니다.",
        "kpis": [],
        "monthly": [],
        "yearlyMetrics": {metric: [] for metric in ["actualSales", "discountRate", "directProfit"]},
        "forecast": [],
        "storeYoyByYear": {},
        "storeYoyMultiYear": [],
        "bep": {
            "title": "BEP 운영 진단",
            "description": "표시할 매장 데이터가 아직 없습니다.",
            "note": "",
            "summary": "집계 가능한 데이터가 없습니다.",
            "avgAchievement": None,
            "safeCount": 0,
            "watchCount": 0,
            "riskCount": 0,
            "stores": [],
        },
    }


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    quoted_hex = ", ".join(f"'{value}'" for value in ACCOUNT_HEX_MAP.values())
    rows = conn.execute(
        f"""
        SELECT country, store_code, store_name, period_key, year, month, hex(account_group_name) AS account_key, SUM(CAST(amount AS REAL)) AS amount
        FROM monthly_pnl
        WHERE hex(account_group_name) IN ({quoted_hex})
        GROUP BY country, store_code, store_name, period_key, year, month, account_key
        ORDER BY period_key, store_code
        """
    ).fetchall()
    conn.close()

    reverse_account_map = {value: key for key, value in ACCOUNT_HEX_MAP.items()}
    region_periods: dict[str, dict[str, dict[str, float]]] = {key: defaultdict(lambda: defaultdict(float)) for key in REGIONS}
    store_periods: dict[str, dict[str, dict[str, dict[str, float | int]]]] = {key: defaultdict(lambda: defaultdict(dict)) for key in REGIONS}
    store_names: dict[str, dict[str, str]] = {key: {} for key in REGIONS}

    for row in rows:
        region_key = next((key for key, meta in REGIONS.items() if row["country"] in meta["countries"]), None)
        if region_key is None:
            continue

        metric_key = reverse_account_map.get(row["account_key"])
        if metric_key is None:
            continue

        period_key = row["period_key"]
        amount = float(row["amount"] or 0)
        region_periods[region_key][period_key][metric_key] += amount

        store_code = row["store_code"]
        store_names[region_key][store_code] = row["store_name"]
        store_periods[region_key][store_code][period_key][metric_key] = amount
        store_periods[region_key][store_code][period_key]["year"] = int(row["year"])
        store_periods[region_key][store_code][period_key]["month"] = int(row["month"])

    payload: dict[str, object] = {
        "title": "HKMC/TW 스토어 대시보드",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "metricMeta": METRIC_META,
        "regions": {},
    }

    for region_key, meta in REGIONS.items():
        periods = sorted(region_periods[region_key].keys())
        monthly_points: list[dict[str, object]] = []

        for period_key in periods:
            point = dict(region_periods[region_key][period_key])
            actual_sales = float(point.get("actualSales", 0.0))
            tag_sales = float(point.get("tagSales", 0.0))
            gross_profit = float(point.get("grossProfit", 0.0))
            direct_cost = float(point.get("directCost", 0.0))
            operating_profit = float(point.get("operatingProfit", 0.0))
            rent = float(point.get("rent", 0.0))
            payroll = float(point.get("payroll", 0.0))
            sga = float(point.get("sga", 0.0))
            discount_rate = (1 - (actual_sales / tag_sales)) if tag_sales else None
            direct_profit = gross_profit - direct_cost if gross_profit else operating_profit
            direct_margin = (direct_profit / actual_sales) if actual_sales else None

            monthly_points.append(
                {
                    "period": period_key,
                    "year": int(period_key[:4]),
                    "month": int(period_key[5:7]),
                    "actualSales": safe_round(actual_sales),
                    "tagSales": safe_round(tag_sales),
                    "discountRate": safe_round(discount_rate, 4),
                    "grossProfit": safe_round(gross_profit),
                    "directCost": safe_round(direct_cost),
                    "operatingProfit": safe_round(operating_profit),
                    "directProfit": safe_round(direct_profit),
                    "directMargin": safe_round(direct_margin, 4),
                    "rent": safe_round(rent),
                    "payroll": safe_round(payroll),
                    "sga": safe_round(sga),
                }
            )

        if not monthly_points:
            payload["regions"][region_key] = empty_region_payload(meta["label"])
            continue

        point_by_period = {point["period"]: point for point in monthly_points}
        for point in monthly_points:
            previous_period = f"{point['year'] - 1}-{point['month']:02d}"
            previous = point_by_period.get(previous_period)
            prev_sales = previous["actualSales"] if previous else None
            prev_direct = previous["directProfit"] if previous else None
            point["yoyGrowth"] = safe_round((point["actualSales"] / prev_sales) - 1, 4) if prev_sales else None
            point["yoyDirectProfit"] = safe_round((point["directProfit"] / prev_direct) - 1, 4) if prev_direct else None

        actual_points = [point for point in monthly_points if point["actualSales"] and point["actualSales"] > 0]
        if not actual_points:
            payload["regions"][region_key] = empty_region_payload(meta["label"])
            continue

        years = sorted({point["year"] for point in actual_points})
        default_year = 2025 if 2025 in years else years[-1]
        latest = actual_points[-1]
        latest_period = latest["period"]

        forecast_source = actual_points[-6:] if len(actual_points) >= 6 else actual_points
        forecast_sales_values = linear_forecast([point["actualSales"] for point in forecast_source], 3)
        forecast_direct_values = linear_forecast([point["directProfit"] for point in forecast_source], 3)
        avg_discount = mean([point["discountRate"] for point in forecast_source if point["discountRate"] is not None]) if forecast_source else None
        forecast_periods = [add_months(latest_period, idx) for idx in range(1, 4)]
        forecast = [
            {
                "period": period,
                "label": month_label(period),
                "actualSales": safe_round(sales),
                "directProfit": safe_round(direct),
                "discountRate": safe_round(avg_discount, 4),
            }
            for period, sales, direct in zip(forecast_periods, forecast_sales_values, forecast_direct_values)
        ]

        yearly_metrics: dict[str, list[dict[str, object]]] = {metric: [] for metric in ["actualSales", "discountRate", "directProfit"]}
        for metric in yearly_metrics:
            for year in years[-3:]:
                values = []
                for month in range(1, 13):
                    period = f"{year:04d}-{month:02d}"
                    point = point_by_period.get(period)
                    values.append(point[metric] if point else None)
                yearly_metrics[metric].append({"year": year, "values": values})

        store_yoy_by_year: dict[str, list[dict[str, object]]] = {}
        available_store_years = sorted({int(point["period"][:4]) for point in actual_points})
        for year in available_store_years:
            rows_for_year: list[dict[str, object]] = []
            for store_code, store_points in store_periods[region_key].items():
                monthly_yoy: list[float | None] = []
                latest_yoy = None
                for month in range(1, 13):
                    current = store_points.get(f"{year:04d}-{month:02d}", {})
                    previous = store_points.get(f"{year - 1:04d}-{month:02d}", {})
                    current_sales = float(current.get("actualSales", 0.0) or 0.0)
                    previous_sales = float(previous.get("actualSales", 0.0) or 0.0)
                    yoy = ((current_sales / previous_sales) - 1) if previous_sales else None
                    monthly_yoy.append(safe_round(yoy, 4) if yoy is not None else None)
                    if yoy is not None:
                        latest_yoy = yoy

                if all(value is None for value in monthly_yoy):
                    continue

                trend, insight = build_store_insight(monthly_yoy)
                rows_for_year.append(
                    {
                        "storeCode": store_code,
                        "storeName": store_names[region_key].get(store_code, store_code),
                        "months": monthly_yoy,
                        "latestYoy": safe_round(latest_yoy, 4) if latest_yoy is not None else None,
                        "trend": trend,
                        "insight": insight,
                    }
                )

            rows_for_year.sort(key=lambda item: (item["latestYoy"] is None, -(item["latestYoy"] or -99)))
            store_yoy_by_year[str(year)] = rows_for_year

        fixed_store_years = [2023, 2024, 2025, 2026]
        store_yoy_multi_year: list[dict[str, object]] = []
        store_codes = sorted(store_names[region_key], key=lambda code: store_names[region_key].get(code, code))
        for store_code in store_codes:
            year_rows: list[dict[str, object]] = []
            has_any_value = False
            for year in fixed_store_years:
                source_row = next((item for item in store_yoy_by_year.get(str(year), []) if item["storeCode"] == store_code), None)
                if source_row is None:
                    year_rows.append({
                        "year": year,
                        "months": [None] * 12,
                        "latestYoy": None,
                        "trend": "flat",
                        "insight": "",
                    })
                    continue

                year_rows.append({
                    "year": year,
                    "months": source_row["months"],
                    "latestYoy": source_row["latestYoy"],
                    "trend": source_row["trend"],
                    "insight": source_row["insight"],
                })
                has_any_value = has_any_value or any(value is not None for value in source_row["months"])

            if has_any_value:
                store_yoy_multi_year.append({
                    "storeCode": store_code,
                    "storeName": store_names[region_key].get(store_code, store_code),
                    "years": year_rows,
                })

        bep_rows: list[dict[str, object]] = []
        for store_code, store_points in store_periods[region_key].items():
            current = store_points.get(latest_period)
            if not current:
                continue

            sales = float(current.get("actualSales", 0.0) or 0.0)
            if sales <= 0:
                continue

            rent = float(current.get("rent", 0.0) or 0.0)
            payroll = float(current.get("payroll", 0.0) or 0.0)
            sga = float(current.get("sga", 0.0) or 0.0)
            op = float(current.get("operatingProfit", 0.0) or 0.0)
            fixed_cost = max(0.0, rent) + max(0.0, payroll)
            contribution_profit = op + fixed_cost
            contribution_margin = (contribution_profit / sales) if sales else None
            bep_sales = (fixed_cost / contribution_margin) if contribution_margin and contribution_margin > 0 else None
            bep_achievement = (sales / bep_sales) if bep_sales else None
            safety_margin = ((sales - bep_sales) / sales) if bep_sales and sales else None
            rent_ratio = (rent / sales) if sales else None
            payroll_ratio = (payroll / sales) if sales else None
            previous = store_points.get(f"{int(latest_period[:4]) - 1}-{latest_period[5:]}", {})
            prev_sales = float(previous.get("actualSales", 0.0) or 0.0)
            yoy = ((sales / prev_sales) - 1) if prev_sales else None
            status_key, status_label = classify_bep(bep_achievement)

            bep_rows.append(
                {
                    "storeCode": store_code,
                    "storeName": store_names[region_key].get(store_code, store_code),
                    "actualSales": safe_round(sales),
                    "rent": safe_round(rent),
                    "payroll": safe_round(payroll),
                    "sga": safe_round(sga),
                    "operatingProfit": safe_round(op),
                    "fixedCost": safe_round(fixed_cost),
                    "contributionMargin": safe_round(contribution_margin, 4),
                    "bepSales": safe_round(bep_sales),
                    "bepAchievement": safe_round(bep_achievement, 4),
                    "safetyMargin": safe_round(safety_margin, 4),
                    "rentRatio": safe_round(rent_ratio, 4),
                    "payrollRatio": safe_round(payroll_ratio, 4),
                    "yoyGrowth": safe_round(yoy, 4) if yoy is not None else None,
                    "statusKey": status_key,
                    "statusLabel": status_label,
                }
            )

        bep_rows.sort(key=lambda item: (item["bepAchievement"] is None, -(item["bepAchievement"] or -99)))
        bep_meta = build_bep_summary(meta["label"], latest_period, bep_rows)
        forecast_total = sum((point["actualSales"] or 0) for point in forecast)

        kpis = [
            {
                "key": "actualSales",
                "label": "실매출",
                "value": latest["actualSales"],
                "display": format_currency(latest["actualSales"]),
                "delta": latest.get("yoyGrowth"),
                "deltaLabel": "YoY",
                "insight": f"당월 실매출은 {format_currency(latest['actualSales'])}이며 전년 동월 대비 {format_percent(latest.get('yoyGrowth'))}입니다.",
            },
            {
                "key": "yoyGrowth",
                "label": "YoY 성장률",
                "value": latest.get("yoyGrowth"),
                "display": format_percent(latest.get("yoyGrowth")),
                "delta": None,
                "deltaLabel": latest_period,
                "insight": f"{latest_period} 기준 전년 동월 성장률입니다. 매출 추세의 방향성과 속도를 빠르게 확인할 수 있습니다.",
            },
            {
                "key": "discountRate",
                "label": "할인율",
                "value": latest.get("discountRate"),
                "display": format_percent(latest.get("discountRate")),
                "delta": None,
                "deltaLabel": "Tag 대비",
                "insight": f"Tag 매출 대비 실매출 차이를 반영한 할인율입니다. 현재 수준은 {format_percent(latest.get('discountRate'))}입니다.",
            },
            {
                "key": "directProfit",
                "label": "직접이익",
                "value": latest.get("directProfit"),
                "display": format_currency(latest.get("directProfit")),
                "delta": latest.get("directMargin"),
                "deltaLabel": "Margin",
                "insight": f"매출총이익에서 직접비를 차감한 값으로, 매장 운영의 실질 수익성을 보여줍니다. 현재 이익률은 {format_percent(latest.get('directMargin'))}입니다.",
            },
            {
                "key": "forecastSales",
                "label": "3개월 매출 전망",
                "value": forecast_total,
                "display": format_currency(forecast_total),
                "delta": None,
                "deltaLabel": "Forward 3M",
                "insight": f"최근 6개월 매출 흐름을 기준으로 단순 추세 예측을 적용했습니다. 향후 3개월 합계는 {format_currency(forecast_total)}입니다.",
            },
        ]

        payload["regions"][region_key] = {
            "label": meta["label"],
            "latestPeriod": latest_period,
            "defaultYear": default_year,
            "years": years,
            "summary": summarize_region(meta["label"], latest_period, latest, forecast_total),
            "kpis": kpis,
            "monthly": monthly_points,
            "yearlyMetrics": yearly_metrics,
            "forecast": forecast,
            "storeYoyByYear": store_yoy_by_year,
            "storeYoyMultiYear": store_yoy_multi_year,
            "bep": {
                **bep_meta,
                "stores": bep_rows,
            },
        }

    OUTPUT_PATH.write_text("window.__DASHBOARD_DATA__ = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    JSON_OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
