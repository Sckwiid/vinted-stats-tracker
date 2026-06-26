import * as Common from './common.js';

const {
  STATUS_LABELS,
  STATUS_ORDER,
  accountBadge,
  escapeHtml,
  formatDate,
  formatMoney,
  groupById,
  loadDashboardData,
  loadSalePurchaseOverrides,
  loadStockIgnored,
  loadStockMatches,
  loadStockProducts,
  normalizeClientText,
  productImageMarkup,
  renderError,
  saleImageMarkup,
  saleStockMatchInfo,
  saveSalePurchaseOverrides,
  saveStockIgnored,
  saveStockMatches,
  setupShell,
  showToast,
  stockPurchaseCents,
  stockSearchText,
  statusBadge
} = Common;

function pollNow() {
  return Common.apiRequest('/api/poll', { method: 'POST' });
}

function updateSaleStatus(saleId, status) {
  return Common.apiRequest(`/api/sales/${encodeURIComponent(saleId)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status })
  });
}

function mergeSale(saleId, payload) {
  return Common.apiRequest(`/api/sales/${encodeURIComponent(saleId)}/merge`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

function createManualSale(payload) {
  return Common.apiRequest('/api/sales', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

const state = {
  sales: [],
  groups: [],
  stockProducts: [],
  stockMatches: {},
  stockIgnored: {},
  purchaseOverrides: {},
  meta: null,
  selectedSaleId: null,
  selectedStockSaleId: null,
  stockSearch: ''
};

const elements = {
  list: document.querySelector('[data-orders-list]'),
  summary: document.querySelector('[data-orders-summary]'),
  search: document.querySelector('[data-search]'),
  status: document.querySelector('[data-status-filter]'),
  account: document.querySelector('[data-account-filter]'),
  showFinished: document.querySelector('[data-show-finished]'),
  refresh: document.querySelector('[data-refresh]'),
  poll: document.querySelector('[data-poll]'),
  bulkPrepared: document.querySelector('[data-bulk-prepared]'),
  bulkSent: document.querySelector('[data-bulk-sent]'),
  manualSaleOpen: document.querySelector('[data-manual-sale-open]'),
  manualSaleModal: document.querySelector('[data-manual-sale-modal]'),
  manualSaleForm: document.querySelector('[data-manual-sale-form]'),
  modal: document.querySelector('[data-merge-modal]'),
  stockModal: document.querySelector('[data-stock-modal]'),
  stockForm: document.querySelector('[data-stock-form]'),
  stockTitle: document.querySelector('[data-stock-title]'),
  stockSearch: document.querySelector('[data-stock-search]'),
  stockFields: document.querySelector('[data-stock-fields]'),
  stockPurchase: document.querySelector('[data-stock-purchase]'),
  stockIgnore: document.querySelector('[data-stock-ignore]'),
  stockSelectedList: document.querySelector('[data-stock-selected-list]'),
  mergeForm: document.querySelector('[data-merge-form]'),
  groupSearch: document.querySelector('[data-group-search]'),
  groupSelect: document.querySelector('[data-group-select]'),
  newGroupName: document.querySelector('[data-new-group-name]')
};

setupShell('orders');

function currentFilters() {
  return {
    query: normalizeClientText(elements.search.value),
    status: elements.status.value,
    account: elements.account.value,
    showFinished: elements.showFinished.checked
  };
}

function filteredSales() {
  const filters = currentFilters();

  return state.sales.filter((sale) => {
    if (!filters.showFinished && ['finished', 'archived'].includes(sale.status)) return false;
    if (filters.status && sale.status !== filters.status) return false;
    if (filters.account && sale.accountName !== filters.account) return false;

    if (filters.query) {
      const haystack = normalizeClientText([
        sale.rawTitle,
        sale.accountName,
        sale.buyerUsername,
        sale.priceFormatted
      ].join(' '));
      if (!haystack.includes(filters.query)) return false;
    }

    return true;
  });
}

function renderFilters() {
  const accounts = [...new Set(state.sales.map((sale) => sale.accountName).filter(Boolean))].sort();
  elements.account.innerHTML = '<option value="">Tous les comptes</option>';
  for (const account of accounts) {
    elements.account.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(account)}">${escapeHtml(account)}</option>`);
  }
}

function renderSummary(sales) {
  const openSales = state.sales.filter((sale) => !['finished', 'archived'].includes(sale.status));
  const totalOpen = openSales.reduce((sum, sale) => sum + Number(sale.priceCents || 0), 0);
  const totalAll = state.sales.reduce((sum, sale) => sum + Number(sale.priceCents || 0), 0);

  elements.summary.innerHTML = `
    <div><strong>${sales.length}</strong><span>affichées</span></div>
    <div><strong>${openSales.length}</strong><span>en cours</span></div>
    <div><strong>${formatMoney(totalOpen)}</strong><span>en cours</span></div>
    <div><strong>${formatMoney(totalAll)}</strong><span>total</span></div>
  `;
}

function saleStockImageMarkup(sale) {
  const info = saleStockMatchInfo(sale, state.stockProducts, state.stockMatches, state.purchaseOverrides, state.stockIgnored);
  return info.products[0] ? productImageMarkup(info.products[0]) : saleImageMarkup(sale);
}

function stockStatusMarkup(sale) {
  if (state.stockProducts.length === 0) {
    return '<span class="stock-order-line missing">Stock non chargé</span>';
  }

  const info = saleStockMatchInfo(sale, state.stockProducts, state.stockMatches, state.purchaseOverrides, state.stockIgnored);
  if (info.products.length === 0 && !info.hasPurchaseOverride && !info.hasMissingProducts) {
    return '<span class="stock-order-line missing">Aucun article stock associé</span>';
  }

  if (info.hasMissingProducts && info.products.length === 0 && !info.hasPurchaseOverride) {
    return '<span class="stock-order-line manual">Stock validé : article retiré du stock · Ajoute un prix manuel</span>';
  }

  const profit = Number(sale.priceCents || 0) - info.purchaseCents;
  const label = info.confidence === 'manual'
    ? 'Stock validé'
    : info.confidence === 'ignored'
      ? 'Stock ignoré'
      : info.products.length > 0
        ? 'Stock détecté'
        : 'Prix manuel';
  const productLabel = info.products.length > 0
    ? ` : ${info.products.map((product) => escapeHtml(product.name || 'Article stock')).join(' + ')}`
    : info.hasMissingProducts
      ? ' : article retiré du stock'
      : '';
  return `
    <span class="stock-order-line ${info.confidence}">
      ${label}${productLabel}
      · Achat ${formatMoney(info.purchaseCents)}
      · Bénéfice ${formatMoney(profit)}
    </span>
  `;
}

function renderOrders() {
  const sales = filteredSales();
  const groupsById = groupById(state.groups);
  renderSummary(sales);

  if (sales.length === 0) {
    elements.list.innerHTML = '<div class="empty-state">Aucune commande à afficher.</div>';
    return;
  }

  elements.list.innerHTML = sales
    .map((sale) => {
      const group = sale.groupId ? groupsById.get(sale.groupId) : null;
      const statusButtons = STATUS_ORDER.map((status) => `
        <button class="status-action ${sale.status === status ? 'selected' : ''}" data-status="${status}" data-sale-id="${sale.id}">
          ${STATUS_LABELS[status]}
        </button>
      `).join('');

      return `
        <article class="sale-card status-card-${escapeHtml(sale.status)}">
          <div class="sale-image">${saleStockImageMarkup(sale)}</div>
          <div class="sale-content">
            <div class="sale-heading">
              <div>
                <h2>${escapeHtml(sale.rawTitle)}</h2>
                <p class="account-line">${accountBadge(sale.accountName)}<span>acheteur ${escapeHtml(sale.buyerUsername)}</span></p>
              </div>
              <strong>${formatMoney(sale.priceCents)}</strong>
            </div>
            <div class="sale-meta">
              ${statusBadge(sale.status)}
              <span>${formatDate(sale.soldAt)}</span>
              <span>${group ? escapeHtml(group.name) : 'Non groupée'}</span>
            </div>
            ${stockStatusMarkup(sale)}
            <div class="card-actions">
              ${statusButtons}
              <button class="secondary" data-merge="${sale.id}">Fusionner</button>
              <button class="secondary" data-stock-edit="${sale.id}">Stock / prix achat</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function selectedStockIdsForSale(sale) {
  const info = saleStockMatchInfo(sale, state.stockProducts, state.stockMatches, state.purchaseOverrides, state.stockIgnored);
  const selectedIds = Array.isArray(state.stockMatches[sale.id])
    ? state.stockMatches[sale.id]
    : info.products.map((product) => product.id);
  return [...new Set(selectedIds.filter(Boolean))].slice(0, 4);
}

function filteredStockProducts(selectedIds = []) {
  const query = normalizeClientText(state.stockSearch);
  const products = query
    ? state.stockProducts.filter((product) => stockSearchText(product).includes(query))
    : state.stockProducts;

  const selectedSet = new Set(selectedIds);
  return products
    .slice()
    .sort((a, b) => {
      const selectedDiff = Number(selectedSet.has(b.id)) - Number(selectedSet.has(a.id));
      if (selectedDiff) return selectedDiff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });
}

function stockProductCard(product, selectedIds = []) {
  const selected = selectedIds.includes(product.id);
  const purchase = stockPurchaseCents(product);
  return `
    <button class="stock-product-card ${selected ? 'selected' : ''}" type="button" data-stock-product-id="${escapeHtml(product.id)}" aria-pressed="${selected ? 'true' : 'false'}">
      <span class="stock-product-card-image">${productImageMarkup(product)}</span>
      <span class="stock-product-card-body">
        <strong>${escapeHtml(product.name || 'Article stock')}</strong>
        <small>${purchase ? `Achat ${formatMoney(purchase)}` : 'Prix d’achat inconnu'}</small>
      </span>
      <span class="stock-product-card-check">${selected ? '✓' : '+'}</span>
    </button>
  `;
}

function renderStockFields() {
  const sale = state.sales.find((item) => item.id === state.selectedStockSaleId);
  if (!sale || !elements.stockFields) return;

  const selectedIds = selectedStockIdsForSale(sale);
  const products = filteredStockProducts(selectedIds);
  const selectedProducts = selectedIds
    .map((productId) => state.stockProducts.find((product) => product.id === productId))
    .filter(Boolean);

  if (elements.stockSelectedList) {
    elements.stockSelectedList.innerHTML = selectedProducts.length === 0
      ? '<p class="muted">Aucun article sélectionné. Clique sur une carte ci-dessous.</p>'
      : selectedProducts.map((product) => `
          <span class="stock-selected-pill">
            ${productImageMarkup(product)}
            <span>${escapeHtml(product.name || 'Article stock')}</span>
            <button type="button" data-remove-stock-product="${escapeHtml(product.id)}" aria-label="Retirer">×</button>
          </span>
        `).join('');
  }

  elements.stockFields.innerHTML = products.length === 0
    ? '<div class="empty-state">Aucun article trouvé dans le stock avec cette recherche.</div>'
    : products.map((product) => stockProductCard(product, selectedIds)).join('');
}

function openStockModal(saleId) {
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale || !elements.stockModal) return;

  const info = saleStockMatchInfo(sale, state.stockProducts, state.stockMatches, state.purchaseOverrides, state.stockIgnored);
  state.selectedStockSaleId = saleId;
  state.stockSearch = '';
  elements.stockTitle.textContent = sale.rawTitle || 'Vente';
  elements.stockSearch.value = '';
  elements.stockPurchase.value = info.hasPurchaseOverride ? String(state.purchaseOverrides[sale.id]) : '';
  if (elements.stockIgnore) elements.stockIgnore.checked = Boolean(state.stockIgnored[sale.id]);
  renderStockFields();
  elements.stockModal.hidden = false;
}

function closeStockModal() {
  if (!elements.stockModal) return;
  elements.stockModal.hidden = true;
  state.selectedStockSaleId = null;
  state.stockSearch = '';
  elements.stockForm.reset();
}

function renderGroupChoices() {
  const sale = state.sales.find((item) => item.id === state.selectedSaleId);
  const query = normalizeClientText(elements.groupSearch.value || sale?.normalizedTitle || '');

  const groups = state.groups
    .map((group) => ({
      group,
      score: query && normalizeClientText(group.name).includes(query) ? 2 : 1
    }))
    .sort((a, b) => b.score - a.score || a.group.name.localeCompare(b.group.name, 'fr'));

  elements.groupSelect.innerHTML = '<option value="">Choisir un groupe existant</option>';
  for (const { group, score } of groups) {
    const suffix = score > 1 ? ' · suggestion' : '';
    elements.groupSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name + suffix)}</option>`
    );
  }
}

function openMergeModal(saleId) {
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale) return;

  state.selectedSaleId = saleId;
  elements.groupSearch.value = sale.rawTitle;
  elements.newGroupName.value = sale.rawTitle;
  renderGroupChoices();
  elements.modal.hidden = false;
}

function closeMergeModal() {
  elements.modal.hidden = true;
  state.selectedSaleId = null;
  elements.mergeForm.reset();
}

function openManualSaleModal() {
  if (!elements.manualSaleModal || !elements.manualSaleForm) return;
  elements.manualSaleForm.reset();
  const soldAtInput = elements.manualSaleForm.elements.soldAt;
  if (soldAtInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    soldAtInput.value = now.toISOString().slice(0, 16);
  }
  elements.manualSaleModal.hidden = false;
}

function closeManualSaleModal() {
  if (!elements.manualSaleModal || !elements.manualSaleForm) return;
  elements.manualSaleModal.hidden = true;
  elements.manualSaleForm.reset();
}

function manualSalePayloadFromForm(form) {
  const price = Number(String(form.elements.price.value || '').replace(',', '.'));
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Prix de vente invalide');
  }

  const soldAtValue = form.elements.soldAt.value;
  const soldAt = soldAtValue ? new Date(soldAtValue).toISOString() : new Date().toISOString();

  return {
    rawTitle: form.elements.rawTitle.value.trim(),
    priceCents: Math.round(price * 100),
    priceFormatted: formatMoney(Math.round(price * 100)),
    buyerUsername: form.elements.buyerUsername.value.trim(),
    accountName: form.elements.accountName.value.trim(),
    soldAt,
    status: form.elements.status.value || 'todo',
    imagePath: form.elements.imagePath.value.trim(),
    source: 'manual'
  };
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
    state.meta = data.meta;
    renderFilters();
    renderOrders();
  } catch (error) {
    renderError(elements.list, error);
  }
}

async function updateVisibleSalesStatus(status) {
  const sales = filteredSales().filter((sale) => sale.status !== status && !['finished', 'archived'].includes(sale.status));
  if (sales.length === 0) {
    showToast('Aucune commande à modifier');
    return;
  }

  for (const button of [elements.bulkPrepared, elements.bulkSent]) {
    if (button) button.disabled = true;
  }

  let updated = 0;
  try {
    for (const sale of sales) {
      const result = await updateSaleStatus(sale.id, status);
      Object.assign(sale, result.sale || { status });
      updated += 1;
    }
    renderOrders();
    showToast(`${updated} commande(s) mise(s) à jour`);
  } catch (error) {
    renderOrders();
    showToast(`${updated}/${sales.length} commande(s) mise(s) à jour. ${error.message}`, 'error');
  } finally {
    for (const button of [elements.bulkPrepared, elements.bulkSent]) {
      if (button) button.disabled = false;
    }
  }
}

elements.list.addEventListener('click', async (event) => {
  const statusButton = event.target.closest('[data-status]');
  const mergeButton = event.target.closest('[data-merge]');
  const stockButton = event.target.closest('[data-stock-edit]');

  if (statusButton) {
    const saleId = statusButton.dataset.saleId;
    const status = statusButton.dataset.status;
    statusButton.disabled = true;

    try {
      const result = await updateSaleStatus(saleId, status);
      const sale = state.sales.find((item) => item.id === saleId);
      if (sale) Object.assign(sale, result.sale);
      renderOrders();
      showToast('Statut mis à jour');
    } catch (error) {
      showToast(error.message, 'error');
      statusButton.disabled = false;
    }
  }

  if (mergeButton) {
    openMergeModal(mergeButton.dataset.merge);
  }

  if (stockButton) {
    openStockModal(stockButton.dataset.stockEdit);
  }
});

for (const element of [elements.search, elements.status, elements.account, elements.showFinished]) {
  element.addEventListener('input', renderOrders);
}

elements.refresh.addEventListener('click', loadAndRender);
if (elements.bulkPrepared) elements.bulkPrepared.addEventListener('click', () => updateVisibleSalesStatus('prepared'));
if (elements.bulkSent) elements.bulkSent.addEventListener('click', () => updateVisibleSalesStatus('sent'));
if (elements.manualSaleOpen) elements.manualSaleOpen.addEventListener('click', openManualSaleModal);
elements.poll.addEventListener('click', async () => {
  elements.poll.disabled = true;
  try {
    const result = await pollNow();
    showToast(`${result.added || 0} nouvelle(s) vente(s)`);
    await loadAndRender();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    elements.poll.disabled = false;
  }
});

elements.groupSearch.addEventListener('input', renderGroupChoices);
elements.modal.addEventListener('click', (event) => {
  if (event.target.matches('[data-close-modal]')) closeMergeModal();
});

if (elements.manualSaleModal) {
  elements.manualSaleModal.addEventListener('click', (event) => {
    if (event.target.matches('[data-close-manual-sale-modal]')) closeManualSaleModal();
  });
}

if (elements.manualSaleForm) {
  elements.manualSaleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = elements.manualSaleForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const payload = manualSalePayloadFromForm(elements.manualSaleForm);
      if (!payload.rawTitle) {
        showToast('Titre Vinted obligatoire', 'error');
        return;
      }
      const result = await createManualSale(payload);
      if (result.sale) {
        state.sales.unshift(result.sale);
      }
      closeManualSaleModal();
      renderFilters();
      renderOrders();
      showToast('Vente manuelle ajoutée');
      await loadAndRender();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

if (elements.stockSearch) {
  elements.stockSearch.addEventListener('input', (event) => {
    state.stockSearch = event.target.value;
    renderStockFields();
  });
}

if (elements.stockModal) {
  elements.stockModal.addEventListener('click', (event) => {
    if (event.target.matches('[data-close-stock-modal]')) closeStockModal();
  });
}

if (elements.stockFields) {
  elements.stockFields.addEventListener('click', (event) => {
    const card = event.target.closest('[data-stock-product-id]');
    if (!card || !state.selectedStockSaleId) return;

    const productId = card.dataset.stockProductId;
    if (elements.stockIgnore) elements.stockIgnore.checked = false;
    delete state.stockIgnored[state.selectedStockSaleId];
    const current = selectedStockIdsForSale({ id: state.selectedStockSaleId });
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId].slice(0, 4);

    if (next.length === 0) {
      delete state.stockMatches[state.selectedStockSaleId];
    } else {
      state.stockMatches[state.selectedStockSaleId] = next;
    }
    renderStockFields();
  });
}

if (elements.stockSelectedList) {
  elements.stockSelectedList.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-stock-product]');
    if (!removeButton || !state.selectedStockSaleId) return;

    const current = selectedStockIdsForSale({ id: state.selectedStockSaleId });
    const next = current.filter((id) => id !== removeButton.dataset.removeStockProduct);
    if (next.length === 0) {
      delete state.stockMatches[state.selectedStockSaleId];
    } else {
      state.stockMatches[state.selectedStockSaleId] = next;
    }
    renderStockFields();
  });
}

if (elements.stockForm) {
  elements.stockForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const saleId = state.selectedStockSaleId;
    if (!saleId) return;

    const ignoreStock = Boolean(elements.stockIgnore?.checked);
    const productIds = ignoreStock ? [] : selectedStockIdsForSale({ id: saleId });

    if (ignoreStock) {
      state.stockIgnored[saleId] = true;
      delete state.stockMatches[saleId];
    } else {
      delete state.stockIgnored[saleId];
      if (productIds.length === 0) {
        delete state.stockMatches[saleId];
      } else {
        state.stockMatches[saleId] = [...new Set(productIds)];
      }
    }

    const purchaseValue = elements.stockPurchase.value.trim().replace(',', '.');
    if (!purchaseValue) {
      delete state.purchaseOverrides[saleId];
    } else {
      const purchaseNumber = Number(purchaseValue);
      if (!Number.isFinite(purchaseNumber) || purchaseNumber < 0) {
        showToast('Prix d’achat invalide', 'error');
        return;
      }
      state.purchaseOverrides[saleId] = purchaseNumber;
    }

    saveStockMatches(state.stockMatches);
    saveStockIgnored(state.stockIgnored);
    saveSalePurchaseOverrides(state.purchaseOverrides);
    closeStockModal();
    renderOrders();
    showToast('Association stock enregistrée');
  });
}

elements.mergeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const saleId = state.selectedSaleId;
  const groupId = elements.groupSelect.value;
  const newGroupName = elements.newGroupName.value.trim();

  if (!saleId) return;
  if (!groupId && !newGroupName) {
    showToast('Choisis un groupe ou indique un nouveau nom', 'error');
    return;
  }

  try {
    const payload = groupId ? { groupId } : { newGroupName };
    const result = await mergeSale(saleId, payload);
    const sale = state.sales.find((item) => item.id === saleId);
    if (sale) Object.assign(sale, result.sale);
    if (!state.groups.some((group) => group.id === result.group.id)) {
      state.groups.push(result.group);
    }
    closeMergeModal();
    renderFilters();
    renderOrders();
    showToast('Vente fusionnée');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

loadAndRender();
