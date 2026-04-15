"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

type CellMetric = {
  sales: number | null;
  previousSales: number | null;
  twoYearSales: number | null;
  tagSales: number | null;
  tagPreviousSales: number | null;
  tagTwoYearSales: number | null;
  yoyPrev: number | null;
  yoyTwo: number | null;
  storeCount: number | null;
  previousStoreCount: number | null;
  twoYearStoreCount: number | null;
};

type DiscountSummary = {
  rate: number | null;
  deltaPp: number | null;
};

type MonthMetric = CellMetric & {
  month: number;
};

type RowKind = "overall-total" | "country-total" | "brand-total" | "channel-total" | "store";
type ViewMode = "yoy" | "sales";
type TableBasisMode = "sales" | "perStore" | "tag";
type TrendTableMode = "sales" | "profit";
type SortDirection = "desc" | "asc";
type CardMetricMode = "month" | "ytd" | "annual";
type TopSummaryView = "sales" | "profit";
type StoreTooltipMode = "month" | "ytd" | "annual";
type Language = "kr" | "en";
type CurrencyMode = "HKD" | "TWD";

type ProfitBreakdownMetric = {
  tagSales: number | null;
  sales: number | null;
  previousSales: number | null;
  discountRate: number | null;
  cogs: number | null;
  grossProfit: number | null;
  previousGrossProfit: number | null;
  grossMargin: number | null;
  grossMarginDeltaPp: number | null;
  grossProfitYoy: number | null;
  directPayroll: number | null;
  directRent: number | null;
  directOther: number | null;
  directProfit: number | null;
  previousDirectProfit: number | null;
  directMargin: number | null;
  directMarginDeltaPp: number | null;
  directProfitYoy: number | null;
  operatingPayroll: number | null;
  operatingRent: number | null;
  advertising: number | null;
  operatingOther: number | null;
  operatingProfit: number | null;
  previousOperatingProfit: number | null;
  operatingMargin: number | null;
  operatingMarginDeltaPp: number | null;
  operatingProfitYoy: number | null;
  directOtherDetails: Record<string, number>;
  operatingOtherDetails: Record<string, number>;
};

type MonthlyProfitTrendPoint = {
  month: number;
  sales: number | null;
  grossProfit: number | null;
  directProfit: number | null;
  operatingProfit: number | null;
};

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

type ProfitTrendMetric = {
  value: number | null;
  previousValue: number | null;
  twoYearValue: number | null;
  yoyPrev: number | null;
  yoyTwo: number | null;
  salesBase: number | null;
  previousSalesBase: number | null;
  twoYearSalesBase: number | null;
  margin: number | null;
};

type ProfitTableRow = {
  kind: RowKind;
  country: string;
  brand: string;
  channel: string;
  storeName: string;
  rowKey: string;
  toggleKey?: string;
  months: Array<ProfitTrendMetric & { month: number }>;
  ytd: ProfitTrendMetric;
  annual: ProfitTrendMetric;
};

const TEXT = {
  emptyRegion: "표시할 리전 데이터가 없습니다.",
  title: "홍마대 매장별 추세",
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
  salesBasis: "실판매출 기준",
  perStoreBasis: "점당매출기준",
  tagBasis: "택가매출 기준",
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

const TEXT_EN = {
  emptyRegion: "No region data available.",
  title: "HKMCTW Store Trend",
  intro: "Shows all 12 months, selected-month YTD, annual totals, and channel summaries in one view.",
  period: "Base Month",
  baseYear: "Base Year",
  channelTopSales: "Top Sales",
  channelTopYoy: "Top YOY",
  topYoY: "Top YOY Store",
  topSales: "Top Sales Store",
  noData: "No data",
  ytdBasisSuffix: "YTD Basis",
  annualTable: "Store Sales Trend",
  ytdRight: "A YTD column appears right after the selected month.",
  country: "Cntry",
  brand: "Brand",
  channel: "Ch.",
  store: "Store",
  annualTotal: "Annual",
  overallTotal: "Total",
  countryTotal: "Cntry Tot.",
  brandTotal: "Brand Tot.",
  channelTotal: "Ch. Tot.",
  viewYoy: "YOY Only",
  viewSales: "Sales View",
  expandAll: "Expand",
  collapseAll: "Collapse",
  unit: "Unit : 1k HKD",
  emptyRows: "No monthly store data available.",
  yoyPrev: "YOY",
  yoyTwo: "vs 2YA",
  salesBasis: "Net Sales Basis",
  perStoreBasis: "Sales/Store Basis",
  tagBasis: "Tag Sales Basis",
  storeCount: "Store Cnt",
  previousStoreCount: "Prev Store Cnt",
  twoYearStoreCount: "2YA Store Cnt",
  ytdAverageStoreCount: "YTD Avg Store Cnt",
  annualAverageStoreCount: "Annual Avg Store Cnt",
  storeCountYoy: "Store Cnt YOY",
  storeCountTwoYear: "Store Cnt vs 2YA",
  expand: "Expand",
  collapse: "Collapse",
  storeDrilldown: "Store Drilldown",
} as const;

const EXTRA_TEXT = {
  kr: {
    monthMode: "당월",
    ytdMode: "누적",
    annualMode: "연간",
    salesValueLabel: "실판매출",
    tagSalesLabel: "택가매출",
    perStoreSalesLabel: "점당매출",
    perStoreHint: "실판매출 / 매장수",
    dataStructureButton: "데이터구조",
    updatedAt: "Updated",
    trendSummaryLabel: "Trend Summary",
    trendSummaryTitle: "현재 현황과 추세",
    dataStructureLabel: "Data Structure",
    dataStructureTitle: "데이터구조",
    dataStructureIntro: "이 화면에서 어떤 값이 SQL actual이고, 어디부터 Excel forecast인지 기준월 기준으로 정리했습니다.",
    close: "닫기",
    finalUpdateLog: "최종 업데이트 로그",
    basePeriod: "기준월",
    ruleBasis: "설명 기준",
    ruleBasisValue: "SQL actual + Excel forecast 병합 + TW 환율/할인율 규칙 기준",
    discountRate: "할인율",
    monthPerStoreFormula: "월 점당매출 계산식",
    ytdPerStoreFormula: "YTD 가중평균월평균점당매출 계산식",
    annualPerStoreFormula: "연간 가중평균월평균점당매출 계산식",
    formulaDescriptionMonth: "당월 매출을 당월 매장수로 나눕니다.",
    formulaDescriptionAggregate: "월별 매출 합계를 월별 매장수 합계로 나눈 가중평균 방식입니다.",
    formulaExpression: "계산식",
    salesTotal: "매출합계",
    langKr: "KR",
    langEn: "EN",
  },
  en: {
    monthMode: "Month",
    ytdMode: "YTD",
    annualMode: "Annual",
    salesValueLabel: "Net Sales",
    tagSalesLabel: "Tag Sales",
    perStoreSalesLabel: "Sales/Store",
    perStoreHint: "Net / Store",
    dataStructureButton: "Data Map",
    updatedAt: "Updated",
    trendSummaryLabel: "Trend Summary",
    trendSummaryTitle: "Current Snapshot",
    dataStructureLabel: "Data Structure",
    dataStructureTitle: "Data Structure",
    dataStructureIntro: "This view explains which values come from SQL actuals and where Excel forecast begins, based on the selected month.",
    close: "Close",
    finalUpdateLog: "Update Log",
    basePeriod: "Base Period",
    ruleBasis: "Rule Basis",
    ruleBasisValue: "SQL actual + Excel forecast merge + TW FX/discount rules",
    discountRate: "Disc. Rate",
    monthPerStoreFormula: "Monthly sales/store formula",
    ytdPerStoreFormula: "YTD weighted avg sales/store formula",
    annualPerStoreFormula: "Annual weighted avg sales/store formula",
    formulaDescriptionMonth: "Monthly sales divided by monthly store count.",
    formulaDescriptionAggregate: "Weighted average based on monthly sales totals divided by monthly store-count totals.",
    formulaExpression: "Formula",
    salesTotal: "Sales Total",
    langKr: "KR",
    langEn: "EN",
  },
} as const;

const BRAND_LABELS_EN: Record<string, string> = {
  ALL: "All",
  M: "MLB",
  X: "DX",
};

const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

type LocaleText = Record<string, string>;

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
const PER_STORE_BASIS_LABEL = "점당매출 기준";
const PER_STORE_SALES_LABEL = "점당매출";
const TAG_BASIS_LABEL = "택가매출 기준";
const TAG_SALES_LABEL = "택가매출";
const YTD_STORE_COUNT_SUM_LABEL = "YTD 매장수 합계";
const ANNUAL_STORE_COUNT_SUM_LABEL = "연간 매장수 합계";
const TAG_SALES_ACCOUNT = "Tag\uB9E4\uCD9C\uC561";
const SALES_ACCOUNT = "\uC2E4\uB9E4\uCD9C\uC561";
const COGS_ACCOUNT = "\uB9E4\uCD9C\uC6D0\uAC00\uD569\uACC4";
const GROSS_PROFIT_ACCOUNT = "\uB9E4\uCD9C\uCD1D\uC774\uC775";
const OPERATING_PROFIT_ACCOUNT = "\uC601\uC5C5\uC774\uC775";
const PAYROLL_ACCOUNT = "1. \uAE09 \uC5EC";
const RENT_ACCOUNT = "4. \uC784\uCC28\uB8CC";
const ADVERTISING_ACCOUNT = "9. \uAD11\uACE0\uC120\uC804\uBE44";
const EXPENSE_ACCOUNT_SET = new Set([
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

export function DashboardShell({
  data,
  storeMonthlySales,
  profitCardData,
  operatingProfitSummary,
  twExchangeRates,
  initialActualPeriod,
  canEditPeriod,
  canPersistSettings,
}: {
  data: DashboardData;
  storeMonthlySales: StoreMonthlySales;
  profitCardData: ProfitCardData;
  operatingProfitSummary: OperatingProfitSummary;
  twExchangeRates: Record<string, number>;
  initialActualPeriod?: string;
  canEditPeriod: boolean;
  canPersistSettings: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const regionKeys = Object.keys(data.regions).filter((key) => data.regions[key]);
  const initialRegionKey = regionKeys[0] ?? "HKMC";
  const initialPeriod = parseActualPeriod(initialActualPeriod, DEFAULT_SELECTED_MONTH);
  const [regionKey, setRegionKey] = useState(initialRegionKey);
  const [selectedBrand, setSelectedBrand] = useState("M");
  const [selectedMonth, setSelectedMonth] = useState(initialPeriod.month);
  const [cardMetricMode, setCardMetricMode] = useState<CardMetricMode>("month");
  const PROFIT_VIEW_ENABLED = false;
  const [topSummaryView, setTopSummaryView] = useState<TopSummaryView>("sales");
  const [expandedChannels, setExpandedChannels] = useState<Record<string, boolean>>({});
  const [expandedProfitBreakdowns, setExpandedProfitBreakdowns] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("yoy");
  const [tableBasisMode, setTableBasisMode] = useState<TableBasisMode>("sales");
  const [trendTableMode, setTrendTableMode] = useState<TrendTableMode>("sales");
  const [showDataStructureModal, setShowDataStructureModal] = useState(false);
  const [sortMonth, setSortMonth] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [language, setLanguage] = useState<Language>("kr");
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>("HKD");
  const [editableTwExchangeRates, setEditableTwExchangeRates] = useState(twExchangeRates);
  const [showRateEditor, setShowRateEditor] = useState(false);
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [isSavingRates, setIsSavingRates] = useState(false);
  const text = useMemo<LocaleText>(() => (language === "en" ? { ...TEXT_EN, ...EXTRA_TEXT.en } : { ...TEXT, ...EXTRA_TEXT.kr }), [language]);

  const region = data.regions[regionKey];
  const latestYear = initialPeriod.year ?? getLatestYear(region?.latestPeriod);
  const storeRows = region?.storeYoyMultiYear ?? [];
  const rawRegionSales = storeMonthlySales[regionKey] ?? {};
  const rawRegionProfit = profitCardData[regionKey] ?? {};
  const rawOperatingProfitSummary = operatingProfitSummary[regionKey] ?? {};
  const countryLabel = REGION_LABELS[regionKey] ?? regionKey;
  const effectiveCurrencyMode: CurrencyMode = regionKey === "TW" ? currencyMode : "HKD";
  const currencyUnitLabel = effectiveCurrencyMode === "TWD" ? "1k TWD" : "1k HKD";
  const editableRateKeys = useMemo(() => MONTH_OPTIONS.map((month) => `${String(latestYear).slice(-2)}${String(month).padStart(2, "0")}`), [latestYear]);
  const selectedTwRate = useMemo(() => {
    if (regionKey !== "TW") return null;
    return resolveTwRate(formatPeriod(latestYear, selectedMonth), editableTwExchangeRates, latestYear);
  }, [editableTwExchangeRates, latestYear, regionKey, selectedMonth]);
  const regionSales = useMemo(() => {
    if (regionKey !== "TW" || effectiveCurrencyMode === "HKD") return rawRegionSales;

    return Object.fromEntries(
      Object.entries(rawRegionSales).map(([storeCode, store]) => {
        const monthlySales = convertSalesMapToTwd(store.monthlySales, editableTwExchangeRates, latestYear);
        const monthlyTagSales = convertSalesMapToTwd(store.monthlyTagSales, editableTwExchangeRates, latestYear);

        return [
          storeCode,
          {
            ...store,
            monthlySales,
            annualTotals: buildAnnualTotals(monthlySales),
            monthlyTagSales,
            annualTagTotals: buildAnnualTotals(monthlyTagSales),
          },
        ];
      }),
    );
  }, [editableTwExchangeRates, effectiveCurrencyMode, latestYear, rawRegionSales, regionKey]);
  const regionProfit = useMemo(() => {
    if (regionKey !== "TW" || effectiveCurrencyMode === "HKD") return rawRegionProfit;

    return Object.fromEntries(
      Object.entries(rawRegionProfit).map(([storeCode, store]) => [
        storeCode,
        {
          ...store,
          accounts: convertProfitAccountsToTwd(store.accounts, editableTwExchangeRates, latestYear),
        },
      ]),
    );
  }, [editableTwExchangeRates, effectiveCurrencyMode, latestYear, rawRegionProfit, regionKey]);
  const selectedOperatingProfitSummary = useMemo(() => {
    const brandKey = selectedBrand === "ALL" ? "ALL" : selectedBrand;
    return rawOperatingProfitSummary[brandKey] ?? rawOperatingProfitSummary.ALL ?? { monthlyOperatingProfit: {}, monthlySales: {} };
  }, [rawOperatingProfitSummary, selectedBrand]);
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
    setSelectedMonth(initialPeriod.month);
  }, [initialPeriod.month]);

  useEffect(() => {
    setEditableTwExchangeRates(twExchangeRates);
  }, [twExchangeRates]);

  useEffect(() => {
    if (availableBrands.length === 0) return;
    if (!availableBrands.includes(selectedBrand)) {
      setSelectedBrand(availableBrands.includes("M") ? "M" : availableBrands[0]);
      setExpandedChannels({});
      setExpandedProfitBreakdowns({});
      setSortMonth(null);
      setSortDirection("desc");
    }
  }, [availableBrands, selectedBrand]);

  const periodOptions = useMemo(() => {
    return MONTH_OPTIONS.map((month) => ({
      value: month,
      label: formatPeriodOptionLabel(latestYear, month, language),
    }));
  }, [latestYear]);

  async function handleActualPeriodChange(nextMonth: number) {
    setSelectedMonth(nextMonth);
    const nextActualPeriod = formatPeriod(latestYear, nextMonth);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("actualPeriod", nextActualPeriod);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });

    if (!canPersistSettings) return;

    await fetch("/api/store-view-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualPeriod: nextActualPeriod }),
    });
  }

  function openRateEditor() {
    const nextDrafts = Object.fromEntries(
      editableRateKeys.map((key) => [key, (editableTwExchangeRates[key] ?? 0).toFixed(4)]),
    );
    setRateDrafts(nextDrafts);
    setShowRateEditor(true);
  }

  async function handleRateSave() {
    const nextRates = Object.fromEntries(
      editableRateKeys.map((key) => [key, Number(rateDrafts[key])]),
    );

    if (Object.values(nextRates).some((value) => !Number.isFinite(value) || value <= 0)) {
      window.alert("Enter valid positive monthly rates.");
      return;
    }

    const mergedRates = { ...editableTwExchangeRates, ...nextRates };
    setIsSavingRates(true);

    try {
      const response = await fetch("/api/store-view-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twExchangeRates: mergedRates }),
      });

      if (!response.ok) {
        throw new Error("failed_to_save_rates");
      }

      setEditableTwExchangeRates(mergedRates);
      setShowRateEditor(false);
    } finally {
      setIsSavingRates(false);
    }
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
          ...createMetricCell(salesSource.monthlySales, salesSource.monthlyTagSales, latestYear, month),
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
          ytd: createYtdMetric(salesSource.monthlySales, salesSource.monthlyTagSales, latestYear, selectedMonth),
          annual: createAnnualMetric(salesSource.annualTotals, salesSource.annualTagTotals, salesSource.monthlySales, latestYear),
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
        storeName: text.overallTotal,
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
          storeName: text.countryTotal,
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
            storeName: text.brandTotal,
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
              storeName: text.channelTotal,
              rowKey: `${toggleKey}-channel-total`,
              toggleKey,
            }),
          );

          if (expandedChannels[toggleKey] ?? false) {
            rows.push(...sortRowsForMonth(channelRows, sortMonth, sortDirection, viewMode, tableBasisMode));
          }
        }
      }
    }

    return rows;
  }, [countryLabel, expandedChannels, regionKey, sortDirection, sortMonth, tableBasisMode, tableRows, text, viewMode]);

  const unitBasisLabel = getBasisLabel(tableBasisMode, language);

  const toggleAllChannels = () => {
    setExpandedChannels(Object.fromEntries(channelKeys.map((key) => [key, !allExpanded])));
  };

  const storeOnlyRows = tableRows;
  const getCardMetric = useMemo(
    () => (row: TableRow) => (cardMetricMode === "month" ? row.months[selectedMonth - 1] : cardMetricMode === "annual" ? row.annual : row.ytd),
    [cardMetricMode, selectedMonth],
  );
  const overallCardMetric = useMemo(() => aggregateMetricCells(storeOnlyRows.map((row) => getCardMetric(row))), [getCardMetric, storeOnlyRows]);
  const overallTopSalesStore = useMemo(
    () =>
      storeOnlyRows.reduce<{ storeName: string; sales: number; yoyPrev: number | null } | null>((best, row) => {
        const metric = getCardMetric(row);
        const displayMetric = getDisplayMetric(metric, tableBasisMode);
        const sales = displayMetric.sales;
        if (sales == null) return best;
        if (!best || sales > best.sales) {
          return {
            storeName: row.storeName,
            sales,
            yoyPrev: displayMetric.yoyPrev,
          };
        }
        return best;
      }, null),
    [getCardMetric, storeOnlyRows, tableBasisMode],
  );
  const overallCardDisplayMetric = useMemo(() => getDisplayMetric(overallCardMetric, tableBasisMode), [overallCardMetric, tableBasisMode]);
  const discountVatFactor = regionKey === "TW" ? 1.05 : 1;
  const overallCardDiscountSummary = useMemo(() => getDiscountSummary(overallCardMetric, discountVatFactor), [discountVatFactor, overallCardMetric]);
  const overallCardTitle = useMemo(() => {
    if (language === "en") {
      if (regionKey === "HKMC") return "HK+Macau Total";
      if (regionKey === "TW") return "Taiwan Total";
      return `${countryLabel} Total`;
    }
    if (regionKey === "HKMC") return "홍콩마카오 합계";
    if (regionKey === "TW") return "대만 전체";
    return `${countryLabel} 전체`;
  }, [countryLabel, language, regionKey]);

  const channelHighlights = useMemo(() => {
    const grouped = new Map<string, TableRow[]>();
    for (const row of storeOnlyRows) {
      const groupLabel = getChannelHighlightLabel(row);
      const rows = grouped.get(groupLabel) ?? [];
      rows.push(row);
      grouped.set(groupLabel, rows);
    }

    return Array.from(grouped.entries()).map(([channel, rows]) => {
      const metrics = rows.map((row) => {
        const metric = getCardMetric(row);
        const displayMetric = getDisplayMetric(metric, tableBasisMode);
        return { row, metric, displayMetric };
      });
      const channelMetric = aggregateMetricCells(metrics.map((entry) => entry.metric));
      const displayChannelMetric = getDisplayMetric(channelMetric, tableBasisMode);
      const topYoy = metrics.reduce<{ storeName: string; value: number; yoyTwo: number | null } | null>((best, entry) => {
        const value = entry.displayMetric.yoyPrev;
        if (value == null) return best;
        if (!best || value > best.value) {
          return { storeName: entry.row.storeName, value, yoyTwo: entry.displayMetric.yoyTwo };
        }
        return best;
      }, null);

      const topSales = metrics.reduce<{ storeName: string; value: number; yoyPrev: number | null; yoyTwo: number | null } | null>((best, entry) => {
        const value = entry.displayMetric.sales;
        if (value == null) return best;
        if (!best || value > best.value) {
          return { storeName: entry.row.storeName, value, yoyPrev: entry.displayMetric.yoyPrev, yoyTwo: entry.displayMetric.yoyTwo };
        }
        return best;
      }, null);

      const discountSummary = getDiscountSummary(channelMetric, discountVatFactor);
      return { channel, channelMetric, displayChannelMetric, topYoy, topSales, discountSummary };
    }).sort((a, b) => getChannelCardOrder(a.channel) - getChannelCardOrder(b.channel) || a.channel.localeCompare(b.channel));
  }, [discountVatFactor, getCardMetric, storeOnlyRows, tableBasisMode]);

  const filteredProfitStores = useMemo(
    () => Object.values(regionProfit).filter((store) => selectedBrand === "ALL" || store.brand === selectedBrand),
    [regionProfit, selectedBrand],
  );
  const profitTableRows = useMemo<ProfitTableRow[]>(() => {
    return filteredProfitStores
      .map((store, index) => {
        const rowCountry = regionKey === "HKMC" ? (store.country === "MC" ? "마카오" : "홍콩") : countryLabel;
        const toggleKey = `${rowCountry}__${store.brand}__${store.channel}`;
        const priorYearStore = buildProfitMetricForStore(store, latestYear - 1, selectedMonth, cardMetricMode, discountVatFactor);

        return {
          kind: "store" as const,
          country: rowCountry,
          brand: store.brand,
          channel: store.channel,
          storeName: store.storeName,
          rowKey: `profit-${store.brand}-${store.channel}-${store.storeName}-${index}`,
          toggleKey,
          months: MONTH_OPTIONS.map((month) => {
            const current = buildProfitMetricForStore(store, latestYear, month, "month", discountVatFactor);
            const prevYear = buildProfitMetricForStore(store, latestYear - 1, month, "month", discountVatFactor);
            return {
              month,
              ...createProfitTrendMetric(
                current.directProfit,
                current.previousDirectProfit,
                prevYear.previousDirectProfit,
                current.sales,
                current.previousSales,
                prevYear.previousSales,
              ),
            };
          }),
          ytd: createProfitTrendMetric(
            buildProfitMetricForStore(store, latestYear, selectedMonth, "ytd", discountVatFactor).directProfit,
            buildProfitMetricForStore(store, latestYear, selectedMonth, "ytd", discountVatFactor).previousDirectProfit,
            buildProfitMetricForStore(store, latestYear - 1, selectedMonth, "ytd", discountVatFactor).previousDirectProfit,
            buildProfitMetricForStore(store, latestYear, selectedMonth, "ytd", discountVatFactor).sales,
            buildProfitMetricForStore(store, latestYear, selectedMonth, "ytd", discountVatFactor).previousSales,
            buildProfitMetricForStore(store, latestYear - 1, selectedMonth, "ytd", discountVatFactor).previousSales,
          ),
          annual: createProfitTrendMetric(
            buildProfitMetricForStore(store, latestYear, 12, "annual", discountVatFactor).directProfit,
            buildProfitMetricForStore(store, latestYear, 12, "annual", discountVatFactor).previousDirectProfit,
            priorYearStore.previousDirectProfit,
            buildProfitMetricForStore(store, latestYear, 12, "annual", discountVatFactor).sales,
            buildProfitMetricForStore(store, latestYear, 12, "annual", discountVatFactor).previousSales,
            priorYearStore.previousSales,
          ),
        };
      })
      .sort((a, b) => {
        if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
        if (a.channel !== b.channel) return a.channel.localeCompare(b.channel);
        return a.storeName.localeCompare(b.storeName);
      });
  }, [cardMetricMode, countryLabel, discountVatFactor, filteredProfitStores, latestYear, regionKey, selectedMonth]);
  const visibleProfitRows = useMemo<ProfitTableRow[]>(() => {
    if (profitTableRows.length === 0) return [];

    const rows: ProfitTableRow[] = [];
    rows.push(
      createProfitSummaryRow("overall-total", profitTableRows, {
        country: "전체",
        brand: "-",
        channel: "-",
        storeName: text.overallTotal,
        rowKey: `${countryLabel}-profit-overall-total`,
      }),
    );

    const countryGroups = new Map<string, ProfitTableRow[]>();
    for (const row of profitTableRows) {
      const group = countryGroups.get(row.country) ?? [];
      group.push(row);
      countryGroups.set(row.country, group);
    }

    for (const country of getCountryOrder(regionKey, countryGroups as unknown as Map<string, TableRow[]>)) {
      const countryRows = countryGroups.get(country) ?? [];
      rows.push(
        createProfitSummaryRow("country-total", countryRows, {
          country,
          brand: "-",
          channel: "-",
          storeName: text.countryTotal,
          rowKey: `${country}-profit-country-total`,
        }),
      );

      const brandGroups = new Map<string, ProfitTableRow[]>();
      for (const row of countryRows) {
        const group = brandGroups.get(row.brand) ?? [];
        group.push(row);
        brandGroups.set(row.brand, group);
      }

      for (const [brand, brandRows] of brandGroups.entries()) {
        rows.push(
          createProfitSummaryRow("brand-total", brandRows, {
            country,
            brand,
            channel: "-",
            storeName: text.brandTotal,
            rowKey: `${country}-${brand}-profit-brand-total`,
          }),
        );

        const channelGroups = new Map<string, ProfitTableRow[]>();
        for (const row of brandRows) {
          const group = channelGroups.get(row.channel) ?? [];
          group.push(row);
          channelGroups.set(row.channel, group);
        }

        for (const [channel, channelRows] of channelGroups.entries()) {
          const toggleKey = `${country}__${brand}__${channel}`;
          rows.push(
            createProfitSummaryRow("channel-total", channelRows, {
              country,
              brand,
              channel,
              storeName: text.channelTotal,
              rowKey: `${toggleKey}-profit-channel-total`,
              toggleKey,
            }),
          );

          if (expandedChannels[toggleKey] ?? false) {
            rows.push(...sortProfitRowsForMonth(channelRows, sortMonth, sortDirection, viewMode));
          }
        }
      }
    }

    return rows;
  }, [countryLabel, expandedChannels, profitTableRows, regionKey, sortDirection, sortMonth, text, viewMode]);
  const overallOperatingExpenseMetrics = useMemo(() => {
    const byMode = (month: number, mode: CardMetricMode) =>
      aggregateProfitMetrics(filteredProfitStores.map((store) => buildProfitMetricForStore(store, latestYear, month, mode, discountVatFactor)), discountVatFactor);
    return {
      months: MONTH_OPTIONS.map((month) => {
        const current = byMode(month, "month");
        const previous = aggregateProfitMetrics(
          filteredProfitStores.map((store) => buildProfitMetricForStore(store, latestYear - 1, month, "month", discountVatFactor)),
          discountVatFactor,
        );
        return {
          month,
          ...createProfitTrendMetric(
            getOperatingExpenseValue(current),
            negateNullable(sumProfitValues(current.operatingPayroll, current.operatingRent, current.advertising, current.operatingOther)),
            previous ? getOperatingExpenseValue(previous) : null,
            current.sales,
            current.previousSales,
            previous.sales,
          ),
        };
      }),
      ytd: (() => {
        const current = byMode(selectedMonth, "ytd");
        const previous = aggregateProfitMetrics(
          filteredProfitStores.map((store) => buildProfitMetricForStore(store, latestYear - 1, selectedMonth, "ytd", discountVatFactor)),
          discountVatFactor,
        );
        return createProfitTrendMetric(
          getOperatingExpenseValue(current),
          negateNullable(sumProfitValues(current.operatingPayroll, current.operatingRent, current.advertising, current.operatingOther)),
          previous ? getOperatingExpenseValue(previous) : null,
          current.sales,
          current.previousSales,
          previous.sales,
        );
      })(),
      annual: (() => {
        const current = byMode(12, "annual");
        const previous = aggregateProfitMetrics(
          filteredProfitStores.map((store) => buildProfitMetricForStore(store, latestYear - 1, 12, "annual", discountVatFactor)),
          discountVatFactor,
        );
        return createProfitTrendMetric(
          getOperatingExpenseValue(current),
          negateNullable(sumProfitValues(current.operatingPayroll, current.operatingRent, current.advertising, current.operatingOther)),
          previous ? getOperatingExpenseValue(previous) : null,
          current.sales,
          current.previousSales,
          previous.sales,
        );
      })(),
    };
  }, [discountVatFactor, filteredProfitStores, latestYear, selectedMonth]);
  const overallOperatingProfitMetrics = useMemo(() => {
    const byMode = (year: number, month: number, mode: CardMetricMode) =>
      createProfitTrendMetric(
        sumAccountPeriods(selectedOperatingProfitSummary.monthlyOperatingProfit, year, month, mode),
        sumAccountPeriods(selectedOperatingProfitSummary.monthlyOperatingProfit, year - 1, month, mode),
        sumAccountPeriods(selectedOperatingProfitSummary.monthlyOperatingProfit, year - 2, month, mode),
        sumAccountPeriods(selectedOperatingProfitSummary.monthlySales, year, month, mode),
        sumAccountPeriods(selectedOperatingProfitSummary.monthlySales, year - 1, month, mode),
        sumAccountPeriods(selectedOperatingProfitSummary.monthlySales, year - 2, month, mode),
      );
    return {
      months: MONTH_OPTIONS.map((month) => ({ month, ...byMode(latestYear, month, "month") })),
      ytd: byMode(latestYear, selectedMonth, "ytd"),
      annual: byMode(latestYear, 12, "annual"),
    };
  }, [latestYear, selectedMonth, selectedOperatingProfitSummary]);
  const overallProfitMetric = useMemo(
    () => aggregateProfitMetrics(filteredProfitStores.map((store) => buildProfitMetricForStore(store, latestYear, selectedMonth, cardMetricMode, discountVatFactor)), discountVatFactor),
    [cardMetricMode, discountVatFactor, filteredProfitStores, latestYear, selectedMonth],
  );
  const profitChannelSummaries = useMemo(() => {
    return channelHighlights.map((item) => {
      const stores = filteredProfitStores.filter((store) => getProfitChannelHighlightLabel(store.country, store.channel) === item.channel);
      return {
        channel: item.channel,
        metric: aggregateProfitMetrics(stores.map((store) => buildProfitMetricForStore(store, latestYear, selectedMonth, cardMetricMode, discountVatFactor)), discountVatFactor),
      };
    });
  }, [cardMetricMode, channelHighlights, discountVatFactor, filteredProfitStores, latestYear, selectedMonth]);
  const monthlyProfitTrend = useMemo<MonthlyProfitTrendPoint[]>(
    () =>
      MONTH_OPTIONS.map((month) => {
        const metric = aggregateProfitMetrics(
          filteredProfitStores.map((store) => buildProfitMetricForStore(store, latestYear, month, "month", discountVatFactor)),
          discountVatFactor,
        );

        return {
          month,
          sales: metric.sales,
          grossProfit: metric.grossProfit,
          directProfit: metric.directProfit,
          operatingProfit: metric.operatingProfit,
        };
      }),
    [discountVatFactor, filteredProfitStores, latestYear],
  );

  const trendSummary = useMemo(() => {
    const strongestGrowth = channelHighlights
      .filter((item) => item.displayChannelMetric.yoyPrev != null)
      .sort((a, b) => (b.displayChannelMetric.yoyPrev ?? Number.NEGATIVE_INFINITY) - (a.displayChannelMetric.yoyPrev ?? Number.NEGATIVE_INFINITY))[0];
    const strongestRecovery = channelHighlights
      .filter((item) => item.displayChannelMetric.yoyTwo != null)
      .sort((a, b) => (b.displayChannelMetric.yoyTwo ?? Number.NEGATIVE_INFINITY) - (a.displayChannelMetric.yoyTwo ?? Number.NEGATIVE_INFINITY))[0];
    const softestRecovery = channelHighlights
      .filter((item) => item.displayChannelMetric.yoyTwo != null)
      .sort((a, b) => (a.displayChannelMetric.yoyTwo ?? Number.POSITIVE_INFINITY) - (b.displayChannelMetric.yoyTwo ?? Number.POSITIVE_INFINITY))[0];

    if (language === "en") {
      const basisLabel = cardMetricMode === "month"
        ? `${MONTH_NAMES_EN[selectedMonth - 1]} MTD`
        : cardMetricMode === "annual"
          ? `FY ${latestYear}`
          : `YTD thru ${MONTH_NAMES_EN[selectedMonth - 1]}`;
      const lines: ReactNode[] = [
        <>
          <strong className="font-semibold text-stone-900">{basisLabel}</strong>{" "}
          <strong className="font-semibold text-stone-900">{overallCardTitle}</strong> is at{" "}
          {renderTrendBadge(formatMetricWithUnit(overallCardDisplayMetric.sales, tableBasisMode, effectiveCurrencyMode), "stone")},{" "}
          with {renderTrendMetricBadge("YOY", overallCardDisplayMetric.yoyPrev)} and{" "}
          {renderTrendMetricBadge(text.yoyTwo, overallCardDisplayMetric.yoyTwo)}.
        </>,
      ];

      if (strongestGrowth) {
        lines.push(
          <>
            <strong className="font-semibold text-stone-900">{formatChannelGroupLabel(strongestGrowth.channel, language)}</strong> shows the strongest momentum at{" "}
            {renderTrendMetricBadge("YOY", strongestGrowth.displayChannelMetric.yoyPrev)}.
          </>,
        );
      }

      if (strongestRecovery) {
        lines.push(
          <>
            The strongest recovery vs 2YA is <strong className="font-semibold text-stone-900">{formatChannelGroupLabel(strongestRecovery.channel, language)}</strong>{" "}
            at {renderTrendMetricBadge(text.yoyTwo, strongestRecovery.displayChannelMetric.yoyTwo)}.
          </>,
        );
      }

      if (softestRecovery && softestRecovery.displayChannelMetric.yoyTwo != null && softestRecovery.displayChannelMetric.yoyTwo < 0) {
        lines.push(
          <>
            <strong className="font-semibold text-stone-900">{formatChannelGroupLabel(softestRecovery.channel, language)}</strong> remains softer at{" "}
            {renderTrendMetricBadge(text.yoyTwo, softestRecovery.displayChannelMetric.yoyTwo)}, leaving more room to recover.
          </>,
        );
      }

      return lines.slice(0, 4);
    }

    const basisLabel = cardMetricMode === "month" ? `${selectedMonth}월 당월` : cardMetricMode === "annual" ? `${latestYear}년 연간` : `${selectedMonth}월 누적`;
    const lines: ReactNode[] = [
      <>
        <strong className="font-semibold text-stone-900">{basisLabel}</strong> 기준{" "}
        <strong className="font-semibold text-stone-900">{overallCardTitle}</strong> {getSalesLabel(tableBasisMode, language)}은{" "}
        {renderTrendBadge(formatMetricWithUnit(overallCardDisplayMetric.sales, tableBasisMode, effectiveCurrencyMode), "stone")}이며,{" "}
        {renderTrendMetricBadge("YOY", overallCardDisplayMetric.yoyPrev)}{" "}
        {renderTrendMetricBadge(text.yoyTwo, overallCardDisplayMetric.yoyTwo)} 흐름입니다.
      </>,
    ];

    if (strongestGrowth) {
      lines.push(
        <>
          성장 탄력은 <strong className="font-semibold text-stone-900">{strongestGrowth.channel}</strong>이 가장 강하며{" "}
          {renderTrendMetricBadge("YOY", strongestGrowth.displayChannelMetric.yoyPrev)}를 기록하고 있습니다.
        </>,
      );
    }

    if (strongestRecovery) {
      lines.push(
        <>
          전전년비 기준 회복세는 <strong className="font-semibold text-stone-900">{strongestRecovery.channel}</strong>이 가장 두드러지며{" "}
          {renderTrendMetricBadge(text.yoyTwo, strongestRecovery.displayChannelMetric.yoyTwo)} 수준입니다.
        </>,
      );
    }

    if (softestRecovery && softestRecovery.displayChannelMetric.yoyTwo != null && softestRecovery.displayChannelMetric.yoyTwo < 0) {
      lines.push(
        <>
          반면 <strong className="font-semibold text-stone-900">{softestRecovery.channel}</strong>{topicParticle(softestRecovery.channel)}{" "}
          {renderTrendMetricBadge(text.yoyTwo, softestRecovery.displayChannelMetric.yoyTwo)}로, 추가 회복 여지가 남아 있습니다.
        </>,
      );
    }

    return lines.slice(0, 4);
  }, [cardMetricMode, channelHighlights, effectiveCurrencyMode, language, latestYear, overallCardDisplayMetric.sales, overallCardDisplayMetric.yoyPrev, overallCardDisplayMetric.yoyTwo, overallCardTitle, selectedMonth, tableBasisMode, text.yoyTwo]);

  const dataStructureSections = useMemo(() => {
    if (language === "en") {
      return [
        {
          title: "1. Excel Source",
          items: [
            "`Store_Rawdata.xlsx` is the base forecast source.",
            "`scripts/import_store_rawdata.py` normalizes monthly and annual columns.",
            "Normalized outputs are loaded into `data/normalized/*.csv` and `data/store_dashboard.sqlite`.",
          ],
        },
        {
          title: "2. SQL Actual",
          items: [
            "`scripts/fetch_snowflake_actuals.mjs` queries actual sales from Snowflake `SAP_FNF.DW_HMD_SALE_D` using `ACT_SALE_AMT`.",
            "`scripts/export_store_monthly_sales_sql.py` merges store-level SQL actuals with the dashboard baseline.",
            `The current base period is ${formatPeriod(latestYear, selectedMonth)}, so actuals are applied through that month.`,
          ],
        },
        {
          title: "3. Merge Rules",
          items: [
            "Years before the base year use SQL actuals.",
            "In the base year, SQL actuals are used through the selected month and Excel forecast is used after that.",
            "TW supports monthly exchange-rate overrides in non-production, converts HKD/TWD on screen, and applies the TW discount formula with VAT.",
          ],
        },
        {
          title: "4. Screen Output Data",
          items: [
            "`data/dashboard-data.json` provides `generatedAt`, `regions.monthly`, and `regions.storeYoyMultiYear` for cards, summaries, and YoY.",
            "`app/page.tsx` loads CSV rates plus saved TW monthly overrides and passes them to the dashboard shell.",
            "The summary cards and table reflect SQLite + SQL actual + Excel forecast, plus TW exchange-rate and discount rules.",
          ],
        },
      ];
    }

    return [
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
          "`scripts/fetch_snowflake_actuals.mjs`가 Snowflake `SAP_FNF.DW_HMD_SALE_D`의 `ACT_SALE_AMT`로 actual 매출을 조회합니다.",
          "`scripts/export_store_monthly_sales_sql.py`에서 매장별·월별 SQL actual과 대시보드 기준 데이터를 병합합니다.",
          `현재 화면 기준월은 ${formatPeriod(latestYear, selectedMonth)} 이므로, 해당 월까지 actual 구간으로 처리됩니다.`,
        ],
      },
      {
        title: "3. 병합 규칙",
        items: [
          "기준 연도 이전 연도는 SQL actual을 사용합니다.",
          "기준 연도에서는 선택한 기준월까지 SQL actual, 이후 월은 Excel forecast를 사용합니다.",
          "TW 데이터는 개발환경에서 월별 환율을 수정할 수 있고, 화면에서는 HKD/TWD 전환과 TW 전용 할인율(VAT 포함) 규칙을 적용합니다.",
        ],
      },
      {
        title: "4. 화면 반영 데이터",
        items: [
          "`data/dashboard-data.json`은 카드/요약/YoY용 `generatedAt`, `regions.monthly`, `regions.storeYoyMultiYear`를 제공합니다.",
          "`app/page.tsx`는 CSV 환율과 저장된 TW 월별 환율 설정을 함께 불러와 화면에 전달합니다.",
          "상단 요약과 하단 테이블 모두 SQLite + SQL actual + Excel forecast 병합 결과에 TW 환율/할인율 규칙을 반영해 사용합니다.",
        ],
      },
    ];
  }, [language, latestYear, selectedMonth]);
  const compactTrendSummary = useMemo(() => trendSummary.slice(0, 2), [trendSummary]);

  useEffect(() => {
    if (!showDataStructureModal && !showRateEditor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDataStructureModal(false);
        setShowRateEditor(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDataStructureModal, showRateEditor]);

  if (!region) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10">
        <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/75 px-8 py-10 text-center shadow-[0_20px_50px_rgba(65,46,24,0.08)]">
          <p className="text-lg font-semibold text-stone-900">{text.emptyRegion}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1860px] px-4 pt-0 pb-5 md:px-6 md:pt-0 md:pb-6">
      <div className="space-y-4">
        <section className="sticky top-0 z-30 rounded-[28px] border border-white/70 bg-white/88 p-3 shadow-[0_16px_40px_rgba(65,46,24,0.10)] backdrop-blur-md md:p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">{text.storeDrilldown}</p>
              <h1 className="mt-1 font-serif text-[1.45rem] font-medium leading-none tracking-tight text-stone-900 md:text-[2.1rem]">{text.title}</h1>
              <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-stone-600">{text.intro}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {regionKeys.map((key) => (
                  <ToggleButton
                    compact
                    key={key}
                    active={regionKey === key}
                    onClick={() => {
                      setRegionKey(key);
                      setSelectedMonth(initialPeriod.month);
                      setExpandedChannels({});
                      setExpandedProfitBreakdowns({});
                      setSortMonth(null);
                      setSortDirection("desc");
                    }}
                  >
                    {REGION_LABELS[key] ?? key}
                  </ToggleButton>
                ))}
                <div className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-2 shadow-sm">
                  <label htmlFor="brand-select" className="text-sm font-semibold text-stone-600">
                    Brand
                  </label>
                  <select
                    id="brand-select"
                    value={selectedBrand}
                    onChange={(event) => {
                      setSelectedBrand(event.target.value);
                      setExpandedChannels({});
                      setExpandedProfitBreakdowns({});
                      setSortMonth(null);
                      setSortDirection("desc");
                    }}
                    className="bg-transparent text-sm font-semibold text-stone-900 outline-none"
                  >
                    {availableBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {(language === "en" ? BRAND_LABELS_EN[brand] : BRAND_LABELS[brand]) ?? brand}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="hidden">
                  <button
                    type="button"
                    onClick={() => setTopSummaryView("sales")}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${topSummaryView === "sales" ? "bg-stone-950 text-white" : "text-stone-600"}`}
                  >
                    {language === "en" ? "Sales" : "\uB9E4\uCD9C"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (PROFIT_VIEW_ENABLED) setTopSummaryView("profit");
                    }}
                    disabled={!PROFIT_VIEW_ENABLED}
                    aria-disabled={!PROFIT_VIEW_ENABLED}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${PROFIT_VIEW_ENABLED && topSummaryView === "profit" ? "bg-stone-950 text-white" : "text-stone-400"} ${!PROFIT_VIEW_ENABLED ? "cursor-not-allowed" : ""}`}
                  >
                    {language === "en" ? "Profit" : "이익"}
                  </button>
                </div>
                <div className="inline-flex rounded-full border border-stone-300 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setCardMetricMode("month")}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${cardMetricMode === "month" ? "bg-stone-950 text-white" : "text-stone-600"}`}
                  >
                    {text.monthMode}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardMetricMode("ytd")}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${cardMetricMode === "ytd" ? "bg-stone-950 text-white" : "text-stone-600"}`}
                  >
                    {text.ytdMode}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardMetricMode("annual")}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${cardMetricMode === "annual" ? "bg-stone-950 text-white" : "text-stone-600"}`}
                  >
                    {text.annualMode}
                  </button>
                </div>
                {regionKey === "TW" ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-full border border-stone-300 bg-white px-2 py-1 shadow-sm">
                    <div className="inline-flex rounded-full border border-stone-200 bg-stone-50 p-1">
                      <button
                        type="button"
                        onClick={() => setCurrencyMode("HKD")}
                        className={`w-14 rounded-full px-3 py-1.5 text-center text-sm font-semibold transition ${effectiveCurrencyMode === "HKD" ? "bg-stone-950 text-white" : "text-stone-600"}`} 
                      >
                        HKD
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrencyMode("TWD")}
                        className={`w-14 rounded-full px-3 py-1.5 text-center text-sm font-semibold transition ${effectiveCurrencyMode === "TWD" ? "bg-stone-950 text-white" : "text-stone-600"}`}
                      >
                        TWD
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (canPersistSettings) openRateEditor();
                      }}
                      disabled={!canPersistSettings}
                      className={`min-w-[170px] pr-2 text-left text-[11px] font-medium text-stone-500 transition ${effectiveCurrencyMode === "HKD" && selectedTwRate != null ? "opacity-100" : "pointer-events-none opacity-0"} ${canPersistSettings ? "hover:text-stone-700" : "cursor-default"}`}
                    >
                      {selectedTwRate != null ? `Rate 1 TWD = ${selectedTwRate.toFixed(4)} HKD` : "Rate 1 TWD = 0.0000 HKD"}
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-full border border-stone-300 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setTableBasisMode("sales")}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${tableBasisMode === "sales" ? "bg-stone-950 text-white" : "text-stone-600"}`}
                    >
                      {text.salesValueLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableBasisMode("tag")}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${tableBasisMode === "tag" ? "bg-stone-950 text-white" : "text-stone-600"}`}
                    >
                      {text.tagSalesLabel}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-2 py-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setTableBasisMode("perStore")}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${tableBasisMode === "perStore" ? "bg-stone-950 text-white" : "text-stone-600"}`}
                    >
                      {text.perStoreSalesLabel}
                    </button>
                    <span className="pr-2 text-[11px] font-medium text-stone-500">{text.perStoreHint}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="min-w-[420px] rounded-[28px] border border-stone-200/70 bg-stone-50/90 p-4 shadow-inner shadow-stone-900/5 md:min-w-[500px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <label htmlFor="period-select" className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                    {text.period}
                  </label>
                <select
                  id="period-select"
                  value={selectedMonth}
                  disabled={!canEditPeriod}
                  onChange={(event) => {
                    void handleActualPeriodChange(Number(event.target.value));
                  }}
                  className={`rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 outline-none transition focus:border-emerald-600 ${canEditPeriod ? "" : "cursor-not-allowed bg-stone-100 text-stone-500"}`}
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-full border border-sky-200 bg-sky-50/80 p-1 shadow-sm shadow-sky-100/80">
                    <button
                      type="button"
                      onClick={() => setLanguage("kr")}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                        language === "kr"
                          ? "bg-sky-600 text-white shadow-sm"
                          : "text-sky-700 hover:bg-white/80"
                      }`}
                    >
                      {text.langKr}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage("en")}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                        language === "en"
                          ? "bg-amber-500 text-white shadow-sm"
                          : "text-amber-700 hover:bg-white/80"
                      }`}
                    >
                      {text.langEn}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDataStructureModal(true)}
                    className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-500 hover:bg-stone-100"
                  >
                    {text.dataStructureButton}
                  </button>
                </div>
              </div>
              <div className="mt-2.5 text-sm text-stone-500">
                <p>
                  {text.baseYear} <span className="font-semibold text-stone-800">{latestYear}</span>
                </p>
                <p className="mt-1">{text.updatedAt} {formatTimestamp(data.generatedAt, language)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-white/55 bg-white/78 p-4 shadow-[0_12px_30px_rgba(65,46,24,0.08)]">
          <div className="space-y-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">{text.trendSummaryLabel}</p>
              <h3 className="mt-1 text-lg font-semibold text-stone-900">{text.trendSummaryTitle}</h3>
            </div>
            <div className="space-y-1 text-sm leading-6 text-stone-600">
              {compactTrendSummary.map((line, index) => (
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
                <h2 className="mt-2 text-2xl font-semibold text-stone-900">
                  {latestYear} {trendTableMode === "profit" ? (language === "en" ? "Store Monthly Profit Trend" : "매장월별 손익추세") : text.annualTable}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <ToggleButton
                  active={trendTableMode === "sales"}
                  onClick={() => setTrendTableMode("sales")}
                >
                  {language === "en" ? "Sales Trend" : "매출액 보기"}
                </ToggleButton>
                <ToggleButton
                  active={trendTableMode === "profit"}
                  onClick={() => setTrendTableMode("profit")}
                >
                  {language === "en" ? "Profit Trend" : "손익추세"}
                </ToggleButton>
                <ToggleButton
                  active={viewMode === "sales"}
                  onClick={() => setViewMode(viewMode === "yoy" ? "sales" : "yoy")}
                >
                  {viewMode === "yoy"
                    ? (language === "en" ? "Value View" : "숫자 보기")
                    : (language === "en" ? "YOY View" : "YOY 보기")}
                </ToggleButton>
                <ToggleButton active={allExpanded} onClick={toggleAllChannels}>
                  {allExpanded ? text.collapseAll : text.expandAll}
                </ToggleButton>
              </div>
            </div>
            <div className="text-right text-sm text-stone-500">
              <p>{text.ytdRight}</p>
              <p className="mt-1">
                {trendTableMode === "profit"
                  ? `${text.unit.replace("1k HKD", currencyUnitLabel)} ${language === "en" ? "Store rows: Direct Profit / Top row: Operating Profit" : "매장 행: 직접이익 / 최상단: 영업이익"}`
                  : `${text.unit.replace("1k HKD", currencyUnitLabel)} ${unitBasisLabel}`}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-visible rounded-[22px] border border-stone-200/70 bg-white/95">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1540px] table-fixed text-[11px] leading-4">
                <thead className="bg-stone-100/95 text-stone-700">
                  <tr>
                    <th className="w-[72px] px-2 py-3 text-left font-semibold">{text.country}</th>
                    <th className="w-[70px] px-2 py-3 text-left font-semibold">{text.brand}</th>
                    <th className="w-[88px] px-2 py-3 text-left font-semibold">{text.channel}</th>
                    <th className="w-[120px] px-2 py-3 text-left font-semibold">{text.store}</th>
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
                            <div>{formatMonthHeaderLabel(month, selectedMonth, language)}{sortMonth === month ? (sortDirection === "desc" ? " ↓" : " ↑") : ""}</div>
                          </button>
                        </th>
                        {month === selectedMonth ? (
                          <th className="w-[90px] bg-stone-300/90 px-2 py-3 text-center font-semibold text-stone-900">YTD</th>
                        ) : null}
                      </Fragment>
                    ))}
                    <th className="w-[92px] bg-stone-200/70 px-2 py-3 text-center font-semibold">{text.annualTotal}</th>
                  </tr>
                </thead>
                <tbody>
                  {trendTableMode === "sales" ? (
                    visibleRows.length > 0 ? (
                    visibleRows.map((row) => {
                      const isSummaryRow = row.kind !== "store";
                      const isChannelTotal = row.kind === "channel-total";
                      const isExpanded = row.toggleKey ? (expandedChannels[row.toggleKey] ?? false) : false;

                      return (
                        <tr key={row.rowKey} className={`border-t border-stone-200/70 ${summaryRowClass(row.kind)}`}>
                          <td className="px-2 py-2 font-medium text-stone-700">{formatCountryLabel(row.country, language)}</td>
                          <td className="px-2 py-2 font-medium text-stone-700">{row.brand}</td>
                          <td className="px-2 py-2 font-medium text-stone-700">{formatChannelLabel(row.channel, language)}</td>
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
                                <span>{formatStoreName(row.storeName, language)}</span>
                              </button>
                            ) : (
                              formatStoreName(row.storeName, language)
                            )}
                          </td>
                          {row.months.map((month) => (
                            <Fragment key={`${row.rowKey}-${month.month}`}>
                              <td className={`px-2 py-2 align-top ${monthCellTone(month.month, selectedMonth)}`}>
                                <MetricCell metric={month} emphasize={isSummaryRow} viewMode={viewMode} basisMode={tableBasisMode} storeTooltipMode="month" localeText={text} language={language} />
                              </td>
                              {month.month === selectedMonth ? (
                                <td className="bg-stone-200/80 px-2 py-2 align-top">
                                  <MetricCell metric={row.ytd} emphasize viewMode={viewMode} basisMode={tableBasisMode} storeTooltipMode="ytd" localeText={text} language={language} />
                                </td>
                              ) : null}
                            </Fragment>
                          ))}
                          <td className="bg-stone-50/90 px-2 py-2 align-top">
                            <MetricCell metric={row.annual} emphasize={isSummaryRow} viewMode={viewMode} basisMode={tableBasisMode} storeTooltipMode="annual" localeText={text} language={language} />
                          </td>
                        </tr>
                      );
                    })
                    ) : (
                    <EmptyRow colSpan={18} message={text.emptyRows} />
                    )
                  ) : profitTableRows.length > 0 ? (
                    <>
                      <tr className="border-t-2 border-stone-300 bg-emerald-50/70">
                        <td className="px-2 py-2 font-semibold text-stone-700">{language === "en" ? "All" : "전체"}</td>
                        <td className="px-2 py-2 font-semibold text-stone-700">-</td>
                        <td className="px-2 py-2 font-semibold text-stone-700">-</td>
                        <td className="px-2 py-2 font-semibold text-stone-900">
                          {language === "en" ? "Operating Profit (Top Summary)" : "영업이익 합계"}
                        </td>
                        {overallOperatingProfitMetrics.months.map((month) => (
                          <Fragment key={`op-${month.month}`}>
                            <td className={`px-2 py-2 align-top ${monthCellTone(month.month, selectedMonth)}`}>
                              <ProfitDeltaCell metric={month} emphasize showMargin language={language} />
                            </td>
                            {month.month === selectedMonth ? (
                              <td className="bg-stone-200/80 px-2 py-2 align-top">
                                <ProfitDeltaCell metric={overallOperatingProfitMetrics.ytd} emphasize showMargin language={language} />
                              </td>
                            ) : null}
                          </Fragment>
                        ))}
                        <td className="bg-stone-50/90 px-2 py-2 align-top">
                          <ProfitDeltaCell metric={overallOperatingProfitMetrics.annual} emphasize showMargin language={language} />
                        </td>
                      </tr>
                      {visibleProfitRows.map((row) => {
                        const isSummaryRow = row.kind !== "store";
                        const isChannelTotal = row.kind === "channel-total";
                        const isExpanded = row.toggleKey ? (expandedChannels[row.toggleKey] ?? false) : false;

                        return (
                          <tr key={row.rowKey} className={`border-t border-stone-200/70 ${summaryRowClass(row.kind)}`}>
                            <td className="px-2 py-2 font-medium text-stone-700">{formatCountryLabel(row.country, language)}</td>
                            <td className="px-2 py-2 font-medium text-stone-700">{row.brand}</td>
                            <td className="px-2 py-2 font-medium text-stone-700">{formatChannelLabel(row.channel, language)}</td>
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
                                    {isExpanded ? "▾" : "▸"}
                                  </span>
                                  <span>{formatStoreName(row.storeName, language)}</span>
                                </button>
                              ) : (
                                <>
                                  {formatStoreName(row.storeName, language)}
                                  {!isSummaryRow ? (
                                    <span className="ml-2 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                                      {language === "en" ? "Direct Profit" : "직접이익"}
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </td>
                            {row.months.map((month) => (
                              <Fragment key={`${row.rowKey}-${month.month}`}>
                                <td className={`px-2 py-2 align-top ${monthCellTone(month.month, selectedMonth)}`}>
                                  <ProfitDeltaCell metric={month} emphasize={isSummaryRow} language={language} />
                                </td>
                                {month.month === selectedMonth ? (
                                  <td className="bg-stone-200/80 px-2 py-2 align-top">
                                    <ProfitDeltaCell metric={row.ytd} emphasize language={language} />
                                  </td>
                                ) : null}
                              </Fragment>
                            ))}
                            <td className="bg-stone-50/90 px-2 py-2 align-top">
                              <ProfitDeltaCell metric={row.annual} emphasize={isSummaryRow} language={language} />
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-stone-300 bg-rose-50/60">
                        <td className="px-2 py-2 font-semibold text-stone-700">{language === "en" ? "All" : "전체"}</td>
                        <td className="px-2 py-2 font-semibold text-stone-700">-</td>
                        <td className="px-2 py-2 font-semibold text-stone-700">-</td>
                        <td className="px-2 py-2 font-semibold text-stone-900">{language === "en" ? "Operating Expense" : "영업비"}</td>
                        {overallOperatingExpenseMetrics.months.map((month) => (
                          <Fragment key={`opex-${month.month}`}>
                            <td className={`px-2 py-2 align-top ${monthCellTone(month.month, selectedMonth)}`}>
                              <ProfitDeltaCell metric={month} emphasize language={language} />
                            </td>
                            {month.month === selectedMonth ? (
                              <td className="bg-stone-200/80 px-2 py-2 align-top">
                                <ProfitDeltaCell metric={overallOperatingExpenseMetrics.ytd} emphasize language={language} />
                              </td>
                            ) : null}
                          </Fragment>
                        ))}
                        <td className="bg-stone-50/90 px-2 py-2 align-top">
                          <ProfitDeltaCell metric={overallOperatingExpenseMetrics.annual} emphasize language={language} />
                        </td>
                      </tr>
                    </>
                  ) : (
                    <EmptyRow colSpan={18} message={text.emptyRows} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {topSummaryView === "sales" ? (
            <>
              <OverallSummaryCard
                title={overallCardTitle}
                basis={formatCardBasis(selectedMonth, cardMetricMode, latestYear, language)}
                salesLabel={getSalesLabel(tableBasisMode, language)}
                salesValue={formatMetricValue(overallCardDisplayMetric.sales, tableBasisMode)}
                currencyLabel={effectiveCurrencyMode}
                yoyValue={overallCardDisplayMetric.yoyPrev}
                yoyTwoValue={overallCardDisplayMetric.yoyTwo}
                salesMetric={overallCardMetric}
                discountSummary={overallCardDiscountSummary}
                basisMode={tableBasisMode}
                storeTooltipMode={cardMetricMode === "month" ? "month" : cardMetricMode === "annual" ? "annual" : "ytd"}
                localeText={text}
                language={language}
              />
              {channelHighlights.map((item) => (
                <ChannelHighlightCard
                  key={item.channel}
                  channel={formatChannelGroupLabel(item.channel, language)}
                  basis={formatCardBasis(selectedMonth, cardMetricMode, latestYear, language)}
                  selectedSalesLabel={getSalesLabel(tableBasisMode, language)}
                  selectedSalesValue={formatMetricWithUnit(item.displayChannelMetric.sales, tableBasisMode, effectiveCurrencyMode)}
                  discountSummary={item.discountSummary}
                  summaryValue={renderCardComparison(item.channel, item.displayChannelMetric.yoyPrev, item.displayChannelMetric.yoyTwo, text.yoyTwo)}
                  salesLabel={text.channelTopSales}
                  yoyLabel={text.channelTopYoy}
                  salesValue={item.topSales ? `${formatStoreName(item.topSales.storeName, language)} / ${formatMetricWithUnit(item.topSales.value, tableBasisMode, effectiveCurrencyMode)}` : text.noData}
                  salesDetail={item.topSales ? renderMetricComparison(item.topSales.yoyPrev, item.topSales.yoyTwo, text.yoyTwo) : null}
                  yoyValue={item.topYoy ? `${formatStoreName(item.topYoy.storeName, language)} / ${formatYoyRate(item.topYoy.value)}` : text.noData}
                  yoyDetail={item.topYoy ? renderMetricComparison(item.topYoy.value, item.topYoy.yoyTwo, text.yoyTwo) : null}
                  yoyTone={item.topYoy?.value}
                  localeText={text}
                />
              ))}
            </>
          ) : (
            <>
              <ProfitSummaryCard
                cardKey="overall"
                title={overallCardTitle}
                basis={formatCardBasis(selectedMonth, cardMetricMode, latestYear, language)}
                primaryLabel={language === "en" ? "Operating Profit" : "\uC601\uC5C5\uC774\uC775"}
                primaryValue={formatMetricWithUnit(overallProfitMetric.operatingProfit, "sales", effectiveCurrencyMode)}
                secondaryLabel={language === "en" ? "Direct Profit" : "\uC9C1\uC811\uC774\uC775"}
                secondaryValue={formatMetricWithUnit(overallProfitMetric.directProfit, "sales", effectiveCurrencyMode)}
                metric={overallProfitMetric}
                currencyLabel={effectiveCurrencyMode}
                language={language}
                expandedProfitBreakdowns={expandedProfitBreakdowns}
                onToggleBreakdown={(detailKey) => setExpandedProfitBreakdowns((current) => ({ ...current, [detailKey]: !current[detailKey] }))}
              />
              {profitChannelSummaries.map((item) => (
                <ProfitSummaryCard
                  key={item.channel}
                  cardKey={item.channel}
                  title={formatChannelGroupLabel(item.channel, language)}
                  basis={formatCardBasis(selectedMonth, cardMetricMode, latestYear, language)}
                  primaryLabel={language === "en" ? "Direct Profit" : "\uC9C1\uC811\uC774\uC775"}
                  primaryValue={formatMetricWithUnit(item.metric.directProfit, "sales", effectiveCurrencyMode)}
                  secondaryLabel={language === "en" ? "Gross Profit" : "\uB9E4\uCD9C\uCD1D\uC774\uC775"}
                  secondaryValue={formatMetricWithUnit(item.metric.grossProfit, "sales", effectiveCurrencyMode)}
                  metric={item.metric}
                  currencyLabel={effectiveCurrencyMode}
                  language={language}
                  expandedProfitBreakdowns={expandedProfitBreakdowns}
                  onToggleBreakdown={(detailKey) => setExpandedProfitBreakdowns((current) => ({ ...current, [detailKey]: !current[detailKey] }))}
                />
              ))}
            </>
          )}
        </section>

        <section className="grid gap-4">
          <MonthlyProfitTrendCard
            title={language === "en" ? "Monthly Profit Trend" : "월별 손익추세"}
            subtitle={language === "en" ? `FY ${latestYear} monthly flow from normalized CSV` : `${latestYear}년 월별 손익 흐름`}
            points={monthlyProfitTrend}
            currencyLabel={effectiveCurrencyMode}
            language={language}
          />
        </section>

      </div>
      {showRateEditor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-6">
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={() => setShowRateEditor(false)}
          />
          <section className="relative z-10 w-full max-w-3xl rounded-[28px] border border-white/60 bg-[#f7f3ec] p-5 shadow-[0_24px_80px_rgba(28,25,23,0.28)] md:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Monthly FX</p>
                <h3 className="mt-2 text-2xl font-semibold text-stone-900">TW Exchange Rate Setup</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">Base year {latestYear} monthly rates. Changes are editable only outside production.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRateEditor(false)}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-500 hover:bg-stone-100"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
              {editableRateKeys.map((key, index) => (
                <label key={key} className="rounded-[18px] border border-stone-200 bg-white/90 px-4 py-3 text-sm shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">{key}</span>
                  <span className="mt-1 block text-[11px] text-stone-500">Month {index + 1}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    min="0"
                    value={rateDrafts[key] ?? ""}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setRateDrafts((current) => ({ ...current, [key]: nextValue }));
                    }}
                    className="mt-3 w-full rounded-full border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 outline-none transition focus:border-emerald-600"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRateEditor(false)}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-500 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRateSave()}
                disabled={isSavingRates || !canPersistSettings}
                className={`rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${isSavingRates || !canPersistSettings ? "bg-stone-400" : "bg-stone-950 hover:bg-stone-800"}`}
              >
                {isSavingRates ? "Saving..." : "Save Rates"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">{text.dataStructureLabel}</p>
                <h3 className="mt-2 text-2xl font-semibold text-stone-900">{text.dataStructureTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {text.dataStructureIntro}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDataStructureModal(false)}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-500 hover:bg-stone-100"
              >
                {text.close}
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
              <p className="text-base font-semibold text-stone-900">{text.finalUpdateLog}</p>
              <div className="mt-3 grid gap-3 text-sm text-stone-600 md:grid-cols-3">
                <div className="rounded-[18px] bg-stone-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-400">{text.basePeriod}</p>
                  <p className="mt-2 font-semibold text-stone-900">{formatPeriod(latestYear, selectedMonth)}</p>
                </div>
                <div className="rounded-[18px] bg-stone-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Dashboard JSON</p>
                  <p className="mt-2 font-semibold text-stone-900">{formatTimestamp(data.generatedAt, language)}</p>
                </div>
                <div className="rounded-[18px] bg-stone-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-400">{text.ruleBasis}</p>
                  <p className="mt-2 font-semibold text-stone-900">{text.ruleBasisValue}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function createMetricCell(
  source: Record<string, number>,
  tagSource: Record<string, number> | undefined,
  latestYear: number,
  month: number,
): CellMetric {
  const safeTagSource = tagSource ?? {};
  const sales = source[formatPeriod(latestYear, month)] ?? null;
  const previous = source[formatPeriod(latestYear - 1, month)] ?? null;
  const twoYears = source[formatPeriod(latestYear - 2, month)] ?? null;
  const tagSales = safeTagSource[formatPeriod(latestYear, month)] ?? null;
  const tagPrevious = safeTagSource[formatPeriod(latestYear - 1, month)] ?? null;
  const tagTwoYears = safeTagSource[formatPeriod(latestYear - 2, month)] ?? null;

  return {
    sales,
    previousSales: previous,
    twoYearSales: twoYears,
    tagSales,
    tagPreviousSales: tagPrevious,
    tagTwoYearSales: tagTwoYears,
    yoyPrev: sales != null && previous ? sales / previous - 1 : null,
    yoyTwo: sales != null && twoYears ? sales / twoYears - 1 : null,
    storeCount: sales != null ? (sales > 0 ? 1 : 0) : null,
    previousStoreCount: previous != null ? (previous > 0 ? 1 : 0) : null,
    twoYearStoreCount: twoYears != null ? (twoYears > 0 ? 1 : 0) : null,
  };
}

function createYtdMetric(
  source: Record<string, number>,
  tagSource: Record<string, number> | undefined,
  latestYear: number,
  selectedMonth: number,
): CellMetric {
  const safeTagSource = tagSource ?? {};
  const current = sumPeriods(source, latestYear, selectedMonth);
  const previous = sumPeriods(source, latestYear - 1, selectedMonth);
  const twoYears = sumPeriods(source, latestYear - 2, selectedMonth);
  const currentTag = sumPeriods(safeTagSource, latestYear, selectedMonth);
  const previousTag = sumPeriods(safeTagSource, latestYear - 1, selectedMonth);
  const twoYearsTag = sumPeriods(safeTagSource, latestYear - 2, selectedMonth);

  return {
    sales: current,
    previousSales: previous,
    twoYearSales: twoYears,
    tagSales: currentTag,
    tagPreviousSales: previousTag,
    tagTwoYearSales: twoYearsTag,
    yoyPrev: current != null && previous ? current / previous - 1 : null,
    yoyTwo: current != null && twoYears ? current / twoYears - 1 : null,
    storeCount: calculateCumulativeStoreCount(source, latestYear, selectedMonth),
    previousStoreCount: calculateCumulativeStoreCount(source, latestYear - 1, selectedMonth),
    twoYearStoreCount: calculateCumulativeStoreCount(source, latestYear - 2, selectedMonth),
  };
}

function createAnnualMetric(
  annualSource: Record<string, number>,
  annualTagSource: Record<string, number> | undefined,
  monthlySource: Record<string, number>,
  latestYear: number,
): CellMetric {
  const safeAnnualTagSource = annualTagSource ?? {};
  const sales = annualSource[String(latestYear)] ?? null;
  const previous = annualSource[String(latestYear - 1)] ?? null;
  const twoYears = annualSource[String(latestYear - 2)] ?? null;
  const tagSales = safeAnnualTagSource[String(latestYear)] ?? null;
  const tagPrevious = safeAnnualTagSource[String(latestYear - 1)] ?? null;
  const tagTwoYears = safeAnnualTagSource[String(latestYear - 2)] ?? null;

  return {
    sales,
    previousSales: previous,
    twoYearSales: twoYears,
    tagSales,
    tagPreviousSales: tagPrevious,
    tagTwoYearSales: tagTwoYears,
    yoyPrev: sales != null && previous ? sales / previous - 1 : null,
    yoyTwo: sales != null && twoYears ? sales / twoYears - 1 : null,
    storeCount: calculateCumulativeStoreCount(monthlySource, latestYear, 12),
    previousStoreCount: calculateCumulativeStoreCount(monthlySource, latestYear - 1, 12),
    twoYearStoreCount: calculateCumulativeStoreCount(monthlySource, latestYear - 2, 12),
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
  const tagSales = metrics.reduce((sum, metric) => sum + (metric.tagSales ?? 0), 0);
  const tagPreviousSales = metrics.reduce((sum, metric) => sum + (metric.tagPreviousSales ?? 0), 0);
  const tagTwoYearSales = metrics.reduce((sum, metric) => sum + (metric.tagTwoYearSales ?? 0), 0);
  const storeCount = metrics.reduce((sum, metric) => sum + (metric.storeCount ?? 0), 0);
  const previousStoreCount = metrics.reduce((sum, metric) => sum + (metric.previousStoreCount ?? 0), 0);
  const twoYearStoreCount = metrics.reduce((sum, metric) => sum + (metric.twoYearStoreCount ?? 0), 0);
  const hasSales = metrics.some((metric) => metric.sales != null);
  const hasPreviousSales = metrics.some((metric) => metric.previousSales != null);
  const hasTwoYearSales = metrics.some((metric) => metric.twoYearSales != null);
  const hasTagSales = metrics.some((metric) => metric.tagSales != null);
  const hasTagPreviousSales = metrics.some((metric) => metric.tagPreviousSales != null);
  const hasTagTwoYearSales = metrics.some((metric) => metric.tagTwoYearSales != null);
  const hasStoreCount = metrics.some((metric) => metric.storeCount != null);
  const hasPreviousStoreCount = metrics.some((metric) => metric.previousStoreCount != null);
  const hasTwoYearStoreCount = metrics.some((metric) => metric.twoYearStoreCount != null);

  return {
    sales: hasSales ? sales : null,
    previousSales: hasPreviousSales ? previousSales : null,
    twoYearSales: hasTwoYearSales ? twoYearSales : null,
    tagSales: hasTagSales ? tagSales : null,
    tagPreviousSales: hasTagPreviousSales ? tagPreviousSales : null,
    tagTwoYearSales: hasTagTwoYearSales ? tagTwoYearSales : null,
    yoyPrev: previousSales ? sales / previousSales - 1 : null,
    yoyTwo: twoYearSales ? sales / twoYearSales - 1 : null,
    storeCount: hasStoreCount ? storeCount : null,
    previousStoreCount: hasPreviousStoreCount ? previousStoreCount : null,
    twoYearStoreCount: hasTwoYearStoreCount ? twoYearStoreCount : null,
  };
}

function getOperatingExpenseValue(metric: ProfitBreakdownMetric) {
  const total = sumProfitValues(metric.operatingPayroll, metric.operatingRent, metric.advertising, metric.operatingOther);
  return total == null ? null : -total;
}

function negateNullable(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? null : -value;
}

function createProfitTrendMetric(
  currentValue: number | null | undefined,
  previousValue: number | null | undefined,
  twoYearValue: number | null | undefined,
  currentSales: number | null | undefined,
  previousSales: number | null | undefined,
  twoYearSales: number | null | undefined,
): ProfitTrendMetric {
  const value = currentValue ?? null;
  const prev = previousValue ?? null;
  const twoYear = twoYearValue ?? null;
  const salesBase = currentSales ?? null;
  const previousSalesBase = previousSales ?? null;
  const twoYearSalesBase = twoYearSales ?? null;

  return {
    value,
    previousValue: prev,
    twoYearValue: twoYear,
    yoyPrev: calculateRatioChange(value, prev),
    yoyTwo: calculateRatioChange(value, twoYear),
    salesBase,
    previousSalesBase,
    twoYearSalesBase,
    margin: calculateMarginValue(value, salesBase),
  };
}

function aggregateProfitTrendMetrics(metrics: ProfitTrendMetric[]): ProfitTrendMetric {
  const sumField = (selector: (metric: ProfitTrendMetric) => number | null) =>
    metrics.reduce((sum, metric) => sum + (selector(metric) ?? 0), 0);
  const hasField = (selector: (metric: ProfitTrendMetric) => number | null) => metrics.some((metric) => selector(metric) != null);

  const value = hasField((metric) => metric.value) ? sumField((metric) => metric.value) : null;
  const previousValue = hasField((metric) => metric.previousValue) ? sumField((metric) => metric.previousValue) : null;
  const twoYearValue = hasField((metric) => metric.twoYearValue) ? sumField((metric) => metric.twoYearValue) : null;
  const salesBase = hasField((metric) => metric.salesBase) ? sumField((metric) => metric.salesBase) : null;
  const previousSalesBase = hasField((metric) => metric.previousSalesBase) ? sumField((metric) => metric.previousSalesBase) : null;
  const twoYearSalesBase = hasField((metric) => metric.twoYearSalesBase) ? sumField((metric) => metric.twoYearSalesBase) : null;

  return {
    value,
    previousValue,
    twoYearValue,
    yoyPrev: calculateRatioChange(value, previousValue),
    yoyTwo: calculateRatioChange(value, twoYearValue),
    salesBase,
    previousSalesBase,
    twoYearSalesBase,
    margin: calculateMarginValue(value, salesBase),
  };
}

function sumAccountPeriods(
  source: Record<string, number> | undefined,
  year: number,
  selectedMonth: number,
  mode: CardMetricMode,
) {
  if (!source) return null;
  return sumProfitPeriods(source, year, selectedMonth, mode);
}

function createProfitSummaryRow(
  kind: RowKind,
  rows: ProfitTableRow[],
  values: {
    country: string;
    brand: string;
    channel: string;
    storeName: string;
    rowKey: string;
    toggleKey?: string;
  },
): ProfitTableRow {
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
      ...aggregateProfitTrendMetrics(rows.map((row) => row.months[index])),
    })),
    ytd: aggregateProfitTrendMetrics(rows.map((row) => row.ytd)),
    annual: aggregateProfitTrendMetrics(rows.map((row) => row.annual)),
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

function ToggleButton({ children, active, onClick, compact = false }: { children: ReactNode; active: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border ${compact ? "px-4 py-2 text-sm" : "px-6 py-3 text-base"} font-semibold tracking-[0.01em] shadow-sm transition ${
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
  salesLabel,
  salesValue,
  currencyLabel,
  yoyValue,
  yoyTwoValue,
  salesMetric,
  discountSummary,
  basisMode = "sales",
  storeTooltipMode,
  localeText,
  language,
}: {
  title: string;
  basis: string;
  salesLabel: string;
  salesValue: string;
  currencyLabel: CurrencyMode;
  yoyValue: number | null;
  yoyTwoValue: number | null;
  salesMetric?: CellMetric;
  discountSummary?: DiscountSummary;
  basisMode?: TableBasisMode;
  storeTooltipMode?: StoreTooltipMode;
  localeText: LocaleText;
  language: Language;
}) {
  const showPerStoreFormulaTooltip =
    basisMode === "perStore" && salesMetric != null && storeTooltipMode != null && salesMetric.sales != null && salesMetric.storeCount != null;
  const formulaTooltipTitle =
    storeTooltipMode === "month"
      ? localeText.monthPerStoreFormula
      : storeTooltipMode === "annual"
        ? localeText.annualPerStoreFormula
        : localeText.ytdPerStoreFormula;
  const formulaTooltipCountLabel =
    storeTooltipMode === "month"
      ? localeText.storeCount
      : storeTooltipMode === "annual"
        ? localeText.annualAverageStoreCount
        : localeText.ytdAverageStoreCount;
  const formulaTooltipDescription =
    storeTooltipMode === "month" ? localeText.formulaDescriptionMonth : localeText.formulaDescriptionAggregate;

  return (
    <article className="rounded-[24px] border border-white/55 bg-white/85 p-4 shadow-[0_16px_40px_rgba(65,46,24,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold leading-snug text-stone-900">{title}</p>
          <p className="mt-1 text-xs text-stone-400">{basis}</p>
        </div>
        <DiscountSummaryBadge summary={discountSummary} label={localeText.discountRate} />
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-400">{salesLabel}</p>
          <p className="mt-1 text-base font-semibold text-stone-900">
            {showPerStoreFormulaTooltip ? (
              <span className="group relative inline-flex cursor-help items-center justify-center">
                <span className="border-b border-dotted border-stone-400/80">{salesValue} K {currencyLabel}</span>
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-72 -translate-x-1/2 rounded-[18px] border border-stone-200 bg-white px-3 py-3 text-left shadow-[0_12px_28px_rgba(28,25,23,0.16)] group-hover:block">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">{localeText.formulaExpression}</span>
                  <span className="mt-2 block text-[12px] font-semibold text-stone-900">{formulaTooltipTitle}</span>
                  <span className="mt-1 block text-[11px] leading-5 text-stone-600">{formulaTooltipDescription}</span>
                  <span className="mt-2 block text-[11px] font-medium text-stone-700">
                    {localeText.formulaExpression} <span className="font-semibold text-stone-900">{localeText.salesTotal} / {formulaTooltipCountLabel}</span>
                  </span>
                  <span className="mt-1 block text-[11px] font-medium text-stone-600">
                    {localeText.salesTotal} <span className="font-semibold text-stone-900">{formatSalesCell(salesMetric?.sales)}</span>
                  </span>
                  <span className="mt-1 block text-[11px] font-medium text-stone-600">
                    {formulaTooltipCountLabel} <span className="font-semibold text-stone-900">{formatStoreCount(salesMetric?.storeCount, storeTooltipMode, language)}</span>
                  </span>
                </span>
              </span>
            ) : (
              `${salesValue} K ${currencyLabel}`
            )}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-400">YOY</p>
          <p className="mt-1">
            <span className={`inline-flex rounded-full px-3 py-1 text-base font-semibold ${pillTone(yoyValue)}`}>{formatYoyRate(yoyValue)}</span>
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-400">{localeText.yoyTwo}</p>
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
  selectedSalesLabel,
  selectedSalesValue,
  discountSummary,
  summaryValue,
  salesLabel,
  yoyLabel,
  salesValue,
  salesDetail,
  yoyValue,
  yoyDetail,
  yoyTone,
  localeText,
}: {
  channel: string;
  basis: string;
  selectedSalesLabel: string;
  selectedSalesValue: string;
  discountSummary?: DiscountSummary;
  summaryValue: ReactNode | null;
  salesLabel: string;
  yoyLabel: string;
  salesValue: string;
  salesDetail?: ReactNode;
  yoyValue: string;
  yoyDetail?: ReactNode;
  yoyTone?: number | null;
  localeText: LocaleText;
}) {
  return (
    <article className="rounded-[24px] border border-white/55 bg-white/85 p-4 shadow-[0_16px_40px_rgba(65,46,24,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold leading-snug text-stone-900">{channel}</p>
          <p className="mt-1 text-xs text-stone-400">{basis}</p>
          <div className="mt-3">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-400">{selectedSalesLabel}</p>
            <p className="mt-1 text-base font-semibold text-stone-900">{selectedSalesValue}</p>
          </div>
        </div>
        <DiscountSummaryBadge summary={discountSummary} label={localeText.discountRate} />
      </div>
      {summaryValue ? <p className="mt-2 text-[12px] font-semibold text-stone-600">{summaryValue}</p> : null}
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

function MonthlyProfitTrendCard({
  title,
  subtitle,
  points,
  currencyLabel,
  language,
}: {
  title: string;
  subtitle: string;
  points: MonthlyProfitTrendPoint[];
  currencyLabel: CurrencyMode;
  language: Language;
}) {
  const series = [
    {
      key: "sales",
      label: language === "en" ? "Net Sales" : "\uC2E4\uD310\uB9E4\uCD9C",
      color: "#0f766e",
      values: points.map((point) => point.sales),
    },
    {
      key: "grossProfit",
      label: language === "en" ? "Gross Profit" : "\uB9E4\uCD9C\uCD1D\uC774\uC775",
      color: "#2563eb",
      values: points.map((point) => point.grossProfit),
    },
    {
      key: "directProfit",
      label: language === "en" ? "Direct Profit" : "\uC9C1\uC811\uC774\uC775",
      color: "#d97706",
      values: points.map((point) => point.directProfit),
    },
    {
      key: "operatingProfit",
      label: language === "en" ? "Operating Profit" : "\uC601\uC5C5\uC774\uC775",
      color: "#dc2626",
      values: points.map((point) => point.operatingProfit),
    },
  ] as const;

  const numericValues = series.flatMap((item) => item.values).filter((value): value is number => value != null && !Number.isNaN(value));
  const minValue = numericValues.length > 0 ? Math.min(...numericValues, 0) : 0;
  const maxValue = numericValues.length > 0 ? Math.max(...numericValues, 0) : 0;
  const range = maxValue - minValue || 1;

  const width = 100;
  const height = 40;
  const xForIndex = (index: number) => (points.length <= 1 ? 0 : (index / (points.length - 1)) * width);
  const yForValue = (value: number) => height - ((value - minValue) / range) * height;
  const axisTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    ratio,
    value: minValue + range * ratio,
  }));

  return (
    <article className="rounded-[24px] border border-white/55 bg-white/88 p-4 shadow-[0_16px_40px_rgba(65,46,24,0.10)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold leading-snug text-stone-900">{title}</p>
          <p className="mt-1 text-xs text-stone-400">{subtitle}</p>
        </div>
        <p className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">K {currencyLabel}</p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-[20px] border border-stone-200/80 bg-[#fcfaf6] p-3">
          <div className="mb-3 flex flex-wrap gap-2">
            {series.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-3">
            <div className="relative h-56 text-[11px] font-medium text-stone-500">
              {axisTicks.map((tick) => (
                <span
                  key={tick.ratio}
                  className="absolute right-0 -translate-y-1/2"
                  style={{ top: `${(1 - tick.ratio) * 100}%` }}
                >
                  {formatSalesCell(tick.value)}
                </span>
              ))}
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full overflow-visible">
              {axisTicks.map((tick) => {
                const y = height - tick.ratio * height;
                return <line key={tick.ratio} x1="0" y1={y} x2={width} y2={y} stroke="#e7e5e4" strokeDasharray="1.5 2" strokeWidth="0.4" />;
              })}
              {series.map((item) => {
                const coords = item.values
                  .map((value, index) => (value == null ? null : `${xForIndex(index)},${yForValue(value)}`))
                  .filter((value): value is string => value != null);
                if (coords.length === 0) return null;
                return <polyline key={item.key} fill="none" stroke={item.color} strokeWidth="1.3" points={coords.join(" ")} />;
              })}
              {series.map((item) =>
                item.values.map((value, index) =>
                  value == null ? null : (
                    <circle key={`${item.key}-${index}`} cx={xForIndex(index)} cy={yForValue(value)} r="1.1" fill={item.color} />
                  ),
                ),
              )}
            </svg>
          </div>

          <div className="mt-2 grid grid-cols-6 gap-2 text-[11px] font-medium text-stone-500 md:grid-cols-12">
            {points.map((point) => (
              <span key={point.month} className="text-center">
                {language === "en" ? MONTH_NAMES_EN[point.month - 1] : `${point.month}\uC6D4`}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
          {series.map((item) => {
            const latestValue = item.values[item.values.length - 1];
            const firstValue = item.values[0];
            const change = calculateRatioChange(latestValue, firstValue);

            return (
              <div key={item.key} className="rounded-[18px] border border-stone-200 bg-[#fcfaf6] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <p className="text-sm font-semibold text-stone-900">{item.label}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pillTone(change)}`}>
                    {language === "en" ? "Jan to Latest" : "\uC5F0\uCD08 \uB300\uBE44"} {formatYoyRate(change)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">
                      {language === "en" ? "Latest" : "\uCD5C\uADFC \uC6D4"}
                    </p>
                    <p className="mt-1 font-semibold text-stone-900">{formatProfitAmount(latestValue)} K {currencyLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">
                      {language === "en" ? "Peak" : "\uC5F0\uC911 \uCD5C\uACE0"}
                    </p>
                    <p className="mt-1 font-semibold text-stone-900">
                      {formatProfitAmount(maxSeriesValue(item.values))} K {currencyLabel}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function ProfitSummaryCard({
  cardKey,
  title,
  basis,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  metric,
  currencyLabel,
  language,
  expandedProfitBreakdowns,
  onToggleBreakdown,
}: {
  cardKey: string;
  title: string;
  basis: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  metric: ProfitBreakdownMetric;
  currencyLabel: CurrencyMode;
  language: Language;
  expandedProfitBreakdowns: Record<string, boolean>;
  onToggleBreakdown: (detailKey: string) => void;
}) {
  const directOtherKey = `${cardKey}::direct-other`;
  const directOtherExpanded = expandedProfitBreakdowns[directOtherKey] ?? false;
  const profitMetricDetailLabel = language === "en" ? "Margin" : "이익률";
  const grossProfitDetail = [
    `YOY ${formatYoyRate(metric.grossProfitYoy)}`,
    `${profitMetricDetailLabel} ${formatDiscountRate(metric.grossMargin)} / ${formatDiscountDelta(metric.grossMarginDeltaPp)}`,
  ].join("  ");
  const directProfitDetail = [
    `YOY ${formatYoyRate(metric.directProfitYoy)}`,
    `${profitMetricDetailLabel} ${formatDiscountRate(metric.directMargin)} / ${formatDiscountDelta(metric.directMarginDeltaPp)}`,
  ].join("  ");

  return (
    <article className="rounded-[24px] border border-white/55 bg-white/88 p-4 shadow-[0_16px_40px_rgba(65,46,24,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold leading-snug text-stone-900">{title}</p>
          <p className="mt-1 text-xs text-stone-400">{basis}</p>
        </div>
      </div>
      <div className="mt-3 rounded-[18px] border border-stone-200/80 bg-stone-50/70 p-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">{primaryLabel}</p>
        <p className="mt-1 text-lg font-semibold text-stone-900">{primaryValue}</p>
        <p className="mt-2 text-xs font-medium text-stone-500">{secondaryLabel}</p>
        <p className="mt-1 text-sm font-semibold text-stone-700">{secondaryValue}</p>
      </div>
      <div className="mt-4 space-y-1.5 rounded-[18px] border border-stone-200/80 bg-white/80 p-3">
        <ProfitLine label={getProfitText("tagSales", language)} value={formatProfitAmount(metric.tagSales)} />
        <ProfitLine label={getProfitText("discountRate", language)} value={formatDiscountRate(metric.discountRate)} />
        <ProfitLine label={getProfitText("sales", language)} value={formatProfitAmount(metric.sales)} />
        <ProfitLine label={getProfitText("cogs", language)} value={formatProfitAmount(metric.cogs)} />
        <ProfitLine
          label={getProfitText("grossProfit", language)}
          value={formatProfitAmount(metric.grossProfit)}
          strong
          tone={metric.grossProfit}
          detail={grossProfitDetail}
        />
        <ProfitLine label={getProfitText("directExpense", language)} value={formatProfitAmount(sumProfitValues(metric.directPayroll, metric.directRent, metric.directOther))} strong />
        <ProfitLine label={getProfitText("directPayroll", language)} value={formatProfitAmount(metric.directPayroll)} nested />
        <ProfitLine label={getProfitText("directRent", language)} value={formatProfitAmount(metric.directRent)} nested />
        <ProfitExpandableLine
          label={getProfitText("directOther", language)}
          value={formatProfitAmount(metric.directOther)}
          nested
          expanded={directOtherExpanded}
          onToggle={() => onToggleBreakdown(directOtherKey)}
          detailEntries={metric.directOtherDetails}
        />
        <div className="mt-2 border-t border-stone-200 pt-2">
          <ProfitLine
            label={getProfitText("directProfit", language)}
            value={formatProfitAmount(metric.directProfit)}
            strong
            tone={metric.directProfit}
            detail={directProfitDetail}
          />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-stone-400">{language === "en" ? `Unit: 1k ${currencyLabel}` : `단위: 1k ${currencyLabel}`}</p>
    </article>
  );
}

function ProfitLine({
  label,
  value,
  nested = false,
  strong = false,
  tone,
  detail,
}: {
  label: string;
  value: string;
  nested?: boolean;
  strong?: boolean;
  tone?: number | null;
  detail?: string | null;
}) {
  return (
    <div className={`${nested ? "pl-4" : ""}`}>
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className={`${strong ? "font-semibold text-stone-900" : "text-stone-600"}`}>{label}</span>
        <span className={`${strong ? valueTone(tone ?? 0).replace("text-stone-400", "text-stone-900") : "text-stone-700"} font-medium`}>{value}</span>
      </div>
      {detail ? <p className="mt-0.5 text-[11px] text-stone-400">{detail}</p> : null}
    </div>
  );
}

function ProfitExpandableLine({
  label,
  value,
  expanded,
  onToggle,
  detailEntries,
  nested = false,
}: {
  label: string;
  value: string;
  expanded: boolean;
  onToggle: () => void;
  detailEntries: Record<string, number>;
  nested?: boolean;
}) {
  const entries = Object.entries(detailEntries).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-3 text-left text-[12px] ${nested ? "pl-4" : ""}`}
      >
        <span className="inline-flex items-center gap-1 text-stone-600">
          <span className={`transition ${expanded ? "rotate-90" : ""}`}>▸</span>
          <span>{label}</span>
        </span>
        <span className="font-medium text-stone-700">{value}</span>
      </button>
      {expanded ? (
        <div className="mt-1 space-y-1 pl-8">
          {entries.length > 0 ? (
            entries.map(([name, amount]) => (
              <ProfitLine key={name} label={name} value={formatProfitAmount(amount)} nested />
            ))
          ) : (
            <ProfitLine label="-" value="-" nested />
          )}
        </div>
      ) : null}
    </div>
  );
}

function MetricCell({
  metric,
  emphasize = false,
  viewMode,
  basisMode = "sales",
  storeTooltipMode,
  localeText,
  language,
}: {
  metric: CellMetric;
  emphasize?: boolean;
  viewMode: ViewMode;
  basisMode?: TableBasisMode;
  storeTooltipMode?: StoreTooltipMode;
  localeText: LocaleText;
  language: Language;
}) {
  const displayMetric = getDisplayMetric(metric, basisMode);
  const storeCountYoyPrev = calculateStoreCountChange(metric.storeCount, metric.previousStoreCount);
  const storeCountYoyTwo = calculateStoreCountChange(metric.storeCount, metric.twoYearStoreCount);
  const canShowStoreTooltip =
    storeTooltipMode != null && (metric.storeCount != null || metric.previousStoreCount != null || metric.twoYearStoreCount != null);
  const storeCountLabel =
    storeTooltipMode === "ytd"
      ? localeText.ytdAverageStoreCount
      : storeTooltipMode === "annual"
        ? localeText.annualAverageStoreCount
        : localeText.storeCount;
  const tooltipPositionClass =
    storeTooltipMode === "annual"
      ? "right-full top-1/2 mr-2 -translate-y-1/2"
      : "left-1/2 top-full mt-1 -translate-x-1/2";
  const canShowFormulaTooltip =
    basisMode === "perStore" && viewMode === "sales" && storeTooltipMode != null && displayMetric.sales != null && metric.storeCount != null;
  const formulaTooltipTitle =
    storeTooltipMode === "month"
      ? localeText.monthPerStoreFormula
      : storeTooltipMode === "ytd"
        ? localeText.ytdPerStoreFormula
        : localeText.annualPerStoreFormula;
  const formulaTooltipCountLabel =
    storeTooltipMode === "month"
      ? localeText.storeCount
      : storeTooltipMode === "ytd"
        ? localeText.ytdAverageStoreCount
        : localeText.annualAverageStoreCount;
  const formulaTooltipDescription =
    storeTooltipMode === "month" ? localeText.formulaDescriptionMonth : localeText.formulaDescriptionAggregate;

  return (
    <div>
      {viewMode === "sales" ? (
        <div className={`text-center text-[16px] font-semibold ${emphasize ? "text-stone-950" : "text-stone-900"}`}>
          {canShowFormulaTooltip ? (
            <div className="group relative inline-flex cursor-help items-center justify-center">
              <span className="border-b border-dotted border-stone-400/80">{formatMetricValue(displayMetric.sales, basisMode)}</span>
              <div className={`pointer-events-none absolute z-20 hidden w-72 rounded-[18px] border border-stone-200 bg-white px-3 py-3 text-left shadow-[0_12px_28px_rgba(28,25,23,0.16)] group-hover:block ${tooltipPositionClass}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">{localeText.formulaExpression}</p>
                <p className="mt-2 text-[12px] font-semibold text-stone-900">{formulaTooltipTitle}</p>
                <p className="mt-1 text-[11px] leading-5 text-stone-600">{formulaTooltipDescription}</p>
                <p className="mt-2 text-[11px] font-medium text-stone-700">
                  {localeText.formulaExpression} <span className="font-semibold text-stone-900">{localeText.salesTotal} / {formulaTooltipCountLabel}</span>
                </p>
                <p className="mt-1 text-[11px] font-medium text-stone-600">
                  {localeText.salesTotal} <span className="font-semibold text-stone-900">{formatSalesCell(metric.sales)}</span>
                </p>
                <p className="mt-1 text-[11px] font-medium text-stone-600">
                  {formulaTooltipCountLabel} <span className="font-semibold text-stone-900">{formatStoreCount(metric.storeCount, storeTooltipMode, language)}</span>
                </p>
              </div>
            </div>
          ) : (
            formatMetricValue(displayMetric.sales, basisMode)
          )}
        </div>
      ) : null}
      <div className={`text-center text-[12px] font-semibold ${viewMode === "sales" ? "mt-1 " : ""}${valueTone(displayMetric.yoyPrev)}`}>
        {canShowStoreTooltip ? (
          <div className="group relative inline-flex cursor-help items-center justify-center">
            <span>{localeText.yoyPrev} {formatYoyRate(displayMetric.yoyPrev)}</span>
            <div className={`pointer-events-none absolute z-20 hidden w-56 rounded-[18px] border border-stone-200 bg-white px-3 py-2 text-left shadow-[0_12px_28px_rgba(28,25,23,0.16)] group-hover:block ${tooltipPositionClass}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">{localeText.storeCount}</p>
              <p className="mt-2 text-[11px] font-medium text-stone-600">
                {storeCountLabel} <span className="font-semibold text-stone-900">{formatStoreCount(metric.storeCount, storeTooltipMode, language)}</span>
              </p>
              <p className="mt-1 text-[11px] font-medium text-stone-600">
                {localeText.previousStoreCount} <span className="font-semibold text-stone-900">{formatStoreCount(metric.previousStoreCount, storeTooltipMode, language)}</span>
                <span className={`ml-2 ${valueTone(storeCountYoyPrev)}`}>YOY {formatYoyRate(storeCountYoyPrev)}</span>
              </p>
              <p className="mt-1 text-[11px] font-medium text-stone-600">
                {localeText.twoYearStoreCount} <span className="font-semibold text-stone-900">{formatStoreCount(metric.twoYearStoreCount, storeTooltipMode, language)}</span>
                <span className={`ml-2 ${valueTone(storeCountYoyTwo)}`}>{localeText.yoyTwo} {formatYoyRate(storeCountYoyTwo)}</span>
              </p>
            </div>
          </div>
        ) : (
          <span>{localeText.yoyPrev} {formatYoyRate(displayMetric.yoyPrev)}</span>
        )}
      </div>
      <div className={`mt-1 text-center text-[9px] ${valueTone(displayMetric.yoyTwo)}`}>{localeText.yoyTwo} {formatYoyRate(displayMetric.yoyTwo)}</div>
    </div>
  );
}

function DiscountSummaryBadge({ summary, label }: { summary?: DiscountSummary; label: string }) {
  if (!summary || summary.rate == null) return null;

  return (
    <div className="text-right">
      <p className="text-[11px] font-medium text-stone-400">{label}</p>
      <p className="mt-1 text-[13px] leading-none">
        <span className="font-semibold italic text-sky-700">{formatDiscountRate(summary.rate)}</span>
        {summary.deltaPp != null ? <span className="ml-1 text-[11px] font-semibold text-sky-600">{formatDiscountDelta(summary.deltaPp)}</span> : null}
      </p>
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

function formatPeriodOptionLabel(year: number, month: number, language: Language = "kr") {
  if (language === "en") {
    return `${MONTH_NAMES_EN[month - 1]} '${String(year).slice(-2)}`;
  }
  const shortYear = String(year).slice(-2);
  return `${shortYear}년 ${month}월`;
}

function formatMonthHeaderLabel(month: number, selectedMonth: number, language: Language = "kr") {
  if (language === "en") {
    const label = MONTH_NAMES_EN[month - 1];
    return month > selectedMonth ? `${label} (E)` : label;
  }
  return month > selectedMonth ? `${month}월 (e)` : `${month}월`;
}

function formatCountryLabel(country: string, language: Language = "kr") {
  if (language !== "en") return country;
  if (country === "홍콩") return "HK";
  if (country === "마카오") return "Macau";
  if (country === "전체") return "All";
  return country;
}

function formatChannelLabel(channel: string, language: Language = "kr") {
  if (language !== "en") return channel;
  if (channel === "리테일") return "Retail";
  if (channel === "아울렛") return "Outlet";
  if (channel === "온라인") return "Online";
  return channel;
}

function formatChannelGroupLabel(channel: string, language: Language = "kr") {
  if (language !== "en") return channel;

  const replacements: Array<[string, string]> = [
    ["홍콩", "HK"],
    ["마카오", "Macau"],
    ["대만", "Taiwan"],
    ["리테일", "Retail"],
    ["아울렛", "Outlet"],
    ["온라인", "Online"],
  ];

  let formatted = channel;
  for (const [from, to] of replacements) {
    formatted = formatted.replaceAll(from, to);
  }
  return formatted;
}

function formatStoreName(storeName: string, language: Language = "kr") {
  if (language !== "en") return storeName;

  const replacements: Array<[string, string]> = [
    ["홍콩", "HK"],
    ["마카오", "Macau"],
    ["대만", "Taiwan"],
    ["리테일", "Retail"],
    ["아울렛", "Outlet"],
    ["온라인", "Online"],
    ["자사몰", "91APP"],
    ["한신아레나", "Hanshin Arena"],
    ["링커우아울렛", "Linkou Outlet"],
  ];

  let formatted = storeName;
  for (const [from, to] of replacements) {
    formatted = formatted.replaceAll(from, to);
  }
  return formatted;
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

function getSortValue(row: TableRow, sortMonth: number, viewMode: ViewMode, basisMode: TableBasisMode) {
  const metric = row.months[sortMonth - 1];
  if (!metric) return Number.NEGATIVE_INFINITY;
  const displayMetric = getDisplayMetric(metric, basisMode);
  const value = viewMode === "yoy" ? displayMetric.yoyPrev : displayMetric.sales;
  return value == null || Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
}

function sortRowsForMonth(rows: TableRow[], sortMonth: number | null, sortDirection: SortDirection, viewMode: ViewMode, basisMode: TableBasisMode) {
  if (sortMonth == null) return rows;
  return [...rows].sort((a, b) => {
    const rawDiff = getSortValue(b, sortMonth, viewMode, basisMode) - getSortValue(a, sortMonth, viewMode, basisMode);
    const diff = sortDirection === "desc" ? rawDiff : -rawDiff;
    if (diff !== 0) return diff;
    return a.storeName.localeCompare(b.storeName);
  });
}

function getProfitSortValue(row: ProfitTableRow, sortMonth: number, viewMode: ViewMode) {
  const metric = row.months[sortMonth - 1];
  if (!metric) return Number.NEGATIVE_INFINITY;
  const value = viewMode === "yoy" ? metric.yoyPrev : metric.value;
  return value == null || Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
}

function sortProfitRowsForMonth(rows: ProfitTableRow[], sortMonth: number | null, sortDirection: SortDirection, viewMode: ViewMode) {
  if (sortMonth == null) return rows;
  return [...rows].sort((a, b) => {
    const rawDiff = getProfitSortValue(b, sortMonth, viewMode) - getProfitSortValue(a, sortMonth, viewMode);
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

function formatDiscountRate(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDiscountDelta(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value > 0) return `+${value.toFixed(1)}%p`;
  if (value < 0) return `${String.fromCharCode(0x25B3)}${Math.abs(value).toFixed(1)}%p`;
  return `${value.toFixed(1)}%p`;
}

function calculateDiscountRate(sales: number | null | undefined, tagSales: number | null | undefined, vatFactor = 1) {
  if (sales == null || tagSales == null || Number.isNaN(sales) || Number.isNaN(tagSales) || tagSales === 0) {
    return null;
  }
  return 1 - (sales * vatFactor) / tagSales;
}

function getDiscountSummary(metric: CellMetric, vatFactor = 1): DiscountSummary {
  const rate = calculateDiscountRate(metric.sales, metric.tagSales, vatFactor);
  const previousRate = calculateDiscountRate(metric.previousSales, metric.tagPreviousSales, vatFactor);
  return {
    rate,
    deltaPp: rate != null && previousRate != null ? (rate - previousRate) * 100 : null,
  };
}

function convertProfitAccountsToTwd(
  accounts: Record<string, Record<string, number>>,
  exchangeRates: Record<string, number>,
  referenceYear: number,
) {
  return Object.fromEntries(
    Object.entries(accounts).map(([accountName, periods]) => {
      if (accountName === "할인율") {
        return [accountName, periods];
      }
      return [accountName, convertSalesMapToTwd(periods, exchangeRates, referenceYear)];
    }),
  );
}

function getProfitChannelHighlightLabel(country: string, channel: string) {
  if (country === "MC") return "마카오";
  if (country === "HK" && channel === "리테일") return "홍콩 리테일";
  if (country === "HK" && channel === "아울렛") return "홍콩 아울렛";
  if (country === "HK" && channel === "온라인") return "홍콩 온라인";
  return `${country} ${channel}`.trim();
}

function emptyProfitMetric(): ProfitBreakdownMetric {
  return {
    tagSales: null,
    sales: null,
    previousSales: null,
    discountRate: null,
    cogs: null,
    grossProfit: null,
    previousGrossProfit: null,
    grossMargin: null,
    grossMarginDeltaPp: null,
    grossProfitYoy: null,
    directPayroll: null,
    directRent: null,
    directOther: null,
    directProfit: null,
    previousDirectProfit: null,
    directMargin: null,
    directMarginDeltaPp: null,
    directProfitYoy: null,
    operatingPayroll: null,
    operatingRent: null,
    advertising: null,
    operatingOther: null,
    operatingProfit: null,
    previousOperatingProfit: null,
    operatingMargin: null,
    operatingMarginDeltaPp: null,
    operatingProfitYoy: null,
    directOtherDetails: {},
    operatingOtherDetails: {},
  };
}

function sumProfitPeriods(source: Record<string, number> | undefined, year: number, selectedMonth: number, mode: CardMetricMode) {
  if (!source) return null;
  if (mode === "month") {
    const value = source[formatPeriod(year, selectedMonth)];
    return value == null ? null : value;
  }
  if (mode === "annual") {
    let total = 0;
    let hasValue = false;
    for (let month = 1; month <= 12; month += 1) {
      const value = source[formatPeriod(year, month)];
      if (value == null) continue;
      total += value;
      hasValue = true;
    }
    return hasValue ? total : null;
  }
  return sumPeriods(source, year, selectedMonth);
}

function sumProfitValues(...values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0);
}

function calculateMarginValue(amount: number | null | undefined, sales: number | null | undefined) {
  if (amount == null || sales == null || Number.isNaN(amount) || Number.isNaN(sales) || sales === 0) {
    return null;
  }
  return amount / sales;
}

function calculateMarginDeltaPp(currentMargin: number | null | undefined, previousMargin: number | null | undefined) {
  if (currentMargin == null || previousMargin == null || Number.isNaN(currentMargin) || Number.isNaN(previousMargin)) {
    return null;
  }
  return (currentMargin - previousMargin) * 100;
}

function mergeProfitDetailMaps(maps: Array<Record<string, number>>) {
  const merged: Record<string, number> = {};
  for (const map of maps) {
    for (const [key, value] of Object.entries(map)) {
      merged[key] = (merged[key] ?? 0) + value;
    }
  }
  return Object.fromEntries(
    Object.entries(merged)
      .filter(([, value]) => Math.abs(value) > 0.0001)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}

function ProfitTrendCell({
  metric,
  emphasize = false,
  showMargin = false,
  language,
}: {
  metric: ProfitTrendMetric;
  emphasize?: boolean;
  showMargin?: boolean;
  language: Language;
}) {
  const prevDelta = metric.value != null && metric.previousValue != null ? metric.value - metric.previousValue : null;
  const twoYearDelta = metric.value != null && metric.twoYearValue != null ? metric.value - metric.twoYearValue : null;
  return (
    <div>
      <div className={`text-center text-[16px] font-semibold ${emphasize ? "text-stone-950" : valueTone(metric.value).replace("text-stone-400", "text-stone-900")}`}>
        {formatProfitAmount(metric.value)}
      </div>
      <div className={`text-center text-[12px] font-semibold ${showMargin ? "mt-1" : ""}${valueTone(prevDelta)}`}>
        {showMargin
          ? (language === "en" ? "Margin " : "이익률 ") + formatDiscountRate(metric.margin)
          : `${language === "en" ? "vs LY" : "전년비"} ${formatProfitDelta(prevDelta)}`}
      </div>
      <div className={`mt-1 text-center text-[9px] ${valueTone(showMargin ? prevDelta : twoYearDelta)}`}>
        {showMargin
          ? `${language === "en" ? "vs LY" : "전년비"} ${formatProfitDelta(prevDelta)}`
          : `${language === "en" ? "vs 2YA" : "전전년비"} ${formatYoyRate(metric.yoyTwo)}`}
      </div>
    </div>
  );
}

function ProfitDeltaCell({
  metric,
  emphasize = false,
  showMargin = false,
  language,
}: {
  metric: ProfitTrendMetric;
  emphasize?: boolean;
  showMargin?: boolean;
  language: Language;
}) {
  const prevDelta = metric.value != null && metric.previousValue != null ? metric.value - metric.previousValue : null;
  const twoYearDelta = metric.value != null && metric.twoYearValue != null ? metric.value - metric.twoYearValue : null;
  const valueClass = metric.value != null && metric.value < 0
    ? "text-red-600"
    : emphasize
      ? "text-stone-950"
      : valueTone(metric.value).replace("text-stone-400", "text-stone-900");

  return (
    <div>
      <div className={`text-center text-[16px] font-semibold ${valueClass}`}>
        {formatProfitAmount(metric.value)}
      </div>
      <div className={`text-center text-[12px] font-semibold ${showMargin ? "mt-1" : ""}${valueTone(prevDelta)}`}>
        {showMargin
          ? (language === "en" ? "Margin " : "\uC774\uC775\uB960 ") + formatDiscountRate(metric.margin)
          : `${language === "en" ? "vs LY" : "\uC804\uB144\uBE44"} ${formatProfitDelta(prevDelta)}`}
      </div>
      <div className={`mt-1 text-center text-[9px] ${valueTone(showMargin ? prevDelta : twoYearDelta)}`}>
        {showMargin
          ? `${language === "en" ? "vs LY" : "\uC804\uB144\uBE44"} ${formatProfitDelta(prevDelta)}`
          : `${language === "en" ? "vs 2YA" : "\uC804\uC804\uB144\uBE44"} ${formatProfitDelta(twoYearDelta)}`}
      </div>
    </div>
  );
}

function maxSeriesValue(values: Array<number | null>) {
  const numericValues = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (numericValues.length === 0) return null;
  return Math.max(...numericValues);
}

function buildProfitMetricForStore(
  store: ProfitCardData[string][string],
  latestYear: number,
  selectedMonth: number,
  mode: CardMetricMode,
  vatFactor = 1,
): ProfitBreakdownMetric {
  const metric = emptyProfitMetric();
  const accounts = store.accounts ?? {};
  metric.tagSales = sumProfitPeriods(accounts[TAG_SALES_ACCOUNT], latestYear, selectedMonth, mode);
  metric.sales = sumProfitPeriods(accounts[SALES_ACCOUNT], latestYear, selectedMonth, mode);
  metric.previousSales = sumProfitPeriods(accounts[SALES_ACCOUNT], latestYear - 1, selectedMonth, mode);
  metric.cogs = sumProfitPeriods(accounts[COGS_ACCOUNT], latestYear, selectedMonth, mode);
  const rawGrossProfit = sumProfitPeriods(accounts[GROSS_PROFIT_ACCOUNT], latestYear, selectedMonth, mode);
  metric.grossProfit = rawGrossProfit ?? (metric.sales != null && metric.cogs != null ? metric.sales - metric.cogs : null);
  metric.previousGrossProfit = sumProfitPeriods(accounts[GROSS_PROFIT_ACCOUNT], latestYear - 1, selectedMonth, mode);

  const directOtherDetails: Record<string, number> = {};
  const operatingOtherDetails: Record<string, number> = {};
  const isOffice = store.channel === "\uC624\uD53C\uC2A4";

  for (const [accountName, periods] of Object.entries(accounts)) {
    if (!EXPENSE_ACCOUNT_SET.has(accountName)) continue;
    const amount = sumProfitPeriods(periods, latestYear, selectedMonth, mode);
    if (amount == null) continue;

    if (isOffice) {
      if (accountName === PAYROLL_ACCOUNT) {
        metric.operatingPayroll = (metric.operatingPayroll ?? 0) + amount;
      } else if (accountName === RENT_ACCOUNT) {
        metric.operatingRent = (metric.operatingRent ?? 0) + amount;
      } else if (accountName === ADVERTISING_ACCOUNT) {
        metric.advertising = (metric.advertising ?? 0) + amount;
      } else {
        operatingOtherDetails[accountName] = (operatingOtherDetails[accountName] ?? 0) + amount;
      }
      continue;
    }

    if (accountName === PAYROLL_ACCOUNT) {
      metric.directPayroll = (metric.directPayroll ?? 0) + amount;
    } else if (accountName === RENT_ACCOUNT) {
      metric.directRent = (metric.directRent ?? 0) + amount;
    } else {
      directOtherDetails[accountName] = (directOtherDetails[accountName] ?? 0) + amount;
    }
  }

  metric.directOtherDetails = directOtherDetails;
  metric.operatingOtherDetails = operatingOtherDetails;
  metric.directOther = sumProfitValues(...Object.values(directOtherDetails));
  metric.operatingOther = sumProfitValues(...Object.values(operatingOtherDetails));
  metric.discountRate = calculateDiscountRate(metric.sales, metric.tagSales, vatFactor);

  const directExpense = sumProfitValues(metric.directPayroll, metric.directRent, metric.directOther) ?? 0;
  const operatingExpense = sumProfitValues(metric.operatingPayroll, metric.operatingRent, metric.advertising, metric.operatingOther) ?? 0;
  metric.directProfit = metric.grossProfit != null ? metric.grossProfit - directExpense : null;

  const previousDirectPayroll = isOffice ? null : sumProfitPeriods(accounts[PAYROLL_ACCOUNT], latestYear - 1, selectedMonth, mode);
  const previousDirectRent = isOffice ? null : sumProfitPeriods(accounts[RENT_ACCOUNT], latestYear - 1, selectedMonth, mode);
  const previousDirectOther = isOffice
    ? null
    : sumProfitValues(
        ...Object.entries(accounts)
          .filter(([accountName]) => EXPENSE_ACCOUNT_SET.has(accountName) && accountName !== PAYROLL_ACCOUNT && accountName !== RENT_ACCOUNT)
          .map(([, periods]) => sumProfitPeriods(periods, latestYear - 1, selectedMonth, mode)),
      );
  const previousDirectExpense = sumProfitValues(previousDirectPayroll, previousDirectRent, previousDirectOther) ?? 0;
  metric.previousDirectProfit = metric.previousGrossProfit != null ? metric.previousGrossProfit - previousDirectExpense : null;

  const rawOperatingProfit = sumProfitPeriods(accounts[OPERATING_PROFIT_ACCOUNT], latestYear, selectedMonth, mode);
  metric.operatingProfit = rawOperatingProfit ?? (
    metric.directProfit != null
      ? metric.directProfit - operatingExpense
      : null
  );
  metric.previousOperatingProfit = sumProfitPeriods(accounts[OPERATING_PROFIT_ACCOUNT], latestYear - 1, selectedMonth, mode);

  metric.grossMargin = calculateMarginValue(metric.grossProfit, metric.sales);
  const previousGrossMargin = calculateMarginValue(metric.previousGrossProfit, metric.previousSales);
  metric.grossMarginDeltaPp = calculateMarginDeltaPp(metric.grossMargin, previousGrossMargin);
  metric.grossProfitYoy = calculateRatioChange(metric.grossProfit, metric.previousGrossProfit);

  metric.directMargin = calculateMarginValue(metric.directProfit, metric.sales);
  const previousDirectMargin = calculateMarginValue(metric.previousDirectProfit, metric.previousSales);
  metric.directMarginDeltaPp = calculateMarginDeltaPp(metric.directMargin, previousDirectMargin);
  metric.directProfitYoy = calculateRatioChange(metric.directProfit, metric.previousDirectProfit);

  metric.operatingMargin = calculateMarginValue(metric.operatingProfit, metric.sales);
  const previousOperatingMargin = calculateMarginValue(metric.previousOperatingProfit, metric.previousSales);
  metric.operatingMarginDeltaPp = calculateMarginDeltaPp(metric.operatingMargin, previousOperatingMargin);
  metric.operatingProfitYoy = calculateRatioChange(metric.operatingProfit, metric.previousOperatingProfit);
  return metric;
}

function aggregateProfitMetrics(metrics: ProfitBreakdownMetric[], vatFactor = 1): ProfitBreakdownMetric {
  const merged = emptyProfitMetric();
  const numericKeys: Array<keyof Omit<ProfitBreakdownMetric, "directOtherDetails" | "operatingOtherDetails" | "discountRate">> = [
    "tagSales",
    "sales",
    "previousSales",
    "cogs",
    "grossProfit",
    "previousGrossProfit",
    "directPayroll",
    "directRent",
    "directOther",
    "directProfit",
    "previousDirectProfit",
    "operatingPayroll",
    "operatingRent",
    "advertising",
    "operatingOther",
    "operatingProfit",
    "previousOperatingProfit",
  ];

  for (const key of numericKeys) {
    const value = sumProfitValues(...metrics.map((metric) => metric[key] as number | null | undefined));
    merged[key] = value as never;
  }

  merged.directOtherDetails = mergeProfitDetailMaps(metrics.map((metric) => metric.directOtherDetails));
  merged.operatingOtherDetails = mergeProfitDetailMaps(metrics.map((metric) => metric.operatingOtherDetails));
  merged.discountRate = calculateDiscountRate(merged.sales, merged.tagSales, vatFactor);

  merged.grossMargin = calculateMarginValue(merged.grossProfit, merged.sales);
  const previousGrossMargin = calculateMarginValue(merged.previousGrossProfit, merged.previousSales);
  merged.grossMarginDeltaPp = calculateMarginDeltaPp(merged.grossMargin, previousGrossMargin);
  merged.grossProfitYoy = calculateRatioChange(merged.grossProfit, merged.previousGrossProfit);

  merged.directMargin = calculateMarginValue(merged.directProfit, merged.sales);
  const previousDirectMargin = calculateMarginValue(merged.previousDirectProfit, merged.previousSales);
  merged.directMarginDeltaPp = calculateMarginDeltaPp(merged.directMargin, previousDirectMargin);
  merged.directProfitYoy = calculateRatioChange(merged.directProfit, merged.previousDirectProfit);

  merged.operatingMargin = calculateMarginValue(merged.operatingProfit, merged.sales);
  const previousOperatingMargin = calculateMarginValue(merged.previousOperatingProfit, merged.previousSales);
  merged.operatingMarginDeltaPp = calculateMarginDeltaPp(merged.operatingMargin, previousOperatingMargin);
  merged.operatingProfitYoy = calculateRatioChange(merged.operatingProfit, merged.previousOperatingProfit);
  return merged;
}

function formatProfitAmount(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return formatSalesCell(value);
}

function formatProfitDelta(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value > 0) return `+${formatSalesCell(value)}`;
  if (value < 0) return `${String.fromCharCode(0x25B3)}${formatSalesCell(Math.abs(value))}`;
  return formatSalesCell(0);
}

function getProfitText(
  key:
    | "tagSales"
    | "discountRate"
    | "sales"
    | "cogs"
    | "grossProfit"
    | "directExpense"
    | "directPayroll"
    | "directRent"
    | "directOther"
    | "directProfit"
    | "operatingExpense"
    | "operatingPayroll"
    | "operatingRent"
    | "advertising"
    | "operatingOther"
    | "operatingProfit",
  language: Language,
) {
  const labels = language === "en"
    ? {
        tagSales: "Tag Sales",
        discountRate: "Disc. Rate",
        sales: "Net Sales",
        cogs: "COGS",
        grossProfit: "Gross Profit",
        directExpense: "Direct Cost",
        directPayroll: "Payroll",
        directRent: "Rent",
        directOther: "Other Direct",
        directProfit: "Direct Profit",
        operatingExpense: "Operating Exp.",
        operatingPayroll: "Payroll",
        operatingRent: "Rent",
        advertising: "Advertising",
        operatingOther: "Other Op. Exp.",
        operatingProfit: "Operating Profit",
      }
    : {
        tagSales: "\uD0DD\uAC00\uB9E4\uCD9C",
        discountRate: "\uD560\uC778\uC728",
        sales: "\uC2E4\uD310\uB9E4\uCD9C",
        cogs: "\uB9E4\uCD9C\uC6D0\uAC00\uD569\uACC4",
        grossProfit: "\uB9E4\uCD9C\uCD1D\uC774\uC775",
        directExpense: "\uC9C1\uC811\uBE44",
        directPayroll: "\uC778\uAC74\uBE44",
        directRent: "\uC784\uCC28\uB8CC",
        directOther: "\uAE30\uD0C0\uC9C1\uC811\uBE44",
        directProfit: "\uC9C1\uC811\uC774\uC775",
        operatingExpense: "\uC601\uC5C5\uBE44",
        operatingPayroll: "\uC778\uAC74\uBE44",
        operatingRent: "\uC784\uCC28\uB8CC",
        advertising: "\uAD11\uACE0\uBE44",
        operatingOther: "\uAE30\uD0C0\uC601\uC5C5\uBE44",
        operatingProfit: "\uC601\uC5C5\uC774\uC775",
      };
  return labels[key];
}

function formatSalesCell(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function getBasisLabel(basisMode: TableBasisMode, language: Language = "kr") {
  if (language === "en") {
    if (basisMode === "perStore") return "Sales/Store Basis";
    if (basisMode === "tag") return "Tag Sales Basis";
    return "Net Sales Basis";
  }
  if (basisMode === "perStore") return PER_STORE_BASIS_LABEL;
  if (basisMode === "tag") return TAG_BASIS_LABEL;
  return TEXT.salesBasis;
}

function getSalesLabel(basisMode: TableBasisMode, language: Language = "kr") {
  if (language === "en") {
    if (basisMode === "perStore") return "Sales/Store";
    if (basisMode === "tag") return "Tag Sales";
    return "Net Sales";
  }
  if (basisMode === "perStore") return "점당매출";
  if (basisMode === "tag") return "택가매출";
  return "실판매출";
}

function getDisplayMetric(metric: CellMetric, basisMode: TableBasisMode) {
  if (basisMode === "sales") {
    return {
      sales: metric.sales,
      yoyPrev: metric.yoyPrev,
      yoyTwo: metric.yoyTwo,
    };
  }

  if (basisMode === "tag") {
    return {
      sales: metric.tagSales,
      yoyPrev: calculateRatioChange(metric.tagSales, metric.tagPreviousSales),
      yoyTwo: calculateRatioChange(metric.tagSales, metric.tagTwoYearSales),
    };
  }

  const sales = calculatePerStoreSales(metric.sales, metric.storeCount);
  const previousSales = calculatePerStoreSales(metric.previousSales, metric.previousStoreCount);
  const twoYearSales = calculatePerStoreSales(metric.twoYearSales, metric.twoYearStoreCount);

  return {
    sales,
    yoyPrev: calculateRatioChange(sales, previousSales),
    yoyTwo: calculateRatioChange(sales, twoYearSales),
  };
}

function formatMetricValue(value: number | null | undefined, basisMode: TableBasisMode) {
  if (basisMode === "perStore") {
    return formatPerStoreSalesCell(value);
  }
  return formatSalesCell(value);
}

function formatMetricWithUnit(value: number | null | undefined, basisMode: TableBasisMode, currencyMode: CurrencyMode) {
  return `${formatMetricValue(value, basisMode)} K ${currencyMode}`;
}

function formatPerStoreSalesCell(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function buildAnnualTotals(monthlySource: Record<string, number>) {
  const annualTotals: Record<string, number> = {};

  for (const [periodKey, amount] of Object.entries(monthlySource)) {
    const year = periodKey.slice(0, 4);
    annualTotals[year] = (annualTotals[year] ?? 0) + amount;
  }

  return Object.fromEntries(Object.entries(annualTotals).map(([year, amount]) => [year, Math.round(amount * 100) / 100]));
}

function resolveTwRate(periodKey: string, exchangeRates: Record<string, number>, referenceYear?: number) {
  const year = periodKey.slice(0, 4);
  const month = periodKey.slice(5, 7);
  const rateKey = `${String(referenceYear ?? Number(year)).slice(-2)}${month}`;

  if (exchangeRates[rateKey] != null) return exchangeRates[rateKey];

  const available = Object.keys(exchangeRates).sort();
  if (available.length === 0) return 1;

  const earlier = available.filter((key) => key <= rateKey);
  const fallbackKey = earlier.length > 0 ? earlier[earlier.length - 1] : available[0];
  return exchangeRates[fallbackKey] ?? 1;
}

function convertSalesMapToTwd(source: Record<string, number> | undefined, exchangeRates: Record<string, number>, referenceYear: number) {
  const safeSource = source ?? {};
  return Object.fromEntries(
    Object.entries(safeSource).map(([periodKey, amount]) => {
      const rate = resolveTwRate(periodKey, exchangeRates, referenceYear);
      const converted = rate === 0 ? amount : amount / rate;
      return [periodKey, Math.round(converted * 100) / 100];
    }),
  );
}

function formatStoreCount(value: number | null | undefined, mode?: StoreTooltipMode, language: Language = "kr") {
  if (value == null || Number.isNaN(value)) return "-";
  const useSingleDecimal = false;
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

function calculatePerStoreSales(sales: number | null | undefined, storeCount: number | null | undefined) {
  if (sales == null || storeCount == null || Number.isNaN(sales) || Number.isNaN(storeCount) || storeCount <= 0) {
    return null;
  }
  return sales / storeCount;
}

function calculateRatioChange(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null || Number.isNaN(current) || Number.isNaN(previous) || previous === 0) {
    return null;
  }
  return current / previous - 1;
}

function calculateCumulativeStoreCount(source: Record<string, number>, year: number, monthLimit: number) {
  let activeStoreMonths = 0;
  let hasValue = false;

  for (let month = 1; month <= monthLimit; month += 1) {
    const value = source[formatPeriod(year, month)];
    if (value == null) continue;
    hasValue = true;
    if (value > 0) {
      activeStoreMonths += 1;
    }
  }

  if (!hasValue) return null;
  return activeStoreMonths;
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

function renderMetricComparison(yoyPrev: number | null | undefined, yoyTwo: number | null | undefined, yoyTwoLabel = "전전년비"): ReactNode | null {
  if ((yoyPrev == null || Number.isNaN(yoyPrev)) && (yoyTwo == null || Number.isNaN(yoyTwo))) {
    return null;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {yoyPrev != null && !Number.isNaN(yoyPrev) ? (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${pillTone(yoyPrev)}`}>YOY {formatYoyRate(yoyPrev)}</span>
      ) : null}
      {yoyTwo != null && !Number.isNaN(yoyTwo) ? (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${pillTone(yoyTwo)}`}>{yoyTwoLabel} {formatYoyRate(yoyTwo)}</span>
      ) : null}
    </span>
  );
}

function renderCardComparison(channel: string, yoyPrev: number | null | undefined, yoyTwo: number | null | undefined, yoyTwoLabel = "전전년비"): ReactNode | null {
  return renderMetricComparison(yoyPrev, yoyTwo, yoyTwoLabel);
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

function formatCardBasis(selectedMonth: number, mode: CardMetricMode, latestYear: number, language: Language = "kr") {
  if (language === "en") {
    if (mode === "month") return `${MONTH_NAMES_EN[selectedMonth - 1]} Basis`;
    if (mode === "annual") return `FY ${latestYear}`;
    return `YTD thru ${MONTH_NAMES_EN[selectedMonth - 1]}`;
  }
  if (mode === "month") return `${selectedMonth}월 기준`;
  if (mode === "annual") return `${latestYear}년 연간 기준`;
  return `${selectedMonth}월 누적 기준`;
}

function formatTimestamp(value: string, language: Language = "kr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const year = parts.year ?? "0000";
  const month = parts.month ?? "00";
  const day = parts.day ?? "00";
  const hour = parts.hour ?? "00";
  const minute = parts.minute ?? "00";

  return language === "en"
    ? `${year}-${month}-${day} ${hour}:${minute}`
    : `${year}. ${month}. ${day}. ${hour}:${minute}`;
}

function valueTone(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "text-stone-400";
  return value >= 0 ? "text-emerald-700" : "text-red-600";
}

function pillTone(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "bg-stone-100 text-stone-600";
  return value >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
}


