export function heuristicCount(text) {
  if (!text) return 0;
  const len = text.length;
  const base = Math.ceil(len / 4);
  const nl = (text.match(/\n/g) || []).length;
  const punct = (text.match(/[.,;:!?]/g) || []).length;
  const bonus = Math.floor(nl / 2) + Math.floor(punct / 6);
  return Math.max(0, base - bonus);
}
