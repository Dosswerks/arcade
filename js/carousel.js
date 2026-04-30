// carousel.js — Carousel engine (positioning, transitions, idle mode)

import { createCard, updateCardMedia } from './card-renderer.js';
import { prefersReducedMotion, debounce } from './utils.js';

/** @type {Object[]} */
let games = [];
/** @type {number} */
let currentIndex = 0;
/** @type {boolean} */
let isIdle = false;
/** @type {number|null} */
let idleTimer = null;
/** @type {number|null} */
let idleInterval = null;
/** @type {boolean} */
let isAnimating = false;
/** @type {Function[]} */
let cardChangeCallbacks = [];
/** @type {HTMLElement|null} */
let containerEl = null;
/** @type {HTMLElement|null} */
let trackEl = null;
/** @type {HTMLElement|null} */
let prevBtn = null;
/** @type {HTMLElement|null} */
let nextBtn = null;
/** @type {HTMLElement|null} */
let announceEl = null;
/** @type {Function|null} */
let resizeHandler = null;

// ── Internal helpers ──────────────────────────────────────────────

/**
 * Returns the pixel width of a single card element.
 * Falls back to the CSS custom property value if no cards exist yet.
 * @returns {number}
 */
function getCardWidth() {
  const firstCard = trackEl?.querySelector('.game-card');
  if (firstCard) return firstCard.offsetWidth;
  return 260; // fallback to mobile default
}

/**
 * Returns the gap between cards in pixels by reading the computed
 * CSS gap property on the track element.
 * @returns {number}
 */
function getCardGap() {
  if (!trackEl) return 24; // 1.5rem fallback
  const computed = getComputedStyle(trackEl).gap;
  return parseFloat(computed) || 24;
}

/**
 * Calculates the translateX offset to center the active card.
 * offset = -(currentIndex * (cardWidth + gap)) + (viewportWidth / 2) - (cardWidth / 2)
 * @returns {number}
 */
function calculateOffset() {
  const cardWidth = getCardWidth();
  const gap = getCardGap();
  const viewportWidth = containerEl ? containerEl.offsetWidth : window.innerWidth;
  return -(currentIndex * (cardWidth + gap)) + (viewportWidth / 2) - (cardWidth / 2);
}

/**
 * Positions the carousel track so the active card is centered.
 * @param {boolean} [animate=true] - Whether to use CSS transition
 */
function positionTrack(animate = true) {
  if (!trackEl) return;
  const offset = calculateOffset();

  if (!animate) {
    trackEl.style.transition = 'none';
  } else {
    trackEl.style.transition = '';
  }

  trackEl.style.transform = `translateX(${offset}px)`;

  // Force reflow when disabling transition so the browser applies it immediately
  if (!animate) {
    // eslint-disable-next-line no-unused-expressions
    trackEl.offsetHeight;
    trackEl.style.transition = '';
  }
}

/**
 * Updates media loading state for all cards based on proximity to active card.
 * Active card ± 2 neighbors get media loaded; distant cards can be unloaded.
 */
function updateMediaWindow() {
  const cards = trackEl?.querySelectorAll('.game-card');
  if (!cards) return;

  cards.forEach((card, i) => {
    const isActive = i === currentIndex;
    const isNearby = Math.abs(i - currentIndex) <= 2;
    updateCardMedia(card, isActive, isNearby);
  });
}

/**
 * Updates the active class on cards — removes from old, adds to new.
 * @param {number} oldIndex
 * @param {number} newIndex
 */
function updateActiveCard(oldIndex, newIndex) {
  const cards = trackEl?.querySelectorAll('.game-card');
  if (!cards) return;

  if (cards[oldIndex]) {
    cards[oldIndex].classList.remove('active');
  }
  if (cards[newIndex]) {
    cards[newIndex].classList.add('active');
  }
}

/**
 * Announces the current carousel position to screen readers.
 */
function announcePosition() {
  if (!announceEl) return;
  announceEl.textContent = `Game ${currentIndex + 1} of ${games.length}`;
}

/**
 * Updates the game count display in the footer.
 */
function updateGameCount() {
  const countEl = document.querySelector('.game-count__number');
  if (countEl) {
    countEl.textContent = String(games.length);
  }
}

/**
 * Updates the URL hash to reflect the current game slug.
 */
function updateUrlHash() {
  if (games[currentIndex] && games[currentIndex].slug) {
    history.replaceState(null, '', '#' + games[currentIndex].slug);
  }
}

/**
 * Saves the current index to sessionStorage.
 */
function saveIndex() {
  try {
    sessionStorage.setItem('dosswerks-carousel-index', String(currentIndex));
  } catch (_) {
    // sessionStorage may be unavailable in some contexts
  }
}

/**
 * Fires all registered card-change callbacks.
 */
function fireCallbacks() {
  const game = games[currentIndex];
  cardChangeCallbacks.forEach(cb => {
    try {
      cb(currentIndex, game);
    } catch (_) {
      // Don't let a bad callback break the carousel
    }
  });
}

/**
 * Resets the idle timer. If idle mode was active, exits it first.
 * Starts a new 5-second timeout that calls enterIdleMode().
 */
function resetIdleTimer() {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  if (isIdle) {
    carousel.exitIdleMode();
  }

  // Don't start idle timer if reduced motion, single game, or no games
  if (prefersReducedMotion() || games.length <= 1) return;

  idleTimer = setTimeout(() => {
    carousel.enterIdleMode();
  }, 5000);
}

/**
 * Resolves the initial card index from sessionStorage or URL hash.
 * @returns {number}
 */
function resolveInitialIndex() {
  // URL hash takes priority
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const hashIndex = games.findIndex(g => g.slug === hash);
    if (hashIndex !== -1) return hashIndex;
  }

  // Fall back to sessionStorage
  try {
    const stored = sessionStorage.getItem('dosswerks-carousel-index');
    if (stored !== null) {
      const idx = parseInt(stored, 10);
      if (!isNaN(idx) && idx >= 0 && idx < games.length) return idx;
    }
  } catch (_) {
    // sessionStorage unavailable
  }

  return 0;
}

/**
 * Updates nav button visibility. Hides arrows for single-game carousels.
 */
function updateNavVisibility() {
  if (!prevBtn || !nextBtn) return;

  if (games.length <= 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
  } else {
    prevBtn.style.display = '';
    nextBtn.style.display = '';
  }
}

/**
 * Click handler for the previous button.
 */
function onPrevClick() {
  carousel.prev();
  resetIdleTimer();
}

/**
 * Click handler for the next button.
 */
function onNextClick() {
  carousel.next();
  resetIdleTimer();
}

// ── Public API ────────────────────────────────────────────────────

const carousel = {
  /**
   * Initializes the carousel with game data and a container element.
   * @param {Object[]} gameList - Array of game data objects (filtered, sorted)
   * @param {HTMLElement} container - The carousel section element
   */
  init(gameList, container) {
    games = gameList;
    containerEl = container;
    trackEl = container.querySelector('.carousel-track');
    announceEl = container.querySelector('.sr-announcements');
    prevBtn = container.querySelector('.carousel-btn--prev');
    nextBtn = container.querySelector('.carousel-btn--next');

    if (!trackEl) return;

    // Don't render anything if 0 games (handled by app.js)
    if (games.length === 0) return;

    // Clear skeleton cards
    const skeletons = trackEl.querySelectorAll('.skeleton-card');
    skeletons.forEach(s => s.remove());

    // Render game cards
    games.forEach((game, index) => {
      const card = createCard(game, index);
      trackEl.appendChild(card);
    });

    // Resolve initial index
    currentIndex = resolveInitialIndex();

    // Set initial active card
    const cards = trackEl.querySelectorAll('.game-card');
    if (cards[currentIndex]) {
      cards[currentIndex].classList.add('active');
    }

    // Position track (no animation on init)
    positionTrack(false);

    // Load media for active ± 2
    updateMediaWindow();

    // Update game count display
    updateGameCount();

    // Announce initial position
    announcePosition();

    // Update URL hash for initial card
    updateUrlHash();

    // Save initial index
    saveIndex();

    // Handle nav button visibility
    updateNavVisibility();

    // Wire nav button click handlers
    if (prevBtn) prevBtn.addEventListener('click', onPrevClick);
    if (nextBtn) nextBtn.addEventListener('click', onNextClick);

    // Handle window resize — debounced reposition
    resizeHandler = debounce(() => {
      positionTrack(false);
    }, 150);
    window.addEventListener('resize', resizeHandler);

    // Start idle timer (only if more than 1 game)
    if (games.length > 1) {
      resetIdleTimer();
    }
  },

  /**
   * Navigates to a specific card index.
   * @param {number} index - Target card index
   * @param {boolean} [animate=true] - Whether to animate the transition
   */
  goTo(index, animate = true) {
    // Clamp to valid range
    const clamped = Math.max(0, Math.min(index, games.length - 1));

    // If already at this index, return (unless forced via no-animate)
    if (clamped === currentIndex && animate) return;

    const oldIndex = currentIndex;
    currentIndex = clamped;

    // Update active card classes
    updateActiveCard(oldIndex, currentIndex);

    // Position track
    positionTrack(animate);

    // Update media window
    updateMediaWindow();

    // Announce position to screen readers
    announcePosition();

    // Update URL hash
    updateUrlHash();

    // Save index to sessionStorage
    saveIndex();

    // Fire callbacks
    fireCallbacks();

    // Reset idle timer
    resetIdleTimer();
  },

  /**
   * Advances to the next card. Clamps at the last card (no wrapping).
   */
  next() {
    if (currentIndex < games.length - 1) {
      carousel.goTo(currentIndex + 1);
    }
  },

  /**
   * Retreats to the previous card. Clamps at the first card (no wrapping).
   */
  prev() {
    if (currentIndex > 0) {
      carousel.goTo(currentIndex - 1);
    }
  },

  /**
   * Returns the current active card index.
   * @returns {number}
   */
  getCurrentIndex() {
    return currentIndex;
  },

  /**
   * Enters idle attract mode — auto-advances every 5 seconds.
   * Wraps from last card back to first.
   */
  enterIdleMode() {
    if (isIdle) return;
    if (prefersReducedMotion()) return;
    if (games.length <= 1) return;

    isIdle = true;

    idleInterval = setInterval(() => {
      if (currentIndex >= games.length - 1) {
        carousel.goTo(0);
      } else {
        carousel.goTo(currentIndex + 1);
      }
    }, 5000);
  },

  /**
   * Exits idle attract mode — clears the auto-advance interval.
   */
  exitIdleMode() {
    if (idleInterval !== null) {
      clearInterval(idleInterval);
      idleInterval = null;
    }
    isIdle = false;
  },

  /**
   * Registers a callback that fires when the active card changes.
   * @param {Function} callback - Called with (index, game)
   */
  onCardChange(callback) {
    if (typeof callback === 'function') {
      cardChangeCallbacks.push(callback);
    }
  },

  /**
   * Cleans up all event listeners, timers, and references.
   */
  destroy() {
    // Clear timers
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (idleInterval !== null) {
      clearInterval(idleInterval);
      idleInterval = null;
    }

    // Remove event listeners
    if (prevBtn) prevBtn.removeEventListener('click', onPrevClick);
    if (nextBtn) nextBtn.removeEventListener('click', onNextClick);
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }

    // Null references
    games = [];
    currentIndex = 0;
    isIdle = false;
    isAnimating = false;
    cardChangeCallbacks = [];
    containerEl = null;
    trackEl = null;
    prevBtn = null;
    nextBtn = null;
    announceEl = null;
  },

  /**
   * Resets the idle timer — exposed for external modules (e.g., input-handler).
   */
  resetIdleTimer() {
    resetIdleTimer();
  },

  /**
   * Returns whether idle mode is currently active.
   * @returns {boolean}
   */
  isIdleMode() {
    return isIdle;
  }
};

export default carousel;
