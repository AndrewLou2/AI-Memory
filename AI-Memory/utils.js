/**
 * Generates a short base-36 hash for the given text.
 */
export function computeTextHash(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}
/**
 * Converts a token count into an approximate word count.
 */
export function wordsApproximation(tokens) {
  return Math.round(tokens * 0.75);
}
/**
 * Creates a  function that delays invoking `fn` until after `waitMs` have
 */
export function debounceFactory(fn, waitMs, stateRef) {
  return function () {
    clearTimeout(stateRef.debounceTimer);
    stateRef.debounceTimer = setTimeout(fn, waitMs);
  };
}
/**
 * Extracts normalized text content from a DOM node, removing interactive/media elements
 * and condensing whitespace while preserving code block text.
 */
export function normalizeMessageNodeToText(node) {
  const clone = node.cloneNode(true);
  const toRemove = clone.querySelectorAll(
    'button, input, textarea, svg, img, video, audio, [role="button"], [contenteditable]'
  );
  toRemove.forEach((n) => n.remove());
  const codeBlocks = Array.from(clone.querySelectorAll("pre, code, pre code"));
  codeBlocks.forEach((codeBlock) => {
    codeBlock.textContent = codeBlock.textContent;
  });
  const text = clone.innerText || clone.textContent || "";
  return text
    .replace(/\u00A0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
/**
 * Returns nodes in document order with duplicates removed.
 * @param {Array<Node>} nodes - List of DOM nodes.
 * @returns {Array<Node>} Sorted and de-duplicated nodes.
 */
export function uniqueOrderedNodes(nodes) {
  const filtered = nodes.filter(Boolean);
  filtered.sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  );
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
/**
 * Filters out nodes that are contained within any other node in the list.
 * @param {Array<Node>} nodes - List of DOM nodes.
 * @returns {Array<Node>} Nodes that are not descendants of any other in the list.
 */
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
