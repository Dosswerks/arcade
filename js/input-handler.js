// input-handler.js — Pointer events, keyboard, and swipe gesture detection

/** @type {HTMLElement|null} */
let carouselEl = null;

/** @type {Function|null} */
let swipeCallback = null;

/** @type {Function|null} */
let selectCallback = null;

// ── Tracking state ────────────────────────────────────────────────

/** @type {boolean} */
let isTracking = false;

/** @type {boolean} */
let isLockedHorizontal = false;

/** @type {number} */
let startX = 0;

/** @type {number} */
let startY = 0;

/** @type {number} */
let startTime = 0;

// ── Bound listener references (for cleanup) ──────────────────────

/** @type {Function|null} */
let boundPointerDown = null;

/** @type {Function|null} */
let boundPointerMove = null;

/** @type {Function|null} */
let boundPointerUp = null;

/** @type {Function|null} */
let boundPointerCancel = null;

/** @type {Function|null} */
let boundKeyDown = null;

// ── Swipe threshold ──────────────────────────────────────────────

const SWIPE_THRESHOLD = 30;
const TAP_THRESHOLD = 10;

// ── Event handlers ───────────────────────────────────────────────

/**
 * Handles pointerdown — records start position and captures pointer.
 * @param {PointerEvent} e
 */
function handlePointerDown(e) {
  // Don't intercept clicks on nav buttons or play buttons
  if (e.target.closest('.carousel-btn')) return;
  if (e.target.closest('.card-play-btn')) return;

  startX = e.clientX;
  startY = e.clientY;
  startTime = Date.now();
  isTracking = true;
  isLockedHorizontal = false;

  // Capture pointer to ensure gesture completes even if pointer leaves element
  if (carouselEl && carouselEl.setPointerCapture) {
    carouselEl.setPointerCapture(e.pointerId);
  }
}

/**
 * Handles pointermove — detects horizontal lock and prevents vertical scroll.
 * @param {PointerEvent} e
 */
function handlePointerMove(e) {
  if (!isTracking) return;

  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  // Check if we should lock to horizontal
  if (!isLockedHorizontal && absDeltaX > SWIPE_THRESHOLD && absDeltaX > absDeltaY) {
    isLockedHorizontal = true;
    // Temporarily prevent vertical scroll by overriding touch-action
    if (carouselEl) {
      carouselEl.style.touchAction = 'none';
    }
    e.preventDefault();
  }

  // Continue preventing default while locked horizontal
  if (isLockedHorizontal) {
    e.preventDefault();
  }
}

/**
 * Handles pointerup — determines swipe direction or tap/click.
 * @param {PointerEvent} e
 */
function handlePointerUp(e) {
  if (!isTracking) return;

  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;
  const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (isLockedHorizontal) {
    // Horizontal swipe detected — fire swipe callback
    if (swipeCallback) {
      if (deltaX < 0) {
        swipeCallback('left'); // swiped left = next
      } else {
        swipeCallback('right'); // swiped right = prev
      }
    }
  } else if (totalMovement < TAP_THRESHOLD) {
    // Minimal movement — treat as tap/click
    if (selectCallback) {
      selectCallback(e.target);
    }
  }

  // Reset state
  isTracking = false;
  isLockedHorizontal = false;

  // Restore touch-action
  if (carouselEl) {
    carouselEl.style.touchAction = 'pan-y';
  }

  // Release pointer capture
  if (carouselEl && carouselEl.releasePointerCapture) {
    try {
      carouselEl.releasePointerCapture(e.pointerId);
    } catch (_) {
      // Pointer may already be released
    }
  }
}

/**
 * Handles pointercancel — resets all tracking state.
 * @param {PointerEvent} e
 */
function handlePointerCancel(e) {
  isTracking = false;
  isLockedHorizontal = false;

  // Restore touch-action
  if (carouselEl) {
    carouselEl.style.touchAction = 'pan-y';
  }

  // Release pointer capture
  if (carouselEl && carouselEl.releasePointerCapture) {
    try {
      carouselEl.releasePointerCapture(e.pointerId);
    } catch (_) {
      // Pointer may already be released
    }
  }
}

/**
 * Handles keydown — arrow keys navigate carousel.
 * @param {KeyboardEvent} e
 */
function handleKeyDown(e) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (swipeCallback) {
      swipeCallback('right'); // left arrow = prev
    }
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (swipeCallback) {
      swipeCallback('left'); // right arrow = next
    }
  }
}

// ── Public API ────────────────────────────────────────────────────

const inputHandler = {
  /**
   * Initializes input handling on the carousel element.
   * @param {HTMLElement} el - The carousel container element
   */
  init(el) {
    carouselEl = el;

    // Set touch-action for default vertical scroll behavior
    carouselEl.style.touchAction = 'pan-y';

    // Create bound references for cleanup
    boundPointerDown = handlePointerDown;
    boundPointerMove = handlePointerMove;
    boundPointerUp = handlePointerUp;
    boundPointerCancel = handlePointerCancel;
    boundKeyDown = handleKeyDown;

    // Add pointer event listeners
    carouselEl.addEventListener('pointerdown', boundPointerDown);
    carouselEl.addEventListener('pointermove', boundPointerMove);
    carouselEl.addEventListener('pointerup', boundPointerUp);
    carouselEl.addEventListener('pointercancel', boundPointerCancel);

    // Add keyboard listener — on both carousel and document for global arrow key support
    carouselEl.addEventListener('keydown', boundKeyDown);
    document.addEventListener('keydown', boundKeyDown);
  },

  /**
   * Registers a callback for swipe gestures.
   * @param {Function} callback - Called with 'left' or 'right'
   */
  onSwipe(callback) {
    swipeCallback = callback;
  },

  /**
   * Registers a callback for tap/click selection.
   * @param {Function} callback - Called with the target HTMLElement
   */
  onSelect(callback) {
    selectCallback = callback;
  },

  /**
   * Removes all event listeners and nulls references.
   */
  destroy() {
    if (carouselEl) {
      if (boundPointerDown) carouselEl.removeEventListener('pointerdown', boundPointerDown);
      if (boundPointerMove) carouselEl.removeEventListener('pointermove', boundPointerMove);
      if (boundPointerUp) carouselEl.removeEventListener('pointerup', boundPointerUp);
      if (boundPointerCancel) carouselEl.removeEventListener('pointercancel', boundPointerCancel);
      if (boundKeyDown) {
        carouselEl.removeEventListener('keydown', boundKeyDown);
        document.removeEventListener('keydown', boundKeyDown);
      }
    }

    carouselEl = null;
    swipeCallback = null;
    selectCallback = null;
    isTracking = false;
    isLockedHorizontal = false;
    startX = 0;
    startY = 0;
    startTime = 0;
    boundPointerDown = null;
    boundPointerMove = null;
    boundPointerUp = null;
    boundPointerCancel = null;
    boundKeyDown = null;
  }
};

export default inputHandler;
