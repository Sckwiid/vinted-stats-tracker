const STORAGE_DATA_KEY = "vinted_stocks_data_v1";
const STORAGE_SESSION_KEY = "vinted_stocks_session_v1";
const STORAGE_API_TOKEN_KEY = "vinted_stocks_api_token_v1";
const DEFAULT_LOW_THRESHOLD = 3;
const DEFAULT_API_POLL_INTERVAL_MS = 60000;
const SELLER_ANTHONY = "anthony";
const SELLER_JULIEN = "julien";
const SELLER_COMPTE_PRO = "compte-pro";
const SELLER_BOTH = "both";
const SELLER_KEYS = [SELLER_ANTHONY, SELLER_JULIEN, SELLER_COMPTE_PRO];

const USERS = {
  anthony: {
    username: "anthony",
    displayName: "Anthony",
    badgeClass: "seller-anthony"
  },
  julien: {
    username: "julien",
    displayName: "Julien",
    badgeClass: "seller-julien"
  },
  "compte-pro": {
    username: "compte-pro",
    displayName: "Compte pro",
    badgeClass: "seller-compte-pro"
  }
};

const state = {
  products: [],
  pendingTemuImport: [],
  user: null,
  view: "home",
  selectedProductId: null,
  selectedImageIndex: 0,
  editingProductId: null,
  apiToken: "",
  search: "",
  sellerFilter: "all",
  excludeAnthony: false,
  excludeJulien: false,
  excludeComptePro: false,
  stockZeroMode: "all",
  lowOnly: false,
  sort: "updatedDesc",
  sync: {
    mode: "local",
    ready: false,
    error: "",
    apiBaseUrl: "",
    storageProvider: "github",
    migrationNoticeShown: false,
    pollTimerId: null
  }
};

const refs = {
  loginView: document.getElementById("loginView"),
  dashboardView: document.getElementById("dashboardView"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  sessionBadge: document.getElementById("sessionBadge"),
  syncBadge: document.getElementById("syncBadge"),
  manualSyncBtn: document.getElementById("manualSyncBtn"),
  exportStockBtn: document.getElementById("exportStockBtn"),
  goAddBtn: document.getElementById("goAddBtn"),
  deleteAllBtn: document.getElementById("deleteAllBtn"),
  homeView: document.getElementById("homeView"),
  addView: document.getElementById("addView"),
  detailView: document.getElementById("detailView"),
  detailBody: document.getElementById("detailBody"),
  backHomeFromAdd: document.getElementById("backHomeFromAdd"),
  logoutBtn: document.getElementById("logoutBtn"),
  addProductForm: document.getElementById("addProductForm"),
  temuImportFile: document.getElementById("temuImportFile"),
  importReviewPanel: document.getElementById("importReviewPanel"),
  importReviewSummary: document.getElementById("importReviewSummary"),
  importReviewList: document.getElementById("importReviewList"),
  importReviewEmpty: document.getElementById("importReviewEmpty"),
  clearImportReviewBtn: document.getElementById("clearImportReviewBtn"),
  confirmImportReviewBtn: document.getElementById("confirmImportReviewBtn"),
  searchInput: document.getElementById("searchInput"),
  sellerFilter: document.getElementById("sellerFilter"),
  excludeAnthony: document.getElementById("excludeAnthony"),
  excludeJulien: document.getElementById("excludeJulien"),
  excludeComptePro: document.getElementById("excludeComptePro"),
  stockZeroFilter: document.getElementById("stockZeroFilter"),
  lowOnly: document.getElementById("lowOnly"),
  sortSelect: document.getElementById("sortSelect"),
  productsBody: document.getElementById("productsBody"),
  emptyState: document.getElementById("emptyState"),
  statusMessage: document.getElementById("statusMessage"),
  statProducts: document.getElementById("statProducts"),
  statAvailable: document.getElementById("statAvailable"),
  statLow: document.getElementById("statLow"),
  statListed: document.getElementById("statListed"),
  statStockValue: document.getElementById("statStockValue")
};

void init();

async function init() {
  bindEvents();
  restoreSession();
  state.products = loadProductsFromCache();
  render();
  await setupSync();
}

function bindEvents() {
  refs.loginForm.addEventListener("submit", handleLogin);
  refs.logoutBtn.addEventListener("click", handleLogout);
  refs.goAddBtn.addEventListener("click", () => {
    showView("add");
  });
  refs.backHomeFromAdd.addEventListener("click", () => {
    if (state.pendingTemuImport.length > 0) {
      showStatus("Valide ou annule l'import Temu avant de revenir au stock.", "error");
      return;
    }
    showView("home");
  });
  refs.manualSyncBtn.addEventListener("click", () => {
    void manualSyncProducts();
  });
  refs.exportStockBtn.addEventListener("click", exportStockJson);
  refs.deleteAllBtn.addEventListener("click", () => {
    void deleteAllProducts();
  });
  refs.addProductForm.addEventListener("submit", handleAddProduct);
  refs.temuImportFile.addEventListener("change", (event) => {
    void handleTemuImport(event);
  });
  refs.importReviewList.addEventListener("input", handleImportReviewInput);
  refs.importReviewList.addEventListener("change", (event) => {
    void handleImportReviewChange(event);
  });
  refs.importReviewList.addEventListener("click", handleImportReviewClick);
  refs.clearImportReviewBtn.addEventListener("click", clearPendingTemuImport);
  refs.confirmImportReviewBtn.addEventListener("click", () => {
    void confirmPendingTemuImport();
  });

  refs.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderTable();
  });

  refs.sellerFilter.addEventListener("change", (event) => {
    state.sellerFilter = event.target.value;
    renderTable();
  });

  refs.excludeAnthony.addEventListener("change", (event) => {
    state.excludeAnthony = event.target.checked;
    renderTable();
  });

  refs.excludeJulien.addEventListener("change", (event) => {
    state.excludeJulien = event.target.checked;
    renderTable();
  });

  refs.excludeComptePro.addEventListener("change", (event) => {
    state.excludeComptePro = event.target.checked;
    renderTable();
  });

  refs.stockZeroFilter.addEventListener("change", (event) => {
    state.stockZeroMode = event.target.value;
    renderTable();
  });

  refs.lowOnly.addEventListener("change", (event) => {
    state.lowOnly = event.target.checked;
    renderTable();
  });

  refs.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderTable();
  });

  refs.productsBody.addEventListener("click", (event) => {
    void handleTableClick(event);
  });

  refs.detailBody.addEventListener("submit", (event) => {
    void handleDetailSubmit(event);
  });

  refs.detailBody.addEventListener("click", (event) => {
    void handleDetailClick(event);
  });
}

function restoreSession() {
  const saved = localStorage.getItem(STORAGE_SESSION_KEY);
  if (!saved) {
    return;
  }

  const username = normalizeUsername(saved);
  if (USERS[username]) {
    state.user = USERS[username];
    state.apiToken = localStorage.getItem(STORAGE_API_TOKEN_KEY) || "";
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") || "").trim();

  const user = USERS[username];

  if (!user) {
    refs.loginError.textContent = "Utilisateur inconnu (utilise anthony, julien ou compte pro).";
    refs.loginError.classList.remove("hidden");
    return;
  }

  if (isApiSyncEnabled()) {
    try {
      const token = await apiLogin(username, password);
      state.user = user;
      state.apiToken = token;
      localStorage.setItem(STORAGE_SESSION_KEY, user.username);
      localStorage.setItem(STORAGE_API_TOKEN_KEY, token);
      refs.loginError.classList.add("hidden");
      refs.loginForm.reset();
      await setupSync();
      render();
      return;
    } catch (error) {
      refs.loginError.textContent = error.message || "Connexion API impossible.";
      refs.loginError.classList.remove("hidden");
      return;
    }
  }

  if (!window.APP_CONFIG || !window.APP_CONFIG.users) {
    refs.loginError.textContent = "Config absente: verifie le fichier config.js.";
    refs.loginError.classList.remove("hidden");
    return;
  }

  const expectedHash = getPasswordHashForUser(username);

  if (!expectedHash) {
    refs.loginError.textContent = `Hash manquant pour ${username}: complete config.js puis redeploie.`;
    refs.loginError.classList.remove("hidden");
    return;
  }

  if (!isValidSha256Hex(expectedHash)) {
    refs.loginError.textContent = "Configuration mot de passe invalide.";
    refs.loginError.classList.remove("hidden");
    return;
  }

  let submittedHash = "";
  try {
    submittedHash = await sha256Hex(password);
  } catch {
    refs.loginError.textContent = "Impossible de verifier le mot de passe sur ce navigateur.";
    refs.loginError.classList.remove("hidden");
    return;
  }

  if (submittedHash !== expectedHash) {
    refs.loginError.textContent = "Identifiants invalides.";
    refs.loginError.classList.remove("hidden");
    return;
  }

  state.user = user;
  localStorage.setItem(STORAGE_SESSION_KEY, user.username);
  refs.loginError.classList.add("hidden");
  refs.loginForm.reset();
  render();
}

function handleLogout() {
  state.user = null;
  state.apiToken = "";
  state.pendingTemuImport = [];
  localStorage.removeItem(STORAGE_SESSION_KEY);
  localStorage.removeItem(STORAGE_API_TOKEN_KEY);
  stopApiPolling();
  render();
}

function showView(view, productId = null) {
  state.view = view;
  state.selectedProductId = productId;
  state.selectedImageIndex = 0;
  state.editingProductId = null;
  render();
}

async function handleAddProduct(event) {
  event.preventDefault();

  if (!state.user) {
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);

  const name = String(formData.get("name") || "").trim();
  const totalStock = Math.max(0, Number(formData.get("totalStock") || 0));
  const listedQuantity = Math.max(0, Number(formData.get("listedQuantity") || 0));
  const listedBy = normalizeListedByValue(formData.getAll("listedBy"));
  const lowThreshold = Math.max(0, Number(formData.get("lowThreshold") || DEFAULT_LOW_THRESHOLD));
  const purchasePriceInput = String(formData.get("purchasePrice") || "").trim();
  const purchasePrice = purchasePriceInput ? parseMoneyValue(purchasePriceInput) : null;
  const articleLink = String(formData.get("articleLink") || "").trim();
  let images = [];

  try {
    images = await collectImagesFromForm(formData, "imageUrls", "imageFiles");
  } catch {
    return;
  }

  if (!name) {
    showStatus("Le nom du produit est obligatoire.", "error");
    return;
  }

  if (listedQuantity > totalStock) {
    showStatus("La quantite en vente ne peut pas depasser le stock total.", "error");
    return;
  }

  if (listedQuantity > 0 && !listedBy) {
    showStatus("Choisis au moins une personne pour un article en vente.", "error");
    return;
  }

  if (articleLink && !isValidHttpUrl(articleLink)) {
    showStatus("Le lien article doit commencer par http:// ou https://.", "error");
    return;
  }

  if (purchasePriceInput && purchasePrice === null) {
    showStatus("Le prix d'achat Temu doit etre un nombre valide.", "error");
    return;
  }

  const now = new Date().toISOString();

  const product = {
    id: makeId(),
    name,
    totalStock,
    listedQuantity,
    listedBy: listedQuantity > 0 ? listedBy : "",
    lowThreshold,
    purchasePrice,
    articleLink,
    photo: images[0] || "",
    images,
    saleHistory: [],
    createdBy: state.user.username,
    createdAt: now,
    updatedAt: now
  };

  state.products.unshift(product);
  persistProductsCache();
  await syncUpsertProduct(product);

  form.reset();
  form.elements.totalStock.value = "0";
  form.elements.listedQuantity.value = "0";
  form.elements.lowThreshold.value = String(DEFAULT_LOW_THRESHOLD);
  showStatus("Produit ajoute.", "info");
  showView("home");
}

async function handleTemuImport(event) {
  const file = event.target.files && event.target.files[0];

  if (!file) {
    return;
  }

  if (!state.user) {
    showStatus("Connecte-toi avant d'importer un fichier Temu.", "error");
    event.target.value = "";
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    const items = normalizeTemuImportPayload(payload);

    if (items.length === 0) {
      showStatus("Fichier Temu invalide: aucun article exploitable.", "error");
      return;
    }

    state.pendingTemuImport = items.map(createPendingTemuImportItem);
    showView("add");
    showStatus(`${state.pendingTemuImport.length} article(s) Temu a valider avant ajout au stock.`, "info");
  } catch (error) {
    showStatus(error && error.message ? error.message : "Impossible de lire le fichier Temu.", "error");
  } finally {
    event.target.value = "";
  }
}

function createPendingTemuImportItem(item) {
  return {
    ...item,
    draftId: makeId(),
    quantity: Math.max(1, Number(item.quantity || 1)),
    title: item.title || "Article Temu",
    imageUrl: item.imageUrl || "",
    productUrl: item.productUrl || "",
    orderPageUrl: item.orderPageUrl || "",
    variant: item.variant || "",
    color: item.color || "",
    purchasePrice: item.purchasePrice,
    lowThreshold: DEFAULT_LOW_THRESHOLD,
    listedQuantity: 0,
    listedBy: ""
  };
}

function handleImportReviewInput(event) {
  const field = event.target.dataset.field;
  if (!field) {
    return;
  }

  const card = event.target.closest("[data-draft-id]");
  const draft = card ? findPendingTemuImportItem(card.dataset.draftId) : null;
  if (!draft) {
    return;
  }

  const value = event.target.value;

  if (field === "quantity") {
    draft.quantity = Math.max(1, Number(value || 1));
    updateImportReviewSummary();
    return;
  }

  if (field === "purchasePrice") {
    draft.purchasePrice = value.trim() ? parseMoneyValue(value) : null;
    return;
  }

  if (field === "color") {
    updateDraftColor(draft, value.trim());
    return;
  }

  if (field === "orderPageUrl") {
    draft.productUrl = "";
    draft.orderPageUrl = value.trim();
    return;
  }

  if (field === "imageUrl") {
    draft.imageUrl = value.trim();
    if (isValidPhotoValue(draft.imageUrl)) {
      updateImportReviewImagePreview(card, draft);
    }
    return;
  }

  if (Object.prototype.hasOwnProperty.call(draft, field)) {
    draft[field] = value.trim();
  }
}

async function handleImportReviewChange(event) {
  if (event.target.dataset.field !== "imageFile") {
    return;
  }

  const card = event.target.closest("[data-draft-id]");
  const draft = card ? findPendingTemuImportItem(card.dataset.draftId) : null;
  const file = event.target.files && event.target.files[0];

  if (!draft || !(file instanceof File) || file.size <= 0) {
    return;
  }

  try {
    draft.imageUrl = await fileToDataUrl(file);
    const imageInput = card.querySelector("[data-field='imageUrl']");
    if (imageInput) {
      imageInput.value = draft.imageUrl;
    }
    updateImportReviewImagePreview(card, draft);
    showStatus("Image mise a jour dans la validation.", "info");
  } catch {
    showStatus("Impossible de lire cette image.", "error");
  } finally {
    event.target.value = "";
  }
}

function updateImportReviewImagePreview(card, draft) {
  const media = card.querySelector(".import-review-media");
  if (!media) {
    return;
  }

  media.innerHTML = draft.imageUrl
    ? `<img src="${escapeHtml(draft.imageUrl)}" alt="Image ${escapeHtml(draft.title)}">`
    : '<div class="no-photo large">Pas image</div>';
}

function handleImportReviewClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || button.dataset.action !== "removeImportDraft") {
    return;
  }

  const card = button.closest("[data-draft-id]");
  const draftId = card ? card.dataset.draftId : "";
  state.pendingTemuImport = state.pendingTemuImport.filter((item) => item.draftId !== draftId);
  renderImportReview();
}

function findPendingTemuImportItem(draftId) {
  return state.pendingTemuImport.find((item) => item.draftId === draftId) || null;
}

function updateDraftColor(draft, color) {
  draft.color = color;

  if (!draft.variant) {
    draft.variant = color;
    return;
  }

  const parts = draft.variant.split("/");
  parts[0] = color || parts[0] || "";
  draft.variant = parts.map((part) => part.trim()).filter(Boolean).join(" / ");
}

function updateImportReviewSummary() {
  const totalQuantity = state.pendingTemuImport.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
  const existingCount = state.pendingTemuImport.filter((item) => Boolean(findExistingTemuProduct(item))).length;
  refs.importReviewSummary.textContent = state.pendingTemuImport.length > 0
    ? `${state.pendingTemuImport.length} article(s), ${totalQuantity} piece(s) a verifier. ${existingCount} deja present(s) seront fusionne(s).`
    : "0 article en attente.";
}

function clearPendingTemuImport() {
  if (state.pendingTemuImport.length === 0) {
    return;
  }

  state.pendingTemuImport = [];
  renderImportReview();
  showStatus("Import Temu annule. Aucun article ajoute au stock.", "info");
}

async function confirmPendingTemuImport() {
  if (state.pendingTemuImport.length === 0) {
    showStatus("Aucun article Temu a valider.", "error");
    return;
  }

  const items = [];

  for (const draft of state.pendingTemuImport) {
    const item = buildTemuItemFromDraft(draft);
    if (!item) {
      return;
    }
    items.push(item);
  }

  stopApiPolling();
  const result = importTemuItems(items);
  state.pendingTemuImport = [];
  persistProductsCache();
  let syncError = "";
  try {
    await syncProductsSnapshot();
  } catch (error) {
    syncError = error && error.message ? error.message : "Import ajoute en local, mais sync API echouee.";
  }

  showView("home");
  showStatus(
    syncError || `Import Temu valide: ${result.added} ajoute(s), ${result.updated} mis a jour.`,
    syncError ? "error" : "info"
  );
}

function buildTemuItemFromDraft(draft) {
  const title = String(draft.title || "").trim();
  const quantity = Math.max(1, Number(draft.quantity || 1));
  const purchasePrice = draft.purchasePrice === null || draft.purchasePrice === undefined || draft.purchasePrice === ""
    ? null
    : parseMoneyValue(draft.purchasePrice);
  const imageUrl = String(draft.imageUrl || "").trim();
  const orderPageUrl = String(draft.orderPageUrl || draft.productUrl || "").trim();

  if (!title) {
    showStatus("Chaque article importe doit avoir un nom.", "error");
    return null;
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    showStatus(`Quantite invalide pour ${title}.`, "error");
    return null;
  }

  if (draft.purchasePrice !== null && draft.purchasePrice !== undefined && String(draft.purchasePrice).trim() && purchasePrice === null) {
    showStatus(`Prix d'achat invalide pour ${title}.`, "error");
    return null;
  }

  if (imageUrl && !isValidPhotoValue(imageUrl)) {
    showStatus(`Image invalide pour ${title}.`, "error");
    return null;
  }

  if (orderPageUrl && !isValidHttpUrl(orderPageUrl)) {
    showStatus(`Lien Order Temu invalide pour ${title}.`, "error");
    return null;
  }

  return {
    ...draft,
    title,
    quantity: Math.floor(quantity),
    purchasePrice,
    productUrl: isTemuProductUrl(orderPageUrl) ? orderPageUrl : "",
    orderPageUrl,
    imageUrl,
    variant: normalizeTemuVariant(draft.variant || draft.color || ""),
    color: normalizeTemuColor(draft.color || draft.variant || ""),
    currency: draft.currency || "EUR"
  };
}

function importTemuItems(items) {
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;

  for (const item of items) {
    const existingProduct = findExistingTemuProduct(item);

    if (existingProduct) {
      existingProduct.totalStock = item.stockExport
        ? item.quantity
        : Math.max(0, Number(existingProduct.totalStock || 0)) + item.quantity;
      existingProduct.purchasePrice = item.purchasePrice !== null ? item.purchasePrice : existingProduct.purchasePrice;
      existingProduct.articleLink = item.productUrl || item.orderPageUrl || existingProduct.articleLink;
      existingProduct.images = mergeProductImages(existingProduct, item.images.length > 0 ? item.images : []);
      existingProduct.photo = existingProduct.images[0] || "";
      existingProduct.listedQuantity = item.listedQuantity !== null
        ? Math.min(item.listedQuantity, existingProduct.totalStock)
        : existingProduct.listedQuantity;
      existingProduct.listedBy = item.listedBy || existingProduct.listedBy;
      existingProduct.lowThreshold = item.lowThreshold !== null ? item.lowThreshold : existingProduct.lowThreshold;
      existingProduct.saleHistory = item.saleHistory.length > 0 ? item.saleHistory : existingProduct.saleHistory;
      existingProduct.temu = buildTemuMeta(existingProduct.temu, item, now);
      existingProduct.updatedAt = item.updatedAt || now;
      updated += 1;
      continue;
    }

    const images = item.images.length > 0 ? item.images : (item.imageUrl ? [item.imageUrl] : []);
    const product = {
      id: item.stockProductId || makeId(),
      name: item.title || "Article Temu",
      totalStock: item.quantity,
      listedQuantity: Math.min(item.listedQuantity || 0, item.quantity),
      listedBy: item.listedBy || "",
      lowThreshold: item.lowThreshold !== null ? item.lowThreshold : DEFAULT_LOW_THRESHOLD,
      purchasePrice: item.purchasePrice,
      articleLink: item.productUrl || item.orderPageUrl || "",
      photo: images[0] || "",
      images,
      saleHistory: item.saleHistory,
      temu: buildTemuMeta({}, item, now),
      createdBy: state.user.username,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now
    };

    state.products.unshift(product);
    added += 1;
  }

  return { added, updated };
}

function normalizeTemuImportPayload(payload) {
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(payload && payload.items)
      ? payload.items
      : [];
  const isStockExport = Boolean(payload && payload.source === "vinted-stocks-export");

  return rawItems
    .map((rawItem) => normalizeTemuImportItem(rawItem, { isStockExport }))
    .filter(Boolean);
}

function normalizeTemuImportItem(rawItem, options = {}) {
  if (!rawItem || typeof rawItem !== "object") {
    return null;
  }

  const title = String(
    rawItem.title
      || rawItem.name
      || rawItem.productTitle
      || rawItem.itemTitle
      || ""
  ).trim();
  const isStockExport = Boolean(options.isStockExport || rawItem.stockExport);
  const quantity = isStockExport
    ? (parseOptionalStockInteger(rawItem.quantity ?? rawItem.qty ?? rawItem.count ?? null) ?? 0)
    : parsePositiveInteger(
      rawItem.quantity
        || rawItem.qty
        || rawItem.count
        || 1
    );
  const purchasePrice = parseMoneyValue(
    rawItem.purchasePrice
      ?? rawItem.unitPurchasePrice
      ?? rawItem.price
      ?? rawItem.unitPrice
      ?? null
  );
  const productUrl = normalizeOptionalHttpUrl(
    rawItem.productUrl
      || rawItem.articleLink
      || rawItem.link
      || rawItem.url
      || ""
  );
  const orderPageUrl = normalizeOptionalHttpUrl(rawItem.orderPageUrl || rawItem.pageUrl || "");
  const images = normalizeImportImages(rawItem);
  const imageUrl = images[0] || normalizeOptionalImageUrl(
    rawItem.imageUrl
      || rawItem.image
      || rawItem.photo
      || rawItem.thumbnail
      || ""
  );
  const variant = normalizeTemuVariant(rawItem.variant || rawItem.option || rawItem.options || "");
  const color = normalizeTemuColor(rawItem.color || rawItem.colour || variant);

  if (title && isInvalidTemuImportTitle(title)) {
    return null;
  }

  if (!title && !productUrl) {
    return null;
  }

  return {
    title: title || "Article Temu",
    quantity,
    purchasePrice,
    productUrl,
    orderPageUrl,
    imageUrl,
    images: [...new Set([imageUrl, ...images].filter(Boolean))],
    orderId: String(rawItem.orderId || rawItem.orderNumber || "").trim(),
    orderDate: String(rawItem.orderDate || rawItem.date || "").trim(),
    variant,
    color,
    importKey: String(rawItem.importKey || "").trim(),
    currency: String(rawItem.currency || "EUR").trim() || "EUR",
    stockExport: isStockExport,
    stockProductId: String(rawItem.stockProductId || rawItem.productId || rawItem.id || "").trim(),
    listedQuantity: parseOptionalStockInteger(rawItem.listedQuantity ?? rawItem.stockListed ?? null),
    listedBy: normalizeListedByValue(rawItem.listedBy || rawItem.listedBySellers || ""),
    lowThreshold: parseOptionalStockInteger(rawItem.lowThreshold ?? rawItem.stockLowThreshold ?? null),
    saleHistory: normalizeSaleHistory(rawItem.saleHistory),
    createdAt: String(rawItem.createdAt || "").trim(),
    updatedAt: String(rawItem.updatedAt || "").trim()
  };
}

function normalizeImportImages(rawItem) {
  const rawImages = Array.isArray(rawItem.images) ? rawItem.images : [];
  return rawImages
    .map(normalizeOptionalImageUrl)
    .filter(Boolean);
}

function isInvalidTemuImportTitle(title) {
  const text = normalizeTextForCompare(title);

  return !text
    || text === "apercu"
    || text === "ouvrir dans un nouvel onglet"
    || text.startsWith("la taille ")
    || text.includes(" tour de buste")
    || text.includes(" tour de taille")
    || text.includes(" tour de hanches")
    || text.includes(" hauteur: ")
    || text.includes(" identique a fr");
}

function findExistingTemuProduct(item) {
  if (item.stockExport && item.stockProductId) {
    const byStockProductId = state.products.find((product) => product.id === item.stockProductId);

    if (byStockProductId) {
      return byStockProductId;
    }
  }

  if (item.importKey) {
    const byImportKey = state.products.find((product) => {
      return product.temu && product.temu.importKey === item.importKey;
    });

    if (byImportKey) {
      return byImportKey;
    }
  }

  const productUrlKey = normalizeUrlForCompare(item.productUrl);

  if (productUrlKey && isTemuProductUrl(item.productUrl)) {
    const byUrl = state.products.find((product) => {
      return normalizeUrlForCompare(product.articleLink) === productUrlKey
        || normalizeUrlForCompare(product.temu && product.temu.productUrl) === productUrlKey;
    });

    if (byUrl) {
      return byUrl;
    }
  }

  if (!item.orderId || !item.title || (!item.variant && !item.color)) {
    return null;
  }

  const titleKey = normalizeTextForCompare(item.title);
  const variantKey = normalizeTextForCompare(item.variant || item.color);
  return state.products.find((product) => {
    return product.temu
      && product.temu.orderId === item.orderId
      && normalizeTextForCompare(product.name) === titleKey
      && normalizeTextForCompare(product.temu.variant || product.temu.color) === variantKey;
  }) || null;
}

function buildTemuMeta(currentMeta, item, importedAt) {
  const previous = currentMeta && typeof currentMeta === "object" ? currentMeta : {};

  return {
    ...previous,
    productUrl: item.productUrl || previous.productUrl || "",
    orderPageUrl: item.orderPageUrl || previous.orderPageUrl || "",
    imageUrl: item.imageUrl || previous.imageUrl || "",
    purchasePrice: item.purchasePrice !== null ? item.purchasePrice : (previous.purchasePrice ?? null),
    currency: item.currency || previous.currency || "EUR",
    orderId: item.orderId || previous.orderId || "",
    orderDate: item.orderDate || previous.orderDate || "",
    variant: item.variant || previous.variant || "",
    color: item.color || previous.color || "",
    importKey: item.importKey || previous.importKey || "",
    importedAt
  };
}

function updateTemuMetaFromProduct(currentMeta, purchasePrice, productUrl) {
  if (!currentMeta || typeof currentMeta !== "object") {
    return undefined;
  }

  return {
    ...currentMeta,
    purchasePrice,
    productUrl: productUrl || currentMeta.productUrl || ""
  };
}

function mergeProductImages(product, imagesToAdd) {
  return [...new Set([...getProductImages(product), ...imagesToAdd].filter(Boolean))];
}

async function handleTableClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const productId = button.dataset.id;

  if (action === "copyLink") {
    await copyTextToClipboard(button.dataset.link || "");
    return;
  }

  if (action === "adjustStock") {
    const delta = Number(button.dataset.delta || 0);
    await adjustProductStock(productId, delta);
    return;
  }

  if (action === "soldItem") {
    await markProductSold(productId);
    return;
  }

  if (action === "edit") {
    showView("detail", productId);
    return;
  }

  if (action === "cancelEdit") {
    state.editingProductId = null;
    renderTable();
    return;
  }

  if (action !== "delete") {
    return;
  }

  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  await deleteProduct(productId);
}

async function deleteProduct(productId) {
  const productIndex = state.products.findIndex((item) => item.id === productId);
  if (productIndex === -1) {
    return;
  }

  const [deletedProduct] = state.products.splice(productIndex, 1);
  persistProductsCache();
  render();

  await syncDeleteProduct(productId);

  showUndoStatus(`Produit supprime: ${deletedProduct.name}.`, "Annuler", async () => {
    state.products.splice(Math.min(productIndex, state.products.length), 0, deletedProduct);
    deletedProduct.updatedAt = new Date().toISOString();
    persistProductsCache();
    await syncUpsertProduct(deletedProduct);
    render();
    showStatus(`Suppression annulee: ${deletedProduct.name}.`, "info");
  });
}

async function deleteAllProducts() {
  if (state.products.length === 0) {
    showStatus("Aucun article a supprimer.", "info");
    return;
  }

  const deletedProducts = [...state.products];
  state.products = [];
  persistProductsCache();
  render();

  try {
    await syncProductsSnapshot();
  } catch (error) {
    showStatus(error && error.message ? error.message : "Suppression globale non synchronisee.", "error");
  }

  showUndoStatus(`${deletedProducts.length} article(s) supprime(s).`, "Annuler", async () => {
    state.products = deletedProducts;
    persistProductsCache();
    try {
      await syncProductsSnapshot();
      showStatus("Suppression globale annulee.", "info");
    } catch (error) {
      showStatus(error && error.message ? error.message : "Annulation non synchronisee.", "error");
    }
    render();
  });
}

async function handleDetailSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const productId = form.dataset.id;
  const action = form.dataset.action;
  const product = state.products.find((item) => item.id === productId);

  if (!product) {
    showStatus("Produit introuvable.", "error");
    return;
  }

  if (action === "saveDetailProduct") {
    const updatedProduct = await buildDetailProductUpdate(product, form);
    if (!updatedProduct) {
      return;
    }

    Object.assign(product, updatedProduct, {
      id: product.id,
      createdBy: product.createdBy,
      createdAt: product.createdAt,
      updatedAt: new Date().toISOString()
    });

    persistProductsCache();
    await syncUpsertProduct(product);
    showStatus(`Article modifie: ${product.name}.`, "info");
    render();
    return;
  }

  if (action === "recordSale") {
    const salePriceInput = form.querySelector("input[name='salePrice']")?.value || "";
    const soldBy = normalizeSoldByValue(form.querySelector("select[name='soldBy']")?.value || "");
    const salePrice = salePriceInput.trim() ? parseSalePrice(salePriceInput) : null;

    if (!soldBy) {
      showStatus("Choisis qui a vendu l'article.", "error");
      return;
    }

    if (salePriceInput.trim() && salePrice === null) {
      showStatus("Indique un prix de vente valide.", "error");
      return;
    }

    await markProductSold(product.id, salePrice, soldBy);
  }
}

async function handleDetailClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;

  if (action === "backHome") {
    showView("home");
    return;
  }

  if (action === "selectImage") {
    state.selectedImageIndex = Number(button.dataset.index || 0);
    renderDetailView();
    return;
  }

  if (action === "adjustStock") {
    await adjustProductStock(button.dataset.id, Number(button.dataset.delta || 0));
  }
}

async function buildDetailProductUpdate(product, form) {
  const formData = new FormData(form);
  const name = String(formData.get("detailName") || "").trim();
  const totalStock = Math.max(0, Number(formData.get("detailTotalStock") || 0));
  const listedQuantity = Math.max(0, Number(formData.get("detailListedQuantity") || 0));
  const listedBy = normalizeListedByValue(formData.getAll("detailListedBy"));
  const lowThreshold = Math.max(0, Number(formData.get("detailLowThreshold") || DEFAULT_LOW_THRESHOLD));
  const purchasePriceInput = String(formData.get("detailPurchasePrice") || "").trim();
  const purchasePrice = purchasePriceInput ? parseMoneyValue(purchasePriceInput) : null;
  const articleLink = String(formData.get("detailArticleLink") || "").trim();
  let newImages = [];

  try {
    newImages = await collectImagesFromForm(formData, "detailImageUrls", "detailImageFiles");
  } catch {
    return null;
  }

  const images = newImages.length > 0
    ? [...new Set([...getProductImages(product), ...newImages])]
    : getProductImages(product);

  if (!name) {
    showStatus("Le nom du produit est obligatoire.", "error");
    return null;
  }

  if (listedQuantity > totalStock) {
    showStatus("La quantite en vente ne peut pas depasser le stock total.", "error");
    return null;
  }

  if (listedQuantity > 0 && !listedBy) {
    showStatus("Choisis au moins une personne pour la mise en vente.", "error");
    return null;
  }

  if (articleLink && !isValidHttpUrl(articleLink)) {
    showStatus("Le lien article doit commencer par http:// ou https://.", "error");
    return null;
  }

  if (purchasePriceInput && purchasePrice === null) {
    showStatus("Le prix d'achat Temu doit etre un nombre valide.", "error");
    return null;
  }

  return {
    name,
    totalStock,
    listedQuantity,
    listedBy: listedQuantity > 0 ? listedBy : "",
    lowThreshold,
    purchasePrice,
    articleLink,
    temu: updateTemuMetaFromProduct(product.temu, purchasePrice, articleLink),
    images,
    photo: images[0] || ""
  };
}

async function adjustProductStock(productId, delta) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    showStatus("Produit introuvable.", "error");
    return;
  }

  if (delta !== 1) {
    return;
  }

  const nextTotalStock = product.totalStock + delta;

  product.totalStock = nextTotalStock;
  product.updatedAt = new Date().toISOString();
  persistProductsCache();
  await syncUpsertProduct(product);
  showStatus(`Stock ajoute pour ${product.name}.`, "info");
  render();
}

async function markProductSold(productId, salePrice = null, soldByValue = "") {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    showStatus("Produit introuvable.", "error");
    return;
  }

  if (product.listedQuantity <= 0) {
    showStatus("Aucun article en vente a marquer comme vendu.", "error");
    return;
  }

  const soldBy = normalizeSoldByValue(soldByValue) || requestSoldBy();
  if (!soldBy) {
    return;
  }

  product.listedQuantity -= 1;
  product.listedBy = removeSellerTagAfterSale(product.listedBy, soldBy, product.listedQuantity);
  if (salePrice !== null) {
    product.saleHistory = Array.isArray(product.saleHistory) ? product.saleHistory : [];
    product.saleHistory.unshift({
      price: salePrice,
      soldBy,
      soldAt: new Date().toISOString()
    });
  }
  product.updatedAt = new Date().toISOString();
  persistProductsCache();
  await syncUpsertProduct(product);
  showStatus(`Vendu par ${getSellerDisplayName(soldBy)}: 1 retire de la quantite en vente pour ${product.name}.`, "info");
  render();
}

function requestSoldBy() {
  const availableSellers = [SELLER_ANTHONY, SELLER_JULIEN, SELLER_COMPTE_PRO];
  const defaultSeller = availableSellers[0];
  const sellerChoices = availableSellers.map(getSellerDisplayName).join(" ou ");
  const answer = window.prompt(
    `Qui l'a vendu ? Tape ${sellerChoices}.`,
    getSellerDisplayName(defaultSeller)
  );

  if (answer === null) {
    return "";
  }

  const soldBy = normalizeSoldByValue(answer);

  if (!soldBy) {
    showStatus("Choisis Anthony, Julien ou Compte pro.", "error");
    return "";
  }

  return soldBy;
}

function getDefaultSoldBy(product) {
  const listedSellers = getListedSellers(product.listedBy);
  const currentUsername = normalizeUsername(state.user && state.user.username);

  if (listedSellers.includes(currentUsername)) {
    return currentUsername;
  }

  if (listedSellers.length > 0) {
    return listedSellers[0];
  }

  if (currentUsername === SELLER_ANTHONY || currentUsername === SELLER_JULIEN || currentUsername === SELLER_COMPTE_PRO) {
    return currentUsername;
  }

  return SELLER_ANTHONY;
}

function normalizeSoldByValue(value) {
  const normalized = normalizeUsername(value);
  if (normalized === SELLER_ANTHONY || normalized === "a") {
    return SELLER_ANTHONY;
  }
  if (normalized === SELLER_JULIEN || normalized === "j") {
    return SELLER_JULIEN;
  }
  if (normalized === SELLER_COMPTE_PRO || normalized === "c" || normalized === "cp" || normalized === "pro") {
    return SELLER_COMPTE_PRO;
  }
  return "";
}

function getListedSellers(listedBy) {
  return normalizeListedSellers(listedBy);
}

function removeSellerTagAfterSale(listedBy, soldBy, remainingListedQuantity) {
  if (remainingListedQuantity <= 0) {
    return "";
  }

  const nextSellers = getListedSellers(listedBy).filter((seller) => seller !== soldBy);
  return normalizeListedByValue(nextSellers);
}

function render() {
  const isLogged = Boolean(state.user);

  refs.loginView.classList.toggle("hidden", isLogged);
  refs.dashboardView.classList.toggle("hidden", !isLogged);

  if (!isLogged) {
    return;
  }

  refs.sessionBadge.textContent = state.user.displayName;
  refs.sessionBadge.className = `seller-badge ${state.user.badgeClass}`;

  renderSyncBadge();
  renderStats();
  renderCurrentView();
}

function renderCurrentView() {
  refs.homeView.classList.toggle("hidden", state.view !== "home");
  refs.addView.classList.toggle("hidden", state.view !== "add");
  refs.detailView.classList.toggle("hidden", state.view !== "detail");

  if (state.view === "home") {
    renderTable();
  }

  if (state.view === "add") {
    renderImportReview();
  }

  if (state.view === "detail") {
    renderDetailView();
  }
}

function renderSyncBadge() {
  if (!refs.syncBadge) {
    return;
  }

  renderManualSyncButton();

  if (state.sync.error) {
    refs.syncBadge.textContent = "Sync erreur";
    refs.syncBadge.className = "sync-badge sync-error";
    return;
  }

  if (!isCloudSyncMode()) {
    refs.syncBadge.textContent = "Sync local";
    refs.syncBadge.className = "sync-badge sync-local";
    return;
  }

  if (!state.sync.ready) {
    refs.syncBadge.textContent = "Sync...";
    refs.syncBadge.className = "sync-badge sync-pending";
    return;
  }

  refs.syncBadge.textContent = state.sync.storageProvider === "github" ? "Sync GitHub" : "Sync partage";
  refs.syncBadge.className = "sync-badge sync-ok";
}

function renderManualSyncButton() {
  if (!refs.manualSyncBtn) {
    return;
  }

  if (isCloudSyncMode()) {
    refs.manualSyncBtn.textContent = state.sync.storageProvider === "github" ? "Pousser sur GitHub" : "Pousser stock";
    refs.manualSyncBtn.title = state.sync.storageProvider === "github"
      ? "Forcer l'envoi de tout le stock local vers le fichier JSON GitHub."
      : "Forcer l'envoi de tout le stock vers la base cloud.";
    return;
  }

  if (state.sync.error) {
    refs.manualSyncBtn.textContent = "Voir erreur sync";
    refs.manualSyncBtn.title = getSyncErrorMessage(state.sync.error);
    return;
  }

  refs.manualSyncBtn.textContent = "Sync non configuree";
  refs.manualSyncBtn.title = "Configure API_BASE_URL pour synchroniser le stock entre les appareils.";
}

function getSyncErrorMessage(errorCode) {
  const messages = {
    api_config_invalid: "Configuration API incomplete. Verifie API_BASE_URL.",
    api_auth_missing: "Connexion API manquante. Deconnecte-toi puis reconnecte-toi.",
    api_login_failed: "Connexion API refusee. Verifie l'utilisateur et le mot de passe.",
    api_read_failed: "Lecture GitHub impossible. Verifie les variables GitHub dans Netlify.",
    api_write_failed: "Ecriture GitHub impossible. Verifie le token GitHub dans Netlify.",
    api_delete_failed: "Suppression GitHub impossible. Verifie le token GitHub dans Netlify.",
    api_manual_push_failed: "Push GitHub impossible. Verifie le token GitHub dans Netlify."
  };

  return messages[errorCode] || "Erreur de sync cloud.";
}

function isCloudSyncMode() {
  return state.sync.mode === "api";
}

function renderStats() {
  const totalProducts = state.products.length;
  const totalAvailable = state.products.reduce((sum, product) => sum + getAvailableStock(product), 0);
  const totalLow = state.products.filter((product) => isLowStock(product)).length;
  const totalListed = state.products.reduce((sum, product) => sum + Number(product.listedQuantity || 0), 0);
  const totalStockValue = state.products.reduce((sum, product) => {
    const purchasePrice = Number(product.purchasePrice || 0);
    const totalStock = Number(product.totalStock || 0);
    return sum + (Number.isFinite(purchasePrice) ? purchasePrice : 0) * totalStock;
  }, 0);

  refs.statProducts.textContent = String(totalProducts);
  refs.statAvailable.textContent = String(totalAvailable);
  refs.statLow.textContent = String(totalLow);
  refs.statListed.textContent = String(totalListed);
  if (refs.statStockValue) refs.statStockValue.textContent = formatPrice(totalStockValue);
}

function renderTable() {
  const products = getVisibleProducts();

  refs.emptyState.classList.toggle("hidden", products.length > 0);

  refs.productsBody.innerHTML = products
    .map((product) => {
      const availableStock = getAvailableStock(product);
      const outOfStockClass = availableStock === 0 ? "out-of-stock-row" : "";
      const availableClass = isLowStock(product) ? "stock-low-value" : "";
      const sellerBadge = renderSellerBadge(product.listedBy);
      const productImages = getProductImages(product);
      const coverImage = productImages[0] || "";
      const photoCell = coverImage
        ? `<img class="product-photo" src="${escapeHtml(coverImage)}" alt="Photo ${escapeHtml(product.name)}">`
        : '<div class="no-photo">Pas photo</div>';

      const displayArticleLink = getDisplayArticleLink(product);
      const articleCell = displayArticleLink
        ? `<button class="btn btn-outline btn-small" type="button" data-action="copyLink" data-link="${escapeHtml(displayArticleLink)}">Copier</button>`
        : "-";

      return `
        <tr class="${outOfStockClass}">
          <td>${photoCell}</td>
          <td>
            <strong>${escapeHtml(product.name)}</strong><br>
            <small>Ajoute par ${escapeHtml(product.createdBy || "-")}</small>
            ${renderTemuInfoLines(product)}
          </td>
          <td>${sellerBadge}</td>
          <td>${product.totalStock}</td>
          <td>${product.listedQuantity}</td>
          <td class="${availableClass}">${availableStock}</td>
          <td>${product.lowThreshold}</td>
          <td>${articleCell}</td>
          <td>
            <div class="actions">
              <button class="btn btn-outline btn-small" type="button" data-action="edit" data-id="${product.id}">Modifier</button>
              <button class="btn btn-danger btn-small" type="button" data-action="delete" data-id="${product.id}">Supprimer</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderImportReview() {
  const drafts = state.pendingTemuImport;
  const hasDrafts = drafts.length > 0;
  const totalQuantity = drafts.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
  const existingCount = drafts.filter((item) => Boolean(findExistingTemuProduct(item))).length;
  const manualAddPanel = refs.addProductForm.closest(".panel");

  refs.importReviewPanel.classList.toggle("hidden", !hasDrafts);
  if (manualAddPanel) {
    manualAddPanel.classList.toggle("hidden", hasDrafts);
  }
  refs.importReviewEmpty.classList.toggle("hidden", hasDrafts);
  refs.confirmImportReviewBtn.disabled = !hasDrafts;
  refs.clearImportReviewBtn.disabled = !hasDrafts;
  refs.importReviewSummary.textContent = hasDrafts
    ? `${drafts.length} article(s), ${totalQuantity} piece(s) a verifier. ${existingCount} deja present(s) seront fusionne(s).`
    : "0 article en attente.";

  refs.importReviewList.innerHTML = drafts.map((item, index) => {
    const articleLink = item.productUrl || item.orderPageUrl || "";
    const existingProduct = findExistingTemuProduct(item);
    const imageCell = item.imageUrl
      ? `<img src="${escapeHtml(item.imageUrl)}" alt="Image ${escapeHtml(item.title)}">`
      : '<div class="no-photo large">Pas image</div>';

    return `
      <article class="import-review-card" data-draft-id="${escapeHtml(item.draftId)}">
        <div class="import-review-media">
          ${imageCell}
        </div>
        <div class="import-review-fields">
          <label class="wide-field">
            Produit
            <textarea data-field="title" rows="2" required>${escapeHtml(item.title)}</textarea>
          </label>
          <label>
            Quantite a ajouter
            <input data-field="quantity" type="number" min="1" value="${Math.max(1, Number(item.quantity || 1))}">
          </label>
          <label>
            Couleur
            <input data-field="color" type="text" value="${escapeHtml(item.color || "")}" placeholder="Ex: Rose">
          </label>
          <label>
            Prix achat Temu
            <input data-field="purchasePrice" type="number" min="0" step="0.01" value="${formatNumberInputValue(item.purchasePrice)}" placeholder="Optionnel">
          </label>
          <label>
            Image URL
            <input data-field="imageUrl" type="text" value="${escapeHtml(item.imageUrl || "")}" placeholder="https://... ou data:image/...">
          </label>
          <label>
            Image fichier
            <input data-field="imageFile" type="file" accept="image/*">
          </label>
          <label class="wide-field">
            Lien Order Temu
            <input data-field="orderPageUrl" type="url" value="${escapeHtml(articleLink)}" placeholder="https://www.temu.com/...">
          </label>
          <div class="import-review-meta">
            <span>#${index + 1}</span>
            ${item.variant ? `<span>${escapeHtml(item.variant)}</span>` : ""}
            ${existingProduct ? `<span class="merge-pill">Fusion: ${escapeHtml(existingProduct.name)}</span>` : '<span class="new-pill">Nouvel article</span>'}
          </div>
        </div>
        <div class="import-review-side">
          <button class="btn btn-danger btn-small" type="button" data-action="removeImportDraft">Retirer</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderDetailView() {
  const product = state.products.find((item) => item.id === state.selectedProductId);

  if (!product) {
    refs.detailBody.innerHTML = `
      <section class="panel page-heading">
        <div>
          <h3>Article introuvable</h3>
          <p class="subtitle">Il a peut-etre ete supprime.</p>
        </div>
        <button class="btn btn-outline" type="button" data-action="backHome">Retour</button>
      </section>
    `;
    return;
  }

  const images = getProductImages(product);
  const activeIndex = Math.min(state.selectedImageIndex, Math.max(images.length - 1, 0));
  const activeImage = images[activeIndex] || "";
  const listedSellers = getListedSellers(product.listedBy);
  const defaultSoldBy = getDefaultSoldBy(product);
  const displayArticleLink = getDisplayArticleLink(product);

  refs.detailBody.innerHTML = `
    <section class="panel page-heading">
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="subtitle">Gestion complete de l'article</p>
      </div>
      <button class="btn btn-outline" type="button" data-action="backHome">Retour</button>
    </section>

    <section class="product-detail-shell">
      <div class="detail-gallery panel">
        <div class="detail-thumbs">
          ${images.length > 0 ? images.map((image, index) => `
            <button class="detail-thumb ${index === activeIndex ? "active" : ""}" type="button" data-action="selectImage" data-index="${index}">
              <img src="${escapeHtml(image)}" alt="Image ${index + 1} ${escapeHtml(product.name)}">
            </button>
          `).join("") : '<div class="no-photo large">Pas image</div>'}
        </div>
        <div class="detail-main-image">
          ${activeImage ? `<img src="${escapeHtml(activeImage)}" alt="Image principale ${escapeHtml(product.name)}">` : '<div class="no-photo large">Pas image</div>'}
        </div>
      </div>

      <aside class="detail-side panel">
        <form class="detail-product-form" data-action="saveDetailProduct" data-id="${product.id}">
          <label>
            Produit
            <input name="detailName" type="text" value="${escapeHtml(product.name)}" required>
          </label>
          <div class="detail-number-grid">
            <label>
              Stock total
              <input name="detailTotalStock" type="number" min="0" value="${product.totalStock}" required>
            </label>
            <label>
              En vente
              <input name="detailListedQuantity" type="number" min="0" value="${product.listedQuantity}" required>
            </label>
          </div>
          <fieldset class="seller-picker">
            <legend>Mis en vente par</legend>
            <div class="seller-checkboxes">
              ${renderSellerCheckbox("detailListedBy", SELLER_ANTHONY, listedSellers)}
              ${renderSellerCheckbox("detailListedBy", SELLER_JULIEN, listedSellers)}
              ${renderSellerCheckbox("detailListedBy", SELLER_COMPTE_PRO, listedSellers)}
            </div>
          </fieldset>
          <label>
            Seuil stock bas
            <input name="detailLowThreshold" type="number" min="0" value="${product.lowThreshold}" required>
          </label>
          <label>
            Prix d'achat Temu
            <input name="detailPurchasePrice" type="number" min="0" step="0.01" value="${formatNumberInputValue(product.purchasePrice)}" placeholder="Optionnel">
          </label>
          <label>
            Lien Order Temu
            <input name="detailArticleLink" type="url" value="${escapeHtml(displayArticleLink)}" placeholder="https://www.temu.com/...">
          </label>
          <label>
            Ajouter images URL
            <textarea name="detailImageUrls" rows="3" placeholder="https://image-1...&#10;https://image-2..."></textarea>
          </label>
          <label>
            Ajouter images fichier
            <input name="detailImageFiles" type="file" accept="image/*" multiple>
          </label>
          <button class="btn btn-main" type="submit">Enregistrer les modifications</button>
        </form>

        <div class="stock-manager">
          <div class="stock-manager-grid">
            <article>
              <span>Dispo</span>
              <strong class="${isLowStock(product) ? "stock-low-value" : ""}">${getAvailableStock(product)}</strong>
            </article>
            <article>
              <span>En vente</span>
              <strong>${product.listedQuantity}</strong>
            </article>
          </div>
          <button class="btn btn-main" type="button" data-action="adjustStock" data-delta="1" data-id="${product.id}">+ Stock</button>
        </div>

        <form class="sale-form" data-action="recordSale" data-id="${product.id}">
          <label>
            Vendu par
            <select name="soldBy" required>
              <option value="anthony" ${defaultSoldBy === SELLER_ANTHONY ? "selected" : ""}>Anthony</option>
              <option value="julien" ${defaultSoldBy === SELLER_JULIEN ? "selected" : ""}>Julien</option>
              <option value="compte-pro" ${defaultSoldBy === SELLER_COMPTE_PRO ? "selected" : ""}>Compte pro</option>
            </select>
          </label>
          <label>
            Prix de vente
            <input name="salePrice" type="number" min="0" step="0.01" placeholder="Optionnel">
          </label>
          <button class="btn btn-outline" type="submit" ${product.listedQuantity <= 0 ? "disabled" : ""}>Vendu</button>
        </form>
      </aside>
    </section>

    <section class="panel price-history-panel">
      <h3>Historique des prix vendus</h3>
      ${renderSaleHistory(product)}
    </section>
  `;
}

function renderSaleHistory(product) {
  const history = Array.isArray(product.saleHistory) ? product.saleHistory : [];

  if (history.length === 0) {
    return '<p class="message">Aucune vente enregistree.</p>';
  }

  return `
    <div class="price-history-list">
      ${history.map((sale) => `
        <article class="price-history-item">
          <strong>${formatPrice(sale.price)}</strong>
          <span>${getSellerDisplayName(sale.soldBy)} - ${formatDateTime(sale.soldAt)}</span>
        </article>
      `).join("")}
    </div>
  `;
}

function getVisibleProducts() {
  const filtered = state.products.filter((product) => {
    const temuTokens = product.temu
      ? `${product.temu.orderId || ""} ${product.temu.productUrl || ""} ${product.temu.orderPageUrl || ""} ${product.temu.variant || ""} ${product.temu.color || ""}`
      : "";
    const haystack = `${product.name} ${product.articleLink} ${temuTokens} ${getSellerSearchTokens(product.listedBy)}`.toLowerCase();

    const matchesSearch = !state.search || haystack.includes(state.search);
    const matchesSeller = listedByMatchesFilter(product.listedBy, state.sellerFilter);
    const matchesExclusion = !isSellerExcluded(product.listedBy);
    const matchesStockZero = matchesStockZeroMode(product, state.stockZeroMode);
    const matchesLow = !state.lowOnly || isLowStock(product);

    return matchesSearch && matchesSeller && matchesExclusion && matchesStockZero && matchesLow;
  });

  filtered.sort((a, b) => compareProducts(a, b, state.sort));
  return filtered;
}

function compareProducts(a, b, sort) {
  if (sort === "nameAsc") {
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  }

  if (sort === "availableAsc") {
    return getAvailableStock(a) - getAvailableStock(b);
  }

  if (sort === "availableDesc") {
    return getAvailableStock(b) - getAvailableStock(a);
  }

  if (sort === "listedDesc") {
    return b.listedQuantity - a.listedQuantity;
  }

  return String(b.updatedAt).localeCompare(String(a.updatedAt));
}

function getAvailableStock(product) {
  const total = Math.max(0, Number(product.totalStock || 0));
  const listed = Math.max(0, Number(product.listedQuantity || 0));
  return Math.max(total - listed, 0);
}

function isLowStock(product) {
  return getAvailableStock(product) <= Number(product.lowThreshold || DEFAULT_LOW_THRESHOLD);
}

function renderSellerBadge(sellerKey) {
  const sellers = getListedSellers(sellerKey);

  if (sellers.length === 0) {
    return '<span class="seller-badge seller-none">Personne</span>';
  }

  return `<div class="seller-badges">${sellers.map(renderSingleSellerBadge).join("")}</div>`;
}

function renderSingleSellerBadge(sellerKey) {
  const user = USERS[sellerKey];
  if (!user) {
    return "";
  }

  return `<span class="seller-badge ${user.badgeClass}">${escapeHtml(user.displayName)}</span>`;
}

function renderTemuInfoLines(product) {
  const lines = [];
  const color = product.temu && product.temu.color ? product.temu.color : "";
  const variant = product.temu && product.temu.variant ? product.temu.variant : "";

  if (color) {
    lines.push(`Couleur: ${color}`);
  } else if (variant) {
    lines.push(`Variante: ${variant}`);
  }

  if (product.purchasePrice !== null && product.purchasePrice !== undefined) {
    lines.push(`Achat Temu: ${formatPrice(product.purchasePrice)}`);
  }

  return lines.map((line) => `<br><small>${escapeHtml(line)}</small>`).join("");
}

function renderSellerCheckbox(name, sellerKey, selectedSellers) {
  const checked = selectedSellers.includes(sellerKey) ? "checked" : "";

  return `
    <label class="seller-option">
      <input type="checkbox" name="${escapeHtml(name)}" value="${sellerKey}" ${checked}>
      ${renderSingleSellerBadge(sellerKey)}
    </label>
  `;
}

function getSellerDisplayName(sellerKey) {
  if (sellerKey === SELLER_ANTHONY) {
    return "Anthony";
  }
  if (sellerKey === SELLER_JULIEN) {
    return "Julien";
  }
  if (sellerKey === SELLER_COMPTE_PRO) {
    return "Compte pro";
  }
  if (sellerKey === SELLER_BOTH) {
    return "Nous deux";
  }
  return "Personne";
}

function normalizeProductsFromRemote(raw) {
  if (!raw) {
    return [];
  }

  const source = Array.isArray(raw) ? raw : Object.values(raw);
  return source.map(normalizeProduct).filter(Boolean);
}

function loadProductsFromCache() {
  const raw = localStorage.getItem(STORAGE_DATA_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeProduct).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeProduct(rawProduct) {
  if (!rawProduct || typeof rawProduct !== "object") {
    return null;
  }

  const totalStock = Math.max(0, Number(rawProduct.totalStock || 0));
  const listedQuantity = Math.max(0, Number(rawProduct.listedQuantity || 0));
  const images = normalizeImages(rawProduct);
  const purchasePrice = parseMoneyValue(rawProduct.purchasePrice ?? rawProduct.temu?.purchasePrice ?? null);
  const articleLink = String(
    rawProduct.articleLink
      || rawProduct.temu?.productUrl
      || rawProduct.temu?.orderPageUrl
      || ""
  ).trim();

  return {
    id: String(rawProduct.id || makeId()),
    name: String(rawProduct.name || "Produit sans nom").trim(),
    totalStock,
    listedQuantity: Math.min(listedQuantity, totalStock),
    listedBy: normalizeListedByValue(rawProduct.listedBy),
    lowThreshold: Math.max(0, Number(rawProduct.lowThreshold || DEFAULT_LOW_THRESHOLD)),
    purchasePrice,
    articleLink,
    photo: images[0] || "",
    images,
    saleHistory: normalizeSaleHistory(rawProduct.saleHistory),
    temu: normalizeTemuMeta(rawProduct.temu, { purchasePrice, articleLink }),
    createdBy: String(rawProduct.createdBy || "").trim(),
    createdAt: String(rawProduct.createdAt || new Date().toISOString()),
    updatedAt: String(rawProduct.updatedAt || rawProduct.createdAt || new Date().toISOString())
  };
}

function normalizeTemuMeta(rawMeta, fallback = {}) {
  if (!rawMeta || typeof rawMeta !== "object") {
    return undefined;
  }

  const purchasePrice = parseMoneyValue(rawMeta.purchasePrice ?? fallback.purchasePrice ?? null);
  const fallbackProductUrl = isTemuProductUrl(fallback.articleLink) ? fallback.articleLink : "";
  const productUrl = normalizeOptionalHttpUrl(rawMeta.productUrl || fallbackProductUrl);
  const orderPageUrl = normalizeOptionalHttpUrl(rawMeta.orderPageUrl || "");
  const imageUrl = normalizeOptionalImageUrl(rawMeta.imageUrl || "");

  return {
    productUrl,
    orderPageUrl,
    imageUrl,
    purchasePrice,
    currency: String(rawMeta.currency || "EUR").trim() || "EUR",
    orderId: String(rawMeta.orderId || "").trim(),
    orderDate: String(rawMeta.orderDate || "").trim(),
    variant: normalizeTemuVariant(rawMeta.variant || ""),
    color: normalizeTemuColor(rawMeta.color || ""),
    importKey: String(rawMeta.importKey || "").trim(),
    importedAt: String(rawMeta.importedAt || "").trim()
  };
}

function normalizeImages(rawProduct) {
  const images = Array.isArray(rawProduct.images) ? rawProduct.images : [];
  const legacyPhoto = String(rawProduct.photo || "").trim();
  const normalized = images
    .map((image) => String(image || "").trim())
    .filter(Boolean);

  if (legacyPhoto) {
    normalized.unshift(legacyPhoto);
  }

  return [...new Set(normalized)];
}

function normalizeSaleHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) {
    return [];
  }

  return rawHistory
    .map((sale) => ({
      price: Number(sale && sale.price ? sale.price : 0),
      soldBy: normalizeSoldByValue(sale && sale.soldBy ? sale.soldBy : ""),
      soldAt: String(sale && sale.soldAt ? sale.soldAt : "")
    }))
    .filter((sale) => sale.price > 0);
}

function getProductImages(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const normalized = images.map((image) => String(image || "").trim()).filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  return product.photo ? [product.photo] : [];
}

function normalizeListedByValue(value) {
  return normalizeListedSellers(value).join(",");
}

function normalizeListedSellers(value) {
  const sellers = [];
  const rawValues = Array.isArray(value) ? value : [value];

  for (const rawValue of rawValues) {
    collectListedSellers(rawValue, sellers);
  }

  return SELLER_KEYS.filter((sellerKey) => sellers.includes(sellerKey));
}

function collectListedSellers(value, sellers) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return;
  }

  const normalized = normalizeUsername(text);
  if (normalized === SELLER_BOTH || text === "nous deux") {
    addSellerKey(sellers, SELLER_ANTHONY);
    addSellerKey(sellers, SELLER_JULIEN);
    return;
  }

  if (SELLER_KEYS.includes(normalized)) {
    addSellerKey(sellers, normalized);
    return;
  }

  const parts = text.split(/[,\n;/|]+/).map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const partNormalized = normalizeUsername(part);

    if (partNormalized === SELLER_BOTH || part === "nous deux") {
      addSellerKey(sellers, SELLER_ANTHONY);
      addSellerKey(sellers, SELLER_JULIEN);
      continue;
    }

    if (SELLER_KEYS.includes(partNormalized)) {
      addSellerKey(sellers, partNormalized);
      continue;
    }

    if (part.includes(SELLER_ANTHONY) || part === "a") {
      addSellerKey(sellers, SELLER_ANTHONY);
    }
    if (part.includes(SELLER_JULIEN) || part === "j") {
      addSellerKey(sellers, SELLER_JULIEN);
    }
    if ((part.includes("compte") && part.includes("pro")) || partNormalized === "pro" || partNormalized === "cp") {
      addSellerKey(sellers, SELLER_COMPTE_PRO);
    }
  }
}

function addSellerKey(sellers, sellerKey) {
  if (SELLER_KEYS.includes(sellerKey) && !sellers.includes(sellerKey)) {
    sellers.push(sellerKey);
  }
}

function getSellerSearchTokens(listedBy) {
  const sellers = getListedSellers(listedBy);
  const tokens = sellers.flatMap((sellerKey) => [sellerKey, getSellerDisplayName(sellerKey).toLowerCase()]);

  if (sellers.includes(SELLER_ANTHONY) && sellers.includes(SELLER_JULIEN)) {
    tokens.push("nous deux", "both");
  }

  if (sellers.includes(SELLER_COMPTE_PRO)) {
    tokens.push("compte pro", "compte_pro", "pro");
  }

  return tokens.join(" ");
}

function listedByMatchesFilter(listedBy, filterValue) {
  if (filterValue === "all") {
    return true;
  }

  const sellers = getListedSellers(listedBy);

  if (filterValue === SELLER_BOTH) {
    return sellers.includes(SELLER_ANTHONY) && sellers.includes(SELLER_JULIEN);
  }

  if (SELLER_KEYS.includes(filterValue)) {
    return sellers.includes(filterValue);
  }

  return listedBy === filterValue;
}

function isSellerExcluded(listedBy) {
  const sellers = getListedSellers(listedBy);
  const includesAnthony = sellers.includes(SELLER_ANTHONY);
  const includesJulien = sellers.includes(SELLER_JULIEN);
  const includesComptePro = sellers.includes(SELLER_COMPTE_PRO);

  if (state.excludeAnthony && includesAnthony) {
    return true;
  }

  if (state.excludeJulien && includesJulien) {
    return true;
  }

  if (state.excludeComptePro && includesComptePro) {
    return true;
  }

  return false;
}

function matchesStockZeroMode(product, mode) {
  const isZero = getAvailableStock(product) === 0;

  if (mode === "onlyZero") {
    return isZero;
  }

  if (mode === "hideZero") {
    return !isZero;
  }

  return true;
}

function persistProductsCache() {
  localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(state.products));
}

function exportStockJson() {
  if (state.products.length === 0) {
    showStatus("Aucun article a exporter.", "error");
    return;
  }

  const exportedAt = new Date().toISOString();
  const payload = {
    source: "vinted-stocks-export",
    schemaVersion: 1,
    exportedAt,
    itemCount: state.products.length,
    items: state.products.map((product) => createStockExportItem(product))
  };

  downloadJsonFile(payload, `vinted-stock-export-${exportedAt.slice(0, 10)}.json`);
  showStatus(`${state.products.length} article(s) exporte(s) au format JSON.`, "info");
}

function createStockExportItem(product) {
  const images = getProductImages(product);
  const temu = product.temu && typeof product.temu === "object" ? product.temu : {};
  const productUrl = temu.productUrl || (isTemuProductUrl(product.articleLink) ? product.articleLink : "");
  const orderPageUrl = temu.orderPageUrl || (isTemuOrderUrl(product.articleLink) ? product.articleLink : "");
  const listedSellers = normalizeListedSellers(product.listedBy);

  return {
    stockExport: true,
    stockProductId: product.id,
    title: product.name,
    quantity: Math.max(0, Number(product.totalStock || 0)),
    listedQuantity: Math.max(0, Number(product.listedQuantity || 0)),
    listedBy: product.listedBy || "",
    listedBySellers: listedSellers,
    lowThreshold: Math.max(0, Number(product.lowThreshold || DEFAULT_LOW_THRESHOLD)),
    purchasePrice: product.purchasePrice,
    currency: temu.currency || "EUR",
    imageUrl: images[0] || temu.imageUrl || "",
    images,
    productUrl,
    articleLink: product.articleLink || productUrl || orderPageUrl || "",
    orderPageUrl,
    orderId: temu.orderId || "",
    orderDate: temu.orderDate || "",
    variant: temu.variant || "",
    color: temu.color || "",
    importKey: temu.importKey || `stock-${product.id}`,
    saleHistory: product.saleHistory || [],
    createdAt: product.createdAt || "",
    updatedAt: product.updatedAt || ""
  };
}

function downloadJsonFile(payload, filename) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getSyncConfig() {
  const sync = window.APP_CONFIG && window.APP_CONFIG.sync ? window.APP_CONFIG.sync : null;
  if (!sync || !sync.enabled) {
    return { enabled: false };
  }

  if (sync.provider === "api") {
    const baseUrl = sync.api && typeof sync.api.baseUrl === "string"
      ? normalizeApiBaseUrl(sync.api.baseUrl)
      : "";

    return {
      enabled: true,
      provider: "api",
      apiBaseUrl: baseUrl,
      storageProvider: sync.storage || "github"
    };
  }

  return { enabled: false };
}

function normalizeApiBaseUrl(value) {
  let url = String(value || "").trim();

  if (!url) {
    return "";
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  url = url.replace(/\/+$/g, "");

  if (!/\/api$/i.test(url)) {
    url = `${url}/api`;
  }

  return url;
}

function isApiSyncEnabled() {
  const syncConfig = getSyncConfig();
  return syncConfig.enabled && syncConfig.provider === "api" && Boolean(syncConfig.apiBaseUrl);
}

async function manualSyncProducts() {
  if (state.sync.error) {
    showSyncDiagnostic(getSyncErrorMessage(state.sync.error));
    return;
  }

  if (state.sync.mode === "api") {
    try {
      state.sync.ready = false;
      state.sync.error = "";
      renderSyncBadge();
      await apiRequest("/products", {
        method: "PUT",
        body: { products: state.products }
      });
      state.sync.ready = true;
      state.sync.migrationNoticeShown = false;
      renderSyncBadge();
      showStatus(state.sync.storageProvider === "github" ? "Stock pousse sur GitHub." : "Stock pousse sur la sync API.", "info");
    } catch {
      state.sync.ready = false;
      state.sync.error = "api_manual_push_failed";
      renderSyncBadge();
      showSyncDiagnostic(getSyncErrorMessage(state.sync.error));
    }
    return;
  }

  showSyncDiagnostic(getSyncNotConfiguredMessage());
}

async function syncProductsSnapshot() {
  if (state.sync.mode !== "api") {
    return;
  }

  try {
    state.sync.ready = false;
    state.sync.error = "";
    renderSyncBadge();
    await apiRequest("/products", {
      method: "PUT",
      body: { products: state.products }
    });
    state.sync.ready = true;
    state.sync.error = "";
    renderSyncBadge();
    startApiPolling();
  } catch {
    state.sync.ready = false;
    state.sync.error = "api_write_failed";
    renderSyncBadge();
    throw new Error(getSyncErrorMessage(state.sync.error));
  }
}

function showSyncDiagnostic(message) {
  showStatus(message, "error");
  window.alert(message);
}

function getSyncNotConfiguredMessage() {
  const sync = window.APP_CONFIG && window.APP_CONFIG.sync ? window.APP_CONFIG.sync : null;

  if (!sync) {
    return "Sync non configuree: APP_CONFIG.sync est absent du config.js publie.";
  }

  if (sync.provider === "api") {
    if (!sync.enabled) {
      return "Sync non configuree: APP_CONFIG.sync.enabled vaut false.";
    }

    return "Sync non configuree: APP_CONFIG.sync.api.baseUrl est manquant.";
  }

  if (sync.provider !== "api") {
    return "Sync non configuree: APP_CONFIG.sync.provider doit etre \"api\".";
  }

  return "Sync non configuree: API non initialisee.";
}

async function apiLogin(username, password) {
  const syncConfig = getSyncConfig();
  if (!syncConfig.enabled || syncConfig.provider !== "api" || !syncConfig.apiBaseUrl) {
    throw new Error("API non configuree.");
  }

  const response = await fetch(`${syncConfig.apiBaseUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    throw new Error(getSyncErrorMessage("api_login_failed"));
  }

  const data = await response.json();
  const token = data && typeof data.token === "string" ? data.token : "";

  if (!token) {
    throw new Error("Reponse API invalide: token manquant.");
  }

  return token;
}

async function setupApiSync(syncConfig) {
  state.sync.mode = "api";
  state.sync.ready = false;
  state.sync.error = "";
  state.sync.apiBaseUrl = syncConfig.apiBaseUrl;
  state.sync.storageProvider = syncConfig.storageProvider || "github";

  if (!syncConfig.apiBaseUrl) {
    state.sync.mode = "local";
    state.sync.error = "api_config_invalid";
    renderSyncBadge();
    showStatus(getSyncErrorMessage(state.sync.error), "error");
    return;
  }

  if (!state.apiToken) {
    state.sync.mode = "local";
    state.sync.error = state.user ? "api_auth_missing" : "";
    renderSyncBadge();
    return;
  }

  try {
    await refreshProductsFromApi();
    state.sync.ready = true;
    state.sync.error = "";
    renderSyncBadge();
    startApiPolling();
  } catch {
    state.sync.ready = false;
    state.sync.error = "api_read_failed";
    renderSyncBadge();
    showStatus(getSyncErrorMessage(state.sync.error), "error");
  }
}

async function refreshProductsFromApi() {
  const data = await apiRequest("/products");
  const rawProducts = Array.isArray(data) ? data : data.products;
  const remoteProducts = normalizeProductsFromRemote(rawProducts);
  const keepLocalForMigration = data
    && data.sourceMissing
    && remoteProducts.length === 0
    && state.products.length > 0;

  if (keepLocalForMigration) {
    persistProductsCache();
    if (!state.sync.migrationNoticeShown) {
      state.sync.migrationNoticeShown = true;
      showStatus("GitHub est vide: stock local conserve. Clique sur Pousser sur GitHub pour migrer.", "info");
    }
    return;
  }

  state.sync.migrationNoticeShown = false;
  state.products = remoteProducts;
  persistProductsCache();
  render();
}

function startApiPolling() {
  stopApiPolling();
  state.sync.pollTimerId = window.setInterval(() => {
    if (state.sync.mode !== "api" || !state.apiToken) {
      return;
    }

    refreshProductsFromApi().catch(() => {
      state.sync.ready = false;
      state.sync.error = "api_read_failed";
      renderSyncBadge();
    });
  }, DEFAULT_API_POLL_INTERVAL_MS);
}

function stopApiPolling() {
  if (state.sync.pollTimerId) {
    window.clearInterval(state.sync.pollTimerId);
    state.sync.pollTimerId = null;
  }
}

async function apiRequest(path, options = {}) {
  const baseUrl = state.sync.apiBaseUrl || getSyncConfig().apiBaseUrl || "";
  if (!baseUrl) {
    throw new Error("api_base_url_missing");
  }

  const headers = {
    ...(options.headers || {})
  };

  if (state.apiToken) {
    headers.Authorization = `Bearer ${state.apiToken}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 401 || response.status === 403) {
    state.apiToken = "";
    localStorage.removeItem(STORAGE_API_TOKEN_KEY);
    throw new Error("api_unauthorized");
  }

  if (!response.ok) {
    throw new Error(`api_http_${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function setupSync() {
  const syncConfig = getSyncConfig();
  stopApiPolling();

  if (!syncConfig.enabled) {
    state.sync.mode = "local";
    state.sync.ready = true;
    state.sync.error = "";
    renderSyncBadge();
    return;
  }

  if (syncConfig.provider === "api") {
    await setupApiSync(syncConfig);
    return;
  }
}

async function syncUpsertProduct(product) {
  if (state.sync.mode === "api") {
    try {
      await apiRequest(`/products/${encodeURIComponent(product.id)}`, {
        method: "PUT",
        body: product
      });
      state.sync.error = "";
      state.sync.ready = true;
      renderSyncBadge();
    } catch {
      state.sync.ready = false;
      state.sync.error = "api_write_failed";
      renderSyncBadge();
      showStatus(getSyncErrorMessage(state.sync.error), "error");
    }
    return;
  }
}

async function syncDeleteProduct(productId) {
  if (state.sync.mode === "api") {
    try {
      await apiRequest(`/products/${encodeURIComponent(productId)}`, {
        method: "DELETE"
      });
      state.sync.error = "";
      state.sync.ready = true;
      renderSyncBadge();
    } catch {
      state.sync.ready = false;
      state.sync.error = "api_delete_failed";
      renderSyncBadge();
      showStatus(getSyncErrorMessage(state.sync.error), "error");
    }
    return;
  }
}

function showStatus(message, kind) {
  refs.statusMessage.textContent = message;
  refs.statusMessage.className = `message ${kind}`;
  refs.statusMessage.classList.remove("hidden");

  window.clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = window.setTimeout(() => {
    refs.statusMessage.classList.add("hidden");
  }, 3500);
}

function showUndoStatus(message, actionLabel, onUndo) {
  refs.statusMessage.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="message-action" type="button">${escapeHtml(actionLabel)}</button>
  `;
  refs.statusMessage.className = "message info message-with-action";
  refs.statusMessage.classList.remove("hidden");

  window.clearTimeout(showStatus.timeoutId);

  const button = refs.statusMessage.querySelector(".message-action");
  button.addEventListener("click", () => {
    window.clearTimeout(showStatus.timeoutId);
    refs.statusMessage.classList.add("hidden");
    void onUndo();
  }, { once: true });

  showStatus.timeoutId = window.setTimeout(() => {
    refs.statusMessage.classList.add("hidden");
  }, 5000);
}

async function copyTextToClipboard(text) {
  const value = String(text || "").trim();
  if (!value) {
    showStatus("Aucun lien a copier.", "error");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      copyTextWithFallback(value);
    }
    showStatus("Lien Order Temu copie.", "info");
  } catch {
    try {
      copyTextWithFallback(value);
      showStatus("Lien Order Temu copie.", "info");
    } catch {
      showStatus("Impossible de copier le lien.", "error");
    }
  }
}

function copyTextWithFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function collectImagesFromForm(formData, urlsFieldName, filesFieldName) {
  const images = [];
  const imageUrls = parseImageUrls(String(formData.get(urlsFieldName) || ""));

  for (const imageUrl of imageUrls) {
    if (!isValidHttpUrl(imageUrl)) {
      showStatus("Une URL image est invalide.", "error");
      throw new Error("invalid_image_url");
    }
    images.push(imageUrl);
  }

  const imageFiles = formData
    .getAll(filesFieldName)
    .filter((file) => file instanceof File && file.size > 0);

  for (const imageFile of imageFiles) {
    try {
      images.push(await fileToDataUrl(imageFile));
    } catch {
      showStatus("Impossible de lire une image importee.", "error");
      throw new Error("file_read_error");
    }
  }

  return [...new Set(images)];
}

function parseImageUrls(value) {
  return value
    .split(/\n|,/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function parseMoneyValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const normalized = text
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const price = Number(normalized);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function parsePositiveInteger(value) {
  const match = String(value || "").match(/\d+/);
  const quantity = match ? Number(match[0]) : Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

function parseOptionalStockInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity >= 0 ? Math.floor(quantity) : null;
}

function normalizeOptionalHttpUrl(value) {
  const url = String(value || "").trim();
  return url && isValidHttpUrl(url) ? url : "";
}

function normalizeOptionalImageUrl(value) {
  const imageUrl = String(value || "").trim();
  return imageUrl && isValidPhotoValue(imageUrl) ? imageUrl : "";
}

function normalizeTemuVariant(value) {
  return String(value || "")
    .replace(/[【】]/g, "")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
}

function normalizeTemuColor(value) {
  return normalizeTemuVariant(value)
    .split("/")[0]
    .replace(/^couleur\s+/i, "")
    .replace(/^color\s+/i, "")
    .trim();
}

function normalizeUrlForCompare(value) {
  const url = String(value || "").trim();
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/+$/g, "").toLowerCase();
  } catch {
    return url.replace(/\/+$/g, "").toLowerCase();
  }
}

function normalizeTextForCompare(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function formatNumberInputValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file_read_error"));
    reader.readAsDataURL(file);
  });
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidHttpUrl(text) {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidPhotoValue(text) {
  const value = String(text || "");
  return isValidHttpUrl(value) || value.startsWith("data:image/");
}

function isTemuProductUrl(value) {
  if (!isValidHttpUrl(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isTemuHost = host === "temu.com"
      || host.endsWith(".temu.com")
      || host === "temu.fr"
      || host.endsWith(".temu.fr");

    if (!isTemuHost) {
      return false;
    }

    return !/order|orders|bg_order_detail|checkout|cart/i.test(url.pathname)
      && (
        url.search.includes("goods_id=")
        || url.search.includes("product_id=")
        || /\/(?:goods|product)/i.test(url.pathname)
        || /\.html$/i.test(url.pathname)
      );
  } catch {
    return false;
  }
}

function isTemuOrderUrl(value) {
  if (!isValidHttpUrl(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isTemuHost = host === "temu.com"
      || host.endsWith(".temu.com")
      || host === "temu.fr"
      || host.endsWith(".temu.fr");

    return isTemuHost && /order|orders|bgt?_order_detail|bg_order_detail/i.test(url.pathname);
  } catch {
    return false;
  }
}

function getDisplayArticleLink(product) {
  return String(product && product.articleLink ? product.articleLink : "").trim();
}

function parseSalePrice(value) {
  const price = parseMoneyValue(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function formatPrice(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizeUsername(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const compact = normalized.replace(/[\s_-]+/g, "");

  if (compact === "comptepro") {
    return SELLER_COMPTE_PRO;
  }

  return normalized;
}

function getPasswordHashForUser(username) {
  const configUsers = window.APP_CONFIG && window.APP_CONFIG.users ? window.APP_CONFIG.users : {};
  const hash = configUsers[username] && typeof configUsers[username].passwordHash === "string"
    ? configUsers[username].passwordHash.trim().toLowerCase()
    : "";
  return hash;
}

function isValidSha256Hex(value) {
  return /^[a-f0-9]{64}$/.test(value);
}

async function sha256Hex(value) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("crypto_subtle_unavailable");
  }

  const input = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", input);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
