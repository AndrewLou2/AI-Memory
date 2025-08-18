export function computeTextHash(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}
export function wordsApproximation(tokens) {
  return Math.round(tokens * 0.75);
}
export function debounceFactory(fn, waitMs, stateRef) {
  return function() {
    clearTimeout(stateRef.debounceTimer);
    stateRef.debounceTimer = setTimeout(fn, waitMs);
  };
}
export function normalizeMessageNodeToText(node) {
  const clone = node.cloneNode(true);
  const toRemove = clone.querySelectorAll("button, input, textarea, svg, img, video, audio, [role=\"button\"], [contenteditable]");
  toRemove.forEach(n => n.remove());
  const codeBlocks = Array.from(clone.querySelectorAll("pre, code, pre code"));
  codeBlocks.forEach(codeBlock => {
    codeBlock.textContent = codeBlock.textContent;
  });
  const text = clone.innerText || clone.textContent || "";
  return text.replace(/\u00A0/g, " ").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
export function uniqueOrderedNodes(nodes) {
  const filtered = nodes.filter(Boolean);
  filtered.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  const deduped = [];
  const seenSet = new Set();
  for (const node of filtered) {
    if (!seenSet.has(node)) {
      seenSet.add(node);
      deduped.push(node);
    }
  }
  return deduped;
}
export function pruneNestedNodes(nodes) {
  const result = [];
  for (const candidate of nodes) {
    let contained = false;
    for (const other of nodes) {
      if (other !== candidate && other.contains(candidate)) {
        contained = true;
        break;
      }
    }
    if (!contained) result.push(candidate);
  }
  return result;
}

