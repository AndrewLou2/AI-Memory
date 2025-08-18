export function openaiCount(text) {
  if (!text) return 0;
  const lengthChars = text.length;
  let approx = Math.ceil(lengthChars / 4);
  const newlines = (text.match(/\n/g) || []).length;
  const punctuation = (text.match(/[.,;:!?]/g) || []).length;
  const codeSymbols = (text.match(/[`{}()[\]<>_=*#:\-]/g) || []).length;
  approx = approx - Math.floor(newlines / 3) - Math.floor(punctuation / 10) + Math.floor(codeSymbols / 20);
  if (approx < 0) approx = 0;
  return approx;
}

