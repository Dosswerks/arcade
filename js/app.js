// app.js — Entry point; orchestrates initialization of all modules

import { fetchGames } from './data-loader.js';
import carousel from './carousel.js';
import inputHandler from './input-handler.js';
import audioManager from './audio-manager.js';
import neonLogo from './neon-logo.js';
import videoManager from './video-manager.js';
import DetailModal from './detail-modal.js';
import { trackPlay, trackDetailOpen, trackError } from './analytics.js';

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Displays a themed message inside the carousel area.
 * Clears the carousel track and shows a neon-styled message.
 * @param {HTMLElement} container - The carousel section element
 * @param {string} text - The message to display
 */
function showMessage(container, text) {
  const track = container.querySelector('.carousel-track');
  if (track) {
    track.innerHTML = '';
  }

  const msg = document.createElement('div');
  msg.className = 'arcade-message';
  msg.setAttribute('role', 'status');
  msg.style.textAlign = 'center';
  msg.style.padding = '3rem 1.5rem';
  msg.style.color = 'var(--color-neon-amber, #f5a623)';
  msg.style.fontFamily = 'var(--font-display, "Press Start 2P", monospace)';
  msg.style.fontSize = 'clamp(0.85rem, 2vw, 1.25rem)';
  msg.style.lineHeight = '1.8';
  msg.style.textShadow =
    '0 0 7px var(--color-neon-amber, #f5a623),' +
    ' 0 0 10px var(--color-neon-amber, #f5a623),' +
    ' 0 0 21px var(--color-neon-amber, #f5a623)';
  msg.textContent = text;

  if (track) {
    track.appendChild(msg);
  } else {
    container.appendChild(msg);
  }
}

// ── Main initialization ───────────────────────────────────────────

async function init() {
  // 1. Get DOM references
  const headingEl = document.querySelector('.neon-logo');
  const carouselEl = document.querySelector('#game-carousel');
  const facadeEl = document.querySelector('.brick-facade');
  const pauseBtn = document.querySelector('.pause-toggle');

  // 2. Init neon logo
  neonLogo.init(headingEl);

  // 3. Init audio manager
  audioManager.init();

  // 4. Check reveal animation
  let revealDuration = 0;
  const revealPlayed = sessionStorage.getItem('dosswerks-reveal-played');

  if (revealPlayed !== 'true') {
    if (facadeEl) {
      facadeEl.classList.add('revealing');
    }
    revealDuration = 2000;
    setTimeout(() => {
      sessionStorage.setItem('dosswerks-reveal-played', 'true');
    }, 2000);
  }

  // 5. Fetch games
  let games;
  try {
    games = await fetchGames();
  } catch (err) {
    showMessage(
      carouselEl,
      'The arcade is closed for maintenance. Please try again later.'
    );
    if (typeof trackError === 'function') {
      trackError('data_load', err?.message || 'unknown');
    }
    return;
  }

  // 6. Handle zero games
  if (games.length === 0) {
    showMessage(
      carouselEl,
      'The machines are warming up... Games coming soon!'
    );
    return;
  }

  // 7. Init carousel
  carousel.init(games, carouselEl);

  // 8. Init input handler
  inputHandler.init(carouselEl);

  // 9. Wire input handler to carousel (swipe gestures + keyboard arrows)
  inputHandler.onSwipe((direction) => {
    if (direction === 'left') carousel.next();
    else carousel.prev();
    audioManager.playSwipeSound();
    carousel.resetIdleTimer();
  });

  // 10. Wire input handler select (card tap) to detail modal
  inputHandler.onSelect((target) => {
    const card = target.closest('.game-card');
    if (!card) return;
    // Don't open modal if they clicked the PLAY button
    if (target.closest('.card-play-btn')) return;
    const index = parseInt(card.dataset.index, 10);
    const game = games[index];
    if (game) {
      DetailModal.open(game, card);
      if (typeof trackDetailOpen === 'function') {
        trackDetailOpen(game);
      }
    }
  });

  // 11. Wire carousel card changes to video manager
  carousel.onCardChange((index, game) => {
    const cards = carouselEl.querySelectorAll('.game-card');
    cards.forEach((card, i) => {
      const cardGame = games[i];
      const isActive = i === index;
      const isNearby = Math.abs(i - index) <= 2;

      if (isActive && cardGame.attract_video) {
        if (!card._video) {
          videoManager.loadVideo(card, cardGame.attract_video, cardGame.attract_video_webm);
        }
        videoManager.playVideo(card);
      } else if (card._video) {
        if (isNearby) {
          videoManager.pauseAndRestore(card);
        } else {
          videoManager.unloadVideo(card);
        }
      } else if (isNearby && cardGame.attract_video) {
        videoManager.loadVideo(card, cardGame.attract_video, cardGame.attract_video_webm);
      }
    });
  });

  // 12. Wire PLAY button clicks (event delegation)
  carouselEl.addEventListener('click', (e) => {
    const playBtn = e.target.closest('.card-play-btn');
    if (!playBtn) return;

    audioManager.playSelectSound();

    const card = playBtn.closest('.game-card');
    if (card) {
      const index = parseInt(card.dataset.index, 10);
      const game = games[index];
      if (game && typeof trackPlay === 'function') {
        trackPlay(game);
      }
    }
  });

  // 13. First interaction listener (audio unlock)
  const unlockEvents = ['click', 'touchstart', 'keydown'];
  function handleFirstInteraction() {
    audioManager.unlock();
    unlockEvents.forEach((evt) => {
      document.removeEventListener(evt, handleFirstInteraction);
    });
  }
  unlockEvents.forEach((evt) => {
    document.addEventListener(evt, handleFirstInteraction, { once: false });
  });

  // 14. Pause/play button
  let paused = false;
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      paused = !paused;

      const icon = pauseBtn.querySelector('.pause-toggle__icon');

      if (paused) {
        neonLogo.stopFlicker();
        carousel.exitIdleMode();
        // Update button UI
        if (icon) icon.textContent = '▶';
        pauseBtn.setAttribute('aria-label', 'Resume animations');
        pauseBtn.setAttribute('aria-pressed', 'true');
      } else {
        neonLogo.startFlicker();
        carousel.resetIdleTimer();
        // Update button UI
        if (icon) icon.textContent = '⏸';
        pauseBtn.setAttribute('aria-label', 'Pause animations');
        pauseBtn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  // 15. Start idle timer after reveal completes (or immediately if skipped)
  if (revealDuration > 0) {
    setTimeout(() => {
      carousel.resetIdleTimer();
    }, revealDuration);
  } else {
    carousel.resetIdleTimer();
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
