// analytics.js — Plausible event wrapper (no-op if blocked)
// Thin wrapper around Plausible's window.plausible() function.
// All functions gracefully no-op if Plausible script is blocked or unavailable.

/**
 * Fire a custom event via Plausible analytics.
 * No-ops silently if window.plausible is not available.
 * @param {string} name - Event name
 * @param {Object} [props] - Event properties
 */
function trackEvent(name, props) {
  if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
    window.plausible(name, { props });
  }
}

/**
 * Track a PLAY button click event.
 * @param {{ title: string, slug: string }} game - The game data object
 */
export function trackPlay(game) {
  trackEvent('Play', { title: game.title, slug: game.slug });
}

/**
 * Track a detail modal open event.
 * @param {{ title: string, slug: string }} game - The game data object
 */
export function trackDetailOpen(game) {
  trackEvent('Detail Open', { title: game.title, slug: game.slug });
}

/**
 * Track an error event for telemetry.
 * @param {string} category - Error category (e.g., "image_load_fail", "video_load_fail")
 * @param {string} detail - Error detail (e.g., game slug or URL)
 */
export function trackError(category, detail) {
  trackEvent('Error', { category, detail });
}
