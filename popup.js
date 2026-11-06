const els = {
  avatar: document.getElementById("avatar"),
  studentName: document.getElementById("student-name"),
  studentMeta: document.getElementById("student-meta"),
  sessionBadge: document.getElementById("session-badge"),
  exportButton: document.getElementById("export-button"),
  exportButtonLabel: document.getElementById("export-button-label"),
  progress: document.getElementById("progress"),
  progressFill: document.getElementById("progress-fill"),
  progressText: document.getElementById("progress-text"),
  result: document.getElementById("result"),
  resultStats: document.getElementById("result-stats"),
  resultFile: document.getElementById("result-file"),
  message: document.getElementById("message")
};

let currentTab = null;
let lastStatus = null;
let pollTimer = null;
let busy = false;

function isEcoleDirecteUrl(url) {
  return /^https:\/\/([a-z0-9-]+\.)*ecoledirecte\.com\//i.test(url || "");
}

function show(element) {
  element.classList.remove("hidden");
}

function hide(element) {
  element.classList.add("hidden");
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ED";
  return `${parts[0][0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "ED";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(timestamp) {
  if (!timestamp) return "à l'instant";
  try {
    return new Date(timestamp).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  } catch {
    return "à l'instant";
  }
}

function setBusy(value) {
  busy = value;
  const onEcoleDirecte = Boolean(currentTab && isEcoleDirecteUrl(currentTab.url));
  els.exportButton.disabled = value || !onEcoleDirecte;
  els.exportButtonLabel.textContent = value
    ? "Export en cours..."
    : "Exporter mes données pour l'IA";
}

function showMessage(text, type = "info") {
  els.message.textContent = text;
  els.message.className = `message ${type}`;
  show(els.message);
}

function renderResult(result) {
  const stats = result?.stats || {};
  els.resultStats.replaceChildren();

  const items = [
    [stats.notes, "notes"],
    [stats.devoirs, "devoirs"],
    [stats.messages, "messages"],
    [stats.espaces_de_travail, "espaces"]
  ];

  for (const [value, label] of items) {
    const stat = document.createElement("div");
    stat.className = "stat";
    const strong = document.createElement("strong");
    strong.textContent = String(value ?? 0);
    const span = document.createElement("span");
    span.textContent = label;
    stat.append(strong, span);
    els.resultStats.append(stat);
  }

  const files = stats.fichiers ?? 0;
  const folders = stats.dossiers ?? 0;
  els.resultFile.textContent = [
    result?.filename || "export_ecoledirecte.json",
    formatBytes(result?.bytes),
    `${files} fichiers`,
    `${folders} dossiers`
  ].filter(Boolean).join(" · ");
}

function renderDisconnected() {
  els.studentName.textContent = "EcoleDirecte non détecté";
  els.studentMeta.textContent = "Ouvrez une page EcoleDirecte dans cet onglet";
  els.avatar.textContent = "ED";
  els.sessionBadge.textContent = "Hors ligne";
  els.sessionBadge.className = "badge wait";
  setBusy(false);
  els.exportButton.disabled = true;
  hide(els.progress);
  hide(els.result);
  showMessage("Ouvrez EcoleDirecte, connectez-vous, puis rouvrez ce popup.", "info");
}

function render(status) {
  if (!currentTab || !isEcoleDirecteUrl(currentTab.url)) {
    renderDisconnected();
    return;
  }

  const identity = status?.identity || {};
  const displayName = identity.nom || (identity.studentId ? `Élève #${identity.studentId}` : "Identification...");
  els.studentName.textContent = displayName;
  els.studentMeta.textContent = [identity.etablissement, identity.classe].filter(Boolean).join(" · ") || "EcoleDirecte";
  els.avatar.textContent = initials(identity.nom || "ED");

  const connected = Boolean(status?.tokenCaptured && (identity.studentId || status?.studentId));
  els.sessionBadge.textContent = connected ? "Session active" : "Session en attente";
  els.sessionBadge.className = `badge ${connected ? "ok" : "wait"}`;

  const exportState = status?.export || {};
  const running = Boolean(exportState.running);
  setBusy(running);

  if (running) {
    show(els.progress);
    hide(els.result);
    hide(els.message);
    els.progressFill.style.width = `${clampPercent(exportState.percent)}%`;
    els.progressText.textContent = exportState.message || "Export en cours...";
    return;
  }

  hide(els.progress);

  if (exportState.step === "done" && exportState.result) {
    renderResult(exportState.result);
    show(els.result);
    showMessage(`Dernier export : ${formatDate(exportState.finishedAt)}`, "success");
    return;
  }

  if (exportState.step === "error") {
    hide(els.result);
    showMessage(exportState.error || exportState.message || "L'export a échoué.", "error");
    return;
  }

  hide(els.result);
  if (!connected) {
    showMessage("La session EcoleDirecte est en cours de détection. Si rien ne se passe, rechargez la page EcoleDirecte.", "info");
  } else {
    hide(els.message);
  }
}

async function syncIdentity() {
  if (!currentTab?.id) return;
  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, { type: "ED_GET_IDENTITY" });
    if (response?.identity) {
      await chrome.runtime.sendMessage({ type: "ED_IDENTITY", identity: response.identity });
    }
  } catch {
    // Content script absent : l'export rechargera la page si nécessaire.
  }
}

async function refresh() {
  if (!currentTab) return;
  try {
    const status = await chrome.runtime.sendMessage({ type: "ED_GET_STATUS" });
    if (status?.ok) {
      lastStatus = status;
      render(status);
    }
  } catch {
    // Service worker en cours de réveil : le prochain tick réessaiera.
  }
}

async function onExportClick() {
  if (!currentTab?.id || busy) return;
  setBusy(true);
  hide(els.result);
  hide(els.message);
  show(els.progress);
  els.progressFill.style.width = "1%";
  els.progressText.textContent = "Démarrage de l'export...";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "ED_EXPORT",
      tabId: currentTab.id
    });
    if (!response?.ok) throw new Error(response?.error || "L'export a échoué.");
    if (response.result) renderResult(response.result);
  } catch (error) {
    showMessage(
      error?.message || "L'export a échoué. Vérifiez que la page EcoleDirecte est bien ouverte.",
      "error"
    );
  } finally {
    setBusy(false);
    await refresh();
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function init() {
  els.exportButton.addEventListener("click", onExportClick);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "ED_PROGRESS" && message.export) {
      lastStatus = { ...(lastStatus || {}), export: message.export };
      render(lastStatus);
    }
  });

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0] || null;
  } catch {
    currentTab = null;
  }

  if (!currentTab || !isEcoleDirecteUrl(currentTab.url)) {
    renderDisconnected();
    return;
  }

  await syncIdentity();
  await refresh();
  pollTimer = setInterval(refresh, 900);
  window.addEventListener("pagehide", stopPolling);
}

init();
