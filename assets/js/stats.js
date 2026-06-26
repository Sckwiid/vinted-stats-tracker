import * as Common from './common.js';

const {
  accountBadges,
  escapeHtml,
  formatDate,
  formatMoney,
  loadSalePurchaseOverrides,
  loadDashboardData,
  loadStockIgnored,
  loadStockMatches,
  loadStockProducts,
  productImageMarkup,
  renderError,
  saleImageMarkup,
  saleStockMatchInfo,
  setupShell
} = Common;

const PURCHASE_PRICES_KEY = 'vinted-purchase-prices';

function loadPurchasePrices() {
  try {
    return JSON.parse(localStorage.getItem(PURCHASE_PRICES_KEY) || '{}');
  } catch {
    return {};
  }
}

const PERIODS = [
  { label: 'Aujourd’hui', days: 'today' },
  { label: '1j',   days: 1 },
  { label: '7j',   days: 7 },
  { label: '14j',  days: 14 },
  { label: '1m',   days: 30 },
  { label: '2m',   days: 60 },
  { label: '3m',   days: 90 },
  { label: '6m',   days: 180 },
  { label: '1an',  days: 365 },
  { label: 'Tout', days: null }
];

const state = {
  sales: [],
  groups: [],
  stockProducts: [],
  stockMatches: {},
  stockIgnored: {},
  purchaseOverrides: {},
  chartMode: 'time',
  periodDays: null
};

const elements = {
  chart: document.querySelector('[data-chart]'),
  chartTitle: document.querySelector('[data-chart-title]'),
  chartSubtitle: document.querySelector('[data-chart-subtitle]'),
  chartTabs: document.querySelector('[data-chart-tabs]'),
  list: document.querySelector('[data-stats-list]'),
  summary: document.querySelector('[data-stats-summary]'),
  sort: document.querySelector('[data-sort]'),
  periodFilter: document.querySelector('[data-period-filter]')
};

setupShell('stats');

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));

function localSaleDate(sale) {
  const date = new Date(sale.soldAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mondayFirstDayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function filteredSales() {
  if (state.periodDays === 'today') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return state.sales.filter((sale) => {
      const date = localSaleDate(sale);
      return date && date.getTime() >= start && date.getTime() < end;
    });
  }

  if (!state.periodDays) return state.sales;
  const cutoff = Date.now() - state.periodDays * 24 * 60 * 60 * 1000;
  return state.sales.filter((sale) => {
    const date = localSaleDate(sale);
    return date && date.getTime() >= cutoff;
  });
}

function saleTextForLotDetection(sale, group = null) {
  return [
    sale.rawTitle,
    sale.normalizedTitle,
    group?.name
  ].filter(Boolean).join(' ');
}

function isLotSale(sale, group = null) {
  return /\blots?\b/i.test(saleTextForLotDetection(sale, group));
}

function savedGroupPurchaseCents(groupOrId) {
  const purchasePrices = loadPurchasePrices();
  const key = typeof groupOrId === 'string' ? groupOrId : groupOrId?.id;
  if (!key) return 0;
  return Math.round((Number(purchasePrices[key]) || 0) * 100);
}

function salePurchaseCents(sale, group = null) {
  const stockInfo = saleStockMatchInfo(sale, state.stockProducts, state.stockMatches, state.purchaseOverrides, state.stockIgnored);
  if (stockInfo.purchaseCents > 0) return stockInfo.purchaseCents;
  return savedGroupPurchaseCents(group || sale.groupId);
}

function salesPurchaseCents(sales, groupsById = new Map()) {
  return sales.reduce((sum, sale) => {
    const group = sale.groupId ? groupsById.get(sale.groupId) : null;
    return sum + salePurchaseCents(sale, group);
  }, 0);
}

function summarizeSales(label, sales, group = null) {
  const prices = sales.map((sale) => Number(sale.priceCents || 0));
  const total = prices.reduce((sum, price) => sum + price, 0);
  const lastSale = [...sales].sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt))[0] || null;
  const accounts = [...new Set(sales.map((sale) => sale.accountName).filter(Boolean))];
  const groupsById = new Map(state.groups.map((item) => [item.id, item]));
  const purchaseCents = group?.purchaseCentsOverride ?? salesPurchaseCents(sales, groupsById);
  const profit = total - purchaseCents;
  const imageStockProduct = sales
    .map((sale) => saleStockMatchInfo(sale, state.stockProducts, state.stockMatches, state.purchaseOverrides, state.stockIgnored).products[0])
    .find(Boolean) || null;

  return {
    id: group?.id || 'ungrouped',
    label,
    sales,
    count: sales.length,
    total,
    average: sales.length ? Math.round(total / sales.length) : 0,
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 0,
    lastSale,
    accounts,
    imagePath: group?.mainImagePath || lastSale?.imagePath || null,
    imageStockProduct,
    purchaseCents,
    profit,
    saleDates: [...sales]
      .sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt))
      .map((sale) => sale.soldAt)
  };
}

function buildSummaries() {
  const sales = filteredSales();
  const groupsById = new Map(state.groups.map((group) => [group.id, group]));
  const lotSales = sales.filter((sale) => isLotSale(sale, sale.groupId ? groupsById.get(sale.groupId) : null));
  const nonLotSales = sales.filter((sale) => !isLotSale(sale, sale.groupId ? groupsById.get(sale.groupId) : null));
  const summaries = state.groups.map((group) => {
    const groupSales = nonLotSales.filter((sale) => sale.groupId === group.id);
    return summarizeSales(group.name, groupSales, group);
  });

  if (lotSales.length > 0) {
    const lotPurchaseCents = salesPurchaseCents(lotSales, groupsById);
    summaries.push(summarizeSales('Lots', lotSales, {
      id: 'auto-lots',
      name: 'Lots',
      mainImagePath: lotSales.find((sale) => sale.imagePath)?.imagePath || null,
      purchaseCentsOverride: lotPurchaseCents
    }));
  }

  const ungrouped = nonLotSales.filter((sale) => !sale.groupId);
  if (ungrouped.length > 0) {
    summaries.push(summarizeSales('Non groupées', ungrouped));
  }

  return summaries.filter((summary) => summary.count > 0);
}

function sortSummaries(summaries) {
  const sort = elements.sort.value;
  const sorted = [...summaries];

  if (sort === 'count') sorted.sort((a, b) => b.count - a.count);
  if (sort === 'average') sorted.sort((a, b) => b.average - a.average);
  if (sort === 'total') sorted.sort((a, b) => b.total - a.total);
  if (sort === 'lastSale') sorted.sort((a, b) => new Date(b.lastSale?.soldAt || 0) - new Date(a.lastSale?.soldAt || 0));

  return sorted;
}

function renderPeriodFilter() {
  elements.periodFilter.innerHTML = PERIODS.map(({ label, days }) => `
    <button type="button"
      class="period-btn ${state.periodDays === days ? 'active' : ''}"
      data-period="${days === null ? 'null' : escapeHtml(days)}">
      ${label}
    </button>
  `).join('');
}

function renderSummary() {
  const sales = filteredSales();
  const prices = sales.map((sale) => Number(sale.priceCents || 0));
  const total = prices.reduce((sum, price) => sum + price, 0);
  const finished = sales.filter((sale) => sale.status === 'finished');

  const groupsById = new Map(state.groups.map((group) => [group.id, group]));
  const totalPurchase = salesPurchaseCents(sales, groupsById);
  const profit = total - totalPurchase;

  elements.summary.innerHTML = `
    <div><strong>${sales.length}</strong><span>ventes</span></div>
    <div><strong>${formatMoney(total)}</strong><span>encaissé</span></div>
    <div><strong>${formatMoney(sales.length ? total / sales.length : 0)}</strong><span>prix moyen</span></div>
    <div><strong>${formatMoney(profit)}</strong><span>bénéfice</span></div>
    <div><strong>${finished.length}</strong><span>terminées</span></div>
  `;
}

function renderTimeHeatmap() {
  const sales = filteredSales();
  const counts = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

  for (const sale of sales) {
    const date = localSaleDate(sale);
    if (!date) continue;
    counts[mondayFirstDayIndex(date)][date.getHours()] += 1;
  }

  const max = Math.max(0, ...counts.flat());
  const bestSlots = [];

  counts.forEach((hours, dayIndex) => {
    hours.forEach((count, hour) => {
      if (count > 0) bestSlots.push({ count, dayIndex, hour });
    });
  });

  bestSlots.sort((a, b) => b.count - a.count);

  elements.chartTitle.textContent = 'Heures de vente';
  elements.chartSubtitle.textContent = 'Répartition par jour et heure, basée sur la date du mail reçu.';

  if (sales.length === 0) {
    elements.chart.innerHTML = '<div class="empty-state">Aucune vente à analyser.</div>';
    return;
  }

  const hourHeader = HOUR_LABELS.map((hour, index) => `
    <span class="heatmap-hour ${index % 3 === 0 ? '' : 'muted-hour'}">${index % 3 === 0 ? hour : ''}</span>
  `).join('');

  const rows = counts
    .map((hours, dayIndex) => `
      <span class="heatmap-day">${DAY_LABELS[dayIndex]}</span>
      ${hours
        .map((count, hour) => {
          const level = max ? count / max : 0;
          const intensity = Math.round(12 + level * 78);
          const hotClass = level >= 0.55 ? ' hot' : '';
          const label = `${DAY_LABELS[dayIndex]} ${HOUR_LABELS[hour]}h: ${count} vente${count > 1 ? 's' : ''}`;
          return `<span class="heatmap-cell${hotClass}" style="--intensity:${intensity}%" title="${escapeHtml(label)}">${count || ''}</span>`;
        })
        .join('')}
    `)
    .join('');

  const bestText = bestSlots.length
    ? bestSlots
        .slice(0, 3)
        .map((slot) => `${DAY_LABELS[slot.dayIndex]} ${HOUR_LABELS[slot.hour]}h (${slot.count})`)
        .join(' · ')
    : 'Pas encore assez de données';

  elements.chart.innerHTML = `
    <div class="heatmap-wrap">
      <div class="heatmap-grid">
        <span></span>
        ${hourHeader}
        ${rows}
      </div>
    </div>
    <p class="chart-note">Créneaux les plus actifs : ${escapeHtml(bestText)}</p>
  `;
}

function articleRankingItems() {
  const sales = filteredSales();
  const groupsById = new Map(state.groups.map((group) => [group.id, group]));
  const items = new Map();

  for (const sale of sales) {
    const group = sale.groupId ? groupsById.get(sale.groupId) : null;
    const isLot = isLotSale(sale, group);
    const key = isLot ? 'auto-lots' : group ? group.id : `sale:${sale.normalizedTitle || sale.rawTitle}`;
    const item = items.get(key) || {
      id: key,
      label: isLot ? 'Lots' : group?.name || sale.rawTitle || 'Article sans titre',
      count: 0,
      total: 0,
      lastSale: null,
      imageProduct: null,
      imagePath: group?.mainImagePath || sale.imagePath || null
    };

    item.count += 1;
    item.total += Number(sale.priceCents || 0);
    const stockInfo = saleStockMatchInfo(sale, state.stockProducts, state.stockMatches, state.purchaseOverrides, state.stockIgnored);
    if (!item.imageProduct && stockInfo.products[0]) {
      item.imageProduct = stockInfo.products[0];
    }
    if (!item.imagePath && sale.imagePath) {
      item.imagePath = sale.imagePath;
    }

    const saleDate = localSaleDate(sale);
    if (saleDate && (!item.lastSale || saleDate > item.lastSale)) {
      item.lastSale = saleDate;
    }

    items.set(key, item);
  }

  return [...items.values()]
    .sort((a, b) => b.count - a.count || b.total - a.total || a.label.localeCompare(b.label, 'fr'));
}

function rankingImageMarkup(item) {
  if (item.imageProduct) return productImageMarkup(item.imageProduct);
  return saleImageMarkup({ imagePath: item.imagePath, rawTitle: item.label }, item.label);
}

function renderArticleRanking() {
  const items = articleRankingItems();
  const max = Math.max(0, ...items.map((item) => item.count));

  elements.chartTitle.textContent = 'Articles les plus vendus';
  elements.chartSubtitle.textContent = 'Classement par nombre de ventes, avec le total encaissé et la dernière vente.';

  if (items.length === 0) {
    elements.chart.innerHTML = '<div class="empty-state">Aucun article à analyser.</div>';
    return;
  }

  elements.chart.innerHTML = `
    <div class="ranking-chart">
      ${items
        .map((item) => {
          const width = max ? Math.max(8, Math.round((item.count / max) * 100)) : 0;
          return `
            <div class="ranking-row">
              <div class="ranking-thumb">${rankingImageMarkup(item)}</div>
              <div class="ranking-label">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${item.lastSale ? `Dernière vente: ${formatDate(item.lastSale.toISOString())}` : 'Date inconnue'}</span>
              </div>
              <div class="ranking-bar-track" aria-label="${escapeHtml(item.label)}">
                <span class="ranking-bar" style="width:${width}%"></span>
              </div>
              <div class="ranking-value">
                <strong>${item.count}</strong>
                <span>${formatMoney(item.total)}</span>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderChart() {
  for (const button of elements.chartTabs.querySelectorAll('[data-chart-mode]')) {
    button.classList.toggle('active', button.dataset.chartMode === state.chartMode);
  }

  if (state.chartMode === 'articles') {
    renderArticleRanking();
    return;
  }

  renderTimeHeatmap();
}

function renderStats() {
  renderPeriodFilter();
  renderSummary();
  renderChart();
  const summaries = sortSummaries(buildSummaries());

  if (summaries.length === 0) {
    elements.list.innerHTML = '<div class="empty-state">Aucune statistique à afficher.</div>';
    return;
  }

  elements.list.innerHTML = summaries
    .map((summary) => {
      const imageSale = { imagePath: summary.imagePath, rawTitle: summary.label };
      const imageMarkup = summary.imageStockProduct ? productImageMarkup(summary.imageStockProduct) : saleImageMarkup(imageSale, summary.label);
      const profitClass = summary.profit >= 0 ? 'profit-positive' : 'profit-negative';
      const profitLabel = summary.purchaseCents > 0
        ? `<span class="${profitClass}">Bénéfice <strong>${formatMoney(summary.profit)}</strong></span>`
        : `<span class="muted">Bénéfice <strong>—</strong></span>`;
      return `
        <article class="stats-card">
          <div class="group-image">${imageMarkup}</div>
          <div>
            <h2>${escapeHtml(summary.label)}</h2>
            <div class="stats-grid">
              <span>Ventes <strong>${summary.count}</strong></span>
              <span>Total <strong>${formatMoney(summary.total)}</strong></span>
              <span>Moyenne <strong>${formatMoney(summary.average)}</strong></span>
              <span>Min <strong>${formatMoney(summary.min)}</strong></span>
              <span>Max <strong>${formatMoney(summary.max)}</strong></span>
              <span>Dernière <strong>${summary.lastSale ? formatDate(summary.lastSale.soldAt) : '-'}</strong></span>
            </div>
            <div class="profit-line">${profitLabel}</div>
            <div class="sale-dates">
              ${summary.saleDates
                .slice(0, 5)
                .map((date) => `<span>${formatDate(date)}</span>`)
                .join('')}
            </div>
            <div class="account-badges">${accountBadges(summary.accounts)}</div>
          </div>
        </article>
      `;
    })
    .join('');
}

async function loadAndRender() {
  try {
    const data = await loadDashboardData();
    state.sales = data.sales;
    state.groups = data.groups;
    state.stockProducts = loadStockProducts();
    state.stockMatches = loadStockMatches();
    state.stockIgnored = loadStockIgnored();
    state.purchaseOverrides = loadSalePurchaseOverrides();
    renderStats();
  } catch (error) {
    renderError(elements.list, error);
  }
}

elements.sort.addEventListener('change', renderStats);
elements.chartTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-chart-mode]');
  if (!button) return;
  state.chartMode = button.dataset.chartMode;
  renderChart();
});
elements.periodFilter.addEventListener('click', (event) => {
  const button = event.target.closest('[data-period]');
  if (!button) return;
  const raw = button.dataset.period;
  state.periodDays = raw === 'null' ? null : raw === 'today' ? 'today' : Number(raw);
  renderStats();
});

loadAndRender();
