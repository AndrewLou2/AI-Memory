import { DEFAULT_SETTINGS } from "./constants.js";
const els = {
  site: document.getElementById("site"),
  tokenizer_type: document.getElementById("tokenizer_type"),
  tokenizer_mode: document.getElementById("tokenizer_mode"),
  context_window: document.getElementById("context_window"),
  overhead: document.getElementById("overhead"),
  reply_budget: document.getElementById("reply_budget"),
  custom_selectors: document.getElementById("custom_selectors"),
  save: document.getElementById("save"),
  reset: document.getElementById("reset"),
  test_text: document.getElementById("test_text"),
  test_count: document.getElementById("test_count"),
  test_messages: document.getElementById("test_messages"),
  counts: document.getElementById("counts"),
  boundary: document.getElementById("boundary")
};
let settings = null;
let worker = null;
function createWorker() {
  if (worker) return worker;
  worker = new Worker(chrome.runtime.getURL("worker-tokenizer.js"), { type: "module" });
  return worker;
}
async function loadSettings() {
  const data = await chrome.storage.local.get(["cbt_settings"]);
  settings = Object.assign({}, DEFAULT_SETTINGS, data.cbt_settings || {});
  const s = settings["chatgpt.com"] || {};
  s.context_window = Number(s.context_window);
  s.overhead = Number(s.overhead);
  s.reply_budget = Number(s.reply_budget);
  if (!Number.isFinite(s.context_window) || s.context_window <= 0) s.context_window = 200000;
  if (!Number.isFinite(s.overhead) || s.overhead < 0) s.overhead = 2000;
  if (!Number.isFinite(s.reply_budget) || s.reply_budget < 0) s.reply_budget = 1500;
  s.tokenizer_type = "openai";
  if (s.tokenizer_mode !== "high_fidelity" && s.tokenizer_mode !== "heuristic") s.tokenizer_mode = "high_fidelity";
  settings["chatgpt.com"] = s;
}
function fillForm() {
  const s = settings["chatgpt.com"];
  els.tokenizer_type.value = s.tokenizer_type;
  els.tokenizer_mode.value = s.tokenizer_mode;
  els.context_window.value = s.context_window;
  els.overhead.value = s.overhead;
  els.reply_budget.value = s.reply_budget;
  els.custom_selectors.value = s.custom_selectors;
}
async function save() {
  const newS = {
    tokenizer_type: els.tokenizer_type.value,
    tokenizer_mode: els.tokenizer_mode.value,
    context_window: parseInt(els.context_window.value, 10),
    overhead: parseInt(els.overhead.value, 10),
    reply_budget: parseInt(els.reply_budget.value, 10),
    custom_selectors: els.custom_selectors.value
  };
  if (!Number.isFinite(newS.context_window) || newS.context_window <= 0) newS.context_window = 200000;
  if (!Number.isFinite(newS.overhead) || newS.overhead < 0) newS.overhead = 2000;
  if (!Number.isFinite(newS.reply_budget) || newS.reply_budget < 0) newS.reply_budget = 1500;
  if (newS.tokenizer_mode !== "high_fidelity" && newS.tokenizer_mode !== "heuristic") newS.tokenizer_mode = "high_fidelity";
  newS.tokenizer_type = "openai";
  settings["chatgpt.com"] = newS;
  await chrome.storage.local.set({ cbt_settings: settings });
}
async function reset() {
  settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  await chrome.storage.local.set({ cbt_settings: settings });
  fillForm();
}
function wordsApprox(tokens) {
  return Math.round(tokens * 0.75);
}
function tokenizeLocal(text, tokenizer, mode) {
  const w = createWorker();
  const reqId = Math.random().toString(36).slice(2);
  return new Promise(resolve => {
    const onMsg = e => {
      if (!e.data || e.data.type !== "cbt-tokenize-result" || e.data.reqId !== reqId) return;
      w.removeEventListener("message", onMsg);
      resolve(e.data.counts[0] || 0);
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ type: "cbt-tokenize", reqId, tokenizer, mode, texts: [text] });
  });
}
els.site.addEventListener("change", fillForm);
els.save.addEventListener("click", save);
els.reset.addEventListener("click", reset);
els.test_count.addEventListener("click", async () => {
  const s = settings["chatgpt.com"];
  const text = els.test_text.value || "";
  const hf = await tokenizeLocal(text, s.tokenizer_type, "high_fidelity");
  const he = await tokenizeLocal(text, s.tokenizer_type, "heuristic");
  els.counts.textContent = `high_fidelity: ${hf} tokens (~${wordsApprox(hf)} words)\nheuristic: ${he} tokens (~${wordsApprox(he)} words)`;
});
els.test_messages.addEventListener("click", async () => {
  const s = settings["chatgpt.com"];
  const budget = Math.max(0, s.context_window - s.overhead - s.reply_budget);
  const lines = (els.test_text.value || "").split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
  const w = createWorker();
  const reqId = Math.random().toString(36).slice(2);
  const texts = lines.slice();
  const counts = await new Promise(resolve => {
    const onMsg = e => {
      if (!e.data || e.data.type !== "cbt-tokenize-result" || e.data.reqId !== reqId) return;
      w.removeEventListener("message", onMsg);
      resolve(e.data.counts);
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ type: "cbt-tokenize", reqId, tokenizer: s.tokenizer_type, mode: s.tokenizer_mode, texts });
  });
  let active = 0;
  let startIdx = counts.length;
  for (let i = counts.length - 1; i >= 0; i--) {
    const c = counts[i] || 0;
    if (active + c <= budget) {
      active += c;
      startIdx = i;
    } else {
      break;
    }
  }
  const kept = lines.slice(startIdx).map((t, i) => `✓ ${t.slice(0, 80)}`).join("\n");
  const omitted = lines.slice(0, startIdx).map(t => `× ${t.slice(0, 80)}`).join("\n");
  els.boundary.textContent = `budget: ${budget}\nactive tokens: ${active}\nStart of Context index: ${startIdx}\n\nKept:\n${kept}\n\nOmitted:\n${omitted}`;
});
(async function init() {
  await loadSettings();
  fillForm();
})();

