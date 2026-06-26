const STORAGE_KEYS = {
  apiUrl: 'vinted-dashboard-api-url',
  adminToken: 'vinted-dashboard-admin-token'
};

export const STOCK_PRODUCTS_KEY = 'vinted_stocks_data_v1';
export const STOCK_MATCHES_KEY = 'vinted-stock-sale-matches';
export const SALE_PURCHASE_OVERRIDES_KEY = 'vinted-sale-purchase-overrides';
export const STOCK_IGNORED_KEY = 'vinted-stock-sale-ignored';

export const STATUS_LABELS = {
  todo: 'Pas encore préparé',
  prepared: 'Préparé',
  sent: 'Envoyé',
  finished: 'Terminé',
  archived: 'Archivé'
};

export const STATUS_ORDER = ['todo', 'prepared', 'sent', 'finished'];

export function getSettings() {
  return {
    apiUrl: localStorage.getItem(STORAGE_KEYS.apiUrl) || '',
    adminToken: localStorage.getItem(STORAGE_KEYS.adminToken) || ''
  };
}

export function saveSettings({ apiUrl, adminToken }) {
  localStorage.setItem(STORAGE_KEYS.apiUrl, String(apiUrl || '').trim().replace(/\/$/, ''));
  localStorage.setItem(STORAGE_KEYS.adminToken, String(adminToken || '').trim());
}

export function setupShell(activePage) {
  window.__dashboardModuleLoaded = true;
  const nav = document.querySelector('[data-nav]');
  if (nav) {
    nav.innerHTML = `
      <a href="index.html" class="${activePage === 'orders' ? 'active' : ''}">Commandes</a>
      <a href="statistiques.html" class="${activePage === 'stats' ? 'active' : ''}">Statistiques</a>
      <a href="articles.html" class="${activePage === 'articles' ? 'active' : ''}">Articles</a>
      <a href="vinted-stocks/index.html">Stocks</a>
    `;
  }

  const settingsForm = document.querySelector('[data-settings-form]');
  if (!settingsForm) return;

  const settings = getSettings();
  settingsForm.elements.apiUrl.value = settings.apiUrl;
  settingsForm.elements.adminToken.value = settings.adminToken;

  settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveSettings({
      apiUrl: settingsForm.elements.apiUrl.value,
      adminToken: settingsForm.elements.adminToken.value
    });
    showToast('Paramètres enregistrés');
  });
}

export async function loadJson(path) {
  const response = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Impossible de charger ${path}`);
  }
  return response.json();
}

export async function loadDashboardData() {
  const [sales, groups, meta] = await Promise.all([
    loadJson('data/sales.json'),
    loadJson('data/groups.json'),
    loadJson('data/meta.json')
  ]);

  return { sales, groups, meta };
}

export async function apiRequest(path, options = {}) {
  const { apiUrl, adminToken } = getSettings();
  if (!apiUrl) throw new Error('URL API serveur manquante');
  if (!adminToken) throw new Error('Clé admin manquante');

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Erreur API');
  }
  return data;
}

export function formatDate(value) {
  if (!value) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function formatMoney(cents) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format((Number(cents) || 0) / 100);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function normalizeClientText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function imageUrl(imagePath) {
  return imagePath || '';
}

export function placeholderMarkup() {
  return '<div class="image-placeholder">Sans image</div>';
}

export function saleImageMarkup(sale, alt = '') {
  if (!sale.imagePath) return placeholderMarkup();
  return `<img src="${escapeHtml(imageUrl(sale.imagePath))}" alt="${escapeHtml(alt || sale.rawTitle)}" loading="lazy">`;
}

export function loadStockProducts() {
  try {
    const products = JSON.parse(localStorage.getItem(STOCK_PRODUCTS_KEY) || '[]');
    return Array.isArray(products) ? products.filter((product) => product && product.id) : [];
  } catch {
    return [];
  }
}

export function loadStockMatches() {
  try {
    const matches = JSON.parse(localStorage.getItem(STOCK_MATCHES_KEY) || '{}');
    return matches && typeof matches === 'object' ? matches : {};
  } catch {
    return {};
  }
}

export function saveStockMatches(matches) {
  localStorage.setItem(STOCK_MATCHES_KEY, JSON.stringify(matches || {}));
}

export function loadSalePurchaseOverrides() {
  try {
    const overrides = JSON.parse(localStorage.getItem(SALE_PURCHASE_OVERRIDES_KEY) || '{}');
    return overrides && typeof overrides === 'object' ? overrides : {};
  } catch {
    return {};
  }
}

export function saveSalePurchaseOverrides(overrides) {
  localStorage.setItem(SALE_PURCHASE_OVERRIDES_KEY, JSON.stringify(overrides || {}));
}

export function loadStockIgnored() {
  try {
    const ignored = JSON.parse(localStorage.getItem(STOCK_IGNORED_KEY) || '{}');
    return ignored && typeof ignored === 'object' ? ignored : {};
  } catch {
    return {};
  }
}

export function saveStockIgnored(ignored) {
  localStorage.setItem(STOCK_IGNORED_KEY, JSON.stringify(ignored || {}));
}

export function productImages(product) {
  const images = Array.isArray(product?.images) ? product.images : [];
  const photo = product?.photo ? [product.photo] : [];
  const imageUrl = product?.imageUrl ? [product.imageUrl] : [];
  const temuImageUrl = product?.temu?.imageUrl ? [product.temu.imageUrl] : [];
  return [...images, ...photo, ...imageUrl, ...temuImageUrl]
    .map((image) => String(image || '').trim())
    .filter(Boolean);
}

export function productImageMarkup(product) {
  const image = productImages(product)[0];
  if (!image) return placeholderMarkup();
  return `<img src="${escapeHtml(image)}" alt="${escapeHtml(product?.name || 'Article stock')}" loading="lazy">`;
}

export function stockPurchaseCents(product) {
  const price = Number(product?.purchasePrice ?? product?.temu?.purchasePrice ?? 0);
  return Number.isFinite(price) ? Math.round(price * 100) : 0;
}

export function stockSearchText(product) {
  return normalizeClientText([
    product?.name,
    product?.articleLink,
    product?.temu?.variant,
    product?.temu?.color,
    product?.temu?.productUrl,
    product?.temu?.orderPageUrl
  ].filter(Boolean).join(' '));
}

export function saleSearchText(sale) {
  return normalizeClientText([sale?.rawTitle, sale?.normalizedTitle].filter(Boolean).join(' '));
}

export function saleLooksLikeLot(sale) {
  return /(?:\+|&|\b(et|lot|lots|ensemble|pack|duo)\b)/i.test(saleSearchText(sale));
}

export function saleStockSegments(sale) {
  const title = String(sale?.rawTitle || sale?.normalizedTitle || '').trim();
  if (!saleLooksLikeLot(sale)) return [title];

  const parts = title
    .split(/\s+(?:\+|&|\bet\b|\bavec\b)\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);

  if (parts.length >= 2) return parts.slice(0, 4);
  return [title];
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

export function stockScore(query, product) {
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

export function bestStockMatch(query, products, excludedIds = []) {
  return products
    .filter((product) => !excludedIds.includes(product.id))
    .map((product) => ({ product, score: stockScore(query, product) }))
    .filter((match) => match.score >= 35)
    .sort((a, b) => b.score - a.score)[0] || null;
}

export function autoStockMatches(sale, products, matches = {}, ignored = {}) {
  const manualIds = matches[sale.id];
  if (Array.isArray(manualIds)) {
    return manualIds.map((productId) => products.find((product) => product.id === productId) || null).filter(Boolean);
  }

  if (ignored[sale.id]) return [];

  const detected = [];
  for (const segment of saleStockSegments(sale)) {
    const match = bestStockMatch(segment, products, detected.map((item) => item.product.id));
    if (match) detected.push(match);
  }

  return detected.map((match) => match.product);
}

export function saleStockMatchInfo(sale, products, matches = {}, purchaseOverrides = {}, ignored = {}) {
  const matchedProducts = autoStockMatches(sale, products, matches, ignored);
  const stockPurchase = matchedProducts.reduce((sum, product) => sum + stockPurchaseCents(product), 0);
  const override = purchaseOverrides[sale.id];
  const overrideCents = override === '' || override === undefined || override === null
    ? null
    : Math.round(Number(override) * 100);
  const purchaseCents = Number.isFinite(overrideCents) ? overrideCents : stockPurchase;
  const confidence = Array.isArray(matches[sale.id])
    ? 'manual'
    : ignored[sale.id]
      ? 'ignored'
      : matchedProducts.length > 0
        ? 'auto'
        : 'missing';

  return {
    products: matchedProducts,
    purchaseCents,
    stockPurchaseCents: stockPurchase,
    hasPurchaseOverride: Number.isFinite(overrideCents),
    ignored: Boolean(ignored[sale.id]),
    confidence
  };
}

export function statusBadge(status) {
  return `<span class="status-badge status-${escapeHtml(status)}">${STATUS_LABELS[status] || status}</span>`;
}

function colorHueForText(value = '') {
  const palette = [2, 28, 142, 190, 216, 262, 306, 335];
  let hash = 0;

  for (const char of String(value || 'compte')) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return palette[hash % palette.length];
}

export function accountBadge(accountName) {
  const label = accountName || 'Compte inconnu';
  const hue = colorHueForText(label);
  return `<span class="account-badge" style="--account-hue:${hue}">${escapeHtml(label)}</span>`;
}

export function accountBadges(accountNames = []) {
  const uniqueAccounts = [...new Set(accountNames.filter(Boolean))];
  if (uniqueAccounts.length === 0) return accountBadge(null);
  return uniqueAccounts.map((accountName) => accountBadge(accountName)).join('');
}

export function showToast(message, type = 'success') {
  const toast = document.querySelector('[data-toast]');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.className = 'toast';
  }, 3200);
}

export function renderError(container, error) {
  container.innerHTML = `<div class="empty-state error">${escapeHtml(error.message || error)}</div>`;
}

export function groupById(groups) {
  return new Map(groups.map((group) => [group.id, group]));
}

export function salesForGroup(sales, groupId) {
  return sales.filter((sale) => sale.groupId === groupId);
}
