// neon-logo.js — Letter flicker animation for the neon logo

import { prefersReducedMotion } from './utils.js';

/**
 * Full neon text-shadow glow (matches the CSS .neon-logo rule).
 * Applied to each letter span at full brightness.
 */
const FULL_GLOW =
  '0 0 4px #f5d862,' +
  ' 0 0 8px #f5c842,' +
  ' 0 0 16px #e8a020,' +
  ' 0 0 32px #e8841e,' +
  ' 0 0 48px rgba(232, 132, 30, 0.8),' +
  ' 0 0 72px rgba(192, 48, 30, 0.7),' +
  ' 0 0 100px rgba(192, 48, 30, 0.5),' +
  ' 0 0 140px rgba(180, 40, 25, 0.4)';

/**
 * Dimmed text-shadow used during a flicker dip.
 * Reduces the glow radii to simulate a tube losing power briefly.
 */
const DIM_GLOW =
  '0 0 2px #f5c842,' +
  ' 0 0 4px #e8a020,' +
  ' 0 0 8px rgba(232, 132, 30, 0.4)';

/** Minimum flicker chance per frame per letter (fraction). */
const FLICKER_CHANCE_MIN = 0.001;
/** Maximum flicker chance per frame per letter (fraction). */
const FLICKER_CHANCE_MAX = 0.005;
/** Minimum flicker dip duration in ms. */
const FLICKER_DURATION_MIN = 100;
/** Maximum flicker dip duration in ms. */
const FLICKER_DURATION_MAX = 300;
/** Minimum opacity during a flicker dip. */
const FLICKER_OPACITY_MIN = 0.3;
/** Maximum opacity during a flicker dip. */
const FLICKER_OPACITY_MAX = 0.7;

/**
 * Per-letter state used by the flicker loop.
 * @typedef {Object} LetterState
 * @property {HTMLSpanElement} el   - The <span> wrapping this letter
 * @property {boolean} isSpace      - True if the character is a space (never flickers)
 * @property {boolean} flickering   - Whether the letter is currently in a flicker dip
 * @property {number}  flickerEnd   - Timestamp (ms) when the current dip should end
 */

/** @type {LetterState[]} */
let letters = [];

/** @type {number|null} requestAnimationFrame ID */
let rafId = null;

/** @type {MediaQueryList|null} */
let motionQuery = null;

/** Bound handler reference so we can add/remove the listener cleanly. */
let motionChangeHandler = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a random number between min (inclusive) and max (exclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the neon logo flicker system.
 *
 * Takes the <h1 class="neon-logo"> element, splits its text into individual
 * <span> elements (one per character), and — unless the user prefers reduced
 * motion — starts the flicker animation.
 *
 * @param {HTMLElement} headingEl - The h1.neon-logo element
 */
function init(headingEl) {
  if (!headingEl) return;

  const text = headingEl.textContent || '';

  // Clear existing content and rebuild as individual spans
  headingEl.innerHTML = '';
  letters = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const span = document.createElement('span');
    const isSpace = ch === ' ';

    if (isSpace) {
      span.innerHTML = '&nbsp;';
    } else {
      span.textContent = ch;
    }

    // Composite-friendly hint — only opacity will be animated
    span.style.willChange = 'opacity';
    span.style.display = 'inline-block';

    headingEl.appendChild(span);

    letters.push({
      el: span,
      isSpace,
      flickering: false,
      flickerEnd: 0,
    });
  }

  // Listen for live changes to the reduced-motion preference
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionChangeHandler = handleMotionChange;
    // Use addEventListener where available (modern browsers), fall back to
    // the deprecated addListener for older Safari.
    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', motionChangeHandler);
    } else if (typeof motionQuery.addListener === 'function') {
      motionQuery.addListener(motionChangeHandler);
    }
  }

  // Start or stay static based on current preference
  if (prefersReducedMotion()) {
    stopFlicker();
  } else {
    startFlicker();
  }
}

/**
 * Respond to live changes of the prefers-reduced-motion media query.
 * @param {MediaQueryListEvent} e
 */
function handleMotionChange(e) {
  if (e.matches) {
    stopFlicker();
  } else {
    startFlicker();
  }
}

/**
 * Start the flicker animation loop.
 *
 * Uses a single requestAnimationFrame loop that iterates over every letter
 * span. On each frame each non-space letter has a small random chance of
 * entering a "flicker dip" — a brief reduction in opacity and glow. The dip
 * lasts a random duration (50-150 ms) before the letter snaps back to full
 * brightness. Because each letter rolls independently the effect looks
 * organic and non-uniform.
 */
function startFlicker() {
  // Avoid duplicate loops
  if (rafId !== null) return;

  function tick(now) {
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      if (letter.isSpace) continue;

      if (letter.flickering) {
        // Check if the dip duration has elapsed
        if (now >= letter.flickerEnd) {
          // Restore full brightness
          letter.el.style.opacity = '1';
          letter.el.style.textShadow = FULL_GLOW;
          letter.flickering = false;
        }
      } else {
        // Roll the dice — small chance to start a new dip
        if (Math.random() < rand(FLICKER_CHANCE_MIN, FLICKER_CHANCE_MAX)) {
          const dip = rand(FLICKER_OPACITY_MIN, FLICKER_OPACITY_MAX);
          letter.el.style.opacity = String(dip);
          letter.el.style.textShadow = DIM_GLOW;
          letter.flickering = true;
          letter.flickerEnd = now + rand(FLICKER_DURATION_MIN, FLICKER_DURATION_MAX);
        }
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
}

/**
 * Stop the flicker animation and reset every letter to full static glow.
 *
 * Called when the user enables prefers-reduced-motion, or for cleanup.
 */
function stopFlicker() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Reset all letters to full brightness / normal glow
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    letter.el.style.opacity = '1';
    letter.el.style.textShadow = FULL_GLOW;
    letter.flickering = false;
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const neonLogo = { init, startFlicker, stopFlicker };
export default neonLogo;
export { init, startFlicker, stopFlicker };
