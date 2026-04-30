// audio-manager.js — Sound effects, ambient audio, and mute state management
// Uses Web Audio API for low-latency sound effects, <audio> element for ambient loop.
// All audio silent until unlock() is called on first user interaction (browser autoplay policy).

const STORAGE_KEY = 'dosswerks-audio-muted';

const State = {
  Locked: 'locked',
  Playing: 'playing',
  Muted: 'muted',
  Failed: 'failed',
};

let state = State.Locked;
let muted = false;

// Web Audio API references
let audioCtx = null;
let gainNode = null;

// Ambient loop
let ambientAudio = null;
let ambientSource = null;

// Preloaded sound effect buffers
let swipeBuffer = null;
let selectBuffer = null;

// DOM reference
let muteToggleBtn = null;

/**
 * Load an audio file into an AudioBuffer for low-latency playback.
 * Returns null on failure (non-blocking).
 */
async function loadSoundBuffer(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  } catch {
    console.warn(`[audio-manager] Failed to load sound: ${url}`);
    return null;
  }
}

/**
 * Play a preloaded AudioBuffer through the gain node.
 */
function playBuffer(buffer) {
  if (!buffer || !audioCtx || !gainNode) return;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(gainNode);
  source.start(0);
}

/**
 * Update the mute toggle button's icon and ARIA attributes.
 */
function updateMuteToggleUI() {
  if (!muteToggleBtn) return;
  const icon = muteToggleBtn.querySelector('.mute-toggle__icon');
  if (icon) {
    icon.textContent = muted ? '🔇' : '🔊';
  }
  muteToggleBtn.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
  muteToggleBtn.setAttribute('aria-pressed', String(muted));
}

/**
 * Handle mute toggle button click.
 */
function handleMuteToggleClick() {
  audioManager.setMuted(!muted);
}

const audioManager = {
  /**
   * Initialize audio manager.
   * Reads mute preference from localStorage, sets initial state to Locked,
   * and wires up the mute toggle button.
   */
  init() {
    // Restore mute preference from localStorage
    const storedMuted = localStorage.getItem(STORAGE_KEY);
    if (storedMuted === 'true') {
      muted = true;
    }

    state = State.Locked;

    // Find and configure the mute toggle button
    muteToggleBtn = document.querySelector('.mute-toggle');
    if (muteToggleBtn) {
      updateMuteToggleUI();
      muteToggleBtn.addEventListener('click', handleMuteToggleClick);
    }
  },

  /**
   * Unlock audio — called on first user interaction.
   * Creates AudioContext, gain node, ambient loop, and preloads sound effects.
   */
  async unlock() {
    // Only unlock once
    if (state !== State.Locked) return;

    // Try to create AudioContext
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('AudioContext not supported');
      audioCtx = new AudioContextClass();
    } catch {
      console.warn('[audio-manager] AudioContext creation failed — running silently');
      state = State.Failed;
      // Hide mute toggle since audio won't work
      if (muteToggleBtn) {
        muteToggleBtn.style.display = 'none';
      }
      return;
    }

    // Resume context if suspended (some browsers start suspended)
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch {
        // Continue anyway — some browsers auto-resume on first audio play
      }
    }

    // Create master gain node
    gainNode = audioCtx.createGain();
    gainNode.gain.value = muted ? 0 : 1;
    gainNode.connect(audioCtx.destination);

    // Create ambient loop using <audio> element (better for long audio)
    ambientAudio = document.createElement('audio');
    ambientAudio.src = 'audio/ambient.mp3';
    ambientAudio.loop = true;
    ambientAudio.preload = 'auto';

    // Connect ambient audio to AudioContext via MediaElementSource
    try {
      ambientSource = audioCtx.createMediaElementSource(ambientAudio);
      ambientSource.connect(gainNode);
    } catch {
      console.warn('[audio-manager] Failed to connect ambient audio source');
    }

    // Start playing the ambient loop
    try {
      await ambientAudio.play();
    } catch {
      console.warn('[audio-manager] Ambient audio play failed');
    }

    // Preload sound effect buffers (non-blocking)
    loadSoundBuffer('audio/swipe.mp3').then((buf) => { swipeBuffer = buf; });
    loadSoundBuffer('audio/select.mp3').then((buf) => { selectBuffer = buf; });

    // Set state based on mute preference
    state = muted ? State.Muted : State.Playing;
  },

  /**
   * Play the swipe/navigation sound effect.
   * No-op if locked, muted, or failed.
   */
  playSwipeSound() {
    if (state === State.Locked || state === State.Muted || state === State.Failed) return;
    playBuffer(swipeBuffer);
  },

  /**
   * Play the select/play-button sound effect.
   * No-op if locked, muted, or failed.
   */
  playSelectSound() {
    if (state === State.Locked || state === State.Muted || state === State.Failed) return;
    playBuffer(selectBuffer);
  },

  /**
   * Set muted state. Updates gain, persists to localStorage, updates UI.
   */
  setMuted(newMuted) {
    muted = Boolean(newMuted);

    // Update gain node volume
    if (gainNode) {
      gainNode.gain.value = muted ? 0 : 1;
    }

    // Persist preference
    localStorage.setItem(STORAGE_KEY, String(muted));

    // Update state if audio is active
    if (state === State.Playing || state === State.Muted) {
      state = muted ? State.Muted : State.Playing;
    }

    // Update toggle button UI
    updateMuteToggleUI();
  },

  /**
   * Return current muted state.
   */
  isMuted() {
    return muted;
  },

  /**
   * Clean up all audio resources.
   */
  destroy() {
    // Remove event listener from mute toggle
    if (muteToggleBtn) {
      muteToggleBtn.removeEventListener('click', handleMuteToggleClick);
    }

    // Stop and clean up ambient audio
    if (ambientAudio) {
      ambientAudio.pause();
      ambientAudio.src = '';
      ambientAudio = null;
    }

    // Close AudioContext
    if (audioCtx) {
      try {
        audioCtx.close();
      } catch {
        // Ignore close errors
      }
      audioCtx = null;
    }

    // Null references
    gainNode = null;
    ambientSource = null;
    swipeBuffer = null;
    selectBuffer = null;
    muteToggleBtn = null;

    state = State.Locked;
    muted = false;
  },
};

export default audioManager;
