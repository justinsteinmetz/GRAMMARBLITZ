// ── SHARED — central export surface ───────────────────────
// No logic here. Re-exports only.

// ── AUDIO ────────────────────────────────────────────────
export {
  isMuted,
  toggleMute,
  setTempo,
  playClick,
  playCorrect,
  playWrong,
  playStreak,
  playTimeout,
  playVictory,
  playGameOver,
  startTheme,
  stopTheme
} from './audio.js';

// ── UI ───────────────────────────────────────────────────
export {
  buildGameScreen,
  buildFeedbackLayer,
  flashFeedback,
  showStreak,
  renderOptions,
  setQTag,
  startTimer,
  updateLives,
  S
} from './ui.js';

// ── CONTENT / ENGINE ─────────────────────────────────────
export {
  CHARS,
  getRound,
  getMultiRound,
  updateStats,
  getDiagnosis,
  shuffle,
  levenshtein,
  saveSession,
  loadSession,
  getToneSequence
} from './content.js';
