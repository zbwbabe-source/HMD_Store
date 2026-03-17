"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type MonthlyPoint = {
  year: number;
  month: number;
  actualSales: number;
};

type StoreYoyMultiYearRow = {
  storeCode: string;
  storeName: string;
  years: Array<{
    year: number;
    months: Array<number | null>;
  }>;
};

type RegionData = {
  latestPeriod: string;
  monthly: MonthlyPoint[];
  storeYoyMultiYear: StoreYoyMultiYearRow[];
};

type DashboardData = {
  generatedAt: string;
  regions: Record<string, RegionData>;
};

type StoreMonthlySales = Record<
  string,
  Record<
    string,
    {
      brand: string;
      channel: string;
      storeName: string;
      monthlySales: Record<string, number>;
      annualTotals: Record<string, number>;
    }
  >
>;

type CellMetric = {
  sales: number | null;
  previousSales: number | null;
  twoYearSales: number | null;
  yoyPrev: number | null;
  yoyTwo: number | null;
  storeCount: number | null;
  previousStoreCount: number | null;
  twoYearStoreCount: number | null;
};

type MonthMetric = CellMetric & {
  month: number;
};

type RowKind = "overall-total" | "country-total" | "brand-total" | "channel-total" | "store";
type ViewMode = "yoy" | "sales";
type SortDirection = "desc" | "asc";
type CardMetricMode = "ytd" | "month";
type StoreTooltipMode = "month" | "ytd" | "annual";

type TableRow = {
  kind: RowKind;
  country: string;
  brand: string;
  channel: string;
  storeName: string;
  rowKey: string;
  toggleKey?: string;
  months: MonthMetric[];
  ytd: CellMetric;
  annual: CellMetric;
};

const TEXT = {
  emptyRegion: "표시할 리전 데이터가 없습니다.",
  title: "홍콩법인 매장 월별 Sales / YoY",
  intro: "12개월 전체, 선택월 YTD, 연간 합계, 그리고 채널별 합계를 한 화면에서 볼 수 있게 정리했습니다.",
  period: "실적 기준월",
  baseYear: "기준 연도",
  channelTopSales: "최고 매출",
  channelTopYoy: "최고 YOY",
  topYoY: "최고 YoY 점포",
  topSales: "최대 매출 점포",
  noData: "선택 월 데이터 없음",
  ytdBasisSuffix: "누적 기준",
  annualTable: "매장월별 매출추세",
  ytdRight: "실적 기준월 바로 오른쪽에 YTD 열이 추가됩니다.",
  country: "국가",
  brand: "브랜드",
  channel: "채널",
  store: "매장명",
  annualTotal: "연간 합계",
  overallTotal: "전체 합계",
  countryTotal: "국가 합계",
  brandTotal: "브랜드 합계",
  channelTotal: "채널 합계",
  viewYoy: "YoY만 보기",
  viewSales: "매출액 보기",
  expandAll: "매장 펼치기",
  collapseAll: "매장 접기",
  unit: "단위 : 1k HKD",
  emptyRows: "표시할 매장 월별 데이터가 없습니다.",
  yoyPrev: "YOY",
  yoyTwo: "전전년비",
  storeCount: "당월 매장수",
  previousStoreCount: "전년 매장수",
  twoYearStoreCount: "전전년 매장수",
  ytdAverageStoreCount: "YTD 평균 매장수",
  annualAverageStoreCount: "연간 평균 매장수",
  storeCountYoy: "매장수 YOY",
  storeCountTwoYear: "매장수 전전년비",
  expand: "펼치기",
  collapse: "접기",
  storeDrilldown: "Store Drilldown",
};

const REGION_LABELS: Record<string, string> = {
  HKMC: "HKMC",
  TW: "TW",
};

const BRAND_LABELS: Record<string, string> = {
  ALL: "전체",
  M: "MLB",
  X: "DX",
};

const DEFAULT_SELECTED_MONTH = 2;
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

export function DashboardShell({
  data,
  storeMonthlySales,
  initialActualPeriod,
  canEditPeriod,
}: {
  data: DashboardData;
  storeMonthlySales: StoreMonthlySales;
  initialActualPeriod?: string;
  canEditPeriod: boolean;
}) {
  const regionKeys = Object.keys(data.regions).filter((key) => data.regions[key]);
  const initialRegionKey = regionKeys[0] ?? "HKMC";
  const initialPeriod = parseActualPeriod(initialActualPeriod, DEFAULT_SELECTED_MONTH);
  const [regionKey, setRegionKey] = useState(initialRegionKey);
  const [selectedBrand, setSelectedBrand] = useState("M");
  const [selectedMonth, setSelectedMonth] = useState(initialPeriod.month);
  const [cardMetricMode, setCardMetricMode] = useState<CardMetricMode>("ytd");
  const [expandedChannels, setExpandedChannels] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("yoy");
  const [showDataStructureModal, setShowDataStructureModal] = useState(false);
  const [sortMonth, setSortMonth] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const region = data.regions[regionKey];
  const latestYear = initialPeriod.year ?? getLatestYear(region?.latestPeriod);
  const storeRows = region?.storeYoyMultiYear ?? [];
  const regionSales = storeMonthlySales[regionKey] ?? {};
  const countryLabel = REGION_LABELS[regionKey] ?? regionKey;
  const availableBrands = useMemo(() => {
    const brands = Array.from(
      new Set(
        Object.values(regionSales)
          .map((store) => String(store.brand || ""))
          .filter(Boolean),
      ),
    ).sort();
    const orderedBrands = brands.includes("M")
      ? ["M", ...brands.filter((brand) => brand !== "M")]
      : brands;
    return ["ALL", ...orderedBrands];
  }, [regionSales]);

  useEffect(() => {
    if (availableBrands.length === 0) return;
    if (!availableBrands.includes(selectedBrand)) {
      setSelectedBrand(availableBrands.includes("M") ? "M" : availableBrands[0]);
      setExpandedChannels({});
      setSortMonth(null);
      setSortDirection("desc");
    }
  }, [availableBrands, selectedBrand]);

  const periodOptions = useMemo(() => {
    return MONTH_OPTIONS.map((month) => ({
      value: month,
      label: formatPeriodOptionLabel(latestYear, month),
    }));
  }, [latestYear]);

  async function handleActualPeriodChange(nextMonth: number) {
    setSelectedMonth(nextMonth);
    if (!canEditPeriod) return;

    await fetch("/api/store-view-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualPeriod: formatPeriod(latestYear, nextMonth) }),
    });
  }

  const ytdYoy = useMemo(() => {
    const monthly = region?.monthly ?? [];
    const currentYtd = monthly
      .filter((point) => point.year === latestYear && point.month <= selectedMonth)
      .reduce((sum, point) => sum + (point.actualSales || 0), 0);
    const previousYtd = monthly
      .filter((point) => point.year === latestYear - 1 && point.month <= selectedMonth)
      .reduce((sum, point) => sum + (point.actualSales || 0), 0);

    if (!previousYtd) return null;
    return currentYtd / previousYtd - 1;
  }, [latestYear, region?.monthly, selectedMonth]);

  const tableRows = useMemo<TableRow[]>(() => {
    return storeRows
      .map((store) => {
        const salesSource = regionSales[store.storeCode];
        if (!salesSource) return null;
        if (selectedBrand !== "ALL" && salesSource.brand !== selectedBrand) return null;

        const months = MONTH_OPTIONS.map((month) => ({
          month,
          ...createMetricCell(salesSource.monthlySales, latestYear, month),
        }));
        const rowCountry = getStoreCountry(regionKey, store.storeCode, countryLabel);
        const toggleKey = `${rowCountry}__${salesSource.brand}__${salesSource.channel}`;

        return {
          kind: "store" as const,
          country: rowCountry,
          brand: salesSource.brand,
          channel: salesSource.channel,
          storeName: store.storeName,
          rowKey: store.storeCode,
          toggleKey,
          months,
          ytd: createYtdMetric(salesSource.monthlySales, latestYear, selectedMonth),
          annual: createAnnualMetric(salesSource.annualTotals, salesSource.monthlySales, latestYear),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => {
        if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
        if (a.channel !== b.channel) return a.channel.localeCompare(b.channel);
        return a.storeName.localeCompare(b.storeName);
      });
  }, [countryLabel, latestYear, regionKey, regionSales, selectedBrand, selectedMonth, storeRows]);

  const channelKeys = useMemo(() => Array.from(new Set(tableRows.map((row) => row.toggleKey).filter((value): value is string => Boolean(value)))), [tableRows]);

  const allExpanded = channelKeys.length > 0 && channelKeys.every((key) => expandedChannels[key] === true);

  const visibleRows = useMemo<TableRow[]>(() => {
    if (tableRows.length === 0) return [];

    const rows: TableRow[] = [];
    rows.push(
      createSummaryRow("overall-total", tableRows, {
        country: "전체",
        brand: "-",
        channel: "-",
        storeName: TEXT.overallTotal,
        rowKey: `${countryLabel}-overall-total`,
      }),
    );
    const countryGroups = new Map<string, TableRow[]>();
    for (const row of tableRows) {
      const group = countryGroups.get(row.country) ?? [];
      group.push(row);
      countryGroups.set(row.country, group);
    }

    for (const country of getCountryOrder(regionKey, countryGroups)) {
      const countryRows = countryGroups.get(country) ?? [];
      rows.push(
        createSummaryRow("country-total", countryRows, {
          country,
          brand: "-",
          channel: "-",
          storeName: TEXT.countryTotal,
          rowKey: `${country}-country-total`,
        }),
      );

      const brandGroups = new Map<string, TableRow[]>();
      for (const row of countryRows) {
        const group = brandGroups.get(row.brand) ?? [];
        group.push(row);
        brandGroups.set(row.brand, group);
      }

      for (const [brand, brandRows] of brandGroups.entries()) {
        rows.push(
          createSummaryRow("brand-total", brandRows, {
            country,
            brand,
            channel: "-",
            storeName: TEXT.brandTotal,
            rowKey: `${country}-${brand}-brand-total`,
          }),
        );

        const channelGroups = new Map<string, TableRow[]>();
        for (const row of brandRows) {
          const group = channelGroups.get(row.channel) ?? [];
          group.push(row);
          channelGroups.set(row.channel, group);
        }

        for (const [channel, channelRows] of channelGroups.entries()) {
          const toggleKey = `${country}__${brand}__${channel}`;
          rows.push(
            createSummaryRow("channel-total", channelRows, {
              country,
              brand,
              channel,
              storeName: TEXT.channelTotal,
              rowKey: `${toggleKey}-channel-total`,
              toggleKey,
            }),
          );

          if (expandedChannels[toggleKey] ?? false) {
            rows.push(...sortRowsForMonth(channelRows, sortMonth, sortDirection, viewMode));
          }
        }
      }
    }

    return rows;
  }, [countryLabel, expandedChannels, regionKey, sortDirection, sortMonth, tableRows, viewMode]);

  const toggleAllChannels = () => {
    setExpandedChannels(Object.fromEntries(channelKeys.map((key) => [key, !allExpanded])));
  };

  const storeOnlyRows = tableRows;
  const getCardMetric = useMemo(
    () => (row: TableRow) => (cardMetricMode === "month" ? row.months[selectedMonth - 1] : row.ytd),
    [cardMetricMode, selectedMonth],
  );
  const overallCardMetric = useMemo(() => aggregateMetricCells(storeOnlyRows.map((row) => getCardMetric(row))), [getCardMetric, storeOnlyRows]);
  const overallCardTitle = useMemo(() => {
    if (regionKey === "HKMC") return "홍콩마카오 합계";
    if (regionKey === "TW") return "대만 전체";
    return `${countryLabel} 전체`;
  }, [countryLabel, regionKey]);

  const channelHighlights = useMemo(() => {
    const grouped = new Map<string, TableRow[]>();
    for (const row of storeOnlyRows) {
      const groupLabel = getChannelHighlightLabel(row);
      const rows = grouped.get(groupLabel) ?? [];
      rows.push(row);
      grouped.set(groupLabel, rows);
    }

    return Array.from(grouped.entries()).map(([channel, rows]) => {
      const metrics = rows.map((row) => ({ row, metric: getCardMetric(row) }));
      const channelMetric = aggregateMetricCells(metrics.map((entry) => entry.metric));
      const topYoy = metrics.reduce<{ storeName: string; value: number; yoyTwo: number | null } | null>((best, entry) => {
        const value = entry.metric.yoyPrev;
        if (value == null) return best;
        if (!best || value > best.value) {
          return { storeName: entry.row.storeName, value, yoyTwo: entry.metric.yoyTwo };
        }
        return best;
      }, null);

      const topSales = metrics.reduce<{ storeName: string; value: number; yoyPrev: number | null; yoyTwo: number | null } | null>((best, entry) => {
        const value = entry.metric.sales;
        if (value == null) return best;
        if (!best || value > best.value) {
          return { storeName: entry.row.storeName, value, yoyPrev: entry.metric.yoyPrev, yoyTwo: entry.metric.yoyTwo };
        }
        return best;
      }, null);

      return { channel, channelMetric, topYoy, topSales };
    }).sort((a, b) => getChannelCardOrder(a.channel) - getChannelCardOrder(b.channel) || a.channel.localeCompare(b.channel));
  }, [cardMetricMode, getCardMetric, selectedMonth, storeOnlyRows]);

  const trendSummary = useMemo(() => {
    const strongestGrowth = channelHighlights
      .filter((item) => item.channelMetric.yoyPrev != null)
      .sort((a, b) => (b.channelMetric.yoyPrev ?? Number.NEGATIVE_INFINITY) - (a.channelMetric.yoyPrev ?? Number.NEGATIVE_INFINITY))[0];
    const strongestRecovery = channelHighlights
      .filter((item) => item.channelMetric.yoyTwo != null)
      .sort((a, b) => (b.channelMetric.yoyTwo ?? Number.NEGATIVE_INFINITY) - (a.channelMetric.yoyTwo ?? Number.NEGATIVE_INFINITY))[0];
    const softestRecovery = channelHighlights
      .filter((item) => item.channelMetric.yoyTwo != null)
      .sort((a, b) => (a.channelMetric.yoyTwo ?? Number.POSITIVE_INFINITY) - (b.channelMetric.yoyTwo ?? Number.POSITIVE_INFINITY))[0];

    const basisLabel = cardMetricMode === "month" ? `${selectedMonth}월 당월` : `${selectedMonth}월 누적`;
    const lines: ReactNode[] = [
      <>
        <strong className="font-semibold text-stone-900">{basisLabel}</strong> 기준{" "}
        <strong className="font-semibold text-stone-900">{overallCardTitle}</strong> 실판매출은{" "}
        {renderTrendBadge(`${formatSalesCell(overallCardMetric.sales)} K HKD`, "stone")}이며,{" "}
        {renderTrendMetricBadge("YOY", overallCardMetric.yoyPrev)}{" "}
        {renderTrendMetricBadge("전전년비", overallCardMetric.yoyTwo)} 흐름입니다.
      </>,
    ];

    if (strongestGrowth) {
      lines.push(
        <>
          성장 탄력은 <strong className="font-semibold text-stone-900">{strongestGrowth.channel}</strong>이 가장 강하며{" "}
          {renderTrendMetricBadge("YOY", strongestGrowth.channelMetric.yoyPrev)}를 기록하고 있습니다.
          {strongestGrowth.topSales ? (
            <>
              {" "}대표 매출 점포는 <strong className="font-semibold text-stone-900">{strongestGrowth.topSales.storeName}</strong>로{" "}
              {renderTrendBadge(`${formatSalesCell(strongestGrowth.topSales.value)} K HKD`, "stone")}입니다.
            </>
          ) : null}
        </>,
      );
    }

    if (strongestRecovery) {
      lines.push(
        <>
          전전년비 기준 회복세는 <strong className="font-semibold text-stone-900">{strongestRecovery.channel}</strong>이 가장 두드러지며{" "}
          {renderTrendMetricBadge("전전년비", strongestRecovery.channelMetric.yoyTwo)} 수준입니다.
        </>,
      );
    }

    if (softestRecovery && softestRecovery.channelMetric.yoyTwo != null && softestRecovery.channelMetric.yoyTwo < 0) {
      lines.push(
        <>
          반면 <strong className="font-semibold text-stone-900">{softestRecovery.channel}</strong>{topicParticle(softestRecovery.channel)}{" "}
          {renderTrendMetricBadge("전전년비", softestRecovery.channelMetric.yoyTwo)}로, 추가 회복 여지가 남아 있습니다.
        </>,
      );
    }

    return lines.slice(0, 4);
  }, [cardMetricMode, channelHighlights, overallCardMetric.sales, overallCardMetric.yoyPrev, overallCardMetric.yoyTwo, overallCardTitle, selectedMonth]);

  const dataStructureSections = useMemo(
    () => [
      {
        title: "1. Excel 원본",
        items: [
          "`Store_Rawdata.xlsx`가 기본 forecast 원본입니다.",
          "`scripts/import_store_rawdata.py`가 월별/연간 컬럼을 정규화합니다.",
          "정규화 결과는 `data/normalized/*.csv`와 `data/store_dashboard.sqlite`로 적재됩니다.",
        ],
      },
      {
        title: "2. SQL actual",
        items: [
          "`scripts/fetch_snowflake_actuals.mjs`가 Snowflake `SAP_FNF.DW_HMD_SALE_D`에서 actual 매출을 조회합니다.",
          "`scripts/export_store_monthly_sales_sql.py`에서 매장별·월별 actual 데이터를 받아옵니다.",
          "현재 화면 기준월은 " + formatPeriod(latestYear, selectedMonth) + " 이므로, 해당 월까지 actual 구간으로 처리됩니다.",
        ],
      },
      {
        title: "3. 병합 규칙",
        items: [
          "기준 연도 이전 연도는 SQL actual을 사용합니다.",
          "기준 연도에서는 선택한 기준월까지 SQL actual, 이후 월은 Excel forecast를 사용합니다.",
          "TW 데이터는 병합 과정에서 환율 규칙을 적용해 HKD 기준으로 맞춥니다.",
        ],
      },
      {
        title: "4. 화면 반영 데이터",
        items: [
          "`data/dashboard-data.json`은 카드/요약/YoY용 `generatedAt`, `regions.monthly`, `regions.storeYoyMultiYear`를 제공합니다.",
          "`app/page.tsx`는 `scripts/export_store_monthly_sales_sql.py`를 실행해 표용 `storeMonthlySales`를 만듭니다.",
          "즉 상단 요약과 하단 테이블은 SQLite + SQL actual + Excel forecast를 합친 결과를 같이 사용합니다.",
        ],
      },
    ],
    [latestYear, selectedMonth],
  );

  useEffect(() => {
    if (!showDataStructureModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDataStructureModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDataStructureModal]);

  if (!region) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10">
        <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/75 px-8 py-10 text-center shadow-[0_20px_50px_rgba(65,46,24,0.08)]">
          <p className="text-lg font-semibold text-stone-900">{TEXT.emptyRegion}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1860px] px-4 py-5 md:px-6 md:py-6">
      <div className="space-y-4">
        <section className="rounded-[28px] border border-white/55 bg-white/82 p-5 shadow-[0_16px_40px_rgba(65,46,24,0.10)] md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">{TEXT.storeDrilldown}</p>
              <h1 className="mt-2 font-serif text-3xl leading-none tracking-tight text-stone-900 md:text-5xl">{TEXT.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">{TEXT.intro}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {regionKeys.map((key) => (
                  <ToggleButton
                    key={key}
                    active={regionKey === key}
                    onClick={() => {
                      setRegionKey(key);
                      setSelectedMonth(initialPeriod.month);
                      setExpandedChannels({});
                      setSortMonth(null);
                      setSortDirection("desc");
                    }}
                  >
                    {REGION_LABELS[key] ?? key}
                  </ToggleButton>
                ))}
                <div className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-3 shadow-sm">
                  <label htmlFor="brand-select" className="text-sm font-semibold text-stone-600">
                    Brand
                  </label>
                  <select
                    id="brand-select"
                    value={selectedBrand}
                    onChange={(event) => {
                      setSelectedBrand(event.target.value);
                      setExpandedChannels({});
                      setSortMonth(null);
                      setSortDirection("desc");
                    }}
                    className="bg-transparent text-base font-semibold text-stone-900 outline-none"
                  >
                    {availableBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {BRAND_LABELS[brand] ?? brand}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="min-w-[460px] rounded-[28px] border border-stone-200/70 bg-stone-50/90 p-6 shadow-inner shadow-stone-900/5 md:min-w-[520px]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label htmlFor="period-select" className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                    {TEXT.period}
                  </label>
                <select
                  id="period-select"
                  value={selectedMonth}
                  disabled={!canEditPeriod}
                  onChange={(event) => {
                    void handleActualPeriodChange(Number(event.target.value));
                  }}
                  className={`rounded-full border border-stone-300 bg-white px-5 py-3 text-base font-medium text-stone-800 outline-none transition focus:border-emerald-600 ${canEditPeriod ? "" : "cursor-not-allowed bg-stone-100 text-stone-500"}`}
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDataStructureModal(true)}
                  className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-500 hover:bg-stone-100"
                >
                  데이터구조
                </button>
              </div>
              <div className="mt-5 text-base text-stone-500">
                <p>
                  {TEXT.baseYear} <span className="font-semibold text-stone-800">{latestYear}</span>
                </p>
                <p className="mt-1">Updated {formatTimestamp(data.generatedAt)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <OverallSummaryCard
            title={overallCardTitle}
            basis={formatCardBasis(selectedMonth, cardMetricMode)}
            mode={cardMetricMode}
            onModeChange={setCardMetricMode}
            salesValue={formatSalesCell(overallCardMetric.sales)}
            yoyValue={overallCardMetric.yoyPrev}
            yoyTwoValue={overallCardMetric.yoyTwo}
          />
          {channelHighlights.map((item) => (
            <ChannelHighlightCard
              key={item.channel}
              channel={item.channel}
              basis={formatCardBasis(selectedMonth, cardMetricMode)}
              summaryValue={renderCardComparison(item.channel, item.channelMetric.yoyPrev, item.channelMetric.yoyTwo)}
              salesLabel={TEXT.channelTopSales}
              yoyLabel={TEXT.channelTopYoy}
              salesValue={item.topSales ? `${item.topSales.storeName} / ${formatSalesCell(item.topSales.value)} K HKD` : TEXT.noData}
              salesDetail={item.topSales ? renderMetricComparison(item.topSales.yoyPrev, item.topSales.yoyTwo) : null}
              yoyValue={item.topYoy ? `${item.topYoy.storeName} / ${formatYoyRate(item.topYoy.value)}` : TEXT.noData}
              yoyDetail={item.topYoy ? renderMetricComparison(item.topYoy.value, item.topYoy.yoyTwo) : null}
              yoyTone={item.topYoy?.value}
            />
          ))}
        </section>

        <section className="rounded-[24px] border border-white/55 bg-white/80 p-5 shadow-[0_16px_36px_rgba(65,46,24,0.08)]">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Trend Summary</p>
              <h3 className="mt-2 text-xl font-semibold text-stone-900">현재 현황과 추세</h3>
            </div>
            <div className="space-y-2 text-sm leading-7 text-stone-600">
              {trendSummary.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/55 bg-white/84 p-4 shadow-[0_16px_40px_rgba(65,46,24,0.10)] md:p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">{countryLabel}</p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-900">{latestYear} {TEXT.annualTable}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <ToggleButton
                  active={viewMode === "sales"}
                  onClick={() => setViewMode(viewMode === "yoy" ? "sales" : "yoy")}
                >
                  {viewMode === "yoy" ? TEXT.viewSales : TEXT.viewYoy}
                </ToggleButton>
                <ToggleButton active={allExpanded} onClick={toggleAllChannels}>
                  {allExpanded ? TEXT.collapseAll : TEXT.expandAll}
                </ToggleButton>
              </div>
            </div>
            <div className="text-right text-sm text-stone-500">
              <p>{TEXT.ytdRight}</p>
              <p className="mt-1">{TEXT.unit}</p>
            </div>
          </div>

          <div className="mt-4 overflow-visible rounded-[22px] border border-stone-200/70 bg-white/95">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1540px] table-fixed text-[11px] leading-4">
                <thead className="bg-stone-100/95 text-stone-700">
                  <tr>
                    <th className="w-[72px] px-2 py-3 text-left font-semibold">{TEXT.country}</th>
                    <th className="w-[70px] px-2 py-3 text-left font-semibold">{TEXT.brand}</th>
                    <th className="w-[88px] px-2 py-3 text-left font-semibold">{TEXT.channel}</th>
                    <th className="w-[120px] px-2 py-3 text-left font-semibold">{TEXT.store}</th>
                    {MONTH_OPTIONS.map((month) => (
                      <Fragment key={`head-${month}`}>
                        <th className={`w-[82px] px-2 py-3 text-center font-semibold ${monthHeaderTone(month, selectedMonth)}`}>
                          <button
                            type="button"
                            onClick={() => {
                              if (sortMonth === month) {
                                setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
                              } else {
                                setSortMonth(month);
                                setSortDirection("desc");
                              }
                            }}
                            className="w-full text-center"
                          >
                            <div>{formatMonthHeaderLabel(month, selectedMonth)}{sortMonth === month ? (sortDirection === "desc" ? " ↓" : " ↑") : ""}</div>
                          </button>
                        </th>
                        {month === selectedMonth ? (
                          <th className="w-[90px] bg-stone-300/90 px-2 py-3 text-center font-semibold text-stone-900">YTD</th>
                        ) : null}
                      </Fragment>
                    ))}
                    <th className="w-[92px] bg-stone-200/70 px-2 py-3 text-center font-semibold">{TEXT.annualTotal}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length > 0 ? (
                    visibleRows.map((row) => {
                      const isSummaryRow = row.kind !== "store";
                      const isChannelTotal = row.kind === "channel-total";
                      const isExpanded = row.toggleKey ? (expandedChannels[row.toggleKey] ?? false) : false;

                      return (
                        <tr key={row.rowKey} className={`border-t border-stone-200/70 ${summaryRowClass(row.kind)}`}>
                          <td className="px-2 py-2 font-medium text-stone-700">{row.country}</td>
                          <td className="px-2 py-2 font-medium text-stone-700">{row.brand}</td>
                          <td className="px-2 py-2 font-medium text-stone-700">{row.channel}</td>
                          <td className={`px-2 py-2 ${isSummaryRow ? "font-semibold text-stone-900" : "text-stone-900"}`}>
                            {isChannelTotal && row.toggleKey ? (
                              <button
                                type="button"
                                onClick={() => setExpandedChannels((current) => ({
                                  ...current,
                                  [row.toggleKey!]: !(current[row.toggleKey!] ?? false),
                                }))}
                                className="inline-flex items-center gap-2 text-left font-semibold text-stone-900"
                              >
                                <span className="inline-flex h-5 w-5 items-center justify-center text-xs text-stone-500">
                                  {isExpanded ? "▼" : "▶"}
                                </span>
                                <span>{row.storeName}</span>
                              </button>
                            ) : (
                              row.storeName
                            )}
                          </td>
                          {row.months.map((month) => (
                            <Fragment key={`${row.rowKey}-${month.month}`}>
                              <td className={`px-2 py-2 align-top ${monthCellTone(month.month, selectedMonth)}`}>
                                <MetricCell metric={month} emphasize={isSummaryRow} viewMode={viewMode} storeTooltipMode="month" />
                              </td>
                              {month.month === selectedMonth ? (
                                <td className="bg-stone-200/80 px-2 py-2 align-top">
                                  <MetricCell metric={row.ytd} emphasize viewMode={viewMode} storeTooltipMode="ytd" />
                                </td>
                              ) : null}
                            </Fragment>
                          ))}
                          <td className="bg-stone-50/90 px-2 py-2 align-top">
                            <MetricCell metric={row.annual} emphasize={isSummaryRow} viewMode={viewMode} storeTooltipMode="annual" />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <EmptyRow colSpan={18} message={TEXT.emptyRows} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
      {showDataStructureModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-6">
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={() => setShowDataStructureModal(false)}
          />
          <section className="relative z-10 w-full max-w-4xl rounded-[28px] border border-white/60 bg-[#f7f3ec] p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)] md:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Data Structure</p>
                <h3 className="mt-2 text-2xl font-semibold text-stone-900">데이터구조</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  이 화면에서 어떤 값이 SQL actual이고, 어디부터 Excel forecast인지 기준월 기준으로 정리했습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDataStructureModal(false)}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-500 hover:bg-stone-100"
              >
                닫기
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {dataStructureSections.map((section) => (
                <article key={section.title} className="rounded-[22px] border border-stone-200 bg-white/90 p-4 shadow-sm">
                  <h4 className="text-base font-semibold text-stone-900">{section.title}</h4>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-stone-600">
                    {section.items.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-[22px] border border-stone-200 bg-white/90 p-4 shadow-sm">
              <p className="text-base font-semibold text-stone-900">최종 업데이트 로그</p>
              <div className="mt-3 grid gap-3 text-sm text-stone-600 md:grid-cols-3">
                <div className="rounded-[18px] bg-stone-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-400">기준월</p>
                  <p className="mt-2 font-semibold text-stone-900">{formatPeriod(latestYear, selectedMonth)}</p>
                </div>
                <div className="rounded-[18px] bg-stone-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Dashboard JSON</p>
                  <p className="mt-2 font-semibold text-stone-900">{formatTimestamp(data.generatedAt)}</p>
                </div>
                <div className="rounded-[18px] bg-stone-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-400">설명 기준</p>
                  <p className="mt-2 font-semibold text-stone-900">SQL actual + Excel forecast 병합 기준</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function createMetricCell(source: Record<string, number>, latestYear: number, month: number): CellMetric {
  const sales = source[formatPeriod(latestYear, month)] ?? null;
  const previous = source[formatPeriod(latestYear - 1, month)] ?? null;
  const twoYears = source[formatPeriod(latestYear - 2, month)] ?? null;

  return {
    sales,
    previousSales: previous,
    twoYearSales: twoYears,
    yoyPrev: sales != null && previous ? sales / previous - 1 : null,
    yoyTwo: sales != null && twoYears ? sales / twoYears - 1 : null,
    storeCount: sales != null ? (sales > 0 ? 1 : 0) : null,
    previousStoreCount: previous != null ? (previous > 0 ? 1 : 0) : null,
    twoYearStoreCount: twoYears != null ? (twoYears > 0 ? 1 : 0) : null,
  };
}

function createYtdMetric(source: Record<string, number>, latestYear: number, selectedMonth: number): CellMetric {
  const current = sumPeriods(source, latestYear, selectedMonth);
  const previous = sumPeriods(source, latestYear - 1, selectedMonth);
  const twoYears = sumPeriods(source, latestYear - 2, selectedMonth);

  return {
    sales: current,
    previousSales: previous,
    twoYearSales: twoYears,
    yoyPrev: current != null && previous ? current / previous - 1 : null,
    yoyTwo: current != null && twoYears ? current / twoYears - 1 : null,
    storeCount: calculateAverageStoreCount(source, latestYear, selectedMonth),
    previousStoreCount: calculateAverageStoreCount(source, latestYear - 1, selectedMonth),
    twoYearStoreCount: calculateAverageStoreCount(source, latestYear - 2, selectedMonth),
  };
}

function createAnnualMetric(
  annualSource: Record<string, number>,
  monthlySource: Record<string, number>,
  latestYear: number,
): CellMetric {
  const sales = annualSource[String(latestYear)] ?? null;
  const previous = annualSource[String(latestYear - 1)] ?? null;
  const twoYears = annualSource[String(latestYear - 2)] ?? null;

  return {
    sales,
    previousSales: previous,
    twoYearSales: twoYears,
    yoyPrev: sales != null && previous ? sales / previous - 1 : null,
    yoyTwo: sales != null && twoYears ? sales / twoYears - 1 : null,
    storeCount: calculateAverageStoreCount(monthlySource, latestYear, 12),
    previousStoreCount: calculateAverageStoreCount(monthlySource, latestYear - 1, 12),
    twoYearStoreCount: calculateAverageStoreCount(monthlySource, latestYear - 2, 12),
  };
}

function createSummaryRow(
  kind: RowKind,
  rows: TableRow[],
  values: {
    country: string;
    brand: string;
    channel: string;
    storeName: string;
    rowKey: string;
    toggleKey?: string;
  },
): TableRow {
  return {
    kind,
    country: values.country,
    brand: values.brand,
    channel: values.channel,
    storeName: values.storeName,
    rowKey: values.rowKey,
    toggleKey: values.toggleKey,
    months: MONTH_OPTIONS.map((month, index) => ({
      month,
      ...aggregateMetricCells(rows.map((row) => row.months[index])),
    })),
    ytd: aggregateMetricCells(rows.map((row) => row.ytd)),
    annual: aggregateMetricCells(rows.map((row) => row.annual)),
  };
}

function summaryRowClass(kind: RowKind) {
  switch (kind) {
    case "overall-total":
      return "bg-stone-200/70";
    case "country-total":
      return "bg-stone-100/90";
    case "brand-total":
      return "bg-stone-100/80";
    case "channel-total":
      return "bg-stone-100/60";
    default:
      return "hover:bg-emerald-50/40";
  }
}

function aggregateMetricCells(metrics: CellMetric[]): CellMetric {
  const sales = metrics.reduce((sum, metric) => sum + (metric.sales ?? 0), 0);
  const previousSales = metrics.reduce((sum, metric) => sum + (metric.previousSales ?? 0), 0);
  const twoYearSales = metrics.reduce((sum, metric) => sum + (metric.twoYearSales ?? 0), 0);
  const storeCount = metrics.reduce((sum, metric) => sum + (metric.storeCount ?? 0), 0);
  const previousStoreCount = metrics.reduce((sum, metric) => sum + (metric.previousStoreCount ?? 0), 0);
  const twoYearStoreCount = metrics.reduce((sum, metric) => sum + (metric.twoYearStoreCount ?? 0), 0);
  const hasSales = metrics.some((metric) => metric.sales != null);
  const hasPreviousSales = metrics.some((metric) => metric.previousSales != null);
  const hasTwoYearSales = metrics.some((metric) => metric.twoYearSales != null);
  const hasStoreCount = metrics.some((metric) => metric.storeCount != null);
  const hasPreviousStoreCount = metrics.some((metric) => metric.previousStoreCount != null);
  const hasTwoYearStoreCount = metrics.some((metric) => metric.twoYearStoreCount != null);

  return {
    sales: hasSales ? sales : null,
    previousSales: hasPreviousSales ? previousSales : null,
    twoYearSales: hasTwoYearSales ? twoYearSales : null,
    yoyPrev: previousSales ? sales / previousSales - 1 : null,
    yoyTwo: twoYearSales ? sales / twoYearSales - 1 : null,
    storeCount: hasStoreCount ? storeCount : null,
    previousStoreCount: hasPreviousStoreCount ? previousStoreCount : null,
    twoYearStoreCount: hasTwoYearStoreCount ? twoYearStoreCount : null,
  };
}

function sumPeriods(source: Record<string, number>, year: number, selectedMonth: number) {
  let total = 0;
  let hasValue = false;
  for (let month = 1; month <= selectedMonth; month += 1) {
    const value = source[formatPeriod(year, month)];
    if (value == null) continue;
    total += value;
    hasValue = true;
  }
  return hasValue ? total : null;
}

function ToggleButton({ children, active, onClick }: { children: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-6 py-3 text-base font-semibold tracking-[0.01em] shadow-sm transition ${
        active
          ? "border-stone-950 bg-stone-950 text-white shadow-[0_10px_24px_rgba(28,25,23,0.18)]"
          : "border-stone-300 bg-white text-stone-700 hover:border-stone-500 hover:bg-stone-50"
      }`}
    >
      {children}
    </button>
  );
}

function OverallSummaryCard({
  title,
  basis,
  mode,
  onModeChange,
  salesValue,
  yoyValue,
  yoyTwoValue,
}: {
  title: string;
  basis: string;
  mode: CardMetricMode;
  onModeChange: (mode: CardMetricMode) => void;
  salesValue: string;
  yoyValue: number | null;
  yoyTwoValue: number | null;
}) {
  return (
    <article className="rounded-[24px] border border-white/55 bg-white/85 p-4 shadow-[0_16px_40px_rgba(65,46,24,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold leading-snug text-stone-900">{title}</p>
          <p className="mt-1 text-xs text-stone-400">{basis}</p>
        </div>
        <div className="inline-flex rounded-full border border-stone-300 bg-white p-1">
          <button
            type="button"
            onClick={() => onModeChange("ytd")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${mode === "ytd" ? "bg-stone-950 text-white" : "text-stone-600"}`}
          >
            누적
          </button>
          <button
            type="button"
            onClick={() => onModeChange("month")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${mode === "month" ? "bg-stone-950 text-white" : "text-stone-600"}`}
          >
            당월
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-400">실판매출</p>
          <p className="mt-1 text-base font-semibold text-stone-900">{salesValue} K HKD</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-400">YOY</p>
          <p className="mt-1">
            <span className={`inline-flex rounded-full px-3 py-1 text-base font-semibold ${pillTone(yoyValue)}`}>{formatYoyRate(yoyValue)}</span>
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-400">전전년비</p>
          <p className="mt-1">
            <span className={`inline-flex rounded-full px-3 py-1 text-base font-semibold ${pillTone(yoyTwoValue)}`}>{formatYoyRate(yoyTwoValue)}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

function ChannelHighlightCard({
  channel,
  basis,
  summaryValue,
  salesLabel,
  yoyLabel,
  salesValue,
  salesDetail,
  yoyValue,
  yoyDetail,
  yoyTone,
}: {
  channel: string;
  basis: string;
  summaryValue: ReactNode | null;
  salesLabel: string;
  yoyLabel: string;
  salesValue: string;
  salesDetail?: ReactNode;
  yoyValue: string;
  yoyDetail?: ReactNode;
  yoyTone?: number | null;
}) {
  return (
    <article className="rounded-[24px] border border-white/55 bg-white/85 p-4 shadow-[0_16px_40px_rgba(65,46,24,0.10)]">
      <p className="text-base font-semibold leading-snug text-stone-900">{channel}</p>
      <p className="mt-1 text-xs text-stone-400">{basis}</p>
      {summaryValue ? <p className="mt-1 text-[12px] font-semibold text-stone-600">{summaryValue}</p> : null}
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-400">{salesLabel}</p>
          <p className="mt-1 text-base font-semibold text-stone-900">{salesValue}</p>
          {salesDetail ? <p className="mt-1 text-[12px]">{salesDetail}</p> : null}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-400">{yoyLabel}</p>
          <p className={`mt-1 text-base font-semibold ${valueTone(yoyTone ?? null).replace("text-stone-400", "text-stone-900")}`}>{yoyValue}</p>
          {yoyDetail ? <p className="mt-1 text-[12px]">{yoyDetail}</p> : null}
        </div>
      </div>
    </article>
  );
}

function MetricCell({
  metric,
  emphasize = false,
  viewMode,
  storeTooltipMode,
}: {
  metric: CellMetric;
  emphasize?: boolean;
  viewMode: ViewMode;
  storeTooltipMode?: StoreTooltipMode;
}) {
  const storeCountYoyPrev = calculateStoreCountChange(metric.storeCount, metric.previousStoreCount);
  const storeCountYoyTwo = calculateStoreCountChange(metric.storeCount, metric.twoYearStoreCount);
  const previousStoreCountYoy = calculateStoreCountChange(metric.previousStoreCount, metric.twoYearStoreCount);
  const canShowStoreTooltip =
    storeTooltipMode != null && (metric.storeCount != null || metric.previousStoreCount != null || metric.twoYearStoreCount != null);
  const storeCountLabel =
    storeTooltipMode === "ytd"
      ? TEXT.ytdAverageStoreCount
      : storeTooltipMode === "annual"
        ? TEXT.annualAverageStoreCount
        : TEXT.storeCount;
  const tooltipPositionClass =
    storeTooltipMode === "annual"
      ? "right-full top-1/2 mr-2 -translate-y-1/2"
      : "left-1/2 top-full mt-1 -translate-x-1/2";

  return (
    <div>
      {viewMode === "sales" ? (
        <div className={`text-center text-[16px] font-semibold ${emphasize ? "text-stone-950" : "text-stone-900"}`}>{formatSalesCell(metric.sales)}</div>
      ) : null}
      <div className={`text-center text-[12px] font-semibold ${viewMode === "sales" ? "mt-1 " : ""}${valueTone(metric.yoyPrev)}`}>
        {canShowStoreTooltip ? (
          <div className="group relative inline-flex cursor-help items-center justify-center">
            <span>{TEXT.yoyPrev} {formatYoyRate(metric.yoyPrev)}</span>
            <div className={`pointer-events-none absolute z-20 hidden w-56 rounded-[18px] border border-stone-200 bg-white px-3 py-2 text-left shadow-[0_12px_28px_rgba(28,25,23,0.16)] group-hover:block ${tooltipPositionClass}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Store Count</p>
              <p className="mt-2 text-[11px] font-medium text-stone-600">
                {storeCountLabel} <span className="font-semibold text-stone-900">{formatStoreCount(metric.storeCount, storeTooltipMode)}</span>
              </p>
              <p className="mt-1 text-[11px] font-medium text-stone-600">
                {TEXT.previousStoreCount} <span className="font-semibold text-stone-900">{formatStoreCount(metric.previousStoreCount, storeTooltipMode)}</span>
                <span className={`ml-2 ${valueTone(previousStoreCountYoy)}`}>YOY {formatYoyRate(previousStoreCountYoy)}</span>
              </p>
              <p className="mt-1 text-[11px] font-medium text-stone-600">
                {TEXT.twoYearStoreCount} <span className="font-semibold text-stone-900">{formatStoreCount(metric.twoYearStoreCount, storeTooltipMode)}</span>
                <span className={`ml-2 ${valueTone(storeCountYoyTwo)}`}>{TEXT.yoyTwo} {formatYoyRate(storeCountYoyTwo)}</span>
              </p>
            </div>
          </div>
        ) : (
          <span>{TEXT.yoyPrev} {formatYoyRate(metric.yoyPrev)}</span>
        )}
      </div>
      <div className={`mt-1 text-center text-[9px] ${valueTone(metric.yoyTwo)}`}>{TEXT.yoyTwo} {formatYoyRate(metric.yoyTwo)}</div>
    </div>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-stone-500">
        {message}
      </td>
    </tr>
  );
}

function getLatestYear(period: string | undefined) {
  if (!period) return new Date().getFullYear();
  const [year] = period.split("-");
  return Number(year) || new Date().getFullYear();
}

function formatPeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseActualPeriod(value: string | undefined, fallbackMonth: number) {
  if (!value) return { year: null as number | null, month: fallbackMonth };
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return { year: null as number | null, month: fallbackMonth };
  const month = Number(match[2]);
  if (month < 1 || month > 12) return { year: Number(match[1]) || null, month: fallbackMonth };
  return { year: Number(match[1]) || null, month };
}

function formatPeriodOptionLabel(year: number, month: number) {
  const shortYear = String(year).slice(-2);
  return `${shortYear}년 ${month}월`;
}

function formatMonthHeaderLabel(month: number, selectedMonth: number) {
  return month > selectedMonth ? `${month}월 (e)` : `${month}월`;
}

function getStoreCountry(regionKey: string, storeCode: string, fallbackCountry: string) {
  if (regionKey !== "HKMC") return fallbackCountry;
  if (["MC1", "MC2", "MC3", "MC4", "W01"].includes(storeCode)) return "마카오";
  return "홍콩";
}

function getChannelHighlightLabel(row: TableRow) {
  if (row.country === "마카오") return "마카오";
  if (row.country === "홍콩" && row.channel === "리테일") return "홍콩 리테일";
  if (row.country === "홍콩" && row.channel === "아울렛") return "홍콩 아울렛";
  if (row.country === "홍콩" && row.channel === "온라인") return "홍콩 온라인";
  return `${row.country} ${row.channel}`.trim();
}

function getChannelCardOrder(channel: string) {
  if (channel === "홍콩 리테일") return 0;
  if (channel === "홍콩 아울렛") return 1;
  if (channel === "홍콩 온라인") return 2;
  if (channel === "마카오") return 3;
  return 99;
}

function getCountryOrder(regionKey: string, groups: Map<string, TableRow[]>) {
  if (regionKey === "HKMC") return ["홍콩", "마카오"];
  return Array.from(groups.keys());
}

function getSortValue(row: TableRow, sortMonth: number, viewMode: ViewMode) {
  const metric = row.months[sortMonth - 1];
  if (!metric) return Number.NEGATIVE_INFINITY;
  const value = viewMode === "yoy" ? metric.yoyPrev : metric.sales;
  return value == null || Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
}

function sortRowsForMonth(rows: TableRow[], sortMonth: number | null, sortDirection: SortDirection, viewMode: ViewMode) {
  if (sortMonth == null) return rows;
  return [...rows].sort((a, b) => {
    const rawDiff = getSortValue(b, sortMonth, viewMode) - getSortValue(a, sortMonth, viewMode);
    const diff = sortDirection === "desc" ? rawDiff : -rawDiff;
    if (diff !== 0) return diff;
    return a.storeName.localeCompare(b.storeName);
  });
}

function monthHeaderTone(month: number, selectedMonth: number) {
  if (month === selectedMonth) return "bg-amber-200/80 text-stone-900";
  if (month < selectedMonth) return "bg-amber-50/90";
  return "";
}

function monthCellTone(month: number, selectedMonth: number) {
  if (month === selectedMonth) return "bg-amber-100/90";
  if (month < selectedMonth) return "bg-amber-50/55";
  return "";
}

function formatYoyRate(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Math.round((1 + value) * 100)}%`;
}

function formatSalesCell(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatStoreCount(value: number | null | undefined, mode?: StoreTooltipMode) {
  if (value == null || Number.isNaN(value)) return "-";
  const useSingleDecimal = mode === "ytd" || mode === "annual";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: useSingleDecimal ? 1 : 0,
    maximumFractionDigits: useSingleDecimal ? 1 : 1,
  }).format(value) + "개";
}

function calculateStoreCountChange(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null || Number.isNaN(current) || Number.isNaN(previous) || previous === 0) {
    return null;
  }
  return current / previous - 1;
}

function calculateAverageStoreCount(source: Record<string, number>, year: number, monthLimit: number) {
  let activeMonths = 0;
  let hasValue = false;

  for (let month = 1; month <= monthLimit; month += 1) {
    const value = source[formatPeriod(year, month)];
    if (value == null) continue;
    hasValue = true;
    if (value > 0) {
      activeMonths += 1;
    }
  }

  if (!hasValue) return null;
  return activeMonths / monthLimit;
}

function formatMetricComparison(yoyPrev: number | null | undefined, yoyTwo: number | null | undefined) {
  if ((yoyPrev == null || Number.isNaN(yoyPrev)) && (yoyTwo == null || Number.isNaN(yoyTwo))) {
    return null;
  }

  const parts: string[] = [];
  if (yoyPrev != null && !Number.isNaN(yoyPrev)) {
    parts.push(`YOY ${formatYoyRate(yoyPrev)}`);
  }
  if (yoyTwo != null && !Number.isNaN(yoyTwo)) {
    parts.push(`전전년비 ${formatYoyRate(yoyTwo)}`);
  }
  return parts.join(", ");
}

function renderMetricComparison(yoyPrev: number | null | undefined, yoyTwo: number | null | undefined): ReactNode | null {
  if ((yoyPrev == null || Number.isNaN(yoyPrev)) && (yoyTwo == null || Number.isNaN(yoyTwo))) {
    return null;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {yoyPrev != null && !Number.isNaN(yoyPrev) ? (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${pillTone(yoyPrev)}`}>YOY {formatYoyRate(yoyPrev)}</span>
      ) : null}
      {yoyTwo != null && !Number.isNaN(yoyTwo) ? (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${pillTone(yoyTwo)}`}>전전년비 {formatYoyRate(yoyTwo)}</span>
      ) : null}
    </span>
  );
}

function renderCardComparison(channel: string, yoyPrev: number | null | undefined, yoyTwo: number | null | undefined): ReactNode | null {
  return renderMetricComparison(yoyPrev, yoyTwo);
}

function renderTrendBadge(label: string, tone: "stone" | "metric" = "metric", value?: number | null) {
  if (tone === "stone") {
    return <span className="inline-flex rounded-full bg-stone-900 px-2.5 py-1 text-[12px] font-semibold text-white">{label}</span>;
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${pillTone(value)}`}>{label}</span>;
}

function renderTrendMetricBadge(label: string, value: number | null | undefined) {
  return renderTrendBadge(`${label} ${formatYoyRate(value)}`, "metric", value);
}

function topicParticle(text: string) {
  const lastChar = text.charCodeAt(text.length - 1);
  const hangulBase = 0xac00;
  const hangulEnd = 0xd7a3;
  if (Number.isNaN(lastChar) || lastChar < hangulBase || lastChar > hangulEnd) {
    return "은";
  }
  return (lastChar - hangulBase) % 28 === 0 ? "는" : "은";
}

function formatCardBasis(selectedMonth: number, mode: CardMetricMode) {
  return mode === "month" ? `${selectedMonth}월 기준` : `${selectedMonth}월 누적 기준`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function valueTone(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "text-stone-400";
  return value >= 0 ? "text-emerald-700" : "text-red-600";
}

function pillTone(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "bg-stone-100 text-stone-600";
  return value >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
}
