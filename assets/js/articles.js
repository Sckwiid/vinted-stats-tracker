import {
  accountBadge,
  escapeHtml,
  formatDate,
  formatMoney,
  loadDashboardData,
  normalizeClientText,
  renderError,
  saleImageMarkup,
  salesForGroup,
  setupShell,
  showToast,
  statusBadge
} from './common.js';
import { mergeSale, renameGroup } from './api.js';

const PURCHASE_PRICES_KEY = 'vinted-purchase-prices';

function loadPurchasePrices() {
  try {
    return JSON.parse(localStorage.getItem(PURCHASE_PRICES_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePurchasePrice(groupId, value) {
  const prices = loadPurchasePrices();
  const num = parseFloat(String(value).replace(',', '.'));
  if (Number.isNaN(num) || num < 0) {
    delete prices[groupId];
  } else {
    prices[groupId] = num;
  }
  localStorage.setItem(PURCHASE_PRICES_KEY, JSON.stringify(prices));
}

const state = {
  sales: [],
  groups: []
};

const elements = {
  list: document.querySelector('[data-groups-list]'),
  ungrouped: document.querySelector('[data-ungrouped-list]'),
  search: document.querySelector('[data-group-search]')
};

setupShell('articles');

function filteredGroups() {
  const query = normalizeClientText(elements.search.value);
  if (!query) return state.groups;
  return state.groups.filter((group) => normalizeClientText(group.name).includes(query));
}

function renderGroups() {
  const groups = filteredGroups();
  const purchasePrices = loadPurchasePrices();

  if (groups.length === 0) {
    elements.list.innerHTML = '<div class="empty-state">Aucun groupe à afficher.</div>';
    return;
  }

  elements.list.innerHTML = groups
    .map((group) => {
      const sales = salesForGroup(state.sales, group.id);
      const total = sales.reduce((sum, sale) => sum + Number(sale.priceCents || 0), 0);
      const imageSale = { imagePath: group.mainImagePath || sales[0]?.imagePath, rawTitle: group.name };
      const purchaseVal = purchasePrices[group.id] ?? '';
      const purchaseCents = Math.round((Number(purchaseVal) || 0) * 100);
      const profit = total - purchaseCents;
      const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
      const profitHtml = purchaseVal !== ''
        ? `<span class="${profitClass}">Bénéfice : <strong>${formatMoney(profit)}</strong></span>`
        : '';

      const saleRows = sales
        .slice(0, 8)
        .map((sale) => `
          <li>
            <span>${escapeHtml(sale.rawTitle)}</span>
            ${accountBadge(sale.accountName)}
            <strong>${formatMoney(sale.priceCents)}</strong>
            ${statusBadge(sale.status)}
          </li>
        `)
        .join('');

      return `
        <article class="article-card" data-group-card="${escapeHtml(group.id)}">
          <div class="group-image">${saleImageMarkup(imageSale, group.name)}</div>
          <div class="article-main">
            <div class="article-heading">
              <div>
                <h2>${escapeHtml(group.name)}</h2>
                <p>${sales.length} vente(s) · ${formatMoney(total)}</p>
                ${profitHtml}
              </div>
              <form class="inline-form" data-rename-form="${escapeHtml(group.id)}">
                <input name="name" value="${escapeHtml(group.name)}" aria-label="Nom du groupe">
                <button type="submit">Renommer</button>
              </form>
            </div>
            <div class="purchase-row">
              <form class="purchase-form" data-purchase-form="${escapeHtml(group.id)}">
                <label>
                  Prix d'achat (€)
                  <input
                    name="purchasePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value="${escapeHtml(String(purchaseVal))}"
                    aria-label="Prix d'achat pour ${escapeHtml(group.name)}"
                  >
                </label>
                <button type="submit">Enregistrer</button>
              </form>
            </div>
            <ul class="compact-list">${saleRows || '<li>Aucune vente associée</li>'}</ul>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderUngrouped() {
  const ungrouped = state.sales.filter((sale) => !sale.groupId);

  if (ungrouped.length === 0) {
    elements.ungrouped.innerHTML = '<div class="empty-state">Aucune vente non groupée.</div>';
    return;
  }

  const groupOptions = state.groups
    .map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`)
    .join('');

  elements.ungrouped.innerHTML = ungrouped
    .map((sale) => `
      <article class="ungrouped-row">
        <div class="thumb">${saleImageMarkup(sale)}</div>
        <div>
          <h3>${escapeHtml(sale.rawTitle)}</h3>
          <p class="account-line">${accountBadge(sale.accountName)}<span>${formatMoney(sale.priceCents)} · ${formatDate(sale.soldAt)}</span></p>
        </div>
        <form data-quick-merge="${escapeHtml(sale.id)}">
          <select name="groupId" required>
            <option value="">Groupe</option>
            ${groupOptions}
          </select>
          <button type="submit">Associer</button>
        </form>
      </article>
    `)
    .join('');
}

function render() {
  renderGroups();
  renderUngrouped();
}

async function loadAndRender() {
  try {
    const data = await loadDashboardData();
    state.sales = data.sales;
    state.groups = data.groups;
    render();
  } catch (error) {
    renderError(elements.list, error);
  }
}

elements.search.addEventListener('input', renderGroups);

elements.list.addEventListener('submit', async (event) => {
  const purchaseForm = event.target.closest('[data-purchase-form]');
  if (purchaseForm) {
    event.preventDefault();
    const groupId = purchaseForm.dataset.purchaseForm;
    const value = purchaseForm.elements.purchasePrice.value;
    savePurchasePrice(groupId, value);
    renderGroups();
    showToast('Prix d\'achat enregistré');
    return;
  }

  const renameForm = event.target.closest('[data-rename-form]');
  if (renameForm) {
    event.preventDefault();
    const groupId = renameForm.dataset.renameForm;
    const name = renameForm.elements.name.value.trim();
    try {
      const result = await renameGroup(groupId, name);
      const group = state.groups.find((item) => item.id === groupId);
      if (group) Object.assign(group, result.group);
      renderGroups();
      showToast('Groupe renommé');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
});

elements.ungrouped.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-quick-merge]');
  if (!form) return;
  event.preventDefault();

  const saleId = form.dataset.quickMerge;
  const groupId = form.groupId.value;
  try {
    const result = await mergeSale(saleId, { groupId });
    const sale = state.sales.find((item) => item.id === saleId);
    if (sale) Object.assign(sale, result.sale);
    render();
    showToast('Vente associée');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

loadAndRender();
