// card-renderer.js — Renders game cards into archway frames

import { sanitizeHTML, truncate } from './utils.js';

/**
 * Creates the full card DOM element for a game entry.
 * @param {Object} game - The game data object
 * @param {number} index - The card index in the carousel
 * @returns {HTMLElement} The constructed card article element
 */
export function createCard(game, index) {
  const article = document.createElement('article');
  article.className = 'game-card';
  article.dataset.index = String(index);
  article.dataset.slug = sanitizeHTML(game.slug || '');
  article.setAttribute('aria-label', sanitizeHTML(game.title || ''));
  article.setAttribute('role', 'group');
  article.setAttribute('aria-roledescription', 'slide');
  article.tabIndex = 0;

  const archway = document.createElement('div');
  archway.className = 'card-archway';

  // — Marquee —
  const marquee = document.createElement('div');
  marquee.className = 'card-marquee';

  if (game.logo_image) {
    const logoImg = document.createElement('img');
    logoImg.src = game.logo_image;
    logoImg.alt = sanitizeHTML(game.title || '') + ' logo';
    logoImg.loading = 'lazy';
    marquee.appendChild(logoImg);
  } else {
    const marqueeText = document.createElement('span');
    marqueeText.className = 'card-marquee-text';
    marqueeText.textContent = sanitizeHTML(game.title || '');
    marquee.appendChild(marqueeText);
  }

  // — Media —
  const media = document.createElement('div');
  media.className = 'card-media';

  const picture = document.createElement('picture');

  const source = document.createElement('source');
  source.srcset = game.cover_image || '';
  source.type = 'image/webp';
  picture.appendChild(source);

  const coverImg = document.createElement('img');
  coverImg.src = game.cover_image_fallback || game.cover_image || '';
  coverImg.alt = sanitizeHTML(game.title || '') + ' cover art';
  coverImg.loading = 'lazy';
  coverImg.onerror = function () {
    showErrorPlaceholder(article, game.title || '');
  };
  picture.appendChild(coverImg);

  media.appendChild(picture);

  // — Info —
  const info = document.createElement('div');
  info.className = 'card-info';

  const desc = document.createElement('p');
  desc.className = 'card-description';
  desc.textContent = truncate(sanitizeHTML(game.description || ''), 150);
  info.appendChild(desc);

  const playBtn = document.createElement('a');
  playBtn.className = 'card-play-btn';
  playBtn.href = game.game_url || '#';
  playBtn.target = '_blank';
  playBtn.rel = 'noopener noreferrer';
  playBtn.setAttribute('aria-label', 'Play ' + sanitizeHTML(game.title || ''));
  playBtn.textContent = 'PLAY';
  info.appendChild(playBtn);

  // — Coming Soon Overlay —
  const overlay = document.createElement('div');
  overlay.className = 'card-coming-soon-overlay hidden';
  overlay.textContent = 'COMING SOON';

  // — Featured Badge —
  const badge = document.createElement('div');
  badge.className = 'card-featured-badge hidden';
  badge.textContent = '\u2605 FEATURED';

  // Assemble archway
  archway.appendChild(marquee);
  archway.appendChild(media);
  archway.appendChild(info);
  archway.appendChild(overlay);
  archway.appendChild(badge);

  article.appendChild(archway);

  // Apply status-based overlays
  if (game.status === 'coming_soon') {
    showComingSoonOverlay(article);
  }
  if (game.featured === true) {
    showFeaturedBadge(article);
  }

  return article;
}

/**
 * Shows the "Coming Soon" overlay on a card and disables the PLAY button.
 * @param {HTMLElement} cardEl - The card article element
 */
export function showComingSoonOverlay(cardEl) {
  const overlay = cardEl.querySelector('.card-coming-soon-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }

  const playBtn = cardEl.querySelector('.card-play-btn');
  if (playBtn) {
    playBtn.setAttribute('aria-disabled', 'true');
    playBtn.setAttribute('disabled', '');
    playBtn.removeAttribute('href');
  }
}

/**
 * Shows the featured badge on a card.
 * @param {HTMLElement} cardEl - The card article element
 */
export function showFeaturedBadge(cardEl) {
  const badge = cardEl.querySelector('.card-featured-badge');
  if (badge) {
    badge.classList.remove('hidden');
  }
}

/**
 * Replaces the card media content with a styled error placeholder.
 * @param {HTMLElement} cardEl - The card article element
 * @param {string} title - The game title to display in the placeholder
 */
export function showErrorPlaceholder(cardEl, title) {
  const media = cardEl.querySelector('.card-media');
  if (!media) return;

  media.classList.add('card-media--error');
  media.innerHTML = '';

  const placeholder = document.createElement('div');
  placeholder.className = 'card-media-placeholder';
  placeholder.textContent = sanitizeHTML(title);
  media.appendChild(placeholder);
}

/**
 * Manages media loading state based on card position in the carousel.
 * Active and nearby cards get their media loaded; distant cards can be unloaded.
 * @param {HTMLElement} cardEl - The card article element
 * @param {boolean} isActive - Whether this card is the currently active card
 * @param {boolean} isNearby - Whether this card is adjacent to the active card
 */
export function updateCardMedia(cardEl, isActive, isNearby) {
  const img = cardEl.querySelector('.card-media img');
  if (!img) return;

  if (isActive || isNearby) {
    // Ensure the image has its src loaded
    if (img.dataset.src && !img.src) {
      img.src = img.dataset.src;
    }
  }
}
