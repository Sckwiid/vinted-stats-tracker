(function () {
  const STORAGE_KEYS = {
    apiUrl: 'vinted-dashboard-api-url',
    adminToken: 'vinted-dashboard-admin-token'
  };

  function cleanApiUrl(value) {
    return String(value || '').trim().replace(/\/$/, '');
  }

  function getSettings() {
    return {
      apiUrl: localStorage.getItem(STORAGE_KEYS.apiUrl) || '',
      adminToken: localStorage.getItem(STORAGE_KEYS.adminToken) || ''
    };
  }

  function saveSettings(apiUrl, adminToken) {
    localStorage.setItem(STORAGE_KEYS.apiUrl, cleanApiUrl(apiUrl));
    localStorage.setItem(STORAGE_KEYS.adminToken, String(adminToken || '').trim());
  }

  function importSettingsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const apiUrl = params.get('apiUrl');
    const adminToken = params.get('adminToken') || params.get('adminTok') || params.get('token');

    if (!apiUrl && !adminToken) return;

    const current = getSettings();
    saveSettings(apiUrl || current.apiUrl, adminToken || current.adminToken);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  function setupSettingsForm() {
    const form = document.querySelector('[data-settings-form]');
    if (!form) return;

    const settings = getSettings();
    if (form.elements.apiUrl) form.elements.apiUrl.value = settings.apiUrl;
    if (form.elements.adminToken) form.elements.adminToken.value = settings.adminToken;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveSettings(form.elements.apiUrl?.value, form.elements.adminToken?.value);
      showFallbackToast('Paramètres enregistrés');
    });
  }

  function showFallbackToast(message) {
    const toast = document.querySelector('[data-toast]');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast visible success';
    window.clearTimeout(showFallbackToast.timeout);
    showFallbackToast.timeout = window.setTimeout(() => {
      toast.className = 'toast';
    }, 3200);
  }

  function formatMoney(cents) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format((Number(cents) || 0) / 100);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function loadJson(path) {
    const response = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Impossible de charger ${path}`);
    return response.json();
  }

  async function renderOrdersFallback() {
    if (window.__dashboardModuleLoaded) return;

    const list = document.querySelector('[data-orders-list]');
    const summary = document.querySelector('[data-orders-summary]');
    if (!list || !summary) return;

    try {
      const sales = await loadJson('data/sales.json');
      const visibleSales = Array.isArray(sales)
        ? sales.filter((sale) => !['finished', 'archived'].includes(sale.status))
        : [];
      const total = visibleSales.reduce((sum, sale) => sum + Number(sale.priceCents || 0), 0);

      summary.innerHTML = `
        <div><strong>${visibleSales.length}</strong><span>commandes</span></div>
        <div><strong>${formatMoney(total)}</strong><span>encaissé</span></div>
        <div><strong>Fallback</strong><span>module JS principal non chargé</span></div>
      `;

      if (visibleSales.length === 0) {
        list.innerHTML = '<div class="empty-state">Aucune commande à afficher.</div>';
        return;
      }

      list.innerHTML = visibleSales.map((sale) => `
        <article class="sale-card status-card-${escapeHtml(sale.status || 'todo')}">
          <div class="sale-image"><div class="image-placeholder">Sans image</div></div>
          <div class="sale-content">
            <div class="sale-heading">
              <div>
                <h2>${escapeHtml(sale.rawTitle || 'Vente sans titre')}</h2>
                <p class="account-line"><span>${escapeHtml(sale.accountName || 'Compte inconnu')}</span></p>
              </div>
              <strong>${formatMoney(sale.priceCents)}</strong>
            </div>
            <div class="sale-meta">
              <span>${escapeHtml(sale.status || 'todo')}</span>
              <span>${escapeHtml(sale.soldAt || '')}</span>
            </div>
          </div>
        </article>
      `).join('');
    } catch (error) {
      list.innerHTML = `<div class="empty-state error">${escapeHtml(error.message || error)}</div>`;
    }
  }

  importSettingsFromUrl();
  setupSettingsForm();
  window.setTimeout(renderOrdersFallback, 700);
})();
