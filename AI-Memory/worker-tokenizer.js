import { openaiCount } from "./tokenizer-openai.js";
import { heuristicCount } from "./heuristics.js";

self.onmessage = async (e) => {
  const data = e.data || {};
  if (data.type !== "cbt-tokenize") return;
  const mode = data.mode === "heuristic" ? "heuristic" : "high_fidelity";
  const texts = Array.isArray(data.texts) ? data.texts : [];
  const counts = [];
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i] || "";
    let c = 0;
    if (mode === "heuristic") {
      c = heuristicCount(t);
    } else {
      c = openaiCount(t);
    }
    counts.push(c);
  }
  self.postMessage({ type: "cbt-tokenize-result", reqId: data.reqId, counts });
};
