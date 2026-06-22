import crypto from "node:crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_ATTEMPTS_PREFIX = "auth-attempts";
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const DEFAULT_GITHUB_BRANCH = "main";
const DEFAULT_GITHUB_PRODUCTS_PATH = "db/products.json";
const ALLOWED_ORIGINS = [
  "https://sckwiid.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
];

const authAttempts = globalThis.__vintedStocksAuthAttempts || new Map();
globalThis.__vintedStocksAuthAttempts = authAttempts;

export default async function handler(request) {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    if (request.method === "POST" && path === "/login") {
      return handleLogin(request, corsHeaders);
    }

    const user = requireAuth(request);
    if (!user) {
      return jsonResponse({ error: "unauthorized" }, corsHeaders, 401);
    }

    if (request.method === "GET" && path === "/storage") {
      return jsonResponse({ storage: getStoragePublicInfo() }, corsHeaders);
    }

    if (request.method === "GET" && path === "/products") {
      const result = await readProductsWithMeta();
      return jsonResponse({
        products: result.products,
        sourceMissing: result.sourceMissing,
        storage: getStoragePublicInfo()
      }, corsHeaders);
    }

    if (request.method === "PUT" && path === "/products") {
      const body = await request.json();
      const products = Array.isArray(body) ? body : body.products;
      await writeProducts(Array.isArray(products) ? products : [], user, "Push stock complet vers GitHub");
      return jsonResponse({ ok: true, user, storage: getStoragePublicInfo() }, corsHeaders);
    }

    const productMatch = path.match(/^\/products\/([^/]+)$/);
    if (productMatch && request.method === "PUT") {
      const productId = decodeURIComponent(productMatch[1]);
      const product = await request.json();
      const products = await readProducts();
      const nextProducts = products.filter((item) => item && item.id !== productId);
      nextProducts.unshift({ ...product, id: productId });
      await writeProducts(nextProducts, user, `Mise a jour article ${productId}`);
      return jsonResponse({ ok: true, user, storage: getStoragePublicInfo() }, corsHeaders);
    }

    if (productMatch && request.method === "DELETE") {
      const productId = decodeURIComponent(productMatch[1]);
      const products = await readProducts();
      await writeProducts(
        products.filter((item) => item && item.id !== productId),
        user,
        `Suppression article ${productId}`
      );
      return jsonResponse({ ok: true, user, storage: getStoragePublicInfo() }, corsHeaders);
    }

    return jsonResponse({ error: "not_found" }, corsHeaders, 404);
  } catch (error) {
    return jsonResponse(
      { error: error && error.message ? error.message : "server_error" },
      corsHeaders,
      error && error.status ? error.status : 500
    );
  }
}

export const config = {
  path: "/api/*"
};

async function handleLogin(request, headers) {
  const body = await request.json();
  const username = normalizeUsername(body && body.username);
  const password = String((body && body.password) || "");
  const loginLimit = await getLoginLimit(request, username);

  if (loginLimit.locked) {
    return jsonResponse(
      { error: "too_many_attempts" },
      {
        ...headers,
        "Retry-After": String(Math.ceil(loginLimit.retryAfterMs / 1000))
      },
      429
    );
  }

  const expectedPassword = getExpectedPassword(username);
  if (!expectedPassword || password !== expectedPassword) {
    await recordFailedLogin(loginLimit.key);
    return jsonResponse({ error: "invalid_credentials" }, headers, 401);
  }

  await clearLoginLimit(loginLimit.key);
  return jsonResponse({ token: createToken(username) }, headers);
}

function normalizePath(pathname) {
  return pathname
    .replace(/^\/\.netlify\/functions\/api/, "")
    .replace(/^\/api/, "")
    .replace(/\/+$/g, "") || "/";
}

function getExpectedPassword(username) {
  const passwords = {
    anthony: process.env.ANTHONY_PASSWORD,
    julien: process.env.JULIEN_PASSWORD,
    "compte-pro": process.env.COMPTE_PRO_PASSWORD
  };

  return passwords[username] || "";
}

function requireAuth(request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return verifyToken(token);
}

async function readProducts() {
  const result = await readProductsWithMeta();
  return result.products;
}

async function readProductsWithMeta() {
  const file = await readGitHubFile();
  if (!file) {
    return { products: [], sourceMissing: true };
  }

  const parsed = JSON.parse(file.content || "[]");
  const products = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed && parsed.products)
      ? parsed.products
      : [];

  return { products, sourceMissing: false, sha: file.sha };
}

async function writeProducts(products, username, message) {
  const config = getGitHubStorageConfig();
  const currentFile = await readGitHubFile({ allowMissing: true });
  const payload = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: username || "system",
    products
  };

  const body = {
    message: buildGitHubCommitMessage(message, username),
    content: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8").toString("base64"),
    branch: config.branch
  };

  if (currentFile && currentFile.sha) {
    body.sha = currentFile.sha;
  }

  await githubRequest(getContentsPath(config), {
    method: "PUT",
    body
  });
}

async function readGitHubFile(options = {}) {
  const config = getGitHubStorageConfig();

  try {
    const data = await githubRequest(`${getContentsPath(config)}?ref=${encodeURIComponent(config.branch)}`);
    if (!data || typeof data.content !== "string") {
      throw httpError("github_products_file_invalid", 500);
    }

    return {
      sha: data.sha || "",
      content: Buffer.from(data.content.replace(/\s+/g, ""), "base64").toString("utf8")
    };
  } catch (error) {
    if (error.status === 404 && options.allowMissing !== false) {
      return null;
    }
    throw error;
  }
}

async function githubRequest(path, options = {}) {
  const config = getGitHubStorageConfig();
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "vinted-stocks-sync",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw httpError(getGitHubErrorMessage(response.status, data), response.status === 404 ? 404 : 502);
  }

  return data;
}

function getContentsPath(config) {
  return `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeGitHubPath(config.path)}`;
}

function encodeGitHubPath(path) {
  return String(path || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function getGitHubStorageConfig() {
  const repository = String(process.env.GITHUB_REPOSITORY || "").trim();
  const [repositoryOwner, repositoryName] = repository.includes("/") ? repository.split("/") : ["", ""];
  const config = {
    token: String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim(),
    owner: String(process.env.GITHUB_OWNER || repositoryOwner || "").trim(),
    repo: String(process.env.GITHUB_REPO || repositoryName || "").trim(),
    branch: String(process.env.GITHUB_BRANCH || DEFAULT_GITHUB_BRANCH).trim(),
    path: String(process.env.GITHUB_PRODUCTS_PATH || DEFAULT_GITHUB_PRODUCTS_PATH).trim()
  };

  if (!config.token || !config.owner || !config.repo || !config.branch || !config.path) {
    throw httpError("github_storage_config_missing", 500);
  }

  return config;
}

function getStoragePublicInfo() {
  try {
    const config = getGitHubStorageConfig();
    return {
      provider: "github",
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
      path: config.path
    };
  } catch {
    return {
      provider: "github",
      configured: false
    };
  }
}

function buildGitHubCommitMessage(message, username) {
  const suffix = username ? ` (${username})` : "";
  return `vinted-stocks: ${message || "sync stock"}${suffix}`;
}

function getGitHubErrorMessage(status, data) {
  if (status === 401 || status === 403) {
    return "github_token_refused";
  }

  if (status === 404) {
    return "github_products_file_missing";
  }

  if (status === 409) {
    return "github_write_conflict_retry";
  }

  return data && data.message ? `github_error: ${data.message}` : `github_http_${status}`;
}

async function getLoginLimit(request, username) {
  const key = `${AUTH_ATTEMPTS_PREFIX}/${getLoginLimitKey(request, username)}`;
  const data = authAttempts.get(key) || {};
  const now = Date.now();
  const firstAttemptAt = Number(data.firstAttemptAt || 0);
  const lockUntil = Number(data.lockUntil || 0);

  if (lockUntil > now) {
    return {
      locked: true,
      key,
      retryAfterMs: lockUntil - now
    };
  }

  if (firstAttemptAt && now - firstAttemptAt > LOGIN_WINDOW_MS) {
    authAttempts.delete(key);
  }

  return {
    locked: false,
    key,
    retryAfterMs: 0
  };
}

function getLoginLimitKey(request, username) {
  const rawKey = `${getClientIp(request)}:${normalizeUsername(username) || "unknown"}`;
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(rawKey)
    .digest("hex");
}

function getClientIp(request) {
  const forwardedFor = String(request.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return forwardedFor[0] || request.headers.get("x-nf-client-connection-ip") || "unknown";
}

async function recordFailedLogin(key) {
  const current = authAttempts.get(key) || {};
  const now = Date.now();

  if (!current.firstAttemptAt || now - Number(current.firstAttemptAt) > LOGIN_WINDOW_MS) {
    authAttempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
      lockUntil: 0
    });
    return;
  }

  const count = Number(current.count || 0) + 1;
  authAttempts.set(key, {
    count,
    firstAttemptAt: Number(current.firstAttemptAt || now),
    lastAttemptAt: now,
    lockUntil: count >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_LOCK_MS : 0
  });
}

async function clearLoginLimit(key) {
  authAttempts.delete(key);
}

function createToken(username) {
  const payload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) {
    return "";
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = sign(encodedPayload);

  if (!safeEqual(signature, expectedSignature)) {
    return "";
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return "";
    }
    return normalizeUsername(payload.sub);
  } catch {
    return "";
  }
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || "";
  if (!secret) {
    throw httpError("SESSION_SECRET missing", 500);
  }
  return secret;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function normalizeUsername(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const compact = normalized.replace(/[\s_-]+/g, "");
  return compact === "comptepro" ? "compte-pro" : normalized;
}

function getCorsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const responseOrigin = resolveAllowedOrigin(origin);

  return {
    ...(responseOrigin ? { "Access-Control-Allow-Origin": responseOrigin } : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json"
  };
}

function resolveAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.includes("*")) {
    return "*";
  }

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  return "";
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function jsonResponse(data, headers, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}
