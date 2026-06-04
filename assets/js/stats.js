import {
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
  groups: []
};

const elements = {
  list: document.querySelector('[data-stats-list]'),
  summary: document.querySelector('[data-stats-summary]'),
  sort: document.querySelector('[data-sort]')
};

setupShell('stats');

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
    imagePath: group?.mainImagePath || lastSale?.imagePath || null
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

function renderStats() {
  renderSummary();
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
            <p class="muted">${escapeHtml(summary.accounts.join(', ') || 'Aucun compte')}</p>
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
loadAndRender();
