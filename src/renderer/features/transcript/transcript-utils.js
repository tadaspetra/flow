/**
 * Transcript cleanup and token helpers for the renderer.
 */

/**
 * Normalizes transcript text by collapsing whitespace and trimming.
 * @param {unknown} value - Raw transcript value
 * @returns {string}
 */
export function normalizeTranscriptText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Strips non-speech annotations (brackets, parens) from transcript text.
 * @param {string} text - Raw transcript text
 * @returns {string}
 */
export function stripNonSpeechAnnotations(text) {
  return String(text || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*$/g, ' ')
    .replace(/\([^)]*$/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts spoken word tokens from Scribe token array, excluding annotations.
 * @param {Array<{text?: string, type?: string}>} tokens - Raw tokens from Scribe
 * @returns {Array<{text: string, start?: number, end?: number}>}
 */
export function extractSpokenWordTokens(tokens) {
  const spoken = [];
  let parenDepth = 0;
  let bracketDepth = 0;

  for (const token of Array.isArray(tokens) ? tokens : []) {
    const rawText = typeof token?.text === 'string' ? token.text : '';
    const text = rawText.trim();
    if (!text) continue;

    const isInsideAnnotation =
      parenDepth > 0 ||
      bracketDepth > 0 ||
      /[()[\]]/.test(rawText);

    if (token.type === 'word' && !isInsideAnnotation) {
      spoken.push(token);
    }

    const openParens = (rawText.match(/\(/g) || []).length;
    const closeParens = (rawText.match(/\)/g) || []).length;
    const openBrackets = (rawText.match(/\[/g) || []).length;
    const closeBrackets = (rawText.match(/\]/g) || []).length;

    parenDepth = Math.max(0, parenDepth + openParens - closeParens);
    bracketDepth = Math.max(0, bracketDepth + openBrackets - closeBrackets);
  }

  return spoken;
}
