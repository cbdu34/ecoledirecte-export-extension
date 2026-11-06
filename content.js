(() => {
  const state = { lastIdentityKey: "", reportTimer: null, lastUrl: location.href };

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function extractName() {
    const accountLink = document.querySelector("#user-account-link");
    const title = accountLink?.getAttribute("title") || "";
    const match = title.match(/compte utilisateur de\s+(.+?)\.(?:\s|$)/i);
    if (match) return cleanText(match[1]);
    return cleanText(accountLink?.textContent);
  }

  function extractEstablishment() {
    return cleanText(
      document.querySelector(".navbar p.mb-1")?.textContent
      || document.querySelector("p.mb-1")?.textContent
    );
  }

  function extractStudentId() {
    const candidates = [location.href];
    for (const anchor of document.querySelectorAll('a[href*="/E/"]')) {
      candidates.push(anchor.href);
    }
    for (const href of candidates) {
      const match = href.match(/\/E\/(\d+)(?:\/|$)/)
        || href.match(/\/v3\/(?:eleves|Eleves|E)\/(\d+)(?:\/|\.awp)/i)
        || href.match(/\/v3\/cloud\/E\/(\d+)\.awp/i);
      if (match) return Number(match[1]);
    }
    return null;
  }

  function extractClasse() {
    return cleanText(
      document.querySelector(".ed-menu-classe .libelle")?.textContent
      || document.querySelector(".ed-menu-classe span")?.textContent
    );
  }

  function extractIdentity() {
    return {
      nom: extractName(),
      etablissement: extractEstablishment(),
      studentId: extractStudentId(),
      classe: extractClasse(),
      url: location.href,
      capturedAt: new Date().toISOString()
    };
  }

  function reportIdentity(force = false) {
    const identity = extractIdentity();
    const key = JSON.stringify([identity.nom, identity.etablissement, identity.studentId, identity.classe]);
    if (!force && key === state.lastIdentityKey) return;
    state.lastIdentityKey = key;
    try {
      chrome.runtime.sendMessage({ type: "ED_IDENTITY", identity }).catch(() => {});
    } catch {
      // Extension rechargée : le content script sera réinjecté au prochain chargement.
    }
  }

  function scheduleReport() {
    clearTimeout(state.reportTimer);
    state.reportTimer = setTimeout(() => reportIdentity(), 500);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "ED_GET_IDENTITY") {
      sendResponse({ ok: true, identity: extractIdentity() });
      return;
    }
    if (message?.type === "ED_PING") {
      sendResponse({ ok: true });
    }
  });

  reportIdentity(true);
  [1000, 3000, 7000].forEach((delay) => setTimeout(() => reportIdentity(true), delay));

  const observer = new MutationObserver(scheduleReport);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(() => {
    if (location.href !== state.lastUrl) {
      state.lastUrl = location.href;
      reportIdentity(true);
    }
  }, 1000);
})();
