// video-manager.js — Attract screen video lifecycle (load, play, pause, cleanup)

/**
 * Manages attract screen video elements on game cards.
 * Videos play muted and looped to comply with browser autoplay policies.
 * WebM is preferred format, MP4 as fallback via <source> elements.
 * If video fails to load, cover art remains visible — no error shown to user.
 */
const videoManager = {
  /**
   * Creates a <video> element and appends it to the card's .card-media container.
   * @param {HTMLElement} cardEl - The game card article element
   * @param {string} videoUrl - MP4 video URL
   * @param {string} [webmUrl] - Optional WebM video URL (preferred format)
   */
  loadVideo(cardEl, videoUrl, webmUrl) {
    // Avoid loading a second video if one already exists
    if (cardEl._video) return;

    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'metadata');
    video.className = 'card-video';

    // Set aria-label from the card's aria-label + " gameplay preview"
    const gameTitle = cardEl.getAttribute('aria-label') || '';
    video.setAttribute('aria-label', gameTitle + ' gameplay preview');

    // WebM source first (preferred format) if provided
    if (webmUrl) {
      const webmSource = document.createElement('source');
      webmSource.src = webmUrl;
      webmSource.type = 'video/webm';
      video.appendChild(webmSource);
    }

    // MP4 source as fallback
    if (videoUrl) {
      const mp4Source = document.createElement('source');
      mp4Source.src = videoUrl;
      mp4Source.type = 'video/mp4';
      video.appendChild(mp4Source);
    }

    // Error handler: silently keep cover art visible
    video.onerror = function () {
      console.warn('Video failed to load for card:', gameTitle);
    };

    // Hide video initially — cover art stays visible until playVideo is called
    video.style.display = 'none';

    // Append to the card's .card-media container
    const mediaContainer = cardEl.querySelector('.card-media');
    if (mediaContainer) {
      mediaContainer.appendChild(video);
    }

    // Store reference on the card element
    cardEl._video = video;
  },

  /**
   * Plays the video on the given card, hiding cover art.
   * @param {HTMLElement} cardEl - The game card article element
   */
  playVideo(cardEl) {
    const video = cardEl._video;
    if (!video) return;

    video.setAttribute('preload', 'auto');

    // Show video, hide cover art
    video.style.display = '';
    const picture = cardEl.querySelector('.card-media picture');
    if (picture) {
      picture.style.display = 'none';
    }

    // Play returns a promise — catch and ignore errors silently
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        // Silently ignore play errors (e.g., interrupted, not allowed)
      });
    }
  },

  /**
   * Pauses the video and restores cover art visibility.
   * @param {HTMLElement} cardEl - The game card article element
   */
  pauseAndRestore(cardEl) {
    const video = cardEl._video;
    if (!video) return;

    video.pause();

    // Show cover art, hide video
    const picture = cardEl.querySelector('.card-media picture');
    if (picture) {
      picture.style.display = '';
    }
    video.style.display = 'none';
  },

  /**
   * Removes the video element from the DOM and cleans up references.
   * @param {HTMLElement} cardEl - The game card article element
   */
  unloadVideo(cardEl) {
    const video = cardEl._video;
    if (!video) return;

    video.pause();

    // Remove from DOM
    if (video.parentNode) {
      video.parentNode.removeChild(video);
    }

    // Clear reference
    cardEl._video = null;

    // Restore cover art visibility
    const picture = cardEl.querySelector('.card-media picture');
    if (picture) {
      picture.style.display = '';
    }
  }
};

export default videoManager;
