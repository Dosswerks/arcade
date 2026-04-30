// detail-modal.js — Game detail modal overlay

import { sanitizeHTML } from './utils.js';

/** @type {boolean} */
let _isOpen = false;

/** @type {HTMLElement|null} */
let _backdrop = null;

/** @type {HTMLElement|null} */
let _originCard = null;

/** @type {HTMLVideoElement|null} */
let _modalVideo = null;

// Bound listener references for cleanup
let _onBackdropClick = null;
let _onKeydown = null;

/**
 * Returns all focusable elements within the modal content.
 * @param {HTMLElement} modalContent
 * @returns {HTMLElement[]}
 */
function getFocusableElements(modalContent) {
  return Array.from(
    modalContent.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
}

/**
 * Handles Tab / Shift+Tab focus trapping within the modal.
 * @param {KeyboardEvent} e
 * @param {HTMLElement} modalContent
 */
function handleFocusTrap(e, modalContent) {
  const focusable = getFocusableElements(modalContent);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    // Shift+Tab: if on first element, wrap to last
    if (document.activeElement === first || document.activeElement === modalContent) {
      e.preventDefault();
      last.focus();
    }
  } else {
    // Tab: if on last element, wrap to first
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

const DetailModal = {
  /**
   * Opens the detail modal for a given game.
   * @param {object} game - The game data object
   * @param {HTMLElement} originCard - The card element that triggered the modal
   */
  open(game, originCard) {
    if (_isOpen) return;

    _originCard = originCard;

    // --- Backdrop ---
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    // --- Modal content ---
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-label', `Details for ${sanitizeHTML(game.title)}`);
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('tabindex', '-1');

    // 1. Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    content.appendChild(closeBtn);

    // 2. Game logo / marquee
    if (game.logo_image) {
      const logo = document.createElement('img');
      logo.src = game.logo_image;
      logo.alt = `${sanitizeHTML(game.title)} logo`;
      logo.style.maxWidth = '100%';
      logo.style.marginBottom = '1rem';
      content.appendChild(logo);
    } else {
      const titleEl = document.createElement('h2');
      titleEl.textContent = sanitizeHTML(game.title);
      titleEl.style.marginTop = '0';
      content.appendChild(titleEl);
    }

    // 3. Media area — video or cover art
    if (game.attract_video) {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-label', `${sanitizeHTML(game.title)} gameplay preview`);
      video.style.width = '100%';
      video.style.borderRadius = '6px';
      video.style.marginBottom = '1rem';

      // WebM source first if available
      if (game.attract_video_webm) {
        const webmSource = document.createElement('source');
        webmSource.src = game.attract_video_webm;
        webmSource.type = 'video/webm';
        video.appendChild(webmSource);
      }

      // MP4 source
      const mp4Source = document.createElement('source');
      mp4Source.src = game.attract_video;
      mp4Source.type = 'video/mp4';
      video.appendChild(mp4Source);

      video.autoplay = true;
      content.appendChild(video);
      _modalVideo = video;
    } else if (game.cover_image) {
      const coverImg = document.createElement('img');
      coverImg.src = game.cover_image;
      coverImg.alt = `${sanitizeHTML(game.title)} cover art`;
      coverImg.style.width = '100%';
      coverImg.style.borderRadius = '6px';
      coverImg.style.marginBottom = '1rem';
      content.appendChild(coverImg);
    }

    // 4. Long description (or short description fallback)
    const descText = game.long_description || game.description;
    if (descText) {
      const descP = document.createElement('p');
      descP.innerHTML = sanitizeHTML(descText);
      content.appendChild(descP);
    }

    // 5. Screenshots gallery
    if (game.screenshots && game.screenshots.length > 0) {
      const gallery = document.createElement('div');
      gallery.className = 'modal-screenshots';
      gallery.style.overflowX = 'auto';
      gallery.style.display = 'flex';
      gallery.style.gap = '0.5rem';
      gallery.style.marginBottom = '1rem';

      game.screenshots.forEach((src, i) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = `${sanitizeHTML(game.title)} screenshot ${i + 1}`;
        img.style.height = '150px';
        img.style.borderRadius = '4px';
        img.style.flexShrink = '0';
        gallery.appendChild(img);
      });

      content.appendChild(gallery);
    }

    // 6. Controls
    if (game.controls) {
      const controlsSection = document.createElement('section');
      const controlsHeading = document.createElement('h3');
      controlsHeading.textContent = 'Controls';
      controlsSection.appendChild(controlsHeading);

      const controlsText = document.createElement('p');
      controlsText.innerHTML = sanitizeHTML(game.controls);
      controlsSection.appendChild(controlsText);

      content.appendChild(controlsSection);
    }

    // 7. Credits
    if (game.credits) {
      const creditsSection = document.createElement('section');
      const creditsHeading = document.createElement('h3');
      creditsHeading.textContent = 'Credits';
      creditsSection.appendChild(creditsHeading);

      const creditsText = document.createElement('p');
      creditsText.innerHTML = sanitizeHTML(game.credits);
      creditsSection.appendChild(creditsText);

      content.appendChild(creditsSection);
    }

    // 8. PLAY button
    const playBtn = document.createElement('a');
    playBtn.className = 'card-play-btn';
    playBtn.href = game.game_url;
    playBtn.target = '_blank';
    playBtn.rel = 'noopener noreferrer';
    playBtn.setAttribute('aria-label', `Play ${sanitizeHTML(game.title)}`);
    playBtn.textContent = 'PLAY';
    playBtn.style.display = 'inline-block';
    playBtn.style.marginTop = '1rem';
    content.appendChild(playBtn);

    // Assemble and attach to DOM
    backdrop.appendChild(content);
    document.body.appendChild(backdrop);
    _backdrop = backdrop;

    // Focus the modal content
    content.focus();

    // --- Event listeners ---

    // Click on backdrop (outside modal-content) closes modal
    _onBackdropClick = (e) => {
      if (e.target === backdrop) {
        DetailModal.close();
      }
    };
    backdrop.addEventListener('click', _onBackdropClick);

    // Close button
    closeBtn.addEventListener('click', () => DetailModal.close());

    // Keydown: Escape to close, Tab/Shift+Tab for focus trap
    _onKeydown = (e) => {
      if (e.key === 'Escape') {
        DetailModal.close();
      } else if (e.key === 'Tab') {
        handleFocusTrap(e, content);
      }
    };
    document.addEventListener('keydown', _onKeydown);

    _isOpen = true;
  },

  /**
   * Closes the detail modal and cleans up resources.
   */
  close() {
    if (!_isOpen) return;

    // Clean up modal video
    if (_modalVideo) {
      _modalVideo.pause();
      _modalVideo.remove();
      _modalVideo = null;
    }

    // Remove backdrop from DOM
    if (_backdrop) {
      _backdrop.removeEventListener('click', _onBackdropClick);
      _backdrop.remove();
      _backdrop = null;
    }

    // Remove keydown listener
    if (_onKeydown) {
      document.removeEventListener('keydown', _onKeydown);
      _onKeydown = null;
    }

    _onBackdropClick = null;

    // Return focus to originating card
    if (_originCard) {
      _originCard.focus();
      _originCard = null;
    }

    _isOpen = false;
  },

  /**
   * Returns whether the modal is currently open.
   * @returns {boolean}
   */
  isOpen() {
    return _isOpen;
  }
};

export default DetailModal;
