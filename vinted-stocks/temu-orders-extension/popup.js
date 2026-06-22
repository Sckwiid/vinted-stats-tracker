const scanBtn = document.getElementById("scanBtn");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const previewListEl = document.getElementById("previewList");

scanBtn.addEventListener("click", () => {
  void scanActiveTemuTab();
});

async function scanActiveTemuTab() {
  setBusy(true);
  setStatus("Scan en cours. Analyse rapide de la page commande Temu...", "info");
  clearPreview();

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      throw new Error("Onglet actif introuvable.");
    }

    if (tab.url && !isTemuUrl(tab.url)) {
      throw new Error("Ouvre une page Temu avant de scanner.");
    }

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-scan.js"]
    });

    const result = injectionResults && injectionResults[0] ? injectionResults[0].result : null;

    if (!result || !result.ok) {
      throw new Error(result && result.error ? result.error : "Scan Temu impossible.");
    }

    const payload = buildExportPayload(result.items, result.pageUrl);

    if (payload.items.length === 0) {
      throw new Error("Aucun article Temu trouve. Descends dans la page commandes puis relance le scan.");
    }

    await downloadJson(payload);
    renderPreview(payload.items);
    setStatus(`${payload.items.length} article(s) exporte(s). Le fichier JSON a ete telecharge.`, "success");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Erreur pendant le scan.", "error");
  } finally {
    setBusy(false);
  }
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs[0] ? tabs[0] : null);
    });
  });
}

function isTemuUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "temu.com" || host.endsWith(".temu.com") || host === "temu.fr" || host.endsWith(".temu.fr");
  } catch {
    return false;
  }
}

function buildExportPayload(items, pageUrl) {
  return {
    source: "temu-orders-extension",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    pageUrl: pageUrl || "",
    items: Array.isArray(items) ? items.map(normalizeExportItem).filter(Boolean) : []
  };
}

function normalizeExportItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const title = String(item.title || "").trim();
  const productUrl = String(item.productUrl || "").trim();

  if (!title && !productUrl) {
    return null;
  }

  return {
    title: title || "Article Temu",
    purchasePrice: typeof item.purchasePrice === "number" && Number.isFinite(item.purchasePrice)
      ? item.purchasePrice
      : null,
    quantity: Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
      ? Math.floor(Number(item.quantity))
      : 1,
    imageUrl: String(item.imageUrl || "").trim(),
    productUrl,
    orderPageUrl: String(item.orderPageUrl || "").trim(),
    orderId: String(item.orderId || "").trim(),
    orderDate: String(item.orderDate || "").trim(),
    variant: String(item.variant || "").trim(),
    color: String(item.color || "").trim(),
    importKey: String(item.importKey || "").trim(),
    currency: String(item.currency || "EUR").trim() || "EUR"
  };
}

async function downloadJson(payload) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    await chrome.downloads.download({
      url: objectUrl,
      filename: `temu-orders-${date}.json`,
      saveAs: true,
      conflictAction: "uniquify"
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  }
}

function renderPreview(items) {
  previewListEl.innerHTML = items
    .slice(0, 8)
    .map((item) => {
      const image = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="">`
        : '<div class="no-image"></div>';
      const price = item.purchasePrice === null ? "prix inconnu" : `${item.purchasePrice.toFixed(2)} EUR`;
      const variant = item.color || item.variant || "";
      return `
        <li>
          ${image}
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <span>x${item.quantity} - ${escapeHtml(price)}${variant ? ` - ${escapeHtml(variant)}` : ""}</span>
          </div>
        </li>
      `;
    })
    .join("");
  previewEl.classList.remove("hidden");
}

function clearPreview() {
  previewListEl.innerHTML = "";
  previewEl.classList.add("hidden");
}

function setBusy(isBusy) {
  scanBtn.disabled = isBusy;
  scanBtn.textContent = isBusy ? "Scan en cours..." : "Scanner commandes Temu";
}

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status ${kind === "error" ? "error" : kind === "success" ? "success" : ""}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
