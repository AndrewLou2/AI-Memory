const SITE = location.hostname.replace(/^www\./, "");
const SITE_KEY = "chatgpt.com";
const DEFAULTS = {
  "chatgpt.com": {
    context_window: 128000,
    overhead: 2000,
    reply_budget: 1500,
    tokenizer_mode: "high_fidelity",
    tokenizer_type: "openai",
    custom_selectors: "",
  },
};
const SELECTOR_PROFILES = {
  "chatgpt.com": [
    "[data-message-author-role]",
    '[data-testid="conversation-turn"]',
    "article .markdown",
    "article",
  ],
};

let state = {
  settings: null,
  nodes: [],
  nodeInfos: [],
  countsCache: new Map(),
  textCache: new WeakMap(),
  idCache: new WeakMap(),
  convKey: location.href,
  worker: null,
  recomputeScheduled: false,
  highlightsOn: false,
  lastCompute: null,
  hud: null,
  shadow: null,
  domObserver: null,
  debounceTimer: null,
  rafId: null,
  startNode: null,
  firstOmittedNode: null,
  includedSet: new Set(),
  omittedSet: new Set(),
  expanded: { start: false, omitted: false },
  drag: { dragging: false, offsetX: 0, offsetY: 0 },
};

function hashText(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(36);
}

async function loadSettings() {
  const data = await chrome.storage.local.get([
    "cbt_settings",
    "cbt_position",
    "cbt_highlights",
  ]);
  const merged = Object.assign({}, DEFAULTS);
  const stored = data.cbt_settings || {};
  for (const k of Object.keys(merged)) {
    merged[k] = Object.assign({}, merged[k], stored[k] || {});
  }
  const s = merged[SITE_KEY] || {};
  s.context_window = Number(s.context_window);
  s.overhead = Number(s.overhead);
  s.reply_budget = Number(s.reply_budget);
  if (!Number.isFinite(s.context_window) || s.context_window <= 0)
    s.context_window = 200000;
  if (!Number.isFinite(s.overhead) || s.overhead < 0) s.overhead = 2000;
  if (!Number.isFinite(s.reply_budget) || s.reply_budget < 0)
    s.reply_budget = 1500;
  s.tokenizer_type = "openai";
  if (s.tokenizer_mode !== "high_fidelity" && s.tokenizer_mode !== "heuristic")
    s.tokenizer_mode = "high_fidelity";
  merged[SITE_KEY] = s;
  state.settings = merged;
  state.highlightsOn = !!data.cbt_highlights;
  return data.cbt_position;
}

function getProfile() {
  return state.settings[SITE_KEY];
}

function getSelectors() {
  const siteDefs = SELECTOR_PROFILES[SITE_KEY] || [];
  const custom = (getProfile().custom_selectors || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...custom, ...siteDefs];
}

function createWorker() {
  if (state.worker) return state.worker;
  const url = chrome.runtime.getURL("worker-tokenizer.js");
  state.worker = new Worker(url, { type: "module" });
  return state.worker;
}

function normalizeNodeToText(node) {
  const clone = node.cloneNode(true);
  const toRemove = clone.querySelectorAll(
    'button, input, textarea, svg, img, video, audio, [role="button"], [contenteditable]'
  );
  toRemove.forEach((n) => n.remove());
  const codeBlocks = Array.from(clone.querySelectorAll("pre, code, pre code"));
  codeBlocks.forEach((cb) => {
    cb.textContent = cb.textContent;
  });
  const text = clone.innerText || clone.textContent || "";
  return text
    .replace(/\u00A0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectMessageNodes() {
  const selectors = getSelectors();
  const seen = new Set();
  const nodes = [];
  for (const sel of selectors) {
    const found = Array.from(document.querySelectorAll(sel));
    for (const n of found) {
      if (!n || !n.isConnected) continue;
      if (seen.has(n)) continue;
      if (n.offsetParent === null && !n.closest("article")) continue;
      seen.add(n);
      nodes.push(n);
    }
  }
  if (nodes.length === 0) {
    const articles = Array.from(document.querySelectorAll("article"));
    articles.forEach((a) => {
      if (!seen.has(a)) {
        seen.add(a);
        nodes.push(a);
      }
    });
  }
  return pruneNestedNodes(nodes);
}

function pruneNestedNodes(nodes) {
  const unique = Array.from(new Set(nodes));
  const result = [];
  for (let i = 0; i < unique.length; i++) {
    const node = unique[i];
    let contained = false;
    for (let j = 0; j < unique.length; j++) {
      if (i === j) continue;
      const other = unique[j];
      if (other.contains(node)) {
        contained = true;
        break;
      }
    }
    if (!contained) result.push(node);
  }
  return result;
}

function uniqueOrderedNodes(nodes) {
  const arr = nodes.filter(Boolean);
  arr.sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  );
  const dedup = [];
  const set = new Set();
  for (const n of arr) {
    if (!set.has(n)) {
      set.add(n);
      dedup.push(n);
    }
  }
  return dedup;
}

function ensureHud() {
  if (state.hud && state.shadow) return;
  const host = document.createElement("div");
  host.id = "cbt-host";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "999999999";
  host.style.top = "16px";
  host.style.right = "0px";
  host.style.bottom = "auto";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  fetch(chrome.runtime.getURL("styles.css"))
    .then((r) => r.text())
    .then((css) => {
      style.textContent = css;
    });
  shadow.appendChild(style);
  const container = document.createElement("div");
  container.className = "container";
  container.innerHTML = `
    <div class="header" tabindex="0" aria-label="Context Boundary Tracker">
      <div class="title">Context Boundary Tracker</div>
      <button id="cbt-refresh" class="icon-btn" aria-label="Refresh">⟳</button>
      <div class="drag-handle" aria-hidden="true">⋮⋮</div>
    </div>
    <div class="body">
      <div class="row">
        <div class="error" id="cbt-error" role="alert" aria-live="polite" style="display:none;color:#ff6b6b;font-size:12px;font-weight:600"></div>
      </div>
      <div class="row">
        <div class="label">Model</div>
        <div class="value" id="cbt-model-name"></div>
      </div>
      <div class="section">
        <div class="section-title">Context Window <span id="cbt-context-percent"></span></div>
        <div class="progress"><div id="cbt-progress-bar" class="progress-bar"></div></div>
        <div class="row">
          <div class="label">Tokens</div>
          <div class="value" id="cbt-context-tokens"></div>
        </div>
        <div class="row">
          <div class="label">Words</div>
          <div class="value" id="cbt-context-words"></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Last In Memory</div>
        <div class="preview" id="cbt-start-preview"></div>
        <div class="buttons">
          <button id="cbt-copy-start" class="btn" aria-label="Copy Start of Context">Copy</button>
          <button id="cbt-jump-start" class="btn" aria-label="Jump to Start of Context">Jump to Start</button>
        </div>
      </div>
    </div>
    <div class="modal" id="cbt-modal" aria-hidden="true" role="dialog" aria-modal="true">
      <div class="modal-content" tabindex="0">
        <div class="modal-header">
          <div class="modal-title" id="cbt-modal-title"></div>
          <button id="cbt-modal-close" class="btn" aria-label="Close">ESC</button>
        </div>
        <div class="modal-body" id="cbt-modal-body"></div>
      </div>
    </div>
  `;
  shadow.appendChild(container);
  document.documentElement.appendChild(host);
  state.hud = container;
  state.shadow = shadow;
  bindHud();
}

function injectPageStyles() {
  if (document.getElementById("cbt-page-styles")) return;
  const style = document.createElement("style");
  style.id = "cbt-page-styles";
  style.textContent =
    ".cbt-included{border-left:3px solid #12cf7f !important;} .cbt-omitted{border-left:3px solid #ff4d4f !important; opacity:0.7 !important;} .cbt-flash{animation:cbtFlash 0.4s ease;} @keyframes cbtFlash{0%{box-shadow:0 0 0 0 rgba(0,255,120,0.6);}100%{box-shadow:0 0 0 12px rgba(0,255,120,0);}}";
  document.documentElement.appendChild(style);
}

function bindHud() {
  const $ = (id) => state.shadow.getElementById(id);
  const add = (id, type, handler) => {
    const el = $(id);
    if (el) el.addEventListener(type, handler);
  };
  add("cbt-jump-start", "click", () => jumpTo("start"));
  add("cbt-refresh", "click", scheduleRecomputeImmediate);
  add("cbt-copy-start", "click", () => copySingle("start"));
  const modal = $("cbt-modal");
  const close = $("cbt-modal-close");
  if (close) close.addEventListener("click", hideModal);
  if (modal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal();
    });
  state.shadow.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideModal();
  });
  const header = state.hud.querySelector(".cbt-header");
  const host = state.shadow.host;
  header.addEventListener("mousedown", (e) => {
    state.drag.dragging = true;
    const rect = host.getBoundingClientRect();
    state.drag.offsetY = e.clientY - rect.top;
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!state.drag.dragging) return;
    const y = Math.max(
      0,
      Math.min(window.innerHeight - 40, e.clientY - state.drag.offsetY)
    );
    host.style.top = y + "px";
    host.style.right = "0px";
    host.style.left = "auto";
    host.style.bottom = "auto";
  });
  window.addEventListener("mouseup", async () => {
    if (!state.drag.dragging) return;
    state.drag.dragging = false;
    const rect = state.shadow.host.getBoundingClientRect();
    await chrome.storage.local.set({ cbt_position: { top: rect.top } });
  });
  const toggle = state.shadow.getElementById("cbt-toggle");
  if (toggle)
    toggle.addEventListener("click", async () => {
      const panel = state.hud;
      const collapsed = panel.classList.toggle("cbt-collapsed");
      toggle.textContent = collapsed ? "‹" : "›";
      await chrome.storage.local.set({ cbt_collapsed: collapsed });
    });
  state.shadow.addEventListener("keydown", (e) => {
    if (e.altKey && e.shiftKey && e.code === "KeyB") jumpTo("start");
  });
}

function restoreHudPosition(pos) {
  if (!pos) return;
  const host = state.shadow.host;
  host.style.top = pos.top + "px";
  host.style.right = "0px";
  host.style.left = "auto";
  host.style.bottom = "auto";
}

function setText(id, text) {
  const el = state.shadow.getElementById(id);
  if (el) el.textContent = text;
}

function setError(message) {
  if (!state.shadow) return;
  const el = state.shadow.getElementById("cbt-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.style.display = "block";
  } else {
    el.textContent = "";
    el.style.display = "none";
  }
}

function wordsApprox(tokens) {
  return Math.round(tokens * 0.75);
}

function debounce(fn, wait) {
  return function () {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(fn, wait);
  };
}

async function tokenizeBatch(texts) {
  function fallbackHeuristicCounts(list) {
    return list.map((t) => {
      const len = (t || "").length;
      const base = Math.ceil(len / 4);
      return base;
    });
  }
  try {
    const worker = createWorker();
    const profile = getProfile();
    const mode = profile.tokenizer_mode || "high_fidelity";
    const tokenizer = profile.tokenizer_type || "openai";
    const reqId = Math.random().toString(36).slice(2);
    const result = await Promise.race([
      new Promise((resolve) => {
        const handle = (e) => {
          if (
            !e.data ||
            e.data.type !== "cbt-tokenize-result" ||
            e.data.reqId !== reqId
          )
            return;
          worker.removeEventListener("message", handle);
          resolve(e.data.counts);
        };
        worker.addEventListener("message", handle);
        worker.postMessage({
          type: "cbt-tokenize",
          reqId,
          mode,
          tokenizer,
          texts,
        });
      }),
      new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (!result) {
      setError("Tokenizer timeout, using heuristic counts");
      return fallbackHeuristicCounts(texts);
    }
    setError("");
    return result;
  } catch (err) {
    setError("Tokenizer error, using heuristic counts");
    return fallbackHeuristicCounts(texts);
  }
}

function scheduleRecompute() {
  if (state.recomputeScheduled) return;
  state.recomputeScheduled = true;
  state.rafId = requestAnimationFrame(async () => {
    state.recomputeScheduled = false;
    await recompute();
  });
}

function scheduleRecomputeImmediate() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.recomputeScheduled = false;
  recompute();
}

function setupObserver() {
  if (state.domObserver) state.domObserver.disconnect();
  const obs = new MutationObserver(debounce(() => scheduleRecompute(), 150));
  obs.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  state.domObserver = obs;
  const inputs = document.querySelectorAll("textarea, [contenteditable]");
  inputs.forEach((inp) => {
    inp.addEventListener(
      "input",
      debounce(() => scheduleRecompute(), 150)
    );
  });
}

function getNodesWithTexts() {
  const raw = collectMessageNodes();
  const nodes = uniqueOrderedNodes(raw);
  const infos = [];
  nodes.forEach((n, idx) => {
    const text = normalizeNodeToText(n);
    if (!text) return;
    state.textCache.set(n, text);
    const existing = state.idCache.get(n);
    const id = existing || `${hashText(text)}_${idx}`;
    if (!existing) state.idCache.set(n, id);
    infos.push({ node: n, text, id });
  });
  return infos;
}

async function recompute() {
  ensureHud();
  const infoList = getNodesWithTexts();
  state.nodes = infoList.map((i) => i.node);
  state.nodeInfos = infoList;
  const textsToTokenize = [];
  const idsToTokenize = [];
  for (const info of infoList) {
    if (!state.countsCache.has(info.id)) {
      textsToTokenize.push(info.text);
      idsToTokenize.push(info.id);
    }
  }
  if (textsToTokenize.length > 0) {
    const counts = await tokenizeBatch(textsToTokenize);
    counts.forEach((c, i) => state.countsCache.set(idsToTokenize[i], c));
  }
  const countsOrdered = infoList.map((i) => state.countsCache.get(i.id) || 0);
  const profile = getProfile();
  let detectedModel = null;
  let detectedWindow = null;
  try {
    detectedModel = detectModelName();
    detectedWindow = modelWindowFor(detectedModel);
  } catch (e) {
    detectedModel = null;
    detectedWindow = null;
  }
  const contextWindow = Number(detectedWindow || profile.context_window);
  const overhead = Number(profile.overhead);
  const replyBudget = Number(profile.reply_budget);
  let budget = 0;
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) {
    setError("Context window unavailable; using 0 budget");
    budget = 0;
  } else {
    setError("");
    budget = Math.max(
      0,
      contextWindow -
        (Number.isFinite(overhead) ? overhead : 0) -
        (Number.isFinite(replyBudget) ? replyBudget : 0)
    );
  }
  let activeTokens = 0;
  let startIndex = infoList.length;
  for (let i = infoList.length - 1; i >= 0; i--) {
    const t = countsOrdered[i] || 0;
    if (activeTokens + t <= budget) {
      activeTokens += t;
      startIndex = i;
    } else {
      break;
    }
  }
  let startNode = null;
  let firstOmittedNode = null;
  if (startIndex < infoList.length) {
    startNode = infoList[startIndex].node;
    if (startIndex - 1 >= 0) firstOmittedNode = infoList[startIndex - 1].node;
  }
  state.startNode = startNode;
  state.firstOmittedNode = firstOmittedNode;
  updateHud(activeTokens, budget, contextWindow, detectedModel);
  if (state.highlightsOn) applyHighlights(startIndex);
}

function updateHud(activeTokens, budget, contextWindow, modelName) {
  const profile = getProfile();
  contextWindow = contextWindow || profile.context_window || 200000;
  const totalTokensK = Math.round((contextWindow / 1000) * 10) / 10;
  const activeTokensK = Math.round((activeTokens / 1000) * 10) / 10;
  const totalWordsK = Math.round((wordsApprox(contextWindow) / 1000) * 10) / 10;
  const activeWordsK = Math.round((wordsApprox(activeTokens) / 1000) * 10) / 10;
  setText("cbt-context-tokens", `${activeTokensK}k / ${totalTokensK}k`);
  setText("cbt-context-words", `${activeWordsK}k / ${totalWordsK}k`);
  setText("cbt-model-name", modelName || "auto");
  const startPreview = state.startNode
    ? (state.textCache.get(state.startNode) || "").slice(0, 240)
    : "";
  setText("cbt-start-preview", startPreview);
  const $ = (id) => state.shadow.getElementById(id);
  const progressBar = $("cbt-progress-bar");
  if (progressBar) {
    const percent =
      contextWindow > 0
        ? Math.min(100, Math.round((activeTokens / contextWindow) * 100))
        : 0;
    progressBar.style.width = percent + "%";
  }
  const percentLabel = $("cbt-context-percent");
  if (percentLabel) {
    const pct =
      contextWindow > 0
        ? Math.min(100, Math.round((activeTokens / contextWindow) * 100))
        : 0;
    percentLabel.textContent = pct + "%";
  }
}

function clearHighlights() {
  state.includedSet.forEach((n) => {
    n.classList.remove("cbt-included");
    n.style.transition = "";
  });
  state.omittedSet.forEach((n) => {
    n.classList.remove("cbt-omitted");
    n.style.transition = "";
  });
  state.includedSet.clear();
  state.omittedSet.clear();
}

function applyHighlights(startIndex) {
  clearHighlights();
  for (let i = 0; i < state.nodeInfos.length; i++) {
    const n = state.nodeInfos[i].node;
    if (i >= startIndex) {
      n.classList.add("cbt-included");
      state.includedSet.add(n);
    } else {
      n.classList.add("cbt-omitted");
      state.omittedSet.add(n);
    }
  }
}

function toggleHighlights() {
  state.highlightsOn = !state.highlightsOn;
  chrome.storage.local.set({ cbt_highlights: state.highlightsOn });
  if (!state.highlightsOn) {
    clearHighlights();
  } else {
    const startIdx = state.startNode
      ? state.nodeInfos.findIndex((i) => i.node === state.startNode)
      : state.nodeInfos.length;
    applyHighlights(startIdx);
  }
}

function flashNode(node) {
  if (!node) return;
  node.classList.add("cbt-flash");
  setTimeout(() => node.classList.remove("cbt-flash"), 400);
}

async function attemptLoadAround(node) {
  if (!node) return false;
  for (let i = 0; i < 3; i++) {
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise((r) => setTimeout(r, 300));
  }
  return true;
}

async function jumpTo(which) {
  const target = which === "start" ? state.startNode : state.firstOmittedNode;
  if (!target) return;
  if (!target.isConnected) {
    await attemptLoadAround(target);
    await recompute();
  }
  const el = which === "start" ? state.startNode : state.firstOmittedNode;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  flashNode(el);
}

function copyText(s) {
  return navigator.clipboard.writeText(s);
}

async function copyOmittedRange() {
  if (!state.nodeInfos.length) return;
  const startIdx = state.startNode
    ? state.nodeInfos.findIndex((i) => i.node === state.startNode)
    : state.nodeInfos.length;
  if (startIdx <= 0) return;
  const omitted = state.nodeInfos
    .slice(0, startIdx)
    .map((i) => state.textCache.get(i.node) || "");
  const text = omitted.join("\n\n");
  await copyText(text);
}

function expandPreview(which) {
  const modal = state.shadow.getElementById("cbt-modal");
  const title = state.shadow.getElementById("cbt-modal-title");
  const body = state.shadow.getElementById("cbt-modal-body");
  const isStart = which === "start";
  const node = isStart ? state.startNode : state.firstOmittedNode;
  const txt = node ? state.textCache.get(node) || "" : "";
  title.textContent = isStart ? "Start of Context" : "First Omitted";
  body.textContent = txt;
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
  const focusable = modal.querySelector(".cbt-modal-content");
  focusable.focus();
}

function hideModal() {
  const modal = state.shadow.getElementById("cbt-modal");
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
}

async function copySingle(which) {
  const isStart = which === "start";
  const node = isStart ? state.startNode : state.firstOmittedNode;
  const txt = node ? state.textCache.get(node) || "" : "";
  if (!txt) return;
  await copyText(txt);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "cbt-command") return;
  if (msg.command === "jump_to_start") jumpTo("start");
  if (msg.command === "jump_to_first_omitted") jumpTo("omitted");
  if (msg.command === "toggle_highlights") toggleHighlights();
  if (msg.command === "toggle_panel") {
    if (!state.shadow || !state.hud) return;
    const panel = state.hud;
    const isHidden = panel.style.display === "none";
    if (isHidden) {
      panel.style.display = "";
      scheduleRecomputeImmediate();
    } else {
      panel.style.display = "none";
    }
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.cbt_settings) {
    loadSettings().then(() => scheduleRecomputeImmediate());
  }
});

(async function init() {
  const pos = await loadSettings();
  ensureHud();
  injectPageStyles();
  if (pos) restoreHudPosition(pos);
  state.hud.style.display = "none";
  setupObserver();
  scheduleRecomputeImmediate();
})();
