// === CONSTANTS & GLOBALS ===
const C = {
  GRID_ROWS: 8, GRID_COLS: 6, SPACING: 8, MARGIN: 16,
  CORE_RATIO: 0.60, RIM_RATIO: 0.05,
  MAX_TURNS: 6,
  VOWEL_ROW_GAP: 12, WORD_ROW_GAP: 24, CONTROLS_GAP: 10,
  TURNS_SCORE_GAP: 16,
  BUTTON_HEIGHT: 32, BUTTON_GAP: 22,
  WORD_ROW_BORDER_COLOR: '#1E90FF',
  WORD_ROW_BORDER_WIDTH: 1.0,
  WORD_ROW_V_PADDING: 8,
  WORD_ROW_H_PADDING: 12,
  CHAIN_LINE_WIDTH: 8,
  CHAIN_LINE_OPACITY: 0.9
};

const LETTER_VALUE = {A:1,E:1,I:1,O:1,U:1,N:1,R:1,T:1,L:1,S:1,D:1,B:1,C:1,F:1,G:1,H:1,M:1,P:1,V:1,W:1,Y:1,J:1,K:1,Q:1,X:1,Z:1};
const VOWEL_LETTERS = ['A','E','I','O','U'];

const COLORS = {
  OFF_BG:'#FFFFFF', MID_1:'#E6EEF5', MID_2:'#E6EEF5',
  ON_CORE:'#F5A623', TOP_CORE:'#2F8F83',
  RIGHT:'#2F8F83', WRONG:'#8A9199',
  VOWEL_BG:'#FFFFFF', VOWEL_TILE:'#000000',
  WORD_BG:'#1E90FF', RIM_BLACK:'#8A9199'
};

const HINT_SHADE = '#8B5A2B';

const TILE_STATES = {OFF:0,MID:1,ON:2,TOP:3,RIGHT:4,WRONG:5};
const ASSET_PATH = 'images/';
let QJYNN_RULES = globalThis.QjynnRules;
let QJYNN_WORD_VALIDATOR = globalThis.QjynnWordValidator;

function loadQjynnSupportScript(src, globalName) {
  if (globalThis[globalName] || typeof document === 'undefined') {
    return Promise.resolve(globalThis[globalName]);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(globalThis[globalName]);
    script.onerror = () => reject(new Error(`Unable to load ${src}`));
    document.head.appendChild(script);
  });
}

const qjynnSupportReady = Promise.all([
  loadQjynnSupportScript('qjynn-rules.js', 'QjynnRules'),
  loadQjynnSupportScript('word-validator.js', 'QjynnWordValidator')
]).then(([rules, validator]) => {
  QJYNN_RULES = rules;
  QJYNN_WORD_VALIDATOR = validator;
});

const TUTORIAL_LAYOUT = {"date":"2025-11-30","clue":"Daily Clue: large summer striped fruit ","grid":[[{"l":"M"},{"l":"V"},{"l":"Y"},{"l":"B"},{"l":"N"},{"l":"R"}],[{"l":"Y"},{"l":"B"},{"l":"Q"},{"l":"F"},{"l":"R"},{"l":"L"}],[{"l":"V"},{"l":"D"},{"l":"L"},{"l":"W"},{"l":"T"},{"l":"H"}],[{"l":"C"},{"l":"D"},{"l":"L"},{"l":"N"},{"l":"Z"},{"l":"N"}],[{"l":"K"},{"l":"N"},{"l":"S"},{"l":"M"},{"l":"L"},{"l":"G"}],[{"l":"W"},{"l":"S"},{"l":"R"},{"l":"T"},{"l":"S"},{"l":"X"}],[{"l":"J"},{"l":"T"},{"l":"R"},{"l":"T"},{"l":"H"},{"l":"P"}],[{"l":"G"},{"l":"S"},{"l":"C"},{"l":"F"},{"l":"D"},{"l":"P"}]],"hexalink":"WTRMLN","hexarowcol": [[5, 0],[6, 1],[5, 2],[4, 3],[4, 4],[3, 5]]};

let boxX = 0, boxW = 0, gridX = 0, gy = 0, wordY = 0;
let lastToastTime = 0, lastToastMessage = '';
let wordRowLocked = false, wordRowLockTimer = null;
let hintClicks = 0;
let hexalinkUsed = false;
let hexarowcol = [];
let hintRevealed = new Set();
let medalSize = 0, medalHitX = 0, medalHitY = 0;
let showMedals = false, medalsScrollY = 0;
let tutorialForcedTurns = null;   // Controls displayed turns in tutorial status row

let coinImage = new Image();
coinImage.src = 'data:image/svg+xml;base64,Cjxzdmcgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxkZWZzPgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJnIiBjeD0iNDAlIiBjeT0iNDAlIiByPSI5MCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmOWQ1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjZmZkYTQ0Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2U2YjgwMCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICA8L2RlZnM+CiAgPGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDgiIGZpbGw9IiNkNGEwMTciIHN0cm9rZT0iI2I4ODYwYiIgc3Ryb2tlLXdpZHRoPSI0Ii8+CiAgPGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDQiIGZpbGw9InVybCgjZykiLz4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIzOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZlYTgwIiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuNiIvPgo8L3N2Zz4K';

let medalOutlineSVG = new Image(); medalOutlineSVG.src = `${ASSET_PATH}medal_outline.svg`;
let medalBronzeSVG = new Image(); medalBronzeSVG.src = `${ASSET_PATH}medal_bronze.svg`;
let medalSilverSVG = new Image(); medalSilverSVG.src = `${ASSET_PATH}medal_silver.svg`;
let medalGoldSVG = new Image(); medalGoldSVG.src = `${ASSET_PATH}medal_gold.svg`;
let shareIconSVG = new Image(); shareIconSVG.src = `${ASSET_PATH}share_icon.svg`;
let shareInactiveSVG = new Image(); shareInactiveSVG.src = `${ASSET_PATH}share_inactive.svg`;
let shareActiveSVG = new Image(); shareActiveSVG.src = `${ASSET_PATH}share_active.svg`;
let helpIconSVG = new Image(); helpIconSVG.src = `${ASSET_PATH}help_icon_bold.svg`;

let tileSize, wordTileSize, wordGap;
let grid = [], vowels = [], wordRow = [], chain = [];
let score = 0, turns = 0, gameOver = false, confirmingReset = false;
let hideCheckButtonAtTutorialEnd = false;
let mouseDown = false, dragVowel = null;
let attemptedSeventhTile = false;
let prevWordRow = [];
let sharedContentWidth = 0, buttonStartX = 0, wordRowBoxX = 0;
let savedGameState = null;
let isProcessingCheck = false;

const TUTORIAL_MSG = { color: '#000000', font: '18px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', mobileFont: '16px system-ui,...', yOffset: 40 };

const BUTTON_NAMES = ['hint','check'];
const BTN = {};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Status row constants
const STATUS_Y = 38;
const CIRCLE_RADIUS = 4;
const CIRCLE_SPACING = 12;      // spacing between the 6 turn indicator circles
const MEDAL_SIZE = 32;
const ICON_SIZE = 20;
const STATUS_COLOR = '#333';

let rulesShowing = false, rulesOpacity = 0, rulesScrollY = 0, lastTouchY = 0;
let showMenu = false;
let tutorialMode = false;
let isDesktop = window.innerWidth >= 768;
let activeScreen = 'game';
let currentFullRows = 0;
let currentFullCols = 0;

let tutorialGrid = [], tutorialVowels = [], tutorialWordRow = [], tutorialChain = [];
let tutorialTurns = 0, tutorialScore = 0;
let message = '';
let finger = {x:0,y:0};
let animationPaused = false;
let animationShouldStop = false;
let pauseResolve = null;
let tutorialDragVowel = null;
let hexalink = '';
let beginX = 0, beginY = 0;
let alpha = 1.0;
let fadeDuration = 500;
let fadeStart = performance.now();
let scoreTooltip = null;
let medalTooltip = null;
let turnsTooltip = null;
// Near the top, after let scoreTooltip = null; let medalTooltip = null;
// === EMOJI SHARE GRID (5-CATEGORY SYSTEM) ===
// Tracks results per turn and generates spoiler-free emoji grid for sharing

// Global array to store per-turn result (persisted daily)
let turnResults = []; // [{ emoji: '🟩', wordLength: 5, isHexalink: false }, ...]

// Load saved results for today (called in initGame or on load)
function loadTurnResults() {
  const today = new Date().toISOString().slice(0, 10);
  const saved = localStorage.getItem(`qjynn_turns_${today}`);
  turnResults = saved ? JSON.parse(saved) : [];
}

// Save after each successful word submission (call this inside handleCheck after valid word)
function saveTurnResults() {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(`qjynn_turns_${today}`, JSON.stringify(turnResults));
}

// Call this at the end of a successful word validation (inside handleCheck, after score += ...)
function recordTurnResult(wordLength, isHexalink) {
  let emoji = '⬜'; // default: skip/miss

  if (wordLength >= 2) {
    if (isHexalink) {
      emoji = '⭐'; // Hexalink = star (highest)
    } else if (wordLength <= 3) {
      emoji = '🟨'; // 2–3 letters = yellow
    } else if (wordLength <= 6) {
      emoji = '🟩'; // 4–6 letters = green
    } else {
      emoji = '🟦'; // 7–10 non-hexalink = blue
    }
  }

  turnResults.push({ emoji, wordLength, isHexalink });
  saveTurnResults(); // persist immediately
}

// Reset at new day or game reset (call in initGame or daily reset logic)
function resetTurnResults() {
  turnResults = [];
  saveTurnResults();
}

scoreTooltip = document.createElement('div');
scoreTooltip.style.cssText = `
  position: absolute;
  background: rgba(0,0,0,0.9);
  color: white;
  padding: 8px 14px;
  border-radius: 8px;
  font: bold 14px Arial, sans-serif;
  pointer-events: none;
  z-index: 1001;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
`;
document.body.appendChild(scoreTooltip);

medalTooltip = document.createElement('div');
medalTooltip.style.cssText = `
  position: absolute;
  background: rgba(0,0,0,0.85);
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font: 13px Arial;
  pointer-events: none;
  z-index: 1000;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s;
`;
document.body.appendChild(medalTooltip);
turnsTooltip = document.createElement('div');
turnsTooltip.style.cssText = `
  position: absolute;
  background: rgba(0,0,0,0.85);
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font: 13px Arial;
  pointer-events: none;
  z-index: 1000;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s;
`;
document.body.appendChild(turnsTooltip);

window.gameState = {turns:0,score:0,won:false};

// === HELPER FUNCTIONS ===

// === GENERATE SHARE TEXT ===
function generateEmojiGrid() {
  const today = new Date().toISOString().slice(0, 10);
  const clue = window.EMBEDDED_LAYOUT?.clue || 'Daily Puzzle';
  const streak = localStorage.getItem('qjynn_streak') || '0';
  const turnsPlayed = turnResults.length;
  const turnsText = turnsPlayed === 1 ? '1 turn' : `${turnsPlayed} turns`;

  // Build grid line: max 6 turns
  let gridLine = '';
  for (let i = 0; i < C.MAX_TURNS; i++) {
    if (i < turnResults.length) {
      gridLine += turnResults[i].emoji;
    } else {
      gridLine += '⬜'; // unused turns
    }
  }

  // Medal (based on final score)
  let medalEmoji = '⬜';
  if (score >= 100) medalEmoji = '🥇';
  else if (score >= 70) medalEmoji = '🥈';
  else if (score >= 40) medalEmoji = '🥉';

  const shareText = `Qjynn  ${today}
Clue: ${clue}
${gridLine}${medalEmoji}
${score} pts • ${turnsText} • ${streak}🔥

qjynn.com`;

  return shareText;
}

// === INTEGRATION INTO handleShare() ===
// Replace your existing handleShare() with this version

function handleShare() {
  console.log("[handleShare] ENTERED – user agent:", navigator.userAgent);

  const shareText = generateEmojiGrid();
  console.log("[handleShare] Generated text:", shareText.substring(0, 100)); // partial log

  if (navigator.share) {
    console.log("[handleShare] navigator.share exists – attempting native share");
    navigator.share({
      title: 'My Qjynn Result',
      text: shareText
    }).then(() => {
      console.log("[handleShare] Native share succeeded");
    }).catch(err => {
      console.error("[handleShare] Native share failed:", err);
      fallbackCopy(shareText);
    });
  } else {
    console.log("[handleShare] navigator.share NOT available – fallback to copy");
    fallbackCopy(shareText);
  }
}

function fallbackCopy(text) {
  console.log("[fallbackCopy] Attempting textarea fallback");
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();

  try {
    const success = document.execCommand('copy');
    console.log("[fallbackCopy] execCommand success:", success);
    showToast(success ? 'Copied to clipboard! 📋' : 'Copy failed – manual copy needed', 3000);
  } catch (err) {
    console.error("[fallbackCopy] execCommand error:", err);
    showToast('Copy failed – manual copy needed', 3000);
  }
  document.body.removeChild(ta);
}

// === HELPER: Copy with toast (add if you don't have it) ===
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard! 📋', 2200);
  }).catch(() => {
    // Old-school fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied to clipboard! 📋', 2200);
  });
}
function updateTutorialBackButton() {
  if (tutorialBackBtn) {
    tutorialBackBtn.style.display = tutorialMode ? 'flex' : 'none';
  }
}
function resetTutorialState() {
  animationPaused = false;
  animationShouldStop = true;
  if (pauseResolve) { pauseResolve(); pauseResolve = null; }
  hintClicks = 0;
  hintRevealed.clear();
  hexalinkUsed = false;
  tutorialChain = [];
  tutorialWordRow = [];
  tutorialDragVowel = null;
  message = '';
  console.log("✓ Tutorial state fully reset");
}

function updateGameState() {
  window.gameState.turns = turns;
  window.gameState.score = score;
  window.gameState.won = gameOver && turns <= C.MAX_TURNS && rowsHaveOn();
}

function finishTurn() {
  updateGameState();
  if (activeScreen !== 'medals') render();
}

// ====================== TOAST SYSTEM ======================
function showToast(msg, duration = 1800) {
  if (tutorialMode) {
    lastToastTime = 0;
    lastToastMessage = '';
  }
  console.log("showToast:", msg);

  const now = Date.now();
  if (now - lastToastTime < 800 && msg === lastToastMessage) return;
  lastToastTime = now;
  lastToastMessage = msg;

  const toast = document.createElement('div');
  toast.textContent = msg;

  const vowelY = gy + 8 * (tileSize + C.SPACING) + C.VOWEL_ROW_GAP;
  const vowelBottom = vowelY + tileSize;
  const wordY = vowelY + tileSize + C.WORD_ROW_GAP;
  const ctrlY = wordY + wordTileSize + C.CONTROLS_GAP + 16;
  const midY = vowelBottom + (ctrlY - vowelBottom) / 2;
  const safeY = isNaN(midY) || midY < 100 ? canvas.height / 2 : midY;

  const gridW = 6 * (tileSize + C.SPACING) - C.SPACING;
  const gridCenterX = gridX + gridW / 2;
  const safeX = isNaN(gridCenterX) || gridCenterX <= 0 ? canvas.width / 2 : gridCenterX;

  toast.style.cssText = `
    position: fixed; top: ${safeY}px; left: ${safeX}px; transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.92); color: #fff; padding: 10px 16px; border-radius: 999px;
    font: 16px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    z-index: 999999; pointer-events: none; width: auto; max-width: 90vw; min-width: 240px;
    text-align: center; white-space: pre-wrap; line-height: 1.45; opacity: 0;
    transition: opacity 0.4s ease, transform 0.4s ease; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, -50%) translateY(-8px)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -50%) translateY(12px)';
    setTimeout(() => toast.remove(), 400);
  }, duration);
}
function showTutorialToast(msg, duration = 7200, target = 'clue') {
  if (!tutorialMode) return showToast(msg, duration); // fallback

  const toast = document.createElement('div');
  toast.textContent = msg;

  let yPos;
  if (target === 'clue') {
    // Overlap clue row
    const clueRect = clueDisplay.getBoundingClientRect();
    yPos = clueRect.top + clueRect.height / 2 + 12;
  } else if (target === 'word') {
    // Center in word row area
    yPos = wordY + wordTileSize / 2 + 5;
  } else {
    yPos = canvas.height / 2; // fallback
  }

  const gridW = 6 * (tileSize + C.SPACING) - C.SPACING;
  const gridCenterX = gridX + gridW / 2;
  const safeX = isNaN(gridCenterX) || gridCenterX <= 0 ? canvas.width / 2 : gridCenterX;

  toast.style.cssText = `
    position: fixed; top: ${yPos}px; left: ${safeX}px; transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.92); color: #fff; padding: 10px 10px; border-radius: 999px;
    font: 14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    z-index: 999999; pointer-events: none; width: auto; max-width: 90vw; min-width: 280px;
    text-align: center; white-space: pre-wrap; line-height: 1.45; opacity: 0;
    transition: opacity 0.4s ease, transform 0.4s ease; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, -50%) translateY(-12px)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -50%) translateY(16px)';
    setTimeout(() => toast.remove(), 600);
  }, duration);
}

// ====================== INITIALIZATION & RESIZE ======================
window.initGame = async function() {
  await qjynnSupportReady;

  // Call this once on init (add to initGame or window.load)
  setupShareTouchHandler();
  loadTurnResults(); // at start of initGame()

  // Reset grid for replay on same day
  const today = new Date().toISOString().slice(0, 10);
  const savedTurnsKey = `qjynn_turns_${today}`;
  if (localStorage.getItem(savedTurnsKey) && turns === 0 && score === 0) {
    turnResults = []; // blank grid for new playthrough
    console.log("[EmojiGrid] Replay detected — reset to blank grid");
  }

  const lastDate = localStorage.getItem('qjynn_last_date');
  if (lastDate !== today) {
    resetTurnResults(); // clears old data
    localStorage.setItem('qjynn_last_date', today);
  }
  currentFullRows = 0;
  currentFullCols = 0;
  const layout = window.EMBEDDED_LAYOUT;
  if (!layout?.grid) {
    clueDisplay.textContent = "Error: No level";
    return;
  }
  clueDisplay.textContent = layout.clue || "No clue";

  grid = layout.grid.map(row => row.map(cell => {
    const letter = (cell.l || cell.letter || 'A').toUpperCase();
    return { letter, state: TILE_STATES.OFF, value: LETTER_VALUE[letter] || 1 };
  }));

  hexalink = layout.hexalink?.toUpperCase() || '';
  hexarowcol = layout.hexarowcol || [];

  vowels = VOWEL_LETTERS.map(l => ({ letter: l, value: 1 }));

  score = turns = 0;
  gameOver = confirmingReset = rulesShowing = false;
  rulesOpacity = rulesScrollY = 0;

  updateGameState();
  resize();

  if (activeScreen !== 'medals') render();

  isProcessingCheck = false;
// At the very end of window.initGame = function(options = {}) { ... }
console.log("initGame completed – firing ready event");
const readyEvent = new CustomEvent('gameReady');
window.dispatchEvent(readyEvent);
};

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  isDesktop = w >= 768;

  tileSize = Math.max(38, Math.floor(Math.min(
    (w - 2*C.MARGIN) / (6 + 5*0.15),
    (h - 230) / (8 + 4.8),
    110
  )));

  const approxFs = Math.floor(tileSize * 0.38);
  ctx.font = `${approxFs}px Arial`;
  const texts = ['Hint', 'Check'];
  const maxTextW = Math.max(...texts.map(t => ctx.measureText(t).width));
  const approxButtonW = maxTextW + 40;
  const totalButtonsWidth = 2 * approxButtonW + C.BUTTON_GAP;

  sharedContentWidth = Math.max(totalButtonsWidth, 300);
  buttonStartX = (w - sharedContentWidth) / 2;
  wordRowBoxX = buttonStartX;

  boxX = wordRowBoxX;
  boxW = sharedContentWidth;

  const avail = sharedContentWidth - 2 * C.WORD_ROW_H_PADDING;
  wordTileSize = Math.max(32, Math.min(tileSize * 0.94, Math.floor(avail / 10.8)));
  wordGap = wordTileSize * 0.1;

  createButtons();

  const gridW = 6 * (tileSize + C.SPACING) - C.SPACING;
  canvas.width = Math.max(w, gridW + 2 * C.MARGIN);
  canvas.height = h + 220;

  gridX = (canvas.width - gridW) / 2;
  clueDisplay.style.left = `${gridX + gridW / 2}px`;
  clueDisplay.style.width = `${Math.min(640, gridW)}px`;

  const gyLocal = gridY();
  beginX = gridX + gridW + tileSize * 1.2;
  beginY = gyLocal + 4 * (tileSize + C.SPACING) + tileSize / 2;
}

window.addEventListener('resize', () => {
  if (activeScreen === 'medals') return;
  resize();
  render();
});

function restoreGameState() {
currentFullRows = 0;
currentFullCols = 0;
  if (!savedGameState) return;
  resetTutorialState();
  hexalink = '';
  hexarowcol = [];

  grid = savedGameState.grid.map(r => r.map(t => ({...t})));
  wordRow = savedGameState.wordRow.map(c => ({...c}));
  chain = savedGameState.chain.map(p => ({...p}));
  score = savedGameState.score;
  turns = savedGameState.turns;
  gameOver = savedGameState.gameOver;
  clueDisplay.textContent = savedGameState.clue;
  hexalinkUsed = savedGameState.hexalinkUsed || false;   // ← RESTORED HERE
  // ── ADD THESE LINES ──
  hintClicks = savedGameState.hintClicks || 0;
  hintRevealed = new Set(savedGameState.hintRevealed || []);

  tutorialMode = showMenu = rulesShowing = false;
  animationPaused = false;
  animationShouldStop = true;

  if (pauseResolve) {
    pauseResolve();
    pauseResolve = null;
  }

  render();
}

function saveGameState() {
  savedGameState = {
    grid: grid.map(r => r.map(t => ({...t}))),
    wordRow: wordRow.map(c => ({...c})),
    chain: chain.map(p => ({...p})),
    score, turns, gameOver,
    clue: clueDisplay.textContent,
    hexalinkUsed,   // ← SAVED HERE
    hintClicks,               // ← shorthand – clean and works
    hintRevealed: Array.from(hintRevealed)
  };
}

// ====================== RUN ANIMATION (with stop checks) ======================
async function runAnimation() {
  console.log("runAnimation() STARTED", { tutorialMode, animationShouldStop, animationPaused });

  if (!tutorialMode) {
    console.log("runAnimation early exit: tutorialMode = false");
    return;
  }

  if (animationShouldStop) {
    console.log("runAnimation early exit: animationShouldStop = true");
    return;
  }

  animationShouldStop = false;
  animationPaused = false;
  if (pauseResolve) pauseResolve();

  // Sequential tutorial toasts (5.2s each)
    //{ text: "Full circles show remaining turns\n(start with 6 — one used per turn)", target: 'clue' },
    //{ text: "Progress tracked with bronze/silver/gold medal\nTap/hold to see your current score", target: 'clue' },
  const tutorialToasts = [
    { text: "Full circles show remaining turns", target: 'clue' },
    { text: "Score board - shows current score", target: 'clue' },
    { text: "Check to validate word", target: 'word' },
    { text: "Every Hint click shows one random hexalink letter", target: 'word' }
  ];

  for (const t of tutorialToasts) {
    showTutorialToast(t.text, 2400, t.target);
    await delay(2400 + 600);
    if (animationShouldStop) return;
  }

  clueDisplay.textContent = "";
  render();

  clueDisplay.textContent = "Chain 1-6 letters, drag vowels in, form words & score BIG! ";
  render();
  finger.x = beginX; finger.y = beginY;
  await delay(4000);
  if (animationShouldStop) return;

  clueDisplay.textContent = "here we make a chain with F W T";
  render();
  for (const [r, c] of [[1,3], [2,3], [2,4]]) {
    const pos = getTileCenter(r, c, true);
    await waitWhilePaused();
    if (animationShouldStop) return;
    await animateMove(finger, pos, 500);
    if (animationShouldStop) return;
    await waitWhilePaused();
    if (animationShouldStop) return;
    await delay(500);
    if (animationShouldStop) return;
    if (!tutorialMode) return;
    tutorialGrid[r][c].state = TILE_STATES.MID;
    tutorialChain.push({row: r, col: c});
    tutorialWordRow.push({letter: tutorialGrid[r][c].letter, isVowel: false, valid: null, value: tutorialGrid[r][c].value});
    if (activeScreen !== 'medals') {
      render();
    }
    await delay(1000);
    if (animationShouldStop) return;
    if (!tutorialMode) return;
  }

  // Animate pressing "W" in the word row to remove "WT"
  const wTileIndex = 1;
  const curW = tutorialWordRow.length * wordTileSize + Math.max(0, tutorialWordRow.length - 1) * wordGap;
  const startX = boxX + C.WORD_ROW_H_PADDING + (boxW - 2 * C.WORD_ROW_H_PADDING - curW) / 2;
  const wTileX = startX + wTileIndex * (wordTileSize + wordGap) + wordTileSize / 2;
  const wTileY = wordY + wordTileSize / 2;

  finger.x = wTileX;
  finger.y = wTileY - 100;
  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  clueDisplay.textContent = "remove WT from chain";
  render();
  await delay(2000);
  if (animationShouldStop) return;

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: wTileX, y: wTileY - 20 }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y = wTileY + 20;
  render();
  await delay(120);
  if (animationShouldStop) return;

  finger.y = wTileY - 10;
  render();
  await delay(180);
  if (animationShouldStop) return;

  while (true) {
    const elapsed = performance.now() - fadeStart;
    const t = Math.min(elapsed / fadeDuration, 1);
    alpha = 1 - t;

    if (tutorialWordRow[1]) tutorialWordRow[1].tempAlpha = alpha;
    if (tutorialWordRow[2]) tutorialWordRow[2].tempAlpha = alpha;

    render();

    if (t >= 1) break;
    await new Promise(r => requestAnimationFrame(r));
    if (animationShouldStop) return;
  }

  tutorialWordRow.splice(1, 2);
  tutorialWordRow.forEach(t => delete t.tempAlpha);

  tutorialGrid[2][3].state = TILE_STATES.OFF;
  tutorialGrid[2][4].state = TILE_STATES.OFF;

  tutorialChain = tutorialChain.filter(p => p.row !== 2 || (p.col !== 3 && p.col !== 4));

  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  clueDisplay.textContent = "make a new chain with FRT"
  render();
  await delay(2000);
  if (animationShouldStop) return;

  const rPos = getTileCenter(1, 4, true);
  const tPos = getTileCenter(2, 4, true);

  finger.x = rPos.x;
  finger.y = rPos.y - 100;
  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: rPos.x, y: rPos.y - 20 }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y = rPos.y + 15;
  render();
  await delay(100);
  if (animationShouldStop) return;
  finger.y = rPos.y - 10;
  render();
  await delay(150);
  if (animationShouldStop) return;

  tutorialGrid[1][4].state = TILE_STATES.MID;
  tutorialChain.push({ row: 1, col: 4 });
  tutorialWordRow.push({
    letter: tutorialGrid[1][4].letter,
    isVowel: false,
    valid: null,
    value: tutorialGrid[1][4].value
  });
  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: tPos.x, y: tPos.y - 20 }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y = tPos.y + 15;
  render();
  await delay(100);
  if (animationShouldStop) return;
  finger.y = tPos.y - 10;
  render();
  await delay(150);
  if (animationShouldStop) return;

  tutorialGrid[2][4].state = TILE_STATES.MID;
  tutorialChain.push({ row: 2, col: 4 });
  tutorialWordRow.push({
    letter: tutorialGrid[2][4].letter,
    isVowel: false,
    valid: null,
    value: tutorialGrid[2][4].value
  });
  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;
  clueDisplay.textContent = "drag vowels \"A\" and \"I\""
  render();
  await delay(2000);
  if (animationShouldStop) return;
  render();

  const aVowelPos = getVowelCenter(0);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, aVowelPos, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialDragVowel = { letter: 'A', curX: aVowelPos.x, curY: aVowelPos.y };

  const dropIndexForA = 2;
  const dropPosA = getWordRowDropPos(dropIndexForA, tutorialWordRow);

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dropPosA, 1000, (t) => {
    if (animationShouldStop) return;
    tutorialDragVowel.curX = finger.x;
    tutorialDragVowel.curY = finger.y;
    render();
  });
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(1000);
  if (animationShouldStop) return;

  tutorialWordRow.splice(dropIndexForA, 0, {
    letter: 'A',
    isVowel: true,
    valid: null,
    value: 1
  });
  tutorialDragVowel = null;
  render();
  await delay(500);
  if (animationShouldStop) return;

  const iVowelPos = getVowelCenter(2);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, iVowelPos, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialDragVowel = { letter: 'I', curX: iVowelPos.x, curY: iVowelPos.y };

  const dropIndexForI = 2;
  const dropPosI = getWordRowDropPos(dropIndexForI, tutorialWordRow);

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dropPosI, 1000, (t) => {
    if (animationShouldStop) return;
    tutorialDragVowel.curX = finger.x;
    tutorialDragVowel.curY = finger.y;
    render();
  });
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(1000);
  if (animationShouldStop) return;

  tutorialWordRow.splice(dropIndexForI, 0, {
    letter: 'I',
    isVowel: true,
    valid: null,
    value: 1
  });
  tutorialDragVowel = null;
  render();
  await delay(500);
  if (animationShouldStop) return;

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;
  clueDisplay.textContent = "touch \"A\" to delete it"
  render();
  await delay(2000);
  if (animationShouldStop) return;

  const aIndex = tutorialWordRow.findIndex(ch => ch.letter === 'A' && ch.isVowel);
  if (aIndex === -1) {
    console.warn("A not found in word row");
    return;
  }

  const curW_A = tutorialWordRow.length * wordTileSize + Math.max(0, tutorialWordRow.length - 1) * wordGap;
  const startX_A = boxX + C.WORD_ROW_H_PADDING + (boxW - 2 * C.WORD_ROW_H_PADDING - curW_A) / 2;
  const aTileX = startX_A + aIndex * (wordTileSize + wordGap) + wordTileSize / 2;
  const aTileY = wordY + wordTileSize / 2;

  finger.x = aTileX;
  finger.y = aTileY - 100;
  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: aTileX, y: aTileY - 20 }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y = aTileY + 20;
  render();
  await delay(120);
  if (animationShouldStop) return;

  finger.y = aTileY - 10;
  render();
  await delay(180);
  if (animationShouldStop) return;

  while (true) {
    const elapsed = performance.now() - fadeStart;
    const t = Math.min(elapsed / fadeDuration, 1);
    alpha = 1 - t;

    if (tutorialWordRow[aIndex]) tutorialWordRow[aIndex].tempAlpha = alpha;

    render();

    if (t >= 1) break;
    await new Promise(r => requestAnimationFrame(r));
    if (animationShouldStop) return;
  }

  tutorialWordRow.splice(aIndex, 1);
  tutorialWordRow.forEach(t => delete t.tempAlpha);

  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;
  clueDisplay.textContent = "drag \"U\" and drop to the right of \"FR\""
  render();
  await delay(2000);
  if (animationShouldStop) return;

  const uVowelIndex = 4;
  const uVowelPos = getVowelCenter(uVowelIndex);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, uVowelPos, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialDragVowel = { letter: 'U', curX: uVowelPos.x, curY: uVowelPos.y };

  const rIndex = tutorialWordRow.findIndex(ch => ch.letter === 'R' && !ch.isVowel);
  const dropIndexForU = rIndex !== -1 ? rIndex + 1 : tutorialWordRow.length;

  const dropPosU = getWordRowDropPos(dropIndexForU, tutorialWordRow);

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dropPosU, 1000, (t) => {
    if (animationShouldStop) return;
    tutorialDragVowel.curX = finger.x;
    tutorialDragVowel.curY = finger.y;
    render();
  });
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(1000);
  if (animationShouldStop) return;

  tutorialWordRow.splice(dropIndexForU, 0, {
    letter: 'U',
    isVowel: true,
    valid: null,
    value: 1
  });
  tutorialDragVowel = null;
  render();
  await delay(800);
  if (animationShouldStop) return;

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;
  clueDisplay.textContent = "click Check to validate \"FRUIT\""
  render();
  await delay(2000);
  if (animationShouldStop) return;

  const checkBtnPosFRUIT = getButtonCenter('check');
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, checkBtnPosFRUIT, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12;
  render();
  await delay(100);
  if (animationShouldStop) return;
  finger.y -= 12;
  render();
  await delay(250);
  if (animationShouldStop) return;

  chain = tutorialChain.map(p => ({ ...p }));
  grid = tutorialGrid.map(row => row.map(t => ({ ...t })));
  wordRow = tutorialWordRow.map(ch => ({ ...ch }));

  console.log("[Tutorial Check] Synced chain:", chain.map(p => `(${p.row},${p.col})`));
  console.log("[Tutorial Check] Word:", wordRow.map(c => c.letter).join(''));

  console.log("[Tutorial] Starting real handleCheck() for FRUIT");
  hexalinkUsed = false;
  render();
  await handleCheck();
  if (tutorialMode) tutorialForcedTurns = 1;
  if (animationShouldStop) return;
  console.log("[Tutorial] handleCheck() finished - score:", score, "turns:", turns);
  render();

  tutorialGrid = grid.map(row => row.map(t => ({ ...t })));

  tutorialGrid[1][3].state = TILE_STATES.ON;
  tutorialGrid[1][4].state = TILE_STATES.ON;
  tutorialGrid[2][4].state = TILE_STATES.ON;

  await delay(2000);
  if (animationShouldStop) return;

  chain = [];
  wordRow = [];
  tutorialChain = [];
  tutorialWordRow = [];
  wordRowLocked = false;
  clearTimeout(wordRowLockTimer);

  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;
  clueDisplay.textContent = "Next you'll see a daily clue"
  render();
  await delay(2000);
  if (animationShouldStop) return;
  clueDisplay.textContent = TUTORIAL_LAYOUT.clue
  render();
  await delay(4000);
  if (animationShouldStop) return;
  clueDisplay.textContent = "if WATERMELON is a guess for the daily clue"
  render();
  await delay(4000);
  if (animationShouldStop) return;
  clueDisplay.textContent = "W T R M L N will be the hexalink "
  render();
  await delay(4000);
  if (animationShouldStop) return;
  clueDisplay.textContent = "use Hint button to help reveal hexalink "
  render();
  await delay(4000);
  if (animationShouldStop) return;
  clueDisplay.textContent = "each click shows one random letter in hexalink"
  render();
  await delay(4000);
  if (animationShouldStop) return;
  clueDisplay.textContent = "Note: hexalink can start on either side of the grid"
  render();
  await delay(4000);
  if (animationShouldStop) return;

  hintClicks = 0;
  hintRevealed.clear();
  turns = 1;

  const hintBtnPos = getButtonCenter('hint');

  for (let clickNum = 1; clickNum <= 5; clickNum++) {
    await waitWhilePaused();
    if (animationShouldStop) return;
    await animateMove(finger, hintBtnPos, 500);
    if (animationShouldStop) return;
    await waitWhilePaused();
    if (animationShouldStop) return;
    await delay(500);
    if (animationShouldStop) return;

    finger.y += 12;
    render();
    await delay(100);
    if (animationShouldStop) return;
    finger.y -= 12;
    render();
    await delay(200);
    if (animationShouldStop) return;

    await handleHint();
    if (animationShouldStop) return;

    render();
    await delay(2000);
    if (animationShouldStop) return;

  }

  clueDisplay.textContent = "The sixth click costs a turn"
  render();
  await delay(2000);
  if (animationShouldStop) return;

  await delay(1000);
  if (animationShouldStop) return;
  render();

  tutorialChain = [];
  tutorialWordRow = [];
  render();
  await delay(800);
  if (animationShouldStop) return;

  clueDisplay.textContent = "Now form the hexalink, W T R M L N"
  render();
  await delay(4000);
  if (animationShouldStop) return;

  const hexalinkPositions = [
    [5,0], [6,1], [5,2], [4,3], [4,4], [3,5]
  ];

  for (const [row, col] of hexalinkPositions) {
    const pos = getTileCenter(row, col, true);
    await waitWhilePaused();
    if (animationShouldStop) return;
    await animateMove(finger, pos, 700);
    if (animationShouldStop) return;
    await waitWhilePaused();
    if (animationShouldStop) return;
    await delay(1000);
    if (animationShouldStop) return;

    finger.y += 12;
    render();
    await delay(80);
    if (animationShouldStop) return;
    finger.y -= 12;
    render();
    await delay(150);
    if (animationShouldStop) return;

    tutorialGrid[row][col].state = TILE_STATES.MID;
    tutorialChain.push({ row, col });
    tutorialWordRow.push({
      letter: tutorialGrid[row][col].letter,
      isVowel: false,
      valid: null,
      value: tutorialGrid[row][col].value
    });

    render();
    await delay(400);
    if (animationShouldStop) return;
  }

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;
  render();
  await delay(500);
  if (animationShouldStop) return;

  clueDisplay.textContent = "add vowels to make WATERMELON"
  render();
  await delay(4000);
  if (animationShouldStop) return;

  const vowelDrops = [
    { vowel: 'A', insertAt: 1 },
    { vowel: 'E', insertAt: 3 },
    { vowel: 'E', insertAt: 6 },
    { vowel: 'O', insertAt: 8 }
  ];

  for (const { vowel, insertAt } of vowelDrops) {
    const vowelIndex = VOWEL_LETTERS.indexOf(vowel);
    const vpos = getVowelCenter(vowelIndex);

    await waitWhilePaused();
    if (animationShouldStop) return;
    await animateMove(finger, vpos, 500);
    if (animationShouldStop) return;
    await waitWhilePaused();
    if (animationShouldStop) return;
    await delay(500);
    if (animationShouldStop) return;

    tutorialDragVowel = { letter: vowel, curX: vpos.x, curY: vpos.y };

    const dropPos = getWordRowDropPos(insertAt, tutorialWordRow);
    await waitWhilePaused();
    if (animationShouldStop) return;
    await animateMove(finger, dropPos, 1000, (t) => {
      if (animationShouldStop) return;
      tutorialDragVowel.curX = finger.x;
      tutorialDragVowel.curY = finger.y;
      render();
    });
    await waitWhilePaused();
    if (animationShouldStop) return;
    await delay(1000);
    if (animationShouldStop) return;

    tutorialWordRow.splice(insertAt, 0, {
      letter: vowel,
      isVowel: true,
      valid: null,
      value: 1
    });
    tutorialDragVowel = null;

    render();
    await delay(800);
    if (animationShouldStop) return;
  }

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;
  render();
  await delay(1000);
  if (animationShouldStop) return;

  clueDisplay.textContent = "click Check to validate WATERMELON"
  render();
  await delay(4000);
  if (animationShouldStop) return;

  const checkBtnPosWater = getButtonCenter('check');
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, checkBtnPosWater, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12;
  render();
  await delay(100);
  if (animationShouldStop) return;
  finger.y -= 12;
  render();
  await delay(250);
  if (animationShouldStop) return;

  chain = tutorialChain.map(p => ({ ...p }));
  grid = tutorialGrid.map(row => row.map(t => ({ ...t })));
  wordRow = tutorialWordRow.map(ch => ({ ...ch }));

  hexalinkUsed = true;
  render();

  console.log("[Tutorial Hexalink] Validating WATERMELON");
  render();
  await handleCheck();
  if (tutorialMode) tutorialForcedTurns = 2;
  if (animationShouldStop) return;

  const hexalinkPos = [[5,0],[6,1],[5,2],[4,3],[4,4],[3,5]];
  hexalinkPos.forEach(([r, c]) => {
    tutorialGrid[r][c].state = TILE_STATES.ON;
  });

  await delay(2000);
  if (animationShouldStop) return;

  chain = [];
  wordRow = [];
  tutorialChain = [];
  tutorialWordRow = [];
  wordRowLocked = false;
  clearTimeout(wordRowLockTimer);

  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  render();

  // === NEXT ANIMATION STEP: ===

  const checkBtnPos = getButtonCenter('check');

  // Step 1: Chain N [0,4] → L [1,5] → R [0,5], drag A / I / E → "NAILER"
  clueDisplay.textContent = "Form a new chain N L R";
  render();
  await delay(500);
  if (animationShouldStop) return;

  const nPos = getTileCenter(0, 4, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, nPos, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[0][4].state = TILE_STATES.MID;
  tutorialChain.push({ row: 0, col: 4 });
  tutorialWordRow.push({ letter: 'N', isVowel: false, valid: null, value: 1 });
  render();

  const lPos = getTileCenter(1, 5, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, lPos, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[1][5].state = TILE_STATES.MID;
  tutorialChain.push({ row: 1, col: 5 });
  tutorialWordRow.push({ letter: 'L', isVowel: false, valid: null, value: 1 });
  render();

  const rPosStep1 = getTileCenter(0, 5, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, rPosStep1, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[0][5].state = TILE_STATES.MID;
  tutorialChain.push({ row: 0, col: 5 });
  tutorialWordRow.push({ letter: 'R', isVowel: false, valid: null, value: 1 });
  render();

  clueDisplay.textContent = "add vowels A I E into word row";
  render();
  await delay(500);
  if (animationShouldStop) return;
  // Drag A between N and L (insert at 1 → N A L R)
  const aVowelPos1 = getVowelCenter(0);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, aVowelPos1, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialDragVowel = { letter: 'A', curX: aVowelPos1.x, curY: aVowelPos1.y };
  const dropPosA1 = getWordRowDropPos(1, tutorialWordRow);

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dropPosA1, 1000, (t) => {
    if (animationShouldStop) return;
    tutorialDragVowel.curX = finger.x;
    tutorialDragVowel.curY = finger.y;
    render();
  });
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialWordRow.splice(1, 0, { letter: 'A', isVowel: true, valid: null, value: 1 });
  tutorialDragVowel = null;
  render();

  // Drag I between A and L (insert at 2 → N A I L R)
  const iVowelPos1 = getVowelCenter(2);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, iVowelPos1, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialDragVowel = { letter: 'I', curX: iVowelPos1.x, curY: iVowelPos1.y };
  const dropPosI1 = getWordRowDropPos(2, tutorialWordRow);

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dropPosI1, 1000, (t) => {
    if (animationShouldStop) return;
    tutorialDragVowel.curX = finger.x;
    tutorialDragVowel.curY = finger.y;
    render();
  });
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialWordRow.splice(2, 0, { letter: 'I', isVowel: true, valid: null, value: 1 });
  tutorialDragVowel = null;
  render();

  // Drag E between L and R (insert at 4 → N A I L E R)
  const eVowelPos1 = getVowelCenter(1);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, eVowelPos1, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialDragVowel = { letter: 'E', curX: eVowelPos1.x, curY: eVowelPos1.y };
  const dropPosE1 = getWordRowDropPos(4, tutorialWordRow);

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dropPosE1, 1000, (t) => {
    if (animationShouldStop) return;
    tutorialDragVowel.curX = finger.x;
    tutorialDragVowel.curY = finger.y;
    render();
  });
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialWordRow.splice(4, 0, { letter: 'E', isVowel: true, valid: null, value: 1 });
  tutorialDragVowel = null;
  render();

  clueDisplay.textContent = "click Check to validate NAILER"
  render();
  await delay(500);
  if (animationShouldStop) return;
  render();

  // Click Check
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, checkBtnPos, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(250);

  chain = tutorialChain.map(p => ({ ...p }));
  grid = tutorialGrid.map(row => row.map(t => ({ ...t })));
  wordRow = tutorialWordRow.map(ch => ({ ...ch }));

  await handleCheck();
  if (tutorialMode) tutorialForcedTurns = (tutorialForcedTurns || 0) + 1;
  if (animationShouldStop) return;

  chain.forEach(p => {
    grid[p.row][p.col].state = TILE_STATES.ON;
  });

  tutorialGrid = grid.map(row => row.map(t => ({ ...t })));

  tutorialChain.forEach(p => {
    tutorialGrid[p.row][p.col].state = TILE_STATES.ON;
  });

  render();
  await delay(1200);

  await delay(2000);
  if (animationShouldStop) return;

  chain = [];
  wordRow = [];
  tutorialChain = [];
  tutorialWordRow = [];
  wordRowLocked = false;
  clearTimeout(wordRowLockTimer);
  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  // Step 2: Chain Z [3,4] → G [4,5], drag A between Z and G → Check
  clueDisplay.textContent = "form a new chain with Z and G";
  render();
  await delay(500);
  if (animationShouldStop) return;

  const zPos2 = getTileCenter(3, 4, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, zPos2, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[3][4].state = TILE_STATES.MID;
  tutorialChain.push({ row: 3, col: 4 });
  tutorialWordRow.push({ letter: 'Z', isVowel: false, valid: null, value: 1 });
  render();

  const gPos2 = getTileCenter(4, 5, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, gPos2, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[4][5].state = TILE_STATES.MID;
  tutorialChain.push({ row: 4, col: 5 });
  tutorialWordRow.push({ letter: 'G', isVowel: false, valid: null, value: 1 });
  render();

  const aVowelPos2 = getVowelCenter(0);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, aVowelPos2, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  clueDisplay.textContent = "add vowel A between Z and G";
  render();
  await delay(500);
  if (animationShouldStop) return;

  tutorialDragVowel = { letter: 'A', curX: aVowelPos2.x, curY: aVowelPos2.y };
  const dropPosA2 = getWordRowDropPos(1, tutorialWordRow);

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dropPosA2, 1000, (t) => {
    if (animationShouldStop) return;
    tutorialDragVowel.curX = finger.x;
    tutorialDragVowel.curY = finger.y;
    render();
  });
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(800);
  if (animationShouldStop) return;

  tutorialWordRow.splice(1, 0, { letter: 'A', isVowel: true, valid: null, value: 1 });
  tutorialDragVowel = null;
  render();

  clueDisplay.textContent = "click Check to validate ZAG"
  render();
  await delay(500);
  if (animationShouldStop) return;
  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, checkBtnPos, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(250);

  chain = tutorialChain.map(p => ({ ...p }));
  grid = tutorialGrid.map(row => row.map(t => ({ ...t })));
  wordRow = tutorialWordRow.map(ch => ({ ...ch }));

  await handleCheck();
  if (tutorialMode) tutorialForcedTurns = (tutorialForcedTurns || 0) + 1;
  if (animationShouldStop) return;

  chain.forEach(p => {
    grid[p.row][p.col].state = TILE_STATES.ON;
  });

  tutorialGrid = grid.map(row => row.map(t => ({ ...t })));

  tutorialChain.forEach(p => {
    tutorialGrid[p.row][p.col].state = TILE_STATES.ON;
  });

  render();
  await delay(1000);

  await delay(2000);
  if (animationShouldStop) return;

  chain = [];
  wordRow = [];
  tutorialChain = [];
  tutorialWordRow = [];
  wordRowLocked = false;
  clearTimeout(wordRowLockTimer);
  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  // Step 3: Chain S [5,4] → H [6,4] → D [7,4], drag E between H and D → Check
  clueDisplay.textContent = "form a new chain S H D";
  render();
  await delay(500);
  if (animationShouldStop) return;

  const sPos3 = getTileCenter(5, 4, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, sPos3, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[5][4].state = TILE_STATES.MID;
  tutorialChain.push({ row: 5, col: 4 });
  tutorialWordRow.push({ letter: 'S', isVowel: false, valid: null, value: 1 });
  render();

  const hPos3 = getTileCenter(6, 4, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, hPos3, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[6][4].state = TILE_STATES.MID;
  tutorialChain.push({ row: 6, col: 4 });
  tutorialWordRow.push({ letter: 'H', isVowel: false, valid: null, value: 1 });
  render();

  const dPos3 = getTileCenter(7, 4, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dPos3, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[7][4].state = TILE_STATES.MID;
  tutorialChain.push({ row: 7, col: 4 });
  tutorialWordRow.push({ letter: 'D', isVowel: false, valid: null, value: 1 });
  render();

  const eVowelPos3 = getVowelCenter(1);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, eVowelPos3, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  clueDisplay.textContent = "add vowel E between H and D";
  render();
  await delay(500);
  if (animationShouldStop) return;

  tutorialDragVowel = { letter: 'E', curX: eVowelPos3.x, curY: eVowelPos3.y };
  const dropPosE3 = getWordRowDropPos(2, tutorialWordRow);

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dropPosE3, 1000, (t) => {
    if (animationShouldStop) return;
    tutorialDragVowel.curX = finger.x;
    tutorialDragVowel.curY = finger.y;
    render();
  });
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(800);
  if (animationShouldStop) return;

  tutorialWordRow.splice(2, 0, { letter: 'E', isVowel: true, valid: null, value: 1 });
  tutorialDragVowel = null;
  render();

  clueDisplay.textContent = "click Check to validate SHED"
  render();
  await delay(500);
  if (animationShouldStop) return;
  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, checkBtnPos, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(250);

  chain = tutorialChain.map(p => ({ ...p }));
  grid = tutorialGrid.map(row => row.map(t => ({ ...t })));
  wordRow = tutorialWordRow.map(ch => ({ ...ch }));

  await handleCheck();
  if (tutorialMode) tutorialForcedTurns = (tutorialForcedTurns || 0) + 1;
  if (animationShouldStop) return;

  chain.forEach(p => {
    grid[p.row][p.col].state = TILE_STATES.ON;
  });

  tutorialGrid = grid.map(row => row.map(t => ({ ...t })));

  tutorialChain.forEach(p => {
    tutorialGrid[p.row][p.col].state = TILE_STATES.ON;
  });

  render();
  await delay(1000);

  await delay(2000);
  if (animationShouldStop) return;

  chain = [];
  wordRow = [];
  tutorialChain = [];
  tutorialWordRow = [];
  wordRowLocked = false;
  clearTimeout(wordRowLockTimer);
  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  // New Step 4: Chain K [4,0] → N [4,1] → S [4,2], drag E / E → "KNEES"
  clueDisplay.textContent = "form a new chain with K, N, S";
  render();
  await delay(2000);
  if (animationShouldStop) return;

  const kPos4 = getTileCenter(4, 0, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, kPos4, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[4][0].state = TILE_STATES.MID;
  tutorialChain.push({ row: 4, col: 0 });
  tutorialWordRow.push({ letter: 'K', isVowel: false, valid: null, value: 1 });
  render();

  const nPos4 = getTileCenter(4, 1, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, nPos4, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[4][1].state = TILE_STATES.MID;
  tutorialChain.push({ row: 4, col: 1 });
  tutorialWordRow.push({ letter: 'N', isVowel: false, valid: null, value: 1 });
  render();

  const sPos4 = getTileCenter(4, 2, true);
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, sPos4, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(200);
  tutorialGrid[4][2].state = TILE_STATES.MID;
  tutorialChain.push({ row: 4, col: 2 });
  tutorialWordRow.push({ letter: 'S', isVowel: false, valid: null, value: 1 });
  render();

  clueDisplay.textContent = "add vowel E twice between N and S";
  render();
  await delay(500);
  if (animationShouldStop) return;

  // Drag first E between N and S (insert at 2 → K N E S)
  const eVowelPos4a = getVowelCenter(1); // E
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, eVowelPos4a, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialDragVowel = { letter: 'E', curX: eVowelPos4a.x, curY: eVowelPos4a.y };
  const dropPosE4a = getWordRowDropPos(2, tutorialWordRow);

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dropPosE4a, 1000, (t) => {
    if (animationShouldStop) return;
    tutorialDragVowel.curX = finger.x;
    tutorialDragVowel.curY = finger.y;
    render();
  });
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(800);
  if (animationShouldStop) return;

  tutorialWordRow.splice(2, 0, { letter: 'E', isVowel: true, valid: null, value: 1 });
  tutorialDragVowel = null;
  render();

  // Drag second E between E and S (insert at 3 → K N E E S)
  const eVowelPos4b = getVowelCenter(1); // E again
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, eVowelPos4b, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  tutorialDragVowel = { letter: 'E', curX: eVowelPos4b.x, curY: eVowelPos4b.y };
  const dropPosE4b = getWordRowDropPos(3, tutorialWordRow);

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, dropPosE4b, 1000, (t) => {
    if (animationShouldStop) return;
    tutorialDragVowel.curX = finger.x;
    tutorialDragVowel.curY = finger.y;
    render();
  });
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(800);
  if (animationShouldStop) return;

  tutorialWordRow.splice(3, 0, { letter: 'E', isVowel: true, valid: null, value: 1 });
  tutorialDragVowel = null;
  render();

  clueDisplay.textContent = "click Check to validate KNEES";
  render();
  await delay(300);
  if (animationShouldStop) return;

  // Click Check to validate "KNEES"
  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, checkBtnPos, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;

  finger.y += 12; render(); await delay(100);
  finger.y -= 12; render(); await delay(250);

  chain = tutorialChain.map(p => ({ ...p }));
  grid = tutorialGrid.map(row => row.map(t => ({ ...t })));
  wordRow = tutorialWordRow.map(ch => ({ ...ch }));

  await handleCheck();
  if (tutorialMode) tutorialForcedTurns = (tutorialForcedTurns || 0) + 1;
  if (animationShouldStop) return;

  chain.forEach(p => {
    grid[p.row][p.col].state = TILE_STATES.ON;
  });

  tutorialGrid = grid.map(row => row.map(t => ({ ...t })));

  tutorialChain.forEach(p => {
    tutorialGrid[p.row][p.col].state = TILE_STATES.ON;
  });

  render();

  await waitWhilePaused();
  if (animationShouldStop) return;
  await animateMove(finger, { x: beginX, y: beginY }, 500);
  if (animationShouldStop) return;
  await waitWhilePaused();
  if (animationShouldStop) return;
  await delay(500);
  if (animationShouldStop) return;


  await delay(500);
  // Cleanup word row / chain
  chain = [];
  wordRow = [];
  tutorialChain = [];
  tutorialWordRow = [];
  wordRowLocked = false;
  clearTimeout(wordRowLockTimer);
  render();

  // Final tutorial completion: hide Check, show medal + final score message
  await delay(500);
  if (animationShouldStop) return;

  // 1. Hide Check button by skipping its draw
  hideCheckButtonAtTutorialEnd = true;
  render();  // redraw immediately → Check disappears

  await delay(4000); // give time to read + see medal

  // 3. Set final message
  clueDisplay.textContent = `Tutorial complete!`;

  // 4. Trigger game-over visuals (medal overlay)
  gameOver = true;
  confirmingReset = false;
  render();  // redraw with medal

  console.log("Tutorial end → Final message set:", clueDisplay.textContent);


  render();
  hideCheckButtonAtTutorialEnd = false;

  console.log("runAnimation completed normally");
}

// ====================== START TUTORIAL ======================
function startTutorial() {
  console.log("startTutorial called - switching to TUTORIAL_LAYOUT");
  saveGameState();
  resetTutorialState();           // ← clean state
  // ── CRITICAL FIX ──
  animationShouldStop = false;    // ← Force allow animation to run
  animationPaused = true;         // Start paused so user sees "Tap to start"
  // ──────────────────
  tutorialMode = true;
  hexalinkUsed = false;

  clueDisplay.textContent = TUTORIAL_LAYOUT.clue;
  tutorialGrid = TUTORIAL_LAYOUT.grid.map(row => row.map(cell => {
    const letter = (cell.l || 'A').toUpperCase();
    return { letter, state: TILE_STATES.OFF, value: LETTER_VALUE[letter] || 1 };
  }));
  tutorialVowels = VOWEL_LETTERS.map(l => ({letter: l, value: 1}));
  tutorialWordRow = []; tutorialChain = [];
  tutorialTurns = tutorialScore = 0;
  message = '';
  finger.x = beginX; finger.y = beginY;
  tutorialDragVowel = null;
  wordRow = [];

  resize();
  render();

  runAnimation();
}

// ====================== REMAINING CODE (unchanged) ======================
///////////////////////////////

function showMedalTooltip(show, scoreValue) {
  if (show) {
    medalTooltip.textContent = `Score: ${scoreValue}`;
    medalTooltip.style.opacity = '1';
  } else {
    medalTooltip.style.opacity = '0';
  }
}


function showTurnsTooltip(show) {
  if (!turnsTooltip) {
    turnsTooltip = document.createElement('div');
    turnsTooltip.style.cssText = `
      position: absolute;
      background: rgba(0,0,0,0.85);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font: 13px Arial;
      pointer-events: none;
      z-index: 1000;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.2s;
    `;
    document.body.appendChild(turnsTooltip);
  }

  if (show) {
    turnsTooltip.textContent = `Remaining Turns: ${C.MAX_TURNS - turns}`;
    turnsTooltip.style.opacity = '1';
  } else {
    turnsTooltip.style.opacity = '0';
  }
}

function showScoreTooltip(show, currentScore) {
  if (show) {
    scoreTooltip.textContent = `Score: ${currentScore}`;
    // Position near medal (adjust offsets based on your layout)
    const rect = canvas.getBoundingClientRect();
    const medalScreenX = rect.left + medalHitX * (rect.width / canvas.width);
    const medalScreenY = rect.top + medalHitY * (rect.height / canvas.height);
    scoreTooltip.style.left = `${medalScreenX + 20}px`; // 20px right of medal
    scoreTooltip.style.top = `${medalScreenY - 40}px`;  // 40px above
    scoreTooltip.style.opacity = '1';
  } else {
    scoreTooltip.style.opacity = '0';
  }
}

// ====================== INITIALIZATION & RESIZE ======================
function createButtons(){
  const fs = Math.floor(tileSize * 0.38); // keep fs based on tileSize for text size
  ctx.font = `bold ${fs}px Arial`;

  const texts = ['Hint', 'Check'];
  BUTTON_NAMES.forEach((name, i) => {
    const text = texts[i];
    const textW = ctx.measureText(text).width;
    const buttonW = textW + 80; // horizontal padding for pill

    const c = document.createElement('canvas');
    c.width = buttonW;
    c.height = wordTileSize; // exact match to word row height
    const bctx = c.getContext('2d');

    const radius = wordTileSize / 2; // full pill rounding on ends

    // Draw pill background
    bctx.beginPath();
    bctx.moveTo(radius, 0);
    bctx.lineTo(buttonW - radius, 0);
    bctx.quadraticCurveTo(buttonW, 0, buttonW, radius);
    bctx.lineTo(buttonW, wordTileSize - radius);
    bctx.quadraticCurveTo(buttonW, wordTileSize, buttonW - radius, wordTileSize);
    bctx.lineTo(radius, wordTileSize);
    bctx.quadraticCurveTo(0, wordTileSize, 0, radius);
    bctx.lineTo(0, radius);
    bctx.quadraticCurveTo(0, 0, radius, 0);
    bctx.closePath();
    bctx.fillStyle = '#f5f5f5'; // light gray background
    bctx.fill();

    // Subtle border
    bctx.strokeStyle = '#d1d5db'; // soft gray
    bctx.lineWidth = 1.0;
    bctx.stroke();

    // Text
    bctx.fillStyle = '#111827'; // dark text
    bctx.font = `${fs}px Arial`;
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText(text, buttonW / 2, wordTileSize / 2 + 1);

    BTN[name] = {canvas: c, width: buttonW, height: wordTileSize};
  });
}

// ====================== ROUNDED WORD BOX ======================
function drawRoundedRect(x,y,w,h,radius,fill,stroke=null,lineWidth=1){
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.lineTo(x+w-radius,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+radius);
  ctx.lineTo(x+w,y+h-radius);
  ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
  ctx.lineTo(x+radius,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-radius);
  ctx.lineTo(x,y+radius);
  ctx.quadraticCurveTo(x,y,x+radius,y);
  ctx.closePath();
  ctx.fillStyle=fill;
  ctx.fill();
  if(stroke){
    ctx.strokeStyle=stroke;
    ctx.lineWidth=lineWidth;
    ctx.stroke();
  }
}

// ====================== RENDERING ======================
function renderRules() {
  if (activeScreen === 'medals') return;

  // Early exit if fully hidden
  if (!rulesShowing && rulesOpacity <= 0) {
    rulesOpacity = 0;
    return;
  }

  // Fade
  rulesOpacity = rulesShowing 
    ? Math.min(1, rulesOpacity + 0.1) 
    : Math.max(0, rulesOpacity - 0.1);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = `rgba(0,0,0,${0.6 * rulesOpacity})`;
  ctx.fillRect(0, 0, w, h);

  const isSmall = w < 480;
  const cardW = isSmall ? w - 40 : Math.min(480, w - 80);
  const cardH = h - (isSmall ? 120 : 180);
  const cardX = (w - cardW) / 2;
  const cardY = isSmall ? 60 : 100;

  ctx.save();
  ctx.globalAlpha = rulesOpacity;

  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.roundRect(cardX, cardY, cardW, cardH, 16);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent'; // fully reset shadow

  ctx.save();
  ctx.beginPath(); // clear any pending paths
  ctx.rect(cardX + 20, cardY + 20, cardW - 40, cardH - 40);
  ctx.clip();

  // Explicitly fill clipped area with white (overrides any potential leak)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cardX + 20, cardY + 20, cardW - 40, cardH - 40);

  ctx.fillStyle = '#111827';
  ctx.font = isSmall ? 'bold 19px system-ui, sans-serif' : 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Playing Rules', w / 2, cardY + 40 + rulesScrollY);

  // Rules text
  const lines = [
    "Goal: Score a maximum of points in 6 turns by forming words",
    "How to play:",
    "• Tap 1–6 adjacent (horizontal, vertical, diagonal) letters to form a chain",
    "• Hexalink: a chain with one letter in every column",
    "• NOTE: hexalink can start on either side of the grid",
    "• Chain appears below the vowel letter row",
    "• Drag vowels into the chain of letters to form a word",
    "• Press Check button to validate a word",
    "  Valid → chain turns gold + points",
    "  Invalid → chain turns white, no points",
    "How to undo plays:",
    "• Touch a vowel to delete it",
    "• Touch a consonant to delete it and all letters to right of it",
    "Buttons:",
    "• Check → validate word",
    "• Check → show current score when no chain formed yet",
    "• Hint  → each click shows a hexalink letter randomly",
    "• Hint  → first 5 are free clicks; 6th counts for a turn",
    "Letters:",
    "• Max 10 letters per word",
    "• Use the top clue for a hexalink based word",
    "Scoring:",
    "• 2,3-letter words - 1/letter points",
    "• 4,5,6-letter words - 2/letter points",
    "• 7,8-letter words - 10 (word) + 5 (bonus) points",
    "• 9,10-letter words - 10 (word) + 10 (bonus) points",
    "• Hexalink words - word score + 10 (bonus) points",
    "• Additional points: all gold dots in a row =  +10",
    "• Additional points: all gold dots in a column =  +20",
    "Medals:",
    "• Gold   : 100+ points",
    "• Silver : 70–99 points",
    "• Bronze : 40–69 points",
    "• None   : <40 points"
  ];

  ctx.textAlign = 'left';
  ctx.fillStyle = '#1f2937';
  let y = cardY + 80 + rulesScrollY;

  const lineHeight = isSmall ? 22 : 24;
  const fontBase = isSmall ? '13px system-ui, sans-serif' : '14px system-ui, sans-serif';
  const fontBold = isSmall ? 'bold 14px system-ui, sans-serif' : 'bold 15px system-ui, sans-serif';

  const leftPad = cardX + (isSmall ? 20 : 32);
  const maxWidth = cardW - (isSmall ? 40 : 64);

  lines.forEach((line, i) => {
    ctx.font = [1, 10, 13, 18, 21, 29].includes(i) ? fontBold : fontBase;

    if (ctx.measureText(line).width > maxWidth) {
      const words = line.split(' ');
      let current = '';
      for (const word of words) {
        const test = current + word + ' ';
        if (ctx.measureText(test).width > maxWidth && current) {
          ctx.fillText(current.trim(), leftPad, y);
          y += lineHeight;
          current = word + ' ';
        } else {
          current = test;
        }
      }
      ctx.fillText(current.trim(), leftPad, y);
      y += lineHeight;
    } else {
      ctx.fillText(line, leftPad, y);
      y += lineHeight;
    }
  });

  // ... emoji legend (unchanged) ...
  y += lineHeight * 1.5; // extra spacing after last rule

  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#111827';
  ctx.fillText('Share uses these emojis:', leftPad, y);
  y += lineHeight;

  const legend = [
    { emoji: '⬜', text: 'Skipped or missed turn' },
    { emoji: '🟨', text: '2–3 letter word' },
    { emoji: '🟩', text: '4–6 letter word' },
    { emoji: '🟦', text: '7–10 letter word (non-hexalink)' },
    { emoji: '⭐', text: 'Hexalink word' },
    { emoji: '🥇🥈🥉', text: 'Final medal (gold/silver/bronze)' }
  ];

  ctx.font = '14px system-ui, sans-serif';
  legend.forEach(item => {
    ctx.fillText(item.emoji + '  ' + item.text, leftPad + 20, y);
    y += lineHeight;
  });

  ctx.restore();

  drawBackArrow(cardX + (isSmall ? 20 : 30), cardY + (isSmall ? 30 : 40));

  ctx.restore();

  if (rulesOpacity > 0 && rulesOpacity < 1) {
    requestAnimationFrame(renderRules);
  }
}
function drawStatusRow() {
  const centerX = canvas.width / 2;
  let currentX = centerX - (6 * CIRCLE_SPACING / 2) - 80;

  // Turns circles
  for (let i = 0; i < C.MAX_TURNS; i++) {
    const x = currentX + i * CIRCLE_SPACING;
    ctx.beginPath();
    ctx.arc(x, STATUS_Y, CIRCLE_RADIUS, 0, Math.PI * 2);
    
    // FIXED: Use scripted turns in tutorial mode
    let displayTurns = turns;
    if (tutorialMode && tutorialForcedTurns !== null) {
      displayTurns = tutorialForcedTurns;
    }
    
    ctx.fillStyle = (C.MAX_TURNS - displayTurns > i) ? '#000000' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  currentX += 6 * CIRCLE_SPACING + 30;

// Current score display (replaces medal stand)
const scoreX = currentX + 0;  // shift a bit right from where medal was
const scoreY = STATUS_Y;

ctx.font = '18px Arial, sans-serif';  // ≈ height of circles (adjust 16–20px as needed)
ctx.fillStyle = '#000000';                 // dark text for contrast
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';

const scoreText = score.toString();        // or `$${score}` if you prefer currency look
const textWidth = ctx.measureText(scoreText).width;

ctx.fillText(scoreText, scoreX, scoreY);

// Optional: subtle background pill for emphasis (like Connections)
ctx.save();
ctx.globalAlpha = 0.15;
ctx.fillStyle = '#000000';
ctx.roundRect(scoreX - 8, scoreY - 12, textWidth + 16, 24, 12);
ctx.fill();
ctx.restore();

// Optional tooltip trigger area (keep if you want hover/tap info)
medalHitX = scoreX + textWidth / 2;
medalHitY = scoreY;
medalSize = 20;  // smaller hit area for score

currentX += textWidth + 60;  // space after score for next icons (share, help)


  // Share icon
  const shareSize = ICON_SIZE * 1.4;
  const shareX = currentX;
  const shareY = STATUS_Y - shareSize / 2;
  let shareImage = (turns >= C.MAX_TURNS) ? shareActiveSVG : shareInactiveSVG;

  if (shareImage.complete && shareImage.naturalHeight !== 0) {
    ctx.drawImage(shareImage, shareX - shareSize / 2, shareY, shareSize, shareSize);
  } else {
    ctx.fillStyle = turns >= C.MAX_TURNS ? '#000' : '#888';
    ctx.fillRect(shareX - 12, STATUS_Y - 12, 24, 24);
    ctx.fillStyle = turns >= C.MAX_TURNS ? '#FFF' : '#000';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('↑', shareX, STATUS_Y + 4);
  }

  currentX += ICON_SIZE + 30;

  // Help icon
  const helpSize = 24;
  const helpX = currentX;
  const helpY = STATUS_Y - helpSize / 2;

  if (helpIconSVG.complete && helpIconSVG.naturalHeight !== 0) {
    ctx.drawImage(helpIconSVG, helpX - helpSize / 2, helpY, helpSize, helpSize);
  } else {
    ctx.beginPath();
    ctx.arc(helpX, STATUS_Y, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,200,200,0.25)';
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '15px Arial';
    ctx.fillStyle = '#444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', helpX, STATUS_Y + 1);
  }
}
// ONE AND ONLY renderGame() – rounded word box + no duplicate code
function renderGame(){
  if (activeScreen === 'medals') return;
// At the start of renderGame()
if (typeof boxX === 'undefined') {
  boxX = 0; boxW = 0; gridX = 0; gy = 0; wordY = 0;
}
  ctx.clearRect(0, 0, canvas.width, canvas.height);
if (turns < 0) turns = 0;  // safety clamp
// Change from const to assignment (so globals are updated)
  gridX = (canvas.width - (6 * (tileSize + C.SPACING) - C.SPACING)) / 2;
  gy = gridY();
  const vowelY=gy+8*(tileSize+C.SPACING)+C.VOWEL_ROW_GAP;
  wordY = vowelY + tileSize + C.WORD_ROW_GAP;  // ← add this line EARLY
  const ctrlY = wordY + wordTileSize + C.CONTROLS_GAP + 10;

  // Add the share icon (square with upward arrow) — exact iOS look
  // ── NEW STATUS ROW ───────────────────────────────────────────────
if (!tutorialMode) {
  drawStatusRow();
}

  const clueRect=clueDisplay.getBoundingClientRect();
  const clueY=clueRect.top+clueRect.height/2+(isDesktop?15:0);

if (!grid || !Array.isArray(grid) || grid.length !== 8) return;

// Grid
for(let r=0; r<8; r++) for(let c=0; c<6; c++){
  const t = grid[r][c];
  drawTile(gridX + c*(tileSize + C.SPACING), gy + r*(tileSize + C.SPACING), tileSize, t.letter, t.state, t.value);
}

// NEW: Draw connecting lines between MID tiles in current chain
drawChainLines();


  // Vowels
  const vowelX=(canvas.width-(5*(tileSize+C.SPACING)-C.SPACING))/2;
  ctx.fillStyle=COLORS.VOWEL_BG;
  ctx.fillRect(0,vowelY-10,canvas.width,tileSize+20);
  vowels.forEach((v,i)=>drawTile(vowelX+i*(tileSize+C.SPACING),vowelY,tileSize,v.letter,TILE_STATES.OFF,v.value));


  // Word tiles
  if(!gameOver&&!confirmingReset&&wordRow.length){
    const curW=wordRow.length*wordTileSize+Math.max(0,wordRow.length-1)*wordGap;
    const startX=boxX+C.WORD_ROW_H_PADDING+(boxW-2*C.WORD_ROW_H_PADDING-curW)/2;
    wordRow.forEach((ch,i)=>{
      const x=startX+i*(wordTileSize+wordGap);
      const st=ch.valid===null?(ch.isVowel?TILE_STATES.OFF:TILE_STATES.MID):(ch.valid?TILE_STATES.RIGHT:TILE_STATES.WRONG);
      drawTile(x,wordY,wordTileSize,ch.letter,st,ch.value);
    });
  }
  if(dragVowel?.curX)drawTile(dragVowel.curX-wordTileSize/2,dragVowel.curY-wordTileSize/2,wordTileSize,dragVowel.letter,TILE_STATES.OFF,1);


  // Buttons - only UNDO and CHECK, centered BELOW the word row
  // const wordY = vowelY + tileSize + C.WORD_ROW_GAP;  // word row position (already calculated earlier)

  // Make sure ctrlY is placed AFTER the word row + some breathing room
  // const ctrlY = wordY + wordTileSize + C.CONTROLS_GAP + 10;  // ← added +10 for extra space if needed

  // Center the two buttons horizontally

  // Draw UNDO

  // Draw CHECK

  // Buttons - ONLY draw when NOT game over
if (!gameOver && !confirmingReset) {
  const buttonWidth = BTN['hint'].width;  // Hint button width
  const checkWidth  = BTN['check'].width;
  const gap = C.BUTTON_GAP;

  let totalWidth;
  let hintX, checkX;

  if (hexalinkUsed) {
    // Only Check button → center it
    totalWidth = checkWidth;
    checkX = (canvas.width - totalWidth) / 2;
    hintX = -999;  // off-screen
  console.log("[Button Draw] hexalinkUsed=true → centering Check");
  console.log("canvas.width:", canvas.width);
  console.log("checkWidth:", checkWidth);
  console.log("centered checkX:", checkX);
  } else {
    // Both buttons side by side
    totalWidth = 2 * buttonWidth + gap;
    hintX = (canvas.width - totalWidth) / 2;
    checkX = hintX + buttonWidth + gap;
  }

  let curY = ctrlY;  // same y position

  // Draw Hint only if not used
  if (!hexalinkUsed) {
    const hintBtn = BTN['hint'].canvas;
    ctx.drawImage(hintBtn, hintX, curY);

    // Progressive shading (only when visible)
    if (hintClicks > 0) {
      const segWidth = buttonWidth / 5;
      const shadedWidth = hintClicks * segWidth;
      const inset = 1.5;

      ctx.save();
      // Clip to pill interior (same as before)
      ctx.beginPath();
      const radius = wordTileSize / 2;
      ctx.moveTo(hintX + inset + radius, curY + inset);
      ctx.lineTo(hintX + buttonWidth - inset - radius, curY + inset);
      ctx.quadraticCurveTo(hintX + buttonWidth - inset, curY + inset, hintX + buttonWidth - inset, curY + inset + radius);
      ctx.lineTo(hintX + buttonWidth - inset, curY + wordTileSize - inset - radius);
      ctx.quadraticCurveTo(hintX + buttonWidth - inset, curY + wordTileSize - inset, hintX + buttonWidth - inset - radius, curY + wordTileSize - inset);
      ctx.lineTo(hintX + inset + radius, curY + wordTileSize - inset);
      ctx.quadraticCurveTo(hintX + inset, curY + wordTileSize - inset, hintX + inset, curY + wordTileSize - inset - radius);
      ctx.lineTo(hintX + inset, curY + inset + radius);
      ctx.quadraticCurveTo(hintX + inset, curY + inset, hintX + inset + radius, curY + inset);
      ctx.closePath();
      ctx.clip();

      ctx.fillStyle = HINT_SHADE;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(hintX + buttonWidth - shadedWidth, curY, shadedWidth, wordTileSize);
      ctx.globalAlpha = 1.0;
      ctx.restore();
    }
  }

  // Always draw Check (centered if Hint is hidden)
  //ctx.drawImage(BTN['check'].canvas, checkX, curY);
// Always draw Check (centered if Hint is hidden) — but skip at tutorial end
if (!hideCheckButtonAtTutorialEnd) {
  ctx.drawImage(BTN['check'].canvas, checkX, curY);
}
}

  // Game over overlay – no blue box, tiered medal SVG + positive message
  if (gameOver || confirmingReset) {
    if (gameOver) {
      const msgY = wordY + wordTileSize / 2;
      const largeMedalSize = 32;
      const medalCenterX = canvas.width / 2;
      const medalCenterY = msgY ;

      let largeMedalImage = medalOutlineSVG;
      let msg = "New puzzle, new chance.";
      ctx.fillStyle = '#2F8F83';

      if (score >= 100) {
        largeMedalImage = medalGoldSVG;
        msg = "Pure Gold.";
      } else if (score >= 70) {
        largeMedalImage = medalSilverSVG;
        msg = "So close!";
      } else if (score >= 40) {
        largeMedalImage = medalBronzeSVG;
        msg = "You're getting it.";
      }

      if (largeMedalImage.complete && largeMedalImage.naturalHeight !== 0) {
        ctx.drawImage(largeMedalImage, medalCenterX - largeMedalSize / 2, medalCenterY - largeMedalSize / 2, largeMedalSize, largeMedalSize);
      }

      ctx.fillStyle = '#2F8F83';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(msg, canvas.width / 2, msgY + 30);

      ctx.font = '15px Arial';
      //ctx.fillText(`Score: ${score}`, canvas.width / 2, msgY + 70);
    } else if (confirmingReset) {
      ctx.fillStyle = '#000';
      ctx.font = '15px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Click here to reset the game', canvas.width / 2, wordY + wordTileSize / 2);
    }
  }
  // Reset shadow state from Rules
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetY = 0;

}

// ====================== DRAWING & RENDERING (unchanged except game over logic) ======================
function drawTile(x, y, size, letter, state, value, alpha = 1.0) {
  ctx.globalAlpha = alpha;

  // ... rest of your existing drawTile code ...

  ctx.globalAlpha = 1.0; // reset after drawing
  const r = size / 2;
  const cr = r * C.CORE_RATIO;
  const cx = x + r;
  const cy = y + r;

  // NEW: Special styling for static vowel row tiles
  const isStaticVowel = VOWEL_LETTERS.includes(letter) && 
                        state === TILE_STATES.OFF && 
                        y < wordY - 50;  // rough check: vowel row is above word row

  // NEW: Detect if this tile is in the word row area
  const isInWordRowArea = Math.abs(y - wordY) < 40;  // tolerance for alignment/padding

  // Background color
  let bg;
  if (isInWordRowArea) {
    // All tiles in word row → white background
    bg = '#E6EEF5';
    //bg = '#FFFFFF';
  } else if (isStaticVowel) {
    // All static vowel tiles have black background
    bg = '#1E90FF';
    //bg = '#5C4033';
    //bg = '#000000';
  } else {
    // Normal background logic for grid/vowel row
    bg = state === TILE_STATES.MID ? (value === 1 ? COLORS.MID_1 : COLORS.MID_2) :
         state === TILE_STATES.RIGHT ? COLORS.RIGHT :
         state === TILE_STATES.WRONG ? COLORS.WRONG :
         VOWEL_LETTERS.includes(letter) && state === TILE_STATES.OFF ? COLORS.VOWEL_TILE :
         COLORS.OFF_BG;
  }

  // Rim color logic (your previous requirement)
  let rimColor;
  if (VOWEL_LETTERS.includes(letter) && state === TILE_STATES.OFF && !isInWordRowArea) {
    // Static vowels in vowel row → black rim
    rimColor = COLORS.RIM_BLACK; // '#8A9199'
  } else {
    // Grid tiles + vowels in word row → white rim
    rimColor = '#FFFFFF';
  }

  // Draw rim only for OFF tiles with value 1
  if (state === TILE_STATES.OFF && value === 1) {
    // Outer rim
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = rimColor;
    ctx.fill();

    // Inner background
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1 - C.RIM_RATIO), 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
  } else {
    // All other states: no rim, just solid circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
  }

  // Core for ON/TOP states (unchanged)
// Gold coin for ON state, original core for TOP
if (state === TILE_STATES.ON || state === TILE_STATES.TOP) {
  // Draw gold coin (fits inside core area)
  if (coinImage.complete && coinImage.naturalHeight !== 0) {
    const coinSize = Math.min(cr * 2 * 0.95, r * 0.85);  // Scale to fit core/tile nicely
    ctx.drawImage(coinImage, cx - coinSize / 2, cy - coinSize / 2, coinSize, coinSize);
  } else {
    // Fallback during load: original orange core
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ON_CORE;
    ctx.fill();
  }
} else if (state === TILE_STATES.TOP) {
  // Keep original green core for hexalink TOP state
  ctx.beginPath();
  ctx.arc(cx, cy, cr, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.TOP_CORE;
  ctx.fill();
}

  // Letter text – white for static vowels, black otherwise
  if (state !== TILE_STATES.ON && state !== TILE_STATES.TOP && letter) {
    ctx.fillStyle = isStaticVowel ? '#FFFFFF' : '#000000';
    ctx.font = `${size * 0.55}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, cx, cy);
  }
}

// Draw thick lines connecting centers of all MID tiles in the current chain
function drawChainLines() {
  if (chain.length < 2) return;

  ctx.save();
  ctx.globalAlpha = C.CHAIN_LINE_OPACITY || 0.9;
  ctx.strokeStyle = COLORS.MID_1;
  ctx.lineWidth = C.CHAIN_LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Helper: Get center of a tile
  function getCenter(p) {
    return {
      x: gridX + p.col * (tileSize + C.SPACING) + tileSize / 2,
      y: gy + p.row * (tileSize + C.SPACING) + tileSize / 2
    };
  }

  // Helper: Get rim point on tile A toward tile B, with inset
  function getRimPoint(fromCenter, toCenter, inset = 0.85) {
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.001) return fromCenter;

    const nx = dx / dist;
    const ny = dy / dist;

    const rimRadius = tileSize / 2 * inset;
    return {
      x: fromCenter.x + nx * rimRadius,
      y: fromCenter.y + ny * rimRadius
    };
  }

  const centers = chain.map(getCenter);

  // Draw each segment piecemeal as separate paths (stable, no moving)
  for (let i = 0; i < chain.length - 1; i++) {
    ctx.beginPath();

    // Rim point from current tile toward next
    const startRim = getRimPoint(centers[i], centers[i + 1]);

    // Rim point from next tile toward current (for entry point)
    const endRim = getRimPoint(centers[i + 1], centers[i]);

    ctx.moveTo(startRim.x, startRim.y);
    ctx.lineTo(endRim.x, endRim.y);

    ctx.stroke();
  }

  ctx.restore();
}

// Returns the index in wordRow if the touch position is over a word row tile, else -1
function getWordRowIndexAt(pos) {
  if (!wordRow.length || gameOver || confirmingReset || wordRowLocked) return -1;

  const gy = gridY();
  const wordYPos = gy + 8 * (tileSize + C.SPACING) + C.VOWEL_ROW_GAP + tileSize + C.WORD_ROW_GAP;
  const boxX = wordRowBoxX;
  const boxW = sharedContentWidth;

  const curW = wordRow.length * wordTileSize + Math.max(0, wordRow.length - 1) * wordGap;
  const startX = boxX + C.WORD_ROW_H_PADDING + (boxW - 2 * C.WORD_ROW_H_PADDING - curW) / 2;

  // Check vertical hit first
  if (pos.y < wordYPos - 10 || pos.y > wordYPos + wordTileSize + 10) return -1;

  // Find which tile was touched horizontally
  for (let i = 0; i < wordRow.length; i++) {
    const tileLeft = startX + i * (wordTileSize + wordGap);
    if (pos.x >= tileLeft && pos.x <= tileLeft + wordTileSize) {
      return i;
    }
  }

  return -1;
}

function drawBackArrow(x,y){
  ctx.fillStyle = '#333';
  ctx.font = '42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('←', x, y);
}

function drawFinger(x, y) {
  const w = tileSize;
  const h = 1.0 * tileSize;
  ctx.save();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - w*0.4, y - h);
  ctx.quadraticCurveTo(x, y - h - w*0.3, x + w*0.4, y - h);
  ctx.closePath();
  ctx.fillStyle = '#ffdbac';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function gridY() {
  // Reserve space for status row (~60–70px) + clue bar (~40–50px) + margin
  const topReservedSpace = 105;  // ← increased from 85 to give room for status row
  return topReservedSpace + C.MARGIN + (isDesktop ? 15 : 0);
}

function getTileCenter(row, col, useTutorial = false) {
  const grid = useTutorial ? tutorialGrid : grid;
  const gridX_val = (canvas.width - (6 * (tileSize + C.SPACING) - C.SPACING)) / 2;
  const gy = gridY();
  const cx = gridX_val + col * (tileSize + C.SPACING) + tileSize / 2;
  const cy = gy + row * (tileSize + C.SPACING) + tileSize / 2;
  return {x: cx, y: cy};
}

function getVowelCenter(index) {
  const gy = gridY();
  const vowelY = gy + 8 * (tileSize + C.SPACING) + C.VOWEL_ROW_GAP;
  const vowelX = (canvas.width - (5 * (tileSize + C.SPACING) - C.SPACING)) / 2;
  return {x: vowelX + index * (tileSize + C.SPACING) + tileSize / 2, y: vowelY + tileSize / 2};
}

function getWordRowDropPos(index, wordRowArray = tutorialWordRow) {
  const gy = gridY();
  const wordY = gy + 8 * (tileSize + C.SPACING) + C.VOWEL_ROW_GAP + tileSize + C.WORD_ROW_GAP;
  const boxX = wordRowBoxX, boxW = sharedContentWidth;
  const curW = wordRowArray.length * wordTileSize + Math.max(0, wordRowArray.length - 1) * wordGap;
  const startX = boxX + C.WORD_ROW_H_PADDING + (boxW - 2 * C.WORD_ROW_H_PADDING - curW) / 2;
  return {x: startX + index * (wordTileSize + wordGap) + wordTileSize / 2, y: wordY - 10};
}

function getButtonCenter(name) {
  const gy = gridY();
  const wordY = gy + 8 * (tileSize + C.SPACING) + C.VOWEL_ROW_GAP + tileSize + C.WORD_ROW_GAP;
  const ctrlY = wordY + wordTileSize + C.CONTROLS_GAP;
  let curX = buttonStartX;
  const i = BUTTON_NAMES.indexOf(name.toLowerCase());
  for (let j = 0; j < i; j++) curX += BTN[BUTTON_NAMES[j]].width + C.BUTTON_GAP;
  return {x: curX + BTN[name.toLowerCase()].width / 2, y: ctrlY + C.BUTTON_HEIGHT / 2};
}

// UPDATED getButtonIndex - now only for UNDO and CHECK
function getButtonIndex(pos) {
  const gy = gridY();
  const wordY = gy + 8 * (tileSize + C.SPACING) + C.VOWEL_ROW_GAP + tileSize + C.WORD_ROW_GAP;
  const ctrlY = wordY + wordTileSize + C.CONTROLS_GAP + 12; // match your current offset

  if (pos.y < ctrlY || pos.y > ctrlY + wordTileSize) return -1;

  // Get actual widths from created buttons
  const hintWidth = BTN['hint']?.width || 100;
  const checkWidth = BTN['check']?.width || 100;
  const gap = C.BUTTON_GAP || 20;
  const totalWidth = hintWidth + checkWidth + gap;

  const startX = (canvas.width - totalWidth) / 2;


  // UNDO button hit area
  if (pos.x >= startX && pos.x <= startX + hintWidth) {
    return 0; // UNDO
  }

  // CHECK button hit area
  if (pos.x >= startX + hintWidth + gap && pos.x <= startX + totalWidth) {
    return 1; // CHECK
  }

  return -1;
}


async function animateMove(target, to, duration, onFrame = null) {
  return new Promise(resolve => {
    const from = {x: target.x, y: target.y};
    const start = performance.now();
    const step = () => {
      if (!tutorialMode) { resolve(); return; }
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / duration, 1);
      target.x = from.x + (to.x - from.x) * t;
      target.y = from.y + (to.y - from.y) * t;
      if (onFrame) onFrame(t);
if (activeScreen !== 'medals') {
  render();
}
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

async function animateWiggle(duration = 1000) {
  return new Promise(resolve => {
    const start = performance.now();
    const origX = finger.x;
    const step = () => {
      if (!tutorialMode) { resolve(); return; }
      const elapsed = performance.now() - start;
      if (elapsed >= duration) {
        finger.x = origX;
if (activeScreen !== 'medals') {
  render();
}
        resolve();
        return;
      }
      finger.x = origX + Math.sin(elapsed * 0.02) * 8;
if (activeScreen !== 'medals') {
  render();
}
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function waitWhilePaused() {
  while (animationPaused) {
    await new Promise(resolve => {
      pauseResolve = resolve;
    });
  }
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }



function renderTutorial() {
  if (activeScreen === 'medals') return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);  // Extra clear for safety in tutorial mode

  // SHOW STATUS ROW IN TUTORIAL MODE
  drawStatusRow();

  const gridX = (canvas.width - (6*(tileSize+C.SPACING)-C.SPACING))/2;
  const gy = gridY();
  const vowelY=gy+8*(tileSize+C.SPACING)+C.VOWEL_ROW_GAP;

  for(let r=0;r<8;r++) for(let c=0;c<6;c++){
    const t = tutorialGrid[r][c];
    drawTile(gridX + c*(tileSize+C.SPACING), gy + r*(tileSize+C.SPACING), tileSize, t.letter, t.state, t.value);
  }

  const wordY = gy + 8*(tileSize+C.SPACING) + C.VOWEL_ROW_GAP + tileSize + C.WORD_ROW_GAP;
  const boxX = wordRowBoxX, boxW = sharedContentWidth;
  if(tutorialWordRow.length){
    const curW = tutorialWordRow.length*wordTileSize + Math.max(0,tutorialWordRow.length-1)*wordGap;
    const startX = boxX + C.WORD_ROW_H_PADDING + (boxW - 2*C.WORD_ROW_H_PADDING - curW)/2;
tutorialWordRow.forEach((ch, i) => {
  const x = startX + i * (wordTileSize + wordGap);
  const st = ch.valid === null ? (ch.isVowel ? TILE_STATES.OFF : TILE_STATES.MID) : (ch.valid ? TILE_STATES.RIGHT : TILE_STATES.WRONG);
  drawTile(x, wordY, wordTileSize, ch.letter, st, ch.value, ch.tempAlpha || 1.0);
});
  }

  // Vowels
  const vowelX=(canvas.width-(5*(tileSize+C.SPACING)-C.SPACING))/2;
  ctx.fillStyle=COLORS.VOWEL_BG;
  ctx.fillRect(0,vowelY-10,canvas.width,tileSize+20);
  vowels.forEach((v,i)=>drawTile(vowelX+i*(tileSize+C.SPACING),vowelY,tileSize,v.letter,TILE_STATES.OFF,v.value));

  const ctrlY = wordY + wordTileSize + C.CONTROLS_GAP;
  ctx.fillStyle = '#000';
  ctx.font = '18px Arial';
  ctx.textAlign = 'center';

  // Buttons - only UNDO and CHECK, centered BELOW the word row
  // const wordY = vowelY + tileSize + C.WORD_ROW_GAP;  // word row position (already calculated earlier)

  // Make sure ctrlY is placed AFTER the word row + some breathing room
  // const ctrlY = wordY + wordTileSize + C.CONTROLS_GAP + 10;  // ← added +10 for extra space if needed

  // Center the two buttons horizontally
// Buttons - consistent with renderGame()
// Buttons - consistent centering logic (same as renderGame)
// Buttons - unified centering logic (same as renderGame)
const hintWidth = BTN['hint']?.width || 120;   // safe fallback if not loaded
const checkWidth = BTN['check']?.width || 120;
const gap = C.BUTTON_GAP || 20;

let hintX, checkX;

if (hexalinkUsed) {
  // Only Check button → center it
  checkX = (canvas.width - checkWidth) / 2;
  hintX = -999;  // off-screen (invisible)
} else {
  // Both buttons side by side
  const totalWidth = 2 * hintWidth + gap;
  hintX = (canvas.width - totalWidth) / 2;
  checkX = hintX + hintWidth + gap;
}

const curY = ctrlY;  // your existing y position

// Draw Hint only if not used
if (!hexalinkUsed) {
  const hintBtn = BTN['hint'].canvas;
  ctx.drawImage(hintBtn, hintX, curY);

  // Progressive shading (keep this block exactly as you had it)
  if (hintClicks > 0) {
    const segWidth = hintWidth / 5;
    const shadedWidth = hintClicks * segWidth;
    const inset = 1.5;

    ctx.save();
    const radius = wordTileSize / 2;
    ctx.beginPath();
    ctx.moveTo(hintX + inset + radius, curY + inset);
    ctx.lineTo(hintX + hintWidth - inset - radius, curY + inset);
    ctx.quadraticCurveTo(hintX + hintWidth - inset, curY + inset, hintX + hintWidth - inset, curY + inset + radius);
    ctx.lineTo(hintX + hintWidth - inset, curY + wordTileSize - inset - radius);
    ctx.quadraticCurveTo(hintX + hintWidth - inset, curY + wordTileSize - inset, hintX + hintWidth - inset - radius, curY + wordTileSize - inset);
    ctx.lineTo(hintX + inset + radius, curY + wordTileSize - inset);
    ctx.quadraticCurveTo(hintX + inset, curY + wordTileSize - inset, hintX + inset, curY + wordTileSize - inset - radius);
    ctx.lineTo(hintX + inset, curY + inset + radius);
    ctx.quadraticCurveTo(hintX + inset, curY + inset, hintX + inset + radius, curY + inset);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = HINT_SHADE;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(hintX + hintWidth - shadedWidth, curY, shadedWidth, wordTileSize);
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }
}

// Always draw Check (centered when alone)
//ctx.drawImage(BTN['check'].canvas, checkX, curY);
// Always draw Check (centered if Hint is hidden) — but skip at tutorial end
if (!hideCheckButtonAtTutorialEnd) {
  ctx.drawImage(BTN['check'].canvas, checkX, curY);
}

  // Draw CHECK

if (message) {
  let fontSize = isDesktop ? 17 : 15;  // ← smaller than 18/16
  fontSize = Math.max(13, Math.min(fontSize, Math.floor(canvas.width / 30))); // responsive scaling

  const fontToUse = `500 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;  // ← 500 instead of bold

  ctx.font = fontToUse;
  ctx.fillStyle = '#1a1a1a';  // softer dark gray instead of #000
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Soft shadow for readability without being heavy
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Position: still centered above clue row
  const clueRect = clueDisplay.getBoundingClientRect();
  const messageY = clueRect.top + clueRect.height / 2 + (isDesktop ? 12 : 0) - TUTORIAL_MSG.yOffset;

  // Split into lines if needed (most messages are short, but safety)
  const lines = message.split('\n');
  const lineHeight = fontSize * 1.5;  // more breathing room

  lines.forEach((line, index) => {
    ctx.fillText(line.trim(), canvas.width / 2, messageY + index * lineHeight);
  });

  // Reset shadow
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}


  drawFinger(finger.x, finger.y);

  drawBackArrow(40, 20);
  // Game over overlay – no blue box, tiered medal SVG + positive message
  if (gameOver || confirmingReset) {
    if (gameOver) {
      const msgY = wordY + wordTileSize / 2;
      const largeMedalSize = 32;
      const medalCenterX = canvas.width / 2;
      const medalCenterY = msgY ;

      let largeMedalImage = medalOutlineSVG;
      let msg = "New puzzle, new chance.";
      ctx.fillStyle = '#2F8F83';

      if (score >= 100) {
        largeMedalImage = medalGoldSVG;
        msg = "Pure Gold.";
      } else if (score >= 70) {
        largeMedalImage = medalSilverSVG;
        msg = "So close!";
      } else if (score >= 40) {
        largeMedalImage = medalBronzeSVG;
        msg = "You're getting it.";
      }

      if (largeMedalImage.complete && largeMedalImage.naturalHeight !== 0) {
        ctx.drawImage(largeMedalImage, medalCenterX - largeMedalSize / 2, medalCenterY - largeMedalSize / 2, largeMedalSize, largeMedalSize);
      }

      ctx.fillStyle = '#2F8F83';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(msg, canvas.width / 2, msgY + 30);

      ctx.font = '15px Arial';
      ctx.fillText(`Score: ${score}`, canvas.width / 2, msgY + 70);
    } else if (confirmingReset) {
      ctx.fillStyle = '#000';
      ctx.font = '15px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Click here to reset the game', canvas.width / 2, wordY + wordTileSize / 2);
    }
  }

  if (animationPaused) {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Big centered text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Paused', canvas.width / 2, canvas.height / 2 - 20);

    ctx.font = '20px Arial';
    ctx.fillText('Tap anywhere to resume', canvas.width / 2, canvas.height / 2 + 30);
  }
}

function render() {
  if (activeScreen === 'medals') {
    console.log("render() blocked while medals screen active");
    return; // Prevent any normal rendering
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // ... rest of render() ...

  if (tutorialMode) {
    renderTutorial();
    return;
  }
  if (showMenu) {
    renderGame();
    renderMenu();
    return;
  }
  if (rulesShowing) {
    renderRules();
    return;
  }
  renderGame();
}

function renderMenu() {
  if (activeScreen === 'medals') return;
  // Semi-transparent overlay (Connections has light overlay)
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const menuWidth = 280;
  const menuHeight = 240;
  const menuX = canvas.width - menuWidth - 30;           // top-right aligned (like Connections)
  const menuY = 120;                                       // below status/help icon

  // White card with shadow
  ctx.shadowColor = 'rgba(0,0,0,0.0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 12);  // 12px rounded corners
  ctx.fill();
  ctx.shadowBlur = 0;  // reset shadow

  // Title (optional, Connections doesn't have one – but you can keep or remove)
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';

  // Menu items (same as before, but styled)
const items = [
  { text: 'Tutorial (animation)', y: menuY + 60 },
  { text: 'Rules',             y: menuY + 120 },
  { text: 'My medals',         y: menuY + 180 }
];

  items.forEach(item => {
    // Hover simulation (you can enhance with mouse tracking later)
    ctx.fillStyle = '#f3f4f6';  // very light gray for hover-like
    ctx.beginPath();
    ctx.roundRect(menuX + 10, item.y - 20, menuWidth - 20, 40, 8);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.text, menuX + 30, item.y);
  });

  // Optional: close hint (Connections has an X or click outside)
  ctx.fillStyle = '#6b7280';
  ctx.font = '14px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('Tap outside to close', canvas.width - 40, menuY + menuHeight + 20);
}

// Replace your renderRules() with this version

function showMedalsScreen() {
  console.log("showMedalsScreen() STARTED - exclusive control");

  activeScreen = 'medals';
  clueDisplay.classList.add('hidden');

  // Load medals
  let medals = JSON.parse(localStorage.getItem('qjynn_medals') || '[]');

  // Last 7 days (oldest to newest)
  const today = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Scrolling state
  let medalsScrollY = 0;
  let isDragging = false;
  let lastY = 0;

  const startDrag = (e) => {
    isDragging = true;
    lastY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
    e.preventDefault();
  };

  const moveDrag = (e) => {
    if (!isDragging) return;
    const y = e.clientY || (e.touches ? e.touches[0].clientY : 0);
    medalsScrollY += (y - lastY) * 1.8;
    lastY = y;
    e.preventDefault();
  };

  const endDrag = () => isDragging = false;

  // Attach listeners
  canvas.addEventListener('pointerdown', startDrag);
  canvas.addEventListener('pointermove', moveDrag);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointerleave', endDrag);
  canvas.addEventListener('touchstart', startDrag, { passive: false });
  canvas.addEventListener('touchmove', moveDrag, { passive: false });
  canvas.addEventListener('touchend', endDrag);

  window.medalsListeners = { startDrag, moveDrag, endDrag };

  // Exclusive draw loop
  const drawMedals = () => {
    if (activeScreen !== 'medals') return;

    // Full reset to eliminate superposition/blurriness
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over'; // Reset compositing to default
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cardW = Math.min(520, canvas.width - 60);
    const cardH = canvas.height - 140;
    const cardX = (canvas.width - cardW) / 2;
    const cardY = 70;

    // Card
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 0;
    ctx.roundRect(cardX, cardY, cardW, cardH, 20);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Title
    ctx.fillStyle = '#111827';
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('My Medals – Last 7 Days', canvas.width / 2, cardY + 40);

    // Clip content
    ctx.save();
    ctx.rect(cardX + 20, cardY + 70, cardW - 40, cardH - 100);
    ctx.clip();

    const medalSize = 32;
    let currentY = cardY + 90 + medalsScrollY;

    dates.forEach(date => {
      const entry = medals.find(m => m.date === date);
      const type = entry ? entry.type : 'none';

      let img = medalOutlineSVG;
      if (type === 'gold') img = medalGoldSVG;
      else if (type === 'silver') img = medalSilverSVG;
      else if (type === 'bronze') img = medalBronzeSVG;

      const medalX = cardX + 60;
      if (img.complete && img.naturalHeight !== 0) {
        ctx.drawImage(img, medalX, currentY, medalSize, medalSize);
      } else {
        ctx.beginPath();
        ctx.arc(medalX + medalSize/2, currentY + medalSize/2, medalSize/2, 0, Math.PI*2);
        ctx.fillStyle = type === 'none' ? '#cccccc' : '#888888';
        ctx.fill();
      }

      // Date - perfectly aligned vertically
      ctx.fillStyle = '#444444';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(date, medalX + medalSize + 24, currentY + medalSize / 2);

      currentY += medalSize + 30;
    });

    ctx.restore();

    // Back arrow

    requestAnimationFrame(drawMedals);
  };

  // Start loop
  drawMedals();
}

function rowsHaveOn(){
  for(let r=0;r<8;r++) if(!grid[r].some(t=>t.state===TILE_STATES.ON||t.state===TILE_STATES.TOP)) return false;
  return true;
}

function isHexalink(){
  return QJYNN_RULES.isExactHexalink(chain, grid, hexalink, hexarowcol);
}
// Returns true if current chain contains at least one letter from hexalink
// (using positions from hexarowcol), but is NOT the full exact hexalink sequence
function hasPartialHexalinkMatch() {
  if (!hexalink || !hexarowcol || hexarowcol.length !== 6) return false;

  if (isHexalink()) return false;
  return QJYNN_RULES.hasPartialHexalinkOverlap(chain, hexarowcol);
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  let x, y;

  if (e.touches && e.touches.length > 0) {
    // Use first touch point (Chrome iOS sometimes needs this)
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }

  // Scale to canvas coordinates (handles high-DPI)
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return { x: x * scaleX, y: y * scaleY };
}


function tileAt(x,y,size,startX,startY,cols,rows=Infinity){
  const col = Math.floor((x-startX)/(size+C.SPACING));
  const row = Math.floor((y-startY)/(size+C.SPACING));
  return (col>=0&&col<cols&&row>=0&&row<rows)?{col,row}:null;
}

// ====================== INPUT & CHAIN BUILDING (now allows 1 tile) ======================
function tryAddTile(pos) {
  if (wordRowLocked) return false; // ← NEW: block new chain during freeze
  const gridX = (canvas.width - (6 * (tileSize + C.SPACING) - C.SPACING)) / 2;
  const gy = gridY();
  const t = tileAt(pos.x, pos.y, tileSize, gridX, gy, 6, 8);
  if (!t) return false;

  const tile = grid[t.row][t.col];
  if (tile.state !== TILE_STATES.OFF) return false;

  const cx = gridX + t.col * (tileSize + C.SPACING) + tileSize / 2;
  const cy = gy + t.row * (tileSize + C.SPACING) + tileSize / 2;
  if (Math.hypot(pos.x - cx, pos.y - cy) > tileSize / 2 * 0.8) return false;

  if (chain.length === 0) {
    wordRow = [];
    chain = [];
  }

  // NEW: Only show toast when trying to add a 7th tile (chain already at 6)
  if (chain.length === 6) {
    if (!attemptedSeventhTile) {
      showToast("Maximum 6 letters in chain", 1800);
      attemptedSeventhTile = true;  // prevent repeat in same drag
    }
    return false;  // never add the 7th tile
  }

  if (!QJYNN_RULES.canAppendToChain(chain, t)) return false;

  // All checks passed → add the tile (only reaches here if chain < 6)
  tile.state = TILE_STATES.MID;
  chain.push({ row: t.row, col: t.col });
  wordRow.push({ letter: tile.letter, isVowel: false, valid: null, value: tile.value });

  render();
  return true;
}

function dropVowel(pos){
  if(!dragVowel) return;
  const gy = gridY();
  const wordY = gy + 8*(tileSize+C.SPACING) + C.VOWEL_ROW_GAP + tileSize + C.WORD_ROW_GAP;
  if(pos.y < wordY-20 || pos.y > wordY+wordTileSize+20){ dragVowel=null; if (activeScreen !== 'medals') {
  render();
} return; }

  const boxX = wordRowBoxX, boxW = sharedContentWidth;
  const curW = wordRow.length*wordTileSize + Math.max(0,wordRow.length-1)*wordGap;
  const startX = boxX + C.WORD_ROW_H_PADDING + (boxW - 2*C.WORD_ROW_H_PADDING - curW)/2;
  let idx = wordRow.length;
  for(let i=0;i<=wordRow.length;i++) if(pos.x < startX + i*(wordTileSize + wordGap) + wordTileSize/2){ idx=i; break; }

  if (wordRow.length >= 10) {
    showToast("Maximum 10 letters per word");
    dragVowel = null;
if (activeScreen !== 'medals') {
  render();
}
    return;
  }

  wordRow.splice(idx,0,{letter:dragVowel.letter, isVowel:true, valid:null, value:1});
  dragVowel = null;

  // NEW: After vowel drop (chain complete for this turn) → check partial hexalink match
if (!hexalinkUsed) {
  if (hasPartialHexalinkMatch()) {
    showToast("Some letters are common to hexalink", 1800);
  }
}

if (activeScreen !== 'medals') {
  render();
}
}

function startVowelDrag(pos) {
  if (wordRowLocked) return false;

  const gy = gridY();
  const vowelY = gy + 8 * (tileSize + C.SPACING) + C.VOWEL_ROW_GAP;
  const vowelX = (canvas.width - (5 * (tileSize + C.SPACING) - C.SPACING)) / 2;

  const i = Math.floor((pos.x - vowelX) / (tileSize + C.SPACING));
  if (i < 0 || i > 4) return false;

  const cx = vowelX + i * (tileSize + C.SPACING) + tileSize / 2;
  const cy = vowelY + tileSize / 2;

  // Not close enough to any vowel tile center → not a vowel drag attempt
  if (Math.hypot(pos.x - cx, pos.y - cy) > tileSize / 2 * 0.8) {
    return false;
  }

  // ────────────────────────────────────────────────
  // We are definitely touching a vowel tile → now check the rule
  if (wordRow.length === 0) {
    showToast("Form a chain before dragging a vowel", 1800);
    return false;
  }
  // ────────────────────────────────────────────────

  // Allowed → start dragging
  dragVowel = { letter: vowels[i].letter };
  return true;
}

function moveVowelDrag(pos){ if(dragVowel){ dragVowel.curX=pos.x; dragVowel.curY=pos.y; if (activeScreen !== 'medals') {
  render();
} }}

function getButtonIndex(pos){
  const gy = gridY();
  const wordY = gy + 8*(tileSize+C.SPACING) + C.VOWEL_ROW_GAP + tileSize + C.WORD_ROW_GAP;
  const ctrlY = wordY + wordTileSize + C.CONTROLS_GAP;
  if(pos.y < ctrlY || pos.y > ctrlY + C.BUTTON_HEIGHT) return -1;
  let x = buttonStartX;
  //STEP5 for(let i=0;i<5;i++){
  for(let i=0;i<2;i++){
    const btn = BTN[BUTTON_NAMES[i]];
    if(pos.x >= x && pos.x <= x + btn.width) return i;
    x += btn.width + C.BUTTON_GAP;
  }
  return -1;
}

function isHelpStatusIconClicked(pos) {
  const centerX = canvas.width / 2;
  let helpX = centerX - (6 * CIRCLE_SPACING / 2) - 80 + 6 * CIRCLE_SPACING + 50 + MEDAL_SIZE + 38 + ICON_SIZE + 30;
  const hitRadius = 18;
  return Math.hypot(pos.x - helpX, pos.y - STATUS_Y) < hitRadius;
}

// NEW: Detect click on status row share icon
function isShareIconClicked(pos) {
  if (turns < C.MAX_TURNS) return false;

  const hitRadius = 60; // much larger for finger taps (Chrome needs ~50–70 px)

  const centerX = canvas.width / 2;
  let shareX = centerX - (6 * CIRCLE_SPACING / 2) - 80 + 6 * CIRCLE_SPACING + 50 + MEDAL_SIZE + 38;

  const distance = Math.hypot(pos.x - shareX, pos.y - STATUS_Y);
  console.log("[Share Hit Check] distance:", distance.toFixed(1), "pos:", pos, "shareX:", shareX);

  return distance < hitRadius;
}

function isBackArrowClicked(pos) {
  if (tutorialMode) {
    return Math.hypot(pos.x - 40, pos.y - 20) < 35;
  }

  if (rulesShowing) {
    const cardW = Math.min(480, canvas.width - 40);
    const cardX = (canvas.width - cardW) / 2;
    const cardY = 60;
    const arrowX = cardX + 30;
    const arrowY = cardY + 40;
    if (Math.hypot(pos.x - arrowX, pos.y - arrowY) < 35) {
      rulesShowing = false;
      clueDisplay.style.display = 'block';  // ← show clue row again
if (activeScreen !== 'medals') {
  render();
}
      return true;
    }
  }

  return false;
}

function isMenuClicked(pos) {
  const menuWidth = 280;
  const menuHeight = 300; // ← generous height to cover all items
  const menuX = canvas.width - menuWidth - 30;
  const menuY = 120;

  console.log("Menu bounds check - pos.y:", pos.y, "menuY:", menuY, "menuHeight:", menuHeight);

  // Outside menu → close
  if (pos.x < menuX || pos.x > menuX + menuWidth ||
      pos.y < menuY   || pos.y > menuY + menuHeight) {
    console.log("Click outside menu bounds");
    return -1;
  }

  // Item 1: Moves (animation)
  const item1Y = menuY + 60;
  if (pos.y >= item1Y - 40 && pos.y <= item1Y + 40) {
    console.log("Hit Item 1 (Moves)");
    return 0;
  }

  // Item 2: Rules
  const item2Y = menuY + 120; // ← increased spacing from 110
  if (pos.y >= item2Y - 40 && pos.y <= item2Y + 40) {
    console.log("Hit Item 2 (Rules)");
    return 1;
  }

  // Item 3: My medals
  const item3Y = menuY + 180; // ← increased spacing from 160
  if (pos.y >= item3Y - 40 && pos.y <= item3Y + 40) {
    console.log("Hit Item 3 (My medals)");
    return 2;
  }

  console.log("Click inside menu but missed all items");
  return -1;
}


// Optional: Prevent selection on the entire canvas (very effective)
canvas.style.userSelect = 'none';
canvas.style.webkitUserSelect = 'none'; // for iOS
canvas.style.touchAction = 'none'; // prevents pinch-zoom/scroll interference in medal area


canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const pos = getPos(e);
  mouseDown = true;
// In pointerdown / touchstart (right after mouseDown = true;)
  attemptedSeventhTile = false;  // ← reset at start of new gesture


if ((tutorialMode || rulesShowing || activeScreen === 'medals') && isBackArrowClicked(pos)) {
  if (tutorialMode) {
     restoreGameState();
  } else if (rulesShowing) {
    rulesShowing = false;
    clueDisplay.classList.remove('hidden');
  } else if (activeScreen === 'medals') {
    activeScreen = 'game';
    showMedals = false;
    clueDisplay.classList.remove('hidden');

    // Remove listeners
    const { startDrag, moveDrag, endDrag } = window.medalsListeners || {};
    if (startDrag) {
      canvas.removeEventListener('pointerdown', startDrag);
      canvas.removeEventListener('pointermove', moveDrag);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointerleave', endDrag);
      canvas.removeEventListener('touchstart', startDrag);
      canvas.removeEventListener('touchmove', moveDrag);
      canvas.removeEventListener('touchend', endDrag);
    }
    window.medalsListeners = null;

    showMenu = true;
  }
  render();
  return;
}

// Replace this in the pointerdown handler (the entire if (rulesShowing) block)
if (rulesShowing) {
  // Calculate card bounds (must match your renderRules exactly)
  const isSmall = canvas.width < 480;
  const cardW = isSmall ? canvas.width - 40 : Math.min(480, canvas.width - 80);
  const cardH = canvas.height - (isSmall ? 120 : 180);
  const cardX = (canvas.width - cardW) / 2;
  const cardY = isSmall ? 60 : 100;

  // Check if tap is outside the card
  const isOutsideCard =
    pos.x < cardX ||
    pos.x > cardX + cardW ||
    pos.y < cardY ||
    pos.y > cardY + cardH;

  if (isOutsideCard) {
    // Single tap outside → fully close rules
    rulesShowing = false;
    rulesOpacity = 0; // immediate fade out to avoid dark linger
    clueDisplay.style.display = 'block'; // restore clue row
if (activeScreen !== 'medals') {
  render();
}
    return;
  }

  // Check back arrow
  const arrowX = cardX + (isSmall ? 20 : 30);
  const arrowY = cardY + (isSmall ? 30 : 40);
  if (Math.hypot(pos.x - arrowX, pos.y - arrowY) < 35) {
    rulesShowing = false;
    rulesOpacity = 0;
    clueDisplay.style.display = 'block';
if (activeScreen !== 'medals') {
  render();
}
    return;
  }

  // Tap inside card (not arrow) → do nothing
  return;
}

  if (tutorialMode) return;

if (showMenu) {
  const choice = isMenuClicked(pos);
  console.log("Menu clicked - choice:", choice); // ← DEBUG LOG (check console!)
  if (choice === 0) {
    showMenu = false;
    startTutorial();
  } else if (choice === 1) {
    showMenu = false;
    rulesShowing = true;
    clueDisplay.style.display = 'none';
if (activeScreen !== 'medals') {
  render();
}
  } else if (choice === 2) {
    showMenu = false;
    showMedalsScreen();
    clueDisplay.style.display = 'none';
  } else {
    showMenu = false;
if (activeScreen !== 'medals') {
  render();
}
  }
  return;
}

if (activeScreen === 'medals') {
  const pos = getPos(e);
  const cardX = (canvas.width - 520) / 2; // match your cardW
  const cardY = 70;
  const cardW = 520;
  const cardH = canvas.height - 140;

  // Check if tap is outside the card
  const isOutside = pos.x < cardX || pos.x > cardX + cardW ||
                     pos.y < cardY || pos.y > cardY + cardH;

  if (isOutside || isBackArrowClicked(pos)) {
    // Close medals screen
    activeScreen = 'game';
    clueDisplay.classList.remove('hidden');

    // Cleanup listeners
    const { startDrag, moveDrag, endDrag } = window.medalsListeners || {};
    if (startDrag) {
      canvas.removeEventListener('pointerdown', startDrag);
      canvas.removeEventListener('pointermove', moveDrag);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointerleave', endDrag);
      canvas.removeEventListener('touchstart', startDrag);
      canvas.removeEventListener('touchmove', moveDrag);
      canvas.removeEventListener('touchend', endDrag);
    }
    window.medalsListeners = null;

    showMenu = true; // return to menu
    render();
    return;
  }
}

if (showMedals && !isBackArrowClicked(pos)) {
  // Tap outside back arrow → close medals
  showMedals = false;
  window.currentScreen = null;
  clueDisplay.classList.remove('hidden');
  // Cleanup listeners (same as above)
  const { startDrag, moveDrag, endDrag } = window.medalsListeners || {};
  if (startDrag) {
    // ... remove all listeners as above ...
  }
  window.medalsListeners = null;
  showMenu = true;
if (activeScreen !== 'medals') {
  render();
}
  return;
}

  // Handle share icon click
  if (isShareIconClicked(pos)) {
    handleShare();
    return;
  }

  if (isHelpStatusIconClicked(pos)) {
    saveGameState();
    showMenu = true;
if (activeScreen !== 'medals') {
  render();
}
    return;
  }

  if (confirmingReset) {
    const gy = gridY();
    const wordY = gy + 8*(tileSize+C.SPACING) + C.VOWEL_ROW_GAP + tileSize + C.WORD_ROW_GAP;
    const boxX = wordRowBoxX;
    const boxW = sharedContentWidth;
    const wordRowRect = {
      x: boxX,
      y: wordY - C.WORD_ROW_V_PADDING,
      width: boxW,
      height: wordTileSize + 2*C.WORD_ROW_V_PADDING
    };

    if (pos.x >= wordRowRect.x && pos.x <= wordRowRect.x + wordRowRect.width &&
        pos.y >= wordRowRect.y && pos.y <= wordRowRect.y + wordRowRect.height) {
      // User confirmed reset
      grid.forEach(r => r.forEach(t => t.state = TILE_STATES.OFF));
      wordRow = [];
      chain = [];
      score = 0;
      turns = 0;
      gameOver = false;
      confirmingReset = false;
      updateGameState();
if (activeScreen !== 'medals') {
  render();
}
    } else {
      // Clicked outside → cancel reset
      confirmingReset = false;
      wordRow = prevWordRow.slice(); // restore previous word
if (activeScreen !== 'medals') {
  render();
}
    }
    return;
  }

const btn = getButtonIndex(pos);
if (btn >= 0) {
  if (btn === 0) {
    handleHint();     // HINT button (index 0)
  } else if (btn === 1) {
    handleCheck();    // CHECK button (index 1)
  }
  return;
}
  // ────────────────────────────────────────────────
  // INSERT THE FIXED WORD-ROW TOUCH HANDLING HERE
  const wordIdx = getWordRowIndexAt(pos);
  if (wordIdx !== -1) {
    const touched = wordRow[wordIdx];

    if (VOWEL_LETTERS.includes(touched.letter)) {
      // (1) Touching a vowel → remove only that vowel
      wordRow.splice(wordIdx, 1);
      render();
      return;
    } else {
      // (2) Touching a consonant → remove it + everything to the right
      const removeStart = wordIdx;
      const removeEnd = wordRow.length;
      const removeCount = removeEnd - removeStart;

      // Find how many consonants are in the removed range (R + later consonants)
      let consonantsInTail = 0;
      for (let i = removeStart; i < removeEnd; i++) {
        if (!VOWEL_LETTERS.includes(wordRow[i]?.letter)) {
          consonantsInTail++;
        }
      }

      // Remove the **last** consonantsInTail entries from chain
      // (these are the most recently added consonants, which correspond to R and later)
      for (let i = 0; i < consonantsInTail && chain.length > 0; i++) {
        const p = chain.pop();  // remove from end
        if (p && typeof p.row === 'number' && typeof p.col === 'number') {
          grid[p.row][p.col].state = TILE_STATES.OFF;
        }
      }

      // Now remove the word row slice (vowels + consonants)
      wordRow.splice(removeStart, removeCount);

      render();
      return;
    }

  }
  // ────────────────────────────────────────────────


  if (!gameOver && !confirmingReset) {
    if (startVowelDrag(pos)) return;
    tryAddTile(pos);
  }
});

canvas.addEventListener('pointermove', e => {
  if (rulesShowing) return;
  if (mouseDown) {
    const pos = getPos(e);
    if (dragVowel) moveVowelDrag(pos);
    else if (!tutorialMode) tryAddTile(pos);
  }
});

// Unified pointerup handler (mouse + touch)
// Unified touch + pointer handler for share icon (mobile-friendly)
function setupShareTouchHandler() {
  // Use both pointerup and touchend for maximum compatibility
  const handleUp = (e) => {
    // Only prevent default if we're handling the event
    if (rulesShowing || tutorialMode) {
      e.preventDefault();
    }

    const pos = getPos(e);

    // Reset drag states (your existing logic)
    if (mouseDown && dragVowel) {
      dropVowel(pos);
    }
    mouseDown = false;
    attemptedSeventhTile = false;

    // Rules mode exit
    if (rulesShowing) return;

    // Tutorial pause/resume
    if (tutorialMode) {
      const now = Date.now();
      if (now - lastTapTime < debounceMs) return;
      lastTapTime = now;

      animationPaused = !animationPaused;

      if (!animationPaused && pauseResolve) {
        pauseResolve();
        pauseResolve = null;
      }

      message = animationPaused ? "Paused – tap to resume" : "";
      render();
      return;
    }

    // Share icon check
    if (isShareIconClicked(pos)) {
      console.log("[Share] Icon tapped/detected on mobile - browser:", navigator.userAgent);
      handleShare();
      e.preventDefault(); // prevent any default share behavior
      return;
    }

    // ... any other pointerup logic ...
  };

  canvas.addEventListener('pointerup', handleUp, { passive: false });
  canvas.addEventListener('touchend', handleUp, { passive: false });
}


let touchStartY = 0;
let velocity = 0;
let isScrolling = false;

canvas.addEventListener('touchstart', e => {
  if (!rulesShowing) return;

  if (e.touches.length === 1) {
    isScrolling = true;
    touchStartY = e.touches[0].clientY;
    lastTouchY = touchStartY;
    velocity = 0;
    e.preventDefault(); // Only prevent here to stop page scroll
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (!rulesShowing || !isScrolling || e.touches.length !== 1) return;

  const currentY = e.touches[0].clientY;
  const dy = currentY - lastTouchY;

  // Update scroll position
  rulesScrollY += dy * 1.5; // Slightly faster for better feel
  rulesScrollY = Math.max(-600, Math.min(0, rulesScrollY)); // Your bounds

  // Track velocity for inertia
  velocity = dy * 0.8; // Smooth damping

  lastTouchY = currentY;

  // Only prevent default if we're actually scrolling content
  if (rulesScrollY !== 0 && rulesScrollY !== -600) {
    e.preventDefault();
  }

  render(); // Redraw immediately for smooth feel
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (!rulesShowing || !isScrolling) return;

  isScrolling = false;

  // Apply inertia (momentum scrolling)
  const inertia = () => {
    if (Math.abs(velocity) < 0.1) return;

    rulesScrollY += velocity;
    rulesScrollY = Math.max(-600, Math.min(0, rulesScrollY));
    velocity *= 0.95; // Damping

    render();

    if (Math.abs(velocity) > 0.1) {
      requestAnimationFrame(inertia);
    }
  };

  requestAnimationFrame(inertia);
});

canvas.addEventListener('wheel', e => {
  if (rulesShowing) {
    rulesScrollY += e.deltaY > 0 ? -40 : 40;
    rulesScrollY = Math.max(-600, Math.min(0, rulesScrollY));
    e.preventDefault();
if (activeScreen !== 'medals') {
  render();
}
  }
});

canvas.addEventListener('mousemove', e => {
  if (rulesShowing || showMenu) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  // Medal tooltip using exact stored drawn position
  const hitRadius = medalSize / 2 + 15; // buffer — increase to 20/25 if too small
  if (Math.hypot(mouseX - medalHitX, mouseY - medalHitY) < hitRadius) {
    showScoreTooltip(true, score); // <-- correct function for score tooltip
  } else {
    showScoreTooltip(false);
  }

  // Keep your existing turns/circles tooltip check (scaled coordinates)
  const centerX = canvas.width / 2;
  const circlesLeftX = centerX - (6 * CIRCLE_SPACING / 2) - 80;
  const circlesRightX = circlesLeftX + 6 * CIRCLE_SPACING;
  const circlesHitY = STATUS_Y;

  if (
    mouseX >= circlesLeftX - 10 &&
    mouseX <= circlesRightX + 10 &&
    Math.abs(mouseY - circlesHitY) < 15
  ) {
    showTurnsTooltip(true);
  } else {
    showTurnsTooltip(false);
  }

  // ... any other existing tooltip checks (help icon, etc.) ...
});

canvas.addEventListener('mouseleave', () => {
  showMedalTooltip(false);
});

// ====================== CHECK (now allows 1-letter chain) ======================
// ADD THESE TWO FUNCTIONS (anywhere near countFullRows is fine)

function computeCurrentScore() {
  // FIXED: Row/col bonuses are already added to 'score' incrementally during handleCheck
  // Preview should show the running total without double-counting
// In computeCurrentScore()
//console.log("[PREVIEW REQUEST] returning:", score);
console.trace("[computeCurrentScore] called — returning raw score");
  return score;
}

function countFullRows() {
  return QJYNN_RULES.countFullRows(grid, [TILE_STATES.ON, TILE_STATES.TOP]);
}

function countFullColumns() {
  return QJYNN_RULES.countFullColumns(grid, [TILE_STATES.ON, TILE_STATES.TOP]);
}

async function handleCheck() {
  if (isProcessingCheck || wordRowLocked) return;

  if (wordRow.length === 0) {
    const preview = computeCurrentScore();
    showToast(`No word to validate`, 1800);
    return;
  }

  if (wordRow.length < QJYNN_RULES.MIN_WORD_LENGTH) {
    showToast("Need at least 2 letters in word");
    return;
  }
  if (wordRow.length > QJYNN_RULES.MAX_WORD_LENGTH) {
    showToast("Maximum 10 letters per word");
    return;
  }
  if (gameOver || confirmingReset) return;

  isProcessingCheck = true;

  try {
    const word = wordRow.map(c => c.letter).join('');
    console.log("[handleCheck] Word:", word);
    console.log("[handleCheck] Chain length:", chain.length);
    console.log("[handleCheck] isHexalink():", isHexalink());
    console.log("[handleCheck] hexalinkUsed before:", hexalinkUsed);

    const validation = await QJYNN_WORD_VALIDATOR.validateWord(word);
    if (validation.unavailable) {
      console.error("[handleCheck] Vocabulary unavailable:", validation.error);
      showToast("Word list unavailable. Try again.", 2200);
      render();
      return;
    }
    const valid = validation.valid;

    const isFullHexalink = isHexalink();

    if (!valid) {
      showToast("Not in word list", 1800);

      turns++;
      console.log(`Invalid word "${word}" → turn consumed, new turns: ${turns}`);

      chain.forEach(p => grid[p.row][p.col].state = TILE_STATES.OFF);
      currentFullRows = countFullRows();
      currentFullCols = countFullColumns();
      wordRow.forEach(c => c.valid = false);

      wordRowLocked = true;
      clearTimeout(wordRowLockTimer);
      wordRowLockTimer = setTimeout(() => {
        chain = [];
        wordRow = [];
        wordRowLocked = false;
        render();
      }, 1750);

      if (turns >= C.MAX_TURNS) {
        gameOver = true;
        showGameOverSharePrompt(); // ← Moved here so it triggers on invalid final turn too
      }

      finishTurn();
      render();
    } else {
      if (tutorialMode && word === 'FRUIT') {
        chain.forEach(p => grid[p.row][p.col].state = TILE_STATES.TOP);
        wordRow.forEach(c => c.valid = true);
        score += 10 + 0;
        showCelebrationToast(`Good! +10 points!`, 2400);
        turns++;
      } else {
        if (valid && isFullHexalink) {
          hexalinkUsed = true;
          clueDisplay.textContent = "Hexalink not available anymore!";
          console.log("Valid hexalink word submitted → Hint disabled + clue updated");
          render();
        }

        chain.forEach(p => grid[p.row][p.col].state = isFullHexalink ? TILE_STATES.TOP : TILE_STATES.ON);
        wordRow.forEach(c => c.valid = true);

        const wordSum = wordRow.reduce((a, c) => a + c.value, 0);
        const turnTotal = QJYNN_RULES.scoreWordByLength(wordSum, isFullHexalink);

        if (turnTotal > 0) {
          let message = "";
          let duration = 1800;

          if (turnTotal <= 3) message = `Nice! +${turnTotal} points`;
          else if (turnTotal === 8 || turnTotal === 10 || turnTotal === 12) message = `Good! +${turnTotal} points`;
          else if (turnTotal === 15) message = `Impressive! +${turnTotal} points`;
          else if (turnTotal === 20) message = `Great! +${turnTotal} points`;
          else if (turnTotal === 30) message = `Amazing! +${turnTotal} points`;
          else {
            message = `+${turnTotal} points`;
            duration = 1800;
          }

          showCelebrationToast(message, duration);
          await delay(1800);
        }

// Right before any score += line
console.log("[SCORE BEFORE BONUS] current score:", score, "fullRows now:", countFullRows(), "tracker:", currentFullRows);

        score += turnTotal;
render();  // ← force redraw NOW so score shows instantly

        const newFullRows = countFullRows();
        const newFullCols = countFullColumns();

        const completedRowsThisTurn = newFullRows - currentFullRows;
        const completedColsThisTurn = newFullCols - currentFullCols;

        const lineBonus = QJYNN_RULES.rowColumnBonus(currentFullRows, currentFullCols, newFullRows, newFullCols);
        const rowBonus = lineBonus.completedRows * 10;
        const colBonus = lineBonus.completedColumns * 20;
// Right before any score += line
console.log("[SCORE BEFORE BONUS] current score:", score, "fullRows now:", countFullRows(), "tracker:", currentFullRows);

        score += rowBonus + colBonus;

// After adding row/col bonus
console.log("[SCORE AFTER BONUS] added:", rowBonus + colBonus, "new score:", score);

        if (completedRowsThisTurn > 0) {
          for (let i = 0; i < completedRowsThisTurn; i++) {
            showCelebrationToast("All gold row! +10 points", 1800);
            await delay(1200);
          }
        }

        if (completedColsThisTurn > 0) {
          for (let i = 0; i < completedColsThisTurn; i++) {
            showCelebrationToast("All gold column! +20 points", 1800);
            await delay(1200);
          }
        }

        currentFullRows = newFullRows;
        currentFullCols = newFullCols;
// At the very end of valid branch
console.log("[END OF VALID] final score:", score);
      }

      turns++;
      recordTurnResult(wordRow.length, isFullHexalink);
      console.log(`Consumed turn ${turns} for word: ${word}`);

      if (turns >= C.MAX_TURNS) {
        gameOver = true;
        clueDisplay.textContent = "Great game!";
        render();
        showGameOverSharePrompt(); // ← Moved here so it always triggers when game ends
      }

      if (gameOver) {
        // Optional medal save (moved up if needed)
        const medalType = QJYNN_RULES.medalForScore(score);

        const today = new Date().toISOString().slice(0, 10);
        let medals = JSON.parse(localStorage.getItem('qjynn_medals') || '[]');
        medals = medals.filter(m => m.date !== today);
        medals.push({ date: today, type: medalType });
        localStorage.setItem('qjynn_medals', JSON.stringify(medals));

        console.log(`Saved medal for ${today}: ${medalType} (${score} points)`);
      }

      render();

      wordRowLocked = true;
      clearTimeout(wordRowLockTimer);
      wordRowLockTimer = setTimeout(() => {
        chain = [];
        wordRow = [];
        wordRowLocked = false;
        render();
      }, 1750);

      finishTurn();
    }
  } finally {
    isProcessingCheck = false;
  }
}

// Helper to show share prompt with real SVG icon
function showGameOverSharePrompt() {
  console.log("[GameOver] Showing share prompt with SVG icon");

  const msgDiv = document.getElementById('gameOverMessage');
  if (!msgDiv) {
    console.error("[GameOver] ERROR: #gameOverMessage div not found in DOM");
    // Fallback to clue text
    clueDisplay.textContent = "Great game! Share your medal ↑";
    return;
  }

  console.log("[GameOver] Found message div → setting visible");

  const iconImg = document.getElementById('shareIconInMessage');
  if (iconImg) {
    iconImg.src = `${ASSET_PATH}share_icon.svg`;
    console.log("[GameOver] Set icon src to images/share_icon.svg");
  } else {
    console.warn("[GameOver] shareIconInMessage img not found inside div");
  }

  msgDiv.style.display = 'block';
  console.log("[GameOver] Set display:block on message div");

  // Auto-hide after 8 seconds
  setTimeout(() => {
    msgDiv.style.display = 'none';
    console.log("[GameOver] Auto-hid message after 8s");
  }, 8000);

  // Hide on any tap/click
  const hideMsg = () => {
    msgDiv.style.display = 'none';
    console.log("[GameOver] Hid message on tap");
    document.removeEventListener('pointerdown', hideMsg);
  };
  document.addEventListener('pointerdown', hideMsg);
}

// UPDATED CELEBRATION TOAST (more sparkly!)
// NEW: Count how many rows are fully covered (have at least one ON or TOP tile)
function showCelebrationToast(htmlContent, duration = 8000) {
  const toast = document.createElement('div');
  toast.innerHTML = htmlContent;
  if (tutorialMode && htmlContent.includes('FRUIT')) {
    htmlContent = `Great! FRUIT is valid!`;
  }

  // Get clue row dimensions for positioning & width reference
  const clueRect = clueDisplay.getBoundingClientRect();
  const clueWidth = clueRect.width;
  const toastWidth = Math.min(clueWidth * 1.25, 650);  // 135% of clue, max 700px

  toast.style.cssText = `
    position: fixed;
    top: ${clueRect.top + clueRect.height / 2 - 6}px;   /* vertically centered on clue row */
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
    color: white;
    padding: 12px 20px;
    //padding: 20px 36px;
    border-radius: 999px;
    font-weight: bold;
    text-align: center;
    z-index: 20001;
    pointer-events: none;
    width: ${toastWidth}px;
    max-width: 92vw;
    min-width: 320px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.7);
    border: 2px solid #FFD700;
    //border: 4px solid #FFD700;
    opacity: 0;
    transition: opacity 0.4s ease, transform 0.4s ease;
    animation: victoryPop 0.7s ease-out forwards;
  `;

  // Sparkle strip above the toast
  const sparkle = document.createElement('div');
  sparkle.innerHTML = '✨ ✦ ✧ ✶ ✦ ✨ ✧ ✶ ✨';
  sparkle.style.cssText = `
    position: absolute;
    top: -36px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 48px;
    white-space: nowrap;
    animation: sparkleRain 3.5s infinite;
    pointer-events: none;
    opacity: 0.95;
  `;
  //toast.appendChild(sparkle);

  document.body.appendChild(toast);

  // Fade-in immediately
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, -50%) translateY(-10px)';  // slight upward pop
  });

  // Auto-remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -50%) translateY(-40px)';
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 500);
  }, duration);

  // Re-add keyframes if not already present
  if (!document.getElementById('celebration-styles')) {
    const style = document.createElement('style');
    style.id = 'celebration-styles';
    style.textContent = `
      @keyframes victoryPop {
        0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
        60%  { transform: translate(-50%, -50%) scale(1.12); }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
      @keyframes sparkleRain {
        0%, 100%   { opacity: 0.7; transform: translateX(-50%) translateY(0) rotate(0deg); }
        50%        { opacity: 1;   transform: translateX(-50%) translateY(-28px) rotate(180deg); }
      }
    `;
    document.head.appendChild(style);
  }
}


// NEW: Enhanced UNDO logic
let vowelsRemovedCount = 0;

function handleHint() {
  if (gameOver || confirmingReset || wordRowLocked) return;

  // ── Use TUTORIAL_LAYOUT.hexalink during tutorial, otherwise real layout ──
  if (tutorialMode) {
    hexalink = TUTORIAL_LAYOUT?.hexalink || '';
  } else {
    hexalink = window.EMBEDDED_LAYOUT?.hexalink || '';
  }

  if (!hexalink || hexalink.length !== 6) {
    showToast("No hexalink available", 1800);
    return;
  }

  const prevClicks = hintClicks;
  hintClicks = (hintClicks + 1) % 6;

  // Pick one random unrevealed letter (same as before)
  let available = [];
  for (let i = 0; i < 6; i++) {
    if (!hintRevealed.has(i)) available.push(i);
  }

  let progress = '______';
  let chosenLetter = '_';

  if (available.length > 0) {
    const randomIdx = available[Math.floor(Math.random() * available.length)];
    hintRevealed.add(randomIdx);

    const chars = progress.split('');
    chosenLetter = hexalink[randomIdx];
    chars[randomIdx] = chosenLetter;
    progress = chars.join('');
  } else {
    // Rare fallback: pick any
    const randomIdx = Math.floor(Math.random() * 6);
    const chars = progress.split('');
    chosenLetter = hexalink[randomIdx];
    chars[randomIdx] = chosenLetter;
    progress = chars.join('');
  }

  // Build toast message
  let toastMsg = `Hexalink: ${progress}`;

  // On 6th click: decrement turns + add remaining line
  if (hintClicks === 0 && prevClicks === 5) {
    turns = Math.max(0, turns + 1);   // ← changed to decrement (matches typical game)
    hintRevealed.clear();             // reset for next cycle

    toastMsg += `\nRemaining turns: ${C.MAX_TURNS - turns}`;
  }

  showToast(toastMsg, 1800);

  // Force redraw
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      render();
    });
  });
}


// (All your input handlers, handleCheck, render functions, etc. stay exactly as in your posted code)

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{if(window.EMBEDDED_LAYOUT)initGame();});
}else if(window.EMBEDDED_LAYOUT)initGame();
