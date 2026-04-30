// utils.js — Shared helpers (sanitize, debounce, media queries)

/**
 * Escapes HTML special characters to prevent XSS when rendering
 * user-provided or JSON-sourced text into the DOM.
 * @param {string} text - The raw text to sanitize
 * @returns {string} The escaped text safe for innerHTML insertion
 */
export function sanitizeHTML(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Truncates text to a maximum number of characters, appending an
 * ellipsis character (…) when the text exceeds the limit.
 * @param {string} text - The text to truncate
 * @param {number} max - Maximum character count before truncation
 * @returns {string} The original or truncated text
 */
export function truncate(text, max) {
  if (typeof text !== 'string') return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + '\u2026';
}

/**
 * Standard debounce — delays calling fn until ms milliseconds have
 * passed since the last invocation.
 * @param {Function} fn - The function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function} The debounced wrapper function
 */
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Returns true if the user has enabled the "prefers reduced motion"
 * OS-level accessibility setting.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
