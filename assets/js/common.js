const STORAGE_KEYS = {
  apiUrl: 'vinted-dashboard-api-url',
  adminToken: 'vinted-dashboard-admin-token'
};

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
  const nav = document.querySelector('[data-nav]');
  if (nav) {
    nav.innerHTML = `
      <a href="index.html" class="${activePage === 'orders' ? 'active' : ''}">Commandes</a>
      <a href="statistiques.html" class="${activePage === 'stats' ? 'active' : ''}">Statistiques</a>
      <a href="articles.html" class="${activePage === 'articles' ? 'active' : ''}">Articles</a>
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
