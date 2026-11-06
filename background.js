import { buildExport } from "./lib/mapping.js";

const API_BASE = "https://api.ecoledirecte.com";
const DEFAULT_API_VERSION = "4.101.4";
const EXPORT_FILENAME = "export_ecoledirecte.json";

const STORAGE = {
  token: "edToken",
  apiVersion: "edApiVersion",
  studentId: "edStudentId",
  identity: "edIdentity",
  exportState: "edExportState"
};

const state = {
  loaded: false,
  token: null,
  apiVersion: DEFAULT_API_VERSION,
  studentId: null,
  identity: null,
  exportState: null
};

let loadPromise = null;
let exportRun = null;

class SessionExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

function loadState() {
  if (!loadPromise) {
    loadPromise = chrome.storage.session.get(Object.values(STORAGE))
      .then((stored) => {
        if (!state.token && stored[STORAGE.token]) state.token = stored[STORAGE.token];
        if (stored[STORAGE.apiVersion]) state.apiVersion = stored[STORAGE.apiVersion];
        if (!state.studentId && stored[STORAGE.studentId]) state.studentId = String(stored[STORAGE.studentId]);
        if (!state.identity && stored[STORAGE.identity]) state.identity = stored[STORAGE.identity];
        if (!state.exportState && stored[STORAGE.exportState]) state.exportState = stored[STORAGE.exportState];
        state.loaded = true;
      })
      .catch(() => {
        state.loaded = true;
      });
  }
  return loadPromise;
}

function persist(values) {
  return chrome.storage.session.set(values).catch(() => {});
}

function setToken(token) {
  if (typeof token !== "string" || !token.trim()) return;
  const value = token.trim();
  if (state.token === value) return;
  state.token = value;
  persist({ [STORAGE.token]: value });
}

function setApiVersion(version) {
  if (typeof version !== "string" || !version.trim()) return;
  state.apiVersion = version.trim();
  persist({ [STORAGE.apiVersion]: state.apiVersion });
}

function setStudentId(studentId) {
  if (studentId === null || studentId === undefined || studentId === "") return;
  const value = String(studentId);
  if (state.studentId === value) return;
  state.studentId = value;
  persist({ [STORAGE.studentId]: value });
}

function updateIdentity(identity) {
  if (!identity || typeof identity !== "object") return;
  const clean = {};
  for (const [key, value] of Object.entries(identity)) {
    if (value === null || value === undefined || value === "") continue;
    clean[key] = value;
  }
  state.identity = { ...(state.identity || {}), ...clean };
  if (state.identity.studentId) setStudentId(state.identity.studentId);
  persist({ [STORAGE.identity]: state.identity });
}

function getExportState() {
  return state.exportState || {
    running: false,
    step: "idle",
    message: "Prêt.",
    percent: 0,
    current: null,
    total: null,
    startedAt: null,
    finishedAt: null,
    result: null,
    error: null
  };
}

function setExportState(patch) {
  state.exportState = { ...getExportState(), ...patch };
  persist({ [STORAGE.exportState]: state.exportState });
  try {
    chrome.runtime.sendMessage({ type: "ED_PROGRESS", export: state.exportState }).catch(() => {});
  } catch {
    // Le popup est peut-être fermé : le state reste disponible dans storage.session.
  }
}

function setProgress({ step, message, percent, current = null, total = null }) {
  const previous = getExportState();
  const nextPercent = percent === undefined ? previous.percent : percent;
  setExportState({
    step,
    message,
    percent: Math.max(0, Math.min(100, Math.round(nextPercent || 0))),
    current,
    total
  });
}

function captureFromUrl(url) {
  if (!url) return;
  try {
    const parsed = new URL(url);
    const version = parsed.searchParams.get("v");
    if (version) setApiVersion(version);
    const match = parsed.pathname.match(/\/v3\/(?:eleves|Eleves|E)\/(\d+)(?:\/|\.awp)/i)
      || parsed.pathname.match(/\/v3\/cloud\/E\/(\d+)\.awp/i);
    if (match) setStudentId(match[1]);
  } catch {
    // URL non analysable : on ignore.
  }
}

function findHeader(headers, name) {
  if (!Array.isArray(headers)) return null;
  const lower = name.toLowerCase();
  const header = headers.find((item) => String(item?.name || "").toLowerCase() === lower);
  return header?.value || null;
}

function onBeforeSendHeaders(details) {
  captureFromUrl(details.url);
  const token = findHeader(details.requestHeaders, "X-Token");
  if (token) setToken(token);
}

function onHeadersReceived(details) {
  captureFromUrl(details.url);
  const token = findHeader(details.responseHeaders, "X-Token");
  if (token) setToken(token);
}

function registerWebRequestListener(event, listener, extraInfoSpec) {
  if (!event?.addListener) return;
  const filter = { urls: ["https://api.ecoledirecte.com/*", "https://apip.ecoledirecte.com/*"] };
  try {
    event.addListener(listener, filter, extraInfoSpec);
  } catch {
    event.addListener(listener, filter, extraInfoSpec.filter((item) => item !== "extraHeaders"));
  }
}

registerWebRequestListener(chrome.webRequest.onBeforeSendHeaders, onBeforeSendHeaders, ["requestHeaders", "extraHeaders"]);
registerWebRequestListener(chrome.webRequest.onHeadersReceived, onHeadersReceived, ["responseHeaders", "extraHeaders"]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => {
      try {
        sendResponse(response);
      } catch {
        // Le popup a pu être fermé avant la fin de l'export.
      }
    })
    .catch((error) => {
      try {
        sendResponse({ ok: false, error: error?.message || String(error) });
      } catch {
        // Le popup a pu être fermé avant la fin de l'export.
      }
    });
  return true;
});

async function handleMessage(message, sender) {
  await loadState();
  switch (message?.type) {
    case "ED_IDENTITY":
      updateIdentity(message.identity);
      return { ok: true };
    case "ED_GET_STATUS":
      return getStatus();
    case "ED_EXPORT":
      return startExport(message.tabId ?? sender.tab?.id);
    case "ED_PING":
      return { ok: true };
    default:
      return { ok: false, error: "Message inconnu." };
  }
}

function getStatus() {
  if (state.exportState?.running && !exportRun) {
    setExportState({
      running: false,
      step: "error",
      message: "L'export précédent a été interrompu. Relancez l'export.",
      error: "Export interrompu.",
      percent: 0,
      finishedAt: Date.now()
    });
  }

  const identity = state.identity || {};
  const studentId = identity.studentId ?? state.studentId ?? null;
  return {
    ok: true,
    tokenCaptured: Boolean(state.token),
    apiVersion: state.apiVersion,
    studentId,
    identity: { ...identity, studentId },
    export: getExportState()
  };
}

async function requestIdentityFromTab(tabId) {
  if (!tabId) return null;
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "ED_GET_IDENTITY" });
    if (response?.identity) {
      updateIdentity(response.identity);
      return response.identity;
    }
  } catch {
    // Content script non injecté (page ouverte avant l'installation) ou onglet fermé.
  }
  return null;
}

function getIdentityWithStudentId() {
  const identity = { ...(state.identity || {}) };
  if (!identity.studentId && state.studentId) identity.studentId = state.studentId;
  if (!identity.studentId) return null;
  return identity;
}

function isEcoleDirecteUrl(url) {
  return /^https:\/\/([a-z0-9-]+\.)*ecoledirecte\.com\//i.test(url || "");
}

async function ensureTab(tabId) {
  if (!tabId) throw new Error("Onglet EcoleDirecte introuvable.");
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    throw new Error("Onglet introuvable. Rouvrez EcoleDirecte puis réessayez.");
  }
  if (tab?.url && !isEcoleDirecteUrl(tab.url)) {
    throw new Error("Ouvrez une page EcoleDirecte dans cet onglet, puis réessayez.");
  }
  if (!tab?.url) {
    const identity = await requestIdentityFromTab(tabId);
    if (!identity) throw new Error("Ouvrez une page EcoleDirecte dans cet onglet, puis réessayez.");
  }
  return tab;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForToken(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (state.token) return state.token;
    await sleep(200);
  }
  return null;
}

async function waitForTokenChange(previousToken, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (state.token && state.token !== previousToken) return state.token;
    await sleep(150);
  }
  return null;
}

async function reloadTab(tabId) {
  try {
    await chrome.tabs.reload(tabId);
  } catch {
    throw new Error("Impossible de recharger l'onglet EcoleDirecte.");
  }
}

async function apiRequest(path, body = {}, options = {}) {
  await loadState();
  const version = options.version || state.apiVersion || DEFAULT_API_VERSION;
  const params = new URLSearchParams();
  params.set("verbe", options.verbe || "get");
  params.set("v", version);
  for (const [key, value] of Object.entries(options.extraParams || {})) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }

  const url = `${API_BASE}/v3/${path}?${params.toString()}`;
  const payload = `data=${encodeURIComponent(JSON.stringify(body ?? {}))}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = state.token;
    if (!token) throw new SessionExpiredError("Jeton EcoleDirecte indisponible.");

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Token": token
        },
        body: payload,
        credentials: "omit",
        cache: "no-store"
      });
    } catch (error) {
      throw new Error(`Impossible de contacter EcoleDirecte : ${error.message}`);
    }

    let json;
    try {
      json = await response.json();
    } catch {
      throw new Error(`Réponse invalide d'EcoleDirecte (HTTP ${response.status}).`);
    }

    const nextToken = response.headers.get("X-Token") || json?.token;
    if (nextToken) setToken(nextToken);

    if (Number(json?.code) === 200) return json;

    if (Number(json?.code) === 520 || response.status === 401) {
      const freshToken = await waitForTokenChange(token, 3000);
      if (freshToken) continue;
      throw new SessionExpiredError("La session EcoleDirecte a expiré. Rechargez la page EcoleDirecte puis réessayez.");
    }

    throw new Error(json?.message || `Erreur EcoleDirecte (code ${json?.code ?? response.status}).`);
  }

  throw new SessionExpiredError("La session EcoleDirecte a expiré. Rechargez la page EcoleDirecte puis réessayez.");
}

async function startExport(tabId) {
  await loadState();
  if (exportRun) return exportRun;

  const current = getExportState();
  if (current.running) {
    setExportState({
      running: false,
      step: "error",
      message: "L'export précédent a été interrompu. Nouvel essai...",
      error: "Export interrompu.",
      finishedAt: Date.now()
    });
  }

  exportRun = runExport(tabId).finally(() => {
    exportRun = null;
  });
  return exportRun;
}

async function runExport(tabId) {
  setExportState({
    running: true,
    step: "init",
    message: "Préparation de l'export...",
    percent: 0,
    current: null,
    total: null,
    startedAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null
  });

  try {
    await ensureTab(tabId);

    let identity = getIdentityWithStudentId();
    if (!identity || !identity.nom) {
      await requestIdentityFromTab(tabId);
      identity = getIdentityWithStudentId();
    }

    if (!identity || !identity.nom || !state.token) {
      setExportState({ step: "session", message: "Reconnexion à la page EcoleDirecte...", percent: 2 });
      await reloadTab(tabId);
      await sleep(1500);
      await waitForToken(15000);
      await requestIdentityFromTab(tabId);
      identity = getIdentityWithStudentId() || identity;
    }

    if (!identity) {
      throw new Error("Impossible d'identifier l'élève. Rechargez la page EcoleDirecte, vérifiez que vous êtes connecté, puis réessayez.");
    }
    if (!state.token) {
      throw new Error("Jeton EcoleDirecte introuvable. Vérifiez que vous êtes connecté, rechargez la page puis réessayez.");
    }

    let data;
    try {
      data = await collectAll(identity, setProgress);
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) throw error;
      setExportState({ step: "session", message: "Session expirée, rechargement de la page...", percent: 4 });
      await reloadTab(tabId);
      const token = await waitForToken(15000);
      if (!token) throw error;
      await sleep(1200);
      await requestIdentityFromTab(tabId);
      identity = getIdentityWithStudentId() || identity;
      data = await collectAll(identity, setProgress);
    }

    setExportState({ step: "download", message: "Création du fichier JSON...", percent: 95 });
    const json = JSON.stringify(data, null, 2);
    const bytes = new TextEncoder().encode(json).length;
    const downloadId = await chrome.downloads.download({
      url: jsonToDataUrl(json),
      filename: EXPORT_FILENAME,
      saveAs: false,
      conflictAction: "overwrite"
    });

    const result = {
      downloadId,
      filename: EXPORT_FILENAME,
      bytes,
      stats: computeStats(data)
    };
    setExportState({
      running: false,
      step: "done",
      message: "Export terminé !",
      percent: 100,
      finishedAt: Date.now(),
      result,
      error: null
    });
    return { ok: true, result, export: getExportState() };
  } catch (error) {
    const message = error?.message || "Erreur inconnue.";
    setExportState({
      running: false,
      step: "error",
      message,
      error: message,
      percent: 0,
      finishedAt: Date.now()
    });
    return { ok: false, error: message, export: getExportState() };
  }
}

async function fetchReceivedMessages(studentId) {
  const baseParams = {
    force: "false",
    typeRecuperation: "received",
    idClasseur: "0",
    orderBy: "date",
    order: "desc",
    query: "",
    onlyRead: "",
    page: "0",
    itemsPerPage: "100"
  };

  const messages = await apiRequest(`eleves/${studentId}/messages.awp`, {}, {
    verbe: "get",
    extraParams: { ...baseParams, getAll: "1" }
  });
  const container = messages?.data?.messages;
  const received = Array.isArray(container) ? [...container] : [...(container?.received || [])];
  const total = Number(messages?.data?.pagination?.messagesRecusCount) || 0;

  if (total > received.length) {
    const seen = new Set(received.map((message) => message.id));
    for (let page = 1; received.length < total && page <= 50; page += 1) {
      const next = await apiRequest(`eleves/${studentId}/messages.awp`, {}, {
        verbe: "get",
        extraParams: { ...baseParams, page: String(page), getAll: "0" }
      });
      const nextContainer = next?.data?.messages;
      const batch = Array.isArray(nextContainer) ? nextContainer : (nextContainer?.received || []);
      if (!batch.length) break;
      let added = 0;
      for (const message of batch) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        received.push(message);
        added += 1;
      }
      if (added === 0) break;
    }
  }

  return { messages, received };
}

async function collectAll(identity, onProgress) {
  const studentId = encodeURIComponent(String(identity.studentId));
  const warnings = [];

  onProgress({ step: "notes", message: "Récupération des notes...", percent: 8 });
  const notes = await apiRequest(`eleves/${studentId}/notes.awp`, {}, { verbe: "get" });

  onProgress({ step: "devoirs", message: "Récupération du cahier de textes...", percent: 12 });
  const cahier = await apiRequest(`Eleves/${studentId}/cahierdetexte.awp`, {}, { verbe: "get" });
  const cahierData = cahier?.data && typeof cahier.data === "object" ? cahier.data : {};
  const dates = Object.keys(cahierData).filter((date) => Array.isArray(cahierData[date])).sort();
  const dayDetails = {};

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    const percent = 15 + Math.round(((index + 1) / Math.max(dates.length, 1)) * 20);
    onProgress({
      step: "devoirs",
      message: `Récupération des devoirs (${index + 1}/${dates.length})...`,
      percent,
      current: index + 1,
      total: dates.length
    });
    try {
      dayDetails[date] = await apiRequest(
        `Eleves/${studentId}/cahierdetexte/${encodeURIComponent(date)}.awp`,
        {},
        { verbe: "get" }
      );
    } catch (error) {
      if (error instanceof SessionExpiredError) throw error;
      warnings.push(`Détail du ${date} indisponible : ${error.message}`);
      dayDetails[date] = null;
    }
  }

  onProgress({ step: "messages", message: "Récupération de la boîte de réception...", percent: 38 });
  const { messages, received } = await fetchReceivedMessages(studentId);
  const messageDetails = [];

  for (let index = 0; index < received.length; index += 1) {
    const summary = received[index];
    const percent = 40 + Math.round(((index + 1) / Math.max(received.length, 1)) * 25);
    onProgress({
      step: "messages",
      message: `Lecture des messages (${index + 1}/${received.length})...`,
      percent,
      current: index + 1,
      total: received.length
    });
    try {
      const detail = await apiRequest(`eleves/${studentId}/messages/${summary.id}.awp`, {}, {
        verbe: "get",
        extraParams: { mode: "destinataire" }
      });
      messageDetails.push({ summary, detail: detail?.data || null });
    } catch (error) {
      if (error instanceof SessionExpiredError) throw error;
      warnings.push(`Message ${summary.id} sans contenu : ${error.message}`);
      messageDetails.push({ summary, detail: null, error: error.message });
    }
  }

  onProgress({ step: "espaces", message: "Récupération des espaces de travail...", percent: 68 });
  const workspaces = await apiRequest(`E/${studentId}/espacestravail.awp`, {}, {
    verbe: "get",
    extraParams: { typeModule: "ESPACE_DE_TRAVAIL" }
  });
  const workspaceList = Array.isArray(workspaces?.data) ? workspaces.data : [];
  const workspaceTrees = {};

  for (let index = 0; index < workspaceList.length; index += 1) {
    const workspace = workspaceList[index];
    if (!workspace.cloud) continue;
    const percent = 70 + Math.round(((index + 1) / Math.max(workspaceList.length, 1)) * 20);
    onProgress({
      step: "espaces",
      message: `Exploration de « ${workspace.titre || "espace"} » (${index + 1}/${workspaceList.length})...`,
      percent,
      current: index + 1,
      total: workspaceList.length
    });
    try {
      const tree = await apiRequest(`cloud/W/${workspace.id}.awp`, { profondeur: 999 }, { verbe: "get" });
      workspaceTrees[workspace.id] = tree?.data?.[0] || null;
    } catch (error) {
      if (error instanceof SessionExpiredError) throw error;
      warnings.push(`Arborescence de « ${workspace.titre || workspace.id} » indisponible : ${error.message}`);
      workspaceTrees[workspace.id] = null;
    }
  }

  return buildExport({
    identity,
    notes,
    cahier,
    dayDetails,
    messages,
    messageDetails,
    workspaces,
    workspaceTrees,
    exportedAt: new Date().toISOString(),
    warnings
  });
}

function jsonToDataUrl(json) {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:application/json;charset=utf-8;base64,${btoa(binary)}`;
}

function computeStats(data) {
  const workspaces = Array.isArray(data.espace_de_travail) ? data.espace_de_travail : [];
  return {
    notes: data.notes?.length || 0,
    devoirs: data.devoirs?.length || 0,
    messages: data.messages?.length || 0,
    espaces_de_travail: workspaces.length,
    dossiers: workspaces.reduce((sum, workspace) => sum + (workspace.nb_dossiers || 0), 0),
    fichiers: workspaces.reduce((sum, workspace) => sum + (workspace.nb_fichiers || 0), 0)
  };
}
