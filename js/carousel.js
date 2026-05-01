// carousel.js — Infinite carousel using DOM reordering
// Cards are moved from one end of the track to the other as the user
// navigates, so there's always content in both directions. The track
// translateX is adjusted to compensate, making the move invisible.

import { createCard, updateCardMedia } from './card-renderer.js';
import { prefersReducedMotion, debounce } from './utils.js';

let games = [];
let currentIndex = 0; // logical index into games[]
let isIdle = false;
let idleTimer = null;
let idleInterval = null;
let cardChangeCallbacks = [];
let containerEl = null;
let trackEl = null;
let prevBtn = null;
let nextBtn = null;
let announceEl = null;
let resizeHandler = null;
let isAnimating = false;

// The cards array tracks DOM order (may differ from games[] order after reordering)
let cardEls = [];
// Which position in cardEls[] is currently centered
let centerPos = 0;

function getCardWidth() {
  if (cardEls.length > 0) return cardEls[0].offsetWidth;
  return 260;
}

function getCardGap() {
  if (!trackEl) return 24;
  return parseFloat(getComputedStyle(trackEl).gap) || 24;
}

function getStep() {
  return getCardWidth() + getCardGap();
}

function getViewportWidth() {
  return containerEl ? containerEl.offsetWidth : window.innerWidth;
}

/**
 * Set the track translateX so that cardEls[centerPos] is centered.
 */
function positionTrack(animate) {
  if (!trackEl) return;
  const step = getStep();
  const vw = getViewportWidth();
  const cardW = getCardWidth();
  const offset = -(centerPos * step) + (vw / 2) - (cardW / 2);

  if (!animate) {
    trackEl.style.transition = 'none';
    trackEl.style.transform = `translateX(${offset}px)`;
    void trackEl.offsetHeight;
    trackEl.style.transition = '';
  } else {
    trackEl.style.transform = `translateX(${offset}px)`;
  }
}

/**
 * Ensure cards are balanced around centerPos so there's always
 * content visible on both sides. Moves cards from the far end
 * to the near end as needed — all at once in a single repaint.
 */
function balanceCards() {
  if (games.length <= 2) return;

  const half = Math.floor(games.length / 2);
  let moved = false;

  // Disable transitions for the entire rebalance
  trackEl.style.transition = 'none';

  // Move cards from the end to the beginning if centerPos is too far right
  while (centerPos > half) {
    const first = cardEls.shift();
    trackEl.appendChild(first);
    cardEls.push(first);
    centerPos--;
    moved = true;
  }

  // Move cards from the beginning to the end if centerPos is too far left
  while (centerPos < half && centerPos < cardEls.length - 1 - half) {
    const last = cardEls.pop();
    trackEl.insertBefore(last, trackEl.firstChild);
    cardEls.unshift(last);
    centerPos++;
    moved = true;
  }

  if (moved) {
    // Reposition track instantly to compensate for moved cards
    const step = getStep();
    const vw = getViewportWidth();
    const cardW = getCardWidth();
    const offset = -(centerPos * step) + (vw / 2) - (cardW / 2);
    trackEl.style.transform = `translateX(${offset}px)`;
    // Force single reflow, then restore transitions
    void trackEl.offsetHeight;
  }

  trackEl.style.transition = '';
}

function updateActiveClasses() {
  cardEls.forEach((card, i) => {
    card.classList.toggle('active', i === centerPos);
  });
}

function updateMediaWindow() {
  const len = games.length;
  cardEls.forEach((card) => {
    const gi = parseInt(card.dataset.index, 10);
    const isActive = gi === currentIndex;
    const dist = Math.min(
      Math.abs(gi - currentIndex),
      len - Math.abs(gi - currentIndex)
    );
    updateCardMedia(card, isActive, dist <= 2);
  });
}

function announcePosition() {
  if (announceEl) announceEl.textContent = `Game ${currentIndex + 1} of ${games.length}`;
}

function updateGameCount() {
  const el = document.querySelector('.game-count__number');
  if (el) el.textContent = String(games.length);
}

function updateUrlHash() {
  if (games[currentIndex]?.slug) {
    history.replaceState(null, '', '#' + games[currentIndex].slug);
  }
}

function saveIndex() {
  try { sessionStorage.setItem('dosswerks-carousel-index', String(currentIndex)); } catch (_) {}
}

function fireCallbacks() {
  const game = games[currentIndex];
  cardChangeCallbacks.forEach(cb => { try { cb(currentIndex, game); } catch (_) {} });
}

function resetIdleTimer() {
  if (idleTimer !== null) { clearTimeout(idleTimer); idleTimer = null; }
  if (isIdle) carousel.exitIdleMode();
  if (prefersReducedMotion() || games.length <= 1) return;
  idleTimer = setTimeout(() => carousel.enterIdleMode(), 5000);
}

function resolveInitialIndex() {
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const idx = games.findIndex(g => g.slug === hash);
    if (idx !== -1) return idx;
  }
  try {
    const stored = sessionStorage.getItem('dosswerks-carousel-index');
    if (stored !== null) {
      const idx = parseInt(stored, 10);
      if (!isNaN(idx) && idx >= 0 && idx < games.length) return idx;
    }
  } catch (_) {}
  return 0;
}

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

function onPrevClick() { carousel.prev(); resetIdleTimer(); }
function onNextClick() { carousel.next(); resetIdleTimer(); }

function onTransitionEnd(e) {
  // Only respond to the track's own transform transition, not child transitions
  if (e.target !== trackEl || e.propertyName !== 'transform') return;
  isAnimating = false;
  balanceCards();
}

const carousel = {
  init(gameList, container) {
    games = gameList;
    containerEl = container;
    trackEl = container.querySelector('.carousel-track');
    announceEl = container.querySelector('.sr-announcements');
    prevBtn = container.querySelector('.carousel-btn--prev');
    nextBtn = container.querySelector('.carousel-btn--next');

    if (!trackEl || games.length === 0) return;

    trackEl.querySelectorAll('.skeleton-card').forEach(s => s.remove());

    // Create all cards
    games.forEach((game, index) => {
      trackEl.appendChild(createCard(game, index));
    });

    cardEls = Array.from(trackEl.querySelectorAll('.game-card'));

    // Resolve starting index
    currentIndex = resolveInitialIndex();

    // Find which DOM position has our starting card
    centerPos = cardEls.findIndex(c => parseInt(c.dataset.index, 10) === currentIndex);
    if (centerPos === -1) centerPos = 0;

    // Balance cards around center, then position
    balanceCards();
    updateActiveClasses();
    positionTrack(false);

    updateMediaWindow();
    updateGameCount();
    announcePosition();
    updateUrlHash();
    saveIndex();
    updateNavVisibility();

    if (prevBtn) prevBtn.addEventListener('click', onPrevClick);
    if (nextBtn) nextBtn.addEventListener('click', onNextClick);

    trackEl.addEventListener('transitionend', onTransitionEnd);

    resizeHandler = debounce(() => positionTrack(false), 150);
    window.addEventListener('resize', resizeHandler);

    if (games.length > 1) resetIdleTimer();
  },

  goTo(gameIndex, animate = true) {
    if (isAnimating) return;
    const target = ((gameIndex % games.length) + games.length) % games.length;
    if (target === currentIndex && animate) return;

    currentIndex = target;

    // Find the card in the DOM
    const targetPos = cardEls.findIndex(c => parseInt(c.dataset.index, 10) === target);
    if (targetPos === -1) return;

    centerPos = targetPos;
    isAnimating = animate;

    updateActiveClasses();
    positionTrack(animate);
    updateMediaWindow();
    announcePosition();
    updateUrlHash();
    saveIndex();
    fireCallbacks();
    resetIdleTimer();

    if (!animate) balanceCards();
  },

  next() {
    if (games.length <= 1 || isAnimating) return;

    const nextGameIdx = (currentIndex + 1) % games.length;
    currentIndex = nextGameIdx;

    // Move to the next DOM position (one to the right of center)
    centerPos++;
    isAnimating = true;

    updateActiveClasses();
    positionTrack(true);
    updateMediaWindow();
    announcePosition();
    updateUrlHash();
    saveIndex();
    fireCallbacks();
    resetIdleTimer();
  },

  prev() {
    if (games.length <= 1 || isAnimating) return;

    const prevGameIdx = (currentIndex - 1 + games.length) % games.length;
    currentIndex = prevGameIdx;

    // Move to the previous DOM position (one to the left of center)
    centerPos--;
    isAnimating = true;

    updateActiveClasses();
    positionTrack(true);
    updateMediaWindow();
    announcePosition();
    updateUrlHash();
    saveIndex();
    fireCallbacks();
    resetIdleTimer();
  },

  getCurrentIndex() { return currentIndex; },

  enterIdleMode() {
    if (isIdle || prefersReducedMotion() || games.length <= 1) return;
    isIdle = true;
    idleInterval = setInterval(() => carousel.next(), 5000);
  },

  exitIdleMode() {
    if (idleInterval !== null) { clearInterval(idleInterval); idleInterval = null; }
    isIdle = false;
  },

  onCardChange(callback) {
    if (typeof callback === 'function') cardChangeCallbacks.push(callback);
  },

  destroy() {
    if (idleTimer !== null) { clearTimeout(idleTimer); idleTimer = null; }
    if (idleInterval !== null) { clearInterval(idleInterval); idleInterval = null; }
    if (prevBtn) prevBtn.removeEventListener('click', onPrevClick);
    if (nextBtn) nextBtn.removeEventListener('click', onNextClick);
    if (trackEl) trackEl.removeEventListener('transitionend', onTransitionEnd);
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
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
    cardEls = [];
    centerPos = 0;
  },

  resetIdleTimer() { resetIdleTimer(); },
  isIdleMode() { return isIdle; }
};

export default carousel;
