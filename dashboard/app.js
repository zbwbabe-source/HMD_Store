const dashboardData = window.__DASHBOARD_DATA__;

const state = {
  region: 'HKMC',
  metric: 'actualSales',
  year: null,
};

function init() {
  if (!dashboardData || !dashboardData.regions) return;
  if (!dashboardData.regions[state.region]) {
    state.region = Object.keys(dashboardData.regions)[0];
  }
  state.year = dashboardData.regions[state.region].defaultYear;
  renderRegionButtons();
  renderMetricButtons();
  bindModal();
  render();
}

function render() {
  const region = dashboardData.regions[state.region];
  if (!region) return;
  if (!region.years.includes(state.year)) state.year = region.defaultYear;
  text('page-title', dashboardData.title);
  text('region-heading', region.label + ' 운영 개요');
  text('region-summary', region.summary);
  text('latest-period', region.latestPeriod);
  text('store-table-title', '매장 4개년 월별 YOY');
  text('bep-title', (region.bep && region.bep.title) || '매장별 BEP 진단');
  renderYearButtons();
  renderKpis(region);
  renderTrendChart(region);
  renderForecast(region);
  renderBepSection(region);
  renderStoreTable(region);
}

function renderRegionButtons() {
  const target = document.getElementById('region-toggle');
  if (!target) return;
  target.innerHTML = '';
  Object.keys(dashboardData.regions).forEach((key) => {
    const region = dashboardData.regions[key];
    const button = buttonEl(region.label || key, state.region === key, () => {
      state.region = key;
      state.year = region.defaultYear;
      renderRegionButtons();
      render();
    });
    target.appendChild(button);
  });
}

function renderYearButtons() {
  const target = document.getElementById('year-toggle');
  const region = dashboardData.regions[state.region];
  if (!target || !region) return;
  target.innerHTML = '';
  region.years.forEach((year) => {
    const button = buttonEl(String(year), state.year === year, () => {
      state.year = year;
      renderYearButtons();
      renderKpis(region);
      renderTrendChart(region);
      renderForecast(region);
      renderBepSection(region);
      renderStoreTable(region);
    });
    target.appendChild(button);
  });
}

function renderMetricButtons() {
  const target = document.getElementById('metric-toggle');
  if (!target) return;
  target.innerHTML = '';
  ['actualSales', 'discountRate', 'directProfit'].forEach((key) => {
    const button = buttonEl(metricLabel(key), state.metric === key, () => {
      state.metric = key;
      renderMetricButtons();
      renderTrendChart(dashboardData.regions[state.region]);
    });
    target.appendChild(button);
  });
}

function renderKpis(region) {
  const target = document.getElementById('kpi-grid');
  if (!target) return;
  target.innerHTML = '';
  if (!region.kpis || !region.kpis.length) {
    const empty = document.createElement('div');
    empty.className = 'panel';
    empty.textContent = 'KPI 데이터가 없습니다.';
    target.appendChild(empty);
    return;
  }
  region.kpis.forEach((kpi) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'kpi-card';
    const label = document.createElement('div');
    label.className = 'kpi-label';
    label.textContent = kpi.label;
    const value = document.createElement('div');
    value.className = 'kpi-value';
    value.textContent = kpi.display;
    const meta = document.createElement('div');
    meta.className = 'kpi-meta';
    const left = document.createElement('span');
    left.textContent = kpi.deltaLabel || '';
    const right = document.createElement('span');
    right.className = 'kpi-delta ' + (kpi.delta == null ? '' : (kpi.delta >= 0 ? 'up' : 'down'));
    right.textContent = formatByType(kpi.delta, (kpi.key === 'actualSales' || kpi.key === 'directProfit' || kpi.key === 'yoyGrowth') ? 'percent' : inferType(kpi.key));
    meta.appendChild(left);
    meta.appendChild(right);
    const copy = document.createElement('p');
    copy.className = 'kpi-copy';
    copy.textContent = kpi.insight || '';
    card.appendChild(label);
    card.appendChild(value);
    card.appendChild(meta);
    card.appendChild(copy);
    card.onclick = () => openModal(kpi.key);
    target.appendChild(card);
  });
}

function renderTrendChart(region) {
  const target = document.getElementById('trend-chart');
  if (!target) return;
  const metricSeries = (region.yearlyMetrics && region.yearlyMetrics[state.metric]) || [];
  target.innerHTML = '';
  target.appendChild(simpleChart(metricSeries.map((item) => ({ label: String(item.year), values: item.values || [] })), inferType(state.metric)));
}

function renderForecast(region) {
  const target = document.getElementById('forecast-chart');
  if (!target) return;
  const actualMonths = (region.monthly || []).filter((point) => (point.actualSales || 0) > 0).slice(-6);
  const forecast = region.forecast || [];
  target.innerHTML = '';
  target.appendChild(simpleChart([{ label: '실매출 + 전망', values: actualMonths.map((point) => point.actualSales).concat(forecast.map((point) => point.actualSales)) }], 'currency'));
  text('forecast-summary', '최근 6개월 실적 추세를 기준으로 향후 3개월 매출 합계를 ' + formatByType(forecast.reduce((sum, point) => sum + (point.actualSales || 0), 0), 'currency') + '로 추정했습니다.');
}

function renderBepSection(region) {
  const bep = region.bep || { stores: [] };
  text('bep-description', bep.description || '');
  text('bep-note', bep.note || '');
  text('bep-summary', bep.summary || '');
  const head = document.getElementById('bep-table-head');
  const body = document.getElementById('bep-table-body');
  if (!head || !body) return;
  head.innerHTML = '';
  body.innerHTML = '';
  const headerRow = document.createElement('tr');
  ['매장', 'BEP 달성률', '실매출', 'BEP 매출', '안전마진', '임차료율', '급여율', '공헌이익률', 'YOY', '상태'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  head.appendChild(headerRow);
  if (!bep.stores || !bep.stores.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 10;
    cell.className = 'empty-row';
    cell.textContent = 'BEP를 계산할 수 있는 매장 데이터가 없습니다.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }
  bep.stores.forEach((item) => {
    const row = document.createElement('tr');
    appendCell(row, item.storeName);
    const progressCell = document.createElement('td');
    const box = document.createElement('div');
    box.className = 'progress-cell';
    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('span');
    fill.className = 'progress-fill ' + (item.statusKey || 'unknown');
    fill.style.width = progressWidth(item.bepAchievement) + '%';
    track.appendChild(fill);
    const pct = document.createElement('strong');
    pct.textContent = formatPercentValue(item.bepAchievement);
    box.appendChild(track);
    box.appendChild(pct);
    progressCell.appendChild(box);
    row.appendChild(progressCell);
    appendCell(row, formatByType(item.actualSales, 'currency'));
    appendCell(row, formatByType(item.bepSales, 'currency'));
    appendCell(row, formatByType(item.safetyMargin, 'percent'), valueClass(item.safetyMargin));
    appendCell(row, formatByType(item.rentRatio, 'percent'));
    appendCell(row, formatByType(item.payrollRatio, 'percent'));
    appendCell(row, formatByType(item.contributionMargin, 'percent'));
    appendCell(row, formatYoyCell(item.yoyGrowth), valueClass(item.yoyGrowth));
    const statusCell = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'status-pill ' + (item.statusKey || 'unknown');
    pill.textContent = item.statusLabel || '-';
    statusCell.appendChild(pill);
    row.appendChild(statusCell);
    body.appendChild(row);
  });
}

function renderStoreTable(region) {
  const head = document.getElementById('store-table-head');
  const body = document.getElementById('store-table-body');
  const stores = region.storeYoyMultiYear || [];
  if (!head || !body) return;
  head.innerHTML = '';
  body.innerHTML = '';
  const headerRow = document.createElement('tr');
  ['매장명', '연도'].concat(Array.from({ length: 12 }, (_, idx) => String(idx + 1) + '월')).forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  head.appendChild(headerRow);
  if (!stores.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 14;
    cell.className = 'empty-row';
    cell.textContent = '표시할 4개년 매장 YOY 데이터가 없습니다.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }
  stores.forEach((store) => {
    (store.years || []).forEach((yearRow, rowIndex) => {
      const row = document.createElement('tr');
      if (rowIndex === 0) {
        const storeCell = document.createElement('td');
        storeCell.textContent = store.storeName;
        storeCell.rowSpan = (store.years || []).length || 1;
        row.appendChild(storeCell);
      }
      appendCell(row, String(yearRow.year));
      (yearRow.months || []).forEach((value) => {
        appendCell(row, formatYoyCell(value), valueClass(value));
      });
      body.appendChild(row);
    });
  });
}

function appendCell(row, value, className) {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = value == null ? '-' : String(value);
  row.appendChild(cell);
}

function bindModal() {
  const closeButton = document.getElementById('modal-close');
  const backdrop = document.querySelector('.modal-backdrop');
  if (closeButton) closeButton.onclick = closeModal;
  if (backdrop) backdrop.onclick = closeModal;
}

function openModal(metricKey) {
  const region = dashboardData.regions[state.region];
  if (!region) return;
  const kpi = (region.kpis || []).find((item) => item.key === metricKey);
  if (!kpi) return;
  text('modal-kicker', region.label + ' Deep Dive');
  text('modal-title', kpi.label);
  text('modal-copy', kpi.insight || '');
  const chart = document.getElementById('modal-chart');
  if (chart) {
    chart.innerHTML = '';
    const points = (region.monthly || []).filter((point) => (point.actualSales || 0) > 0).slice(-12);
    let values = [];
    let type = inferType(metricKey);
    if (metricKey === 'forecastSales') {
      values = points.slice(-6).map((point) => point.actualSales).concat((region.forecast || []).map((point) => point.actualSales));
      type = 'currency';
    } else if (metricKey === 'yoyGrowth') {
      values = points.map((point) => point.yoyGrowth);
      type = 'percent';
    } else {
      values = points.map((point) => point[metricKey]);
    }
    chart.appendChild(simpleChart([{ label: metricLabel(metricKey), values: values }], type));
  }
  const modal = document.getElementById('metric-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('metric-modal');
  if (modal) modal.classList.add('hidden');
}

function simpleChart(series, type) {
  const wrap = document.createElement('div');
  wrap.className = 'chart-card';
  if (!series.length) {
    const empty = document.createElement('p');
    empty.className = 'forecast-summary';
    empty.textContent = '표시할 데이터가 없습니다.';
    wrap.appendChild(empty);
    return wrap;
  }
  series.forEach((item) => {
    const row = document.createElement('p');
    row.className = 'forecast-summary';
    row.textContent = item.label;
    const values = item.values.filter((value) => value != null).slice(-6).map((value) => formatByType(value, type));
    const detail = document.createElement('span');
    detail.textContent = values.length ? ': ' + values.join(', ') : '';
    row.appendChild(detail);
    wrap.appendChild(row);
  });
  return wrap;
}

function metricLabel(key) {
  const meta = dashboardData.metricMeta && dashboardData.metricMeta[key];
  if (meta && meta.label) return meta.label;
  return key;
}

function inferType(key) {
  if (key === 'actualSales' || key === 'directProfit' || key === 'forecastSales') return 'currency';
  if (key === 'discountRate' || key === 'yoyGrowth') return 'percent';
  return 'number';
}

function formatByType(value, type) {
  if (value == null || Number.isNaN(value)) return '-';
  if (type === 'percent') return formatPercentValue(value);
  if (type === 'currency') return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

function formatPercentValue(value) {
  if (value == null || Number.isNaN(value)) return '-';
  return (value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0) + '%';
}

function formatYoyCell(value) {
  return formatPercentValue(value);
}

function valueClass(value) {
  if (value == null || Number.isNaN(value)) return '';
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return '';
}

function progressWidth(value) {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(160, value * 100));
}

document.addEventListener('DOMContentLoaded', init);

