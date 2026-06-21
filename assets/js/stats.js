import {
  accountBadges,
  escapeHtml,
  formatDate,
  formatMoney,
  loadDashboardData,
  renderError,
  saleImageMarkup,
  setupShell
} from './common.js';

const state = {
  sales: [],
  groups: [],
  chartMode: 'time'
};

const elements = {
  chart: document.querySelector('[data-chart]'),
  chartTitle: document.querySelector('[data-chart-title]'),
  chartSubtitle: document.querySelector('[data-chart-subtitle]'),
  chartTabs: document.querySelector('[data-chart-tabs]'),
  list: document.querySelector('[data-stats-list]'),
  summary: document.querySelector('[data-stats-summary]'),
  sort: document.querySelector('[data-sort]')
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

function summarizeSales(label, sales, group = null) {
  const prices = sales.map((sale) => Number(sale.priceCents || 0));
  const total = prices.reduce((sum, price) => sum + price, 0);
  const lastSale = [...sales].sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt))[0] || null;
  const accounts = [...new Set(sales.map((sale) => sale.accountName).filter(Boolean))];

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
    saleDates: [...sales]
      .sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt))
      .map((sale) => sale.soldAt)
  };
}

function buildSummaries() {
  const summaries = state.groups.map((group) => {
    const sales = state.sales.filter((sale) => sale.groupId === group.id);
    return summarizeSales(group.name, sales, group);
  });

  const ungrouped = state.sales.filter((sale) => !sale.groupId);
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

function renderSummary() {
  const prices = state.sales.map((sale) => Number(sale.priceCents || 0));
  const total = prices.reduce((sum, price) => sum + price, 0);
  const finished = state.sales.filter((sale) => sale.status === 'finished');

  elements.summary.innerHTML = `
    <div><strong>${state.sales.length}</strong><span>ventes</span></div>
    <div><strong>${formatMoney(total)}</strong><span>encaissé</span></div>
    <div><strong>${formatMoney(state.sales.length ? total / state.sales.length : 0)}</strong><span>prix moyen</span></div>
    <div><strong>${finished.length}</strong><span>terminées</span></div>
  `;
}

function renderTimeHeatmap() {
  const counts = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

  for (const sale of state.sales) {
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

  if (state.sales.length === 0) {
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
  const groupsById = new Map(state.groups.map((group) => [group.id, group]));
  const items = new Map();

  for (const sale of state.sales) {
    const group = sale.groupId ? groupsById.get(sale.groupId) : null;
    const key = group ? group.id : `sale:${sale.normalizedTitle || sale.rawTitle}`;
    const item = items.get(key) || {
      id: key,
      label: group?.name || sale.rawTitle || 'Article sans titre',
      count: 0,
      total: 0,
      lastSale: null
    };

    item.count += 1;
    item.total += Number(sale.priceCents || 0);

    const saleDate = localSaleDate(sale);
    if (saleDate && (!item.lastSale || saleDate > item.lastSale)) {
      item.lastSale = saleDate;
    }

    items.set(key, item);
  }

  return [...items.values()]
    .sort((a, b) => b.count - a.count || b.total - a.total || a.label.localeCompare(b.label, 'fr'))
    .slice(0, 12);
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
      return `
        <article class="stats-card">
          <div class="group-image">${saleImageMarkup(imageSale, summary.label)}</div>
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
loadAndRender();
