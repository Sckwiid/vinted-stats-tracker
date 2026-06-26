import * as Common from './common.js';

const {
  accountBadge,
  escapeHtml,
  formatDate,
  formatMoney,
  loadDashboardData,
  loadSalePurchaseOverrides,
  normalizeClientText,
  renderError,
  saleImageMarkup,
  salesForGroup,
  setupShell,
  showToast,
  statusBadge
} = Common;

function mergeSale(saleId, payload) {
  return Common.apiRequest(`/api/sales/${encodeURIComponent(saleId)}/merge`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

function renameGroup(groupId, name) {
  return Common.apiRequest(`/api/groups/${encodeURIComponent(groupId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name })
  });
}

const PURCHASE_PRICES_KEY = 'vinted-purchase-prices';
const STOCK_PRODUCTS_KEY = 'vinted_stocks_data_v1';
const STOCK_MATCHES_KEY = 'vinted-stock-sale-matches';
const STOCK_IGNORED_KEY = 'vinted-stock-sale-ignored';

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
  groups: [],
  stockProducts: [],
  stockMatches: {},
  stockIgnored: {},
  purchaseOverrides: {},
  stockReviewOpen: false
};

const elements = {
  list: document.querySelector('[data-groups-list]'),
  ungrouped: document.querySelector('[data-ungrouped-list]'),
  search: document.querySelector('[data-group-search]'),
  stockReview: document.querySelector('[data-stock-review]'),
  stockReviewToggle: document.querySelector('[data-stock-review-toggle]')
};

setupShell('articles');

function filteredGroups() {
  const query = normalizeClientText(elements.search.value);
  if (!query) return state.groups;
  return state.groups.filter((group) => normalizeClientText(group.name).includes(query));
}

function loadStockProducts() {
  try {
    const products = JSON.parse(localStorage.getItem(STOCK_PRODUCTS_KEY) || '[]');
    return Array.isArray(products) ? products.filter((product) => product && product.id) : [];
  } catch {
    return [];
  }
}

function loadStockMatches() {
  try {
    const matches = JSON.parse(localStorage.getItem(STOCK_MATCHES_KEY) || '{}');
    return matches && typeof matches === 'object' ? matches : {};
  } catch {
    return {};
  }
}

function saveStockMatches() {
  localStorage.setItem(STOCK_MATCHES_KEY, JSON.stringify(state.stockMatches));
}

function loadStockIgnored() {
  try {
    const ignored = JSON.parse(localStorage.getItem(STOCK_IGNORED_KEY) || '{}');
    return ignored && typeof ignored === 'object' ? ignored : {};
  } catch {
    return {};
  }
}

function saveStockIgnored() {
  localStorage.setItem(STOCK_IGNORED_KEY, JSON.stringify(state.stockIgnored));
}

function productImages(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const photo = product.photo ? [product.photo] : [];
  const imageUrl = product.imageUrl ? [product.imageUrl] : [];
  const temuImageUrl = product.temu?.imageUrl ? [product.temu.imageUrl] : [];
  return [...images, ...photo, ...imageUrl, ...temuImageUrl]
    .map((image) => String(image || '').trim())
    .filter(Boolean);
}

function productImageMarkup(product) {
  const image = productImages(product)[0];
  if (!image) return '<div class="image-placeholder">Sans image</div>';
  return `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name || 'Article stock')}" loading="lazy">`;
}

function stockPurchaseCents(product) {
  const price = Number(product.purchasePrice ?? product.temu?.purchasePrice ?? 0);
  return Number.isFinite(price) ? Math.round(price * 100) : 0;
}

function stockSearchText(product) {
  return normalizeClientText([
    product.name,
    product.articleLink,
    product.temu?.variant,
    product.temu?.color,
    product.temu?.productUrl,
    product.temu?.orderPageUrl
  ].filter(Boolean).join(' '));
}

function saleSearchText(sale) {
  return normalizeClientText([sale.rawTitle, sale.normalizedTitle].filter(Boolean).join(' '));
}

const STOCK_MATCH_STOPWORDS = new Set([
  'femme', 'femmes', 'homme', 'hommes', 'pour', 'avec', 'sans', 'neuf', 'neuve', 'nouveau', 'nouvelle',
  'ete', 'hiver', 'printemps', 'automne', 'taille', 'tailles', 'mode', 'style', 'adulte', 'adultes',
  'couleur', 'unie', 'uni', 'vacances', 'decontracte', 'decontractee', 'confortable', 'tenue', 'vetement',
  'vetements', 'piece', 'pieces', 'lot', 'lots', 'pack', 'ideal', 'parfait', 'parfaite', 'nouvel', 'haute'
]);

const STOCK_MATCH_SYNONYMS = new Map([
  ['debardeur', 'top'],
  ['debardeurs', 'top'],
  ['haut', 'top'],
  ['hauts', 'top'],
  ['tshirt', 'tee'],
  ['shirt', 'tee'],
  ['shirts', 'tee'],
  ['tee', 'tee'],
  ['teeshirt', 'tee'],
  ['teeshirts', 'tee'],
  ['camisole', 'top'],
  ['caraco', 'top'],
  ['combishort', 'combinaison'],
  ['barboteuse', 'combinaison'],
  ['shorts', 'short'],
  ['jupe', 'robe'],
  ['marron', 'brown'],
  ['brun', 'brown'],
  ['brune', 'brown'],
  ['rouge', 'red'],
  ['noir', 'black'],
  ['noire', 'black'],
  ['blanc', 'white'],
  ['blanche', 'white'],
  ['vert', 'green'],
  ['verte', 'green'],
  ['beige', 'beige'],
  ['rose', 'pink'],
  ['leopard', 'leopard']
]);

const STOCK_MATCH_COLORS = new Set(['black', 'white', 'red', 'green', 'beige', 'pink', 'brown', 'bleu', 'blue', 'gris', 'gray', 'grey', 'leopard']);
const STOCK_MATCH_CATEGORIES = new Set(['robe', 'top', 'short', 'ensemble', 'combinaison', 'tee', 'jupe', 'pantalon', 'legging', 'pull', 'gilet']);

function stockMatchTokens(value = '') {
  return normalizeClientText(value)
    .split(' ')
    .map((token) => STOCK_MATCH_SYNONYMS.get(token) || token)
    .filter((token) => token.length > 2 && !STOCK_MATCH_STOPWORDS.has(token));
}

function stockScore(query, product) {
  const queryTokens = [...new Set(stockMatchTokens(query))];
  const productTokens = [...new Set(stockMatchTokens(stockSearchText(product)))];
  if (queryTokens.length === 0 || productTokens.length === 0) return 0;

  const productSet = new Set(productTokens);
  const matchedTokens = queryTokens.filter((token) => productSet.has(token));
  if (matchedTokens.length === 0) return 0;

  const queryColors = queryTokens.filter((token) => STOCK_MATCH_COLORS.has(token));
  const queryCategories = queryTokens.filter((token) => STOCK_MATCH_CATEGORIES.has(token));
  const matchedColors = queryColors.filter((token) => productSet.has(token));
  const matchedCategories = queryCategories.filter((token) => productSet.has(token));

  const coverage = matchedTokens.length / queryTokens.length;
  let score = Math.round(coverage * 82) + matchedTokens.length * 7;

  if (queryCategories.length > 0 && matchedCategories.length === 0) score -= 35;
  if (queryColors.length > 0 && matchedColors.length === 0) score -= 28;
  score += matchedCategories.length * 14;
  score += matchedColors.length * 12;

  if (queryTokens.length <= 3 && coverage === 1) score += 18;
  return Math.max(0, Math.min(score, 100));
}

function bestStockMatch(query, excludedIds = []) {
  return state.stockProducts
    .filter((product) => !excludedIds.includes(product.id))
    .map((product) => ({ product, score: stockScore(query, product) }))
    .filter((match) => match.score >= 35)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function saleLooksLikeLot(sale) {
  return /(?:\+|&|\b(et|lot|lots|ensemble|pack|duo)\b)/i.test(saleSearchText(sale));
}

function saleStockSegments(sale) {
  const title = String(sale.rawTitle || sale.normalizedTitle || '').trim();
  if (!saleLooksLikeLot(sale)) return [title];

  const parts = title
    .split(/\s+\bet\b\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);

  if (parts.length >= 2) return parts.slice(0, 2);
  return [title];
}

function autoStockMatches(sale) {
  const manualIds = state.stockMatches[sale.id];
  if (Array.isArray(manualIds)) {
    return manualIds.map((productId) => state.stockProducts.find((product) => product.id === productId) || null);
  }

  if (state.stockIgnored[sale.id]) return [];

  const matches = [];
  for (const segment of saleStockSegments(sale)) {
    const match = bestStockMatch(segment, matches.map((item) => item.product.id));
    if (match) matches.push(match);
  }

  return matches.map((match) => match.product);
}

function saleStockMatchInfo(sale) {
  const manualIds = Array.isArray(state.stockMatches[sale.id]) ? state.stockMatches[sale.id] : [];
  const products = autoStockMatches(sale).filter(Boolean);
  const productIds = new Set(products.map((product) => product.id));
  const missingProductIds = manualIds.filter((productId) => !productIds.has(productId));
  const stockPurchaseCentsTotal = products.reduce((sum, product) => sum + stockPurchaseCents(product), 0);
  const override = state.purchaseOverrides[sale.id];
  const overrideCents = override === '' || override === undefined || override === null
    ? null
    : Math.round(Number(override) * 100);
  const purchaseCents = Number.isFinite(overrideCents) ? overrideCents : stockPurchaseCentsTotal;
  const confidence = Array.isArray(state.stockMatches[sale.id])
    ? 'manual'
    : state.stockIgnored[sale.id]
      ? 'ignored'
      : products.length > 0
        ? 'auto'
        : 'missing';

  return {
    products,
    purchaseCents,
    confidence,
    missingProductIds,
    hasMissingProducts: missingProductIds.length > 0,
    hasPurchaseOverride: Number.isFinite(overrideCents),
    ignored: Boolean(state.stockIgnored[sale.id])
  };
}

function stockOptions(selectedId = '') {
  return `
    <option value="">Aucun article</option>
    ${state.stockProducts
      .map((product) => `<option value="${escapeHtml(product.id)}" ${product.id === selectedId ? 'selected' : ''}>${escapeHtml(product.name || 'Article stock')}</option>`)
      .join('')}
  `;
}

function stockMatchSummaryMarkup(sale) {
  const info = saleStockMatchInfo(sale);
  if (state.stockProducts.length === 0) {
    return '<p class="stock-match-line missing">Stock non chargé : ouvre d’abord la page Stocks sur ce navigateur.</p>';
  }
  if (info.products.length === 0 && !info.hasPurchaseOverride && !info.hasMissingProducts) {
    return '<p class="stock-match-line missing">Aucune correspondance stock détectée. Clique sur “Vérifier les correspondances stock”.</p>';
  }

  if (info.hasMissingProducts && info.products.length === 0 && !info.hasPurchaseOverride) {
    return '<p class="stock-match-line manual"><span>Validé manuellement</span><span>Article retiré du stock · Ajoute un prix manuel</span></p>';
  }

  const profit = Number(sale.priceCents || 0) - info.purchaseCents;
  const label = info.confidence === 'manual'
    ? 'Validé manuellement'
    : info.confidence === 'ignored'
      ? 'Stock ignoré'
      : info.products.length > 0
        ? 'Détecté automatiquement'
        : 'Prix manuel';
  const productsText = info.products.length > 0
    ? `<strong>${info.products.map((product) => escapeHtml(product.name)).join(' + ')}</strong>`
    : info.hasMissingProducts
      ? '<strong>Article retiré du stock</strong>'
      : '';
  return `
    <div class="stock-match-line ${info.confidence}">
      <span>${label}</span>
      ${productsText}
      <span>Achat ${formatMoney(info.purchaseCents)} · Bénéfice ${formatMoney(profit)}</span>
    </div>
  `;
}

function saleDisplayImageMarkup(sale) {
  const product = saleStockMatchInfo(sale).products[0];
  return product ? productImageMarkup(product) : saleImageMarkup(sale);
}

function saleDisplayTitle(sale) {
  const products = saleStockMatchInfo(sale).products;
  return products.length > 0 ? products.map((product) => product.name).join(' + ') : sale.rawTitle;
}

function renderStockReview() {
  if (!state.stockReviewOpen) {
    elements.stockReview.hidden = true;
    elements.stockReview.innerHTML = '';
    return;
  }

  elements.stockReview.hidden = false;

  if (state.stockProducts.length === 0) {
    elements.stockReview.innerHTML = `
      <div class="empty-state">
        Aucun stock local trouvé. Ouvre d’abord la page Stocks pour charger les articles sur ce navigateur.
      </div>
    `;
    return;
  }

  elements.stockReview.innerHTML = `
    <div class="section-heading">
      <h2>Correspondances ventes ↔ stock</h2>
      <p class="muted">Vérifie les détections automatiques. Pour un lot, tu peux choisir deux articles.</p>
    </div>
    <div class="stock-review-list">
      ${state.sales.map((sale) => {
        const selectedIds = Array.isArray(state.stockMatches[sale.id])
          ? state.stockMatches[sale.id]
          : autoStockMatches(sale).map((product) => product.id);
        const info = saleStockMatchInfo(sale);
        const statusText = info.confidence === 'manual'
          ? 'Validé'
          : info.products.length > 0
            ? 'Auto'
            : 'À associer';

        return `
          <article class="stock-review-card" data-stock-sale="${escapeHtml(sale.id)}">
            <div class="thumb">${saleDisplayImageMarkup(sale)}</div>
            <div>
              <span class="stock-match-status ${info.confidence}">${statusText}</span>
              <h3>${escapeHtml(sale.rawTitle)}</h3>
              ${stockMatchSummaryMarkup(sale)}
            </div>
            <form class="stock-match-form" data-stock-match-form="${escapeHtml(sale.id)}">
              <select name="productA">${stockOptions(selectedIds[0] || '')}</select>
              <select name="productB">${stockOptions(selectedIds[1] || '')}</select>
              <button type="submit">Valider</button>
            </form>
          </article>
        `;
      }).join('')}
    </div>
  `;
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
            <span>${escapeHtml(saleDisplayTitle(sale))}</span>
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
        <div class="thumb">${saleDisplayImageMarkup(sale)}</div>
        <div>
          <h3>${escapeHtml(saleDisplayTitle(sale))}</h3>
          <p class="account-line">${accountBadge(sale.accountName)}<span>${formatMoney(sale.priceCents)} · ${formatDate(sale.soldAt)}</span></p>
          ${stockMatchSummaryMarkup(sale)}
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
  state.stockProducts = loadStockProducts();
  state.stockMatches = loadStockMatches();
  state.stockIgnored = loadStockIgnored();
  state.purchaseOverrides = loadSalePurchaseOverrides();
  renderGroups();
  renderUngrouped();
  renderStockReview();
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
elements.stockReviewToggle.addEventListener('click', () => {
  state.stockReviewOpen = !state.stockReviewOpen;
  renderStockReview();
});

elements.stockReview.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-stock-match-form]');
  if (!form) return;
  event.preventDefault();

  const saleId = form.dataset.stockMatchForm;
  const productIds = [form.productA.value, form.productB.value].filter(Boolean);
  delete state.stockIgnored[saleId];
  if (productIds.length === 0) {
    delete state.stockMatches[saleId];
  } else {
    state.stockMatches[saleId] = [...new Set(productIds)];
  }

  saveStockMatches();
  saveStockIgnored();
  render();
  showToast('Correspondance stock enregistrée');
});

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
