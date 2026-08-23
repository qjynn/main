const fs = require('fs');
const path = require('path');
const qjynnRules = require('../../qjynn-rules.js');
const { consonantSkeleton } = require('../solver/word-index.js');
const { solveBoard, replaySequence, MODE_FIND_GOLD } = require('../solver/state-search.js');
const {
  ROWS,
  COLS,
  CONSONANTS,
  validateEditorialInput,
  validatePuzzle
} = require('./puzzle-validator.js');

const GENERATOR_VERSION = 'm6.0';
const RULES_VERSION = 'qjynn-rules-local';
const VOCABULARY_VERSION = '1.0';
const DEFAULT_MAX_ATTEMPTS = 1000;
const DEFAULT_GOLD_THRESHOLD = 100;
const BASE_CONSONANT_COUNTS = qjynnRules.CONSONANT_INVENTORY;

function createPrng(seed) {
  let state = Number(seed) >>> 0;
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeSeed(seed, input) {
  if (seed !== undefined && seed !== null && seed !== '') {
    const numeric = Number(seed);
    if (!Number.isFinite(numeric)) throw new Error('Seed must be numeric.');
    return numeric >>> 0;
  }
  return hashSeed(`${input.answer}|${input.clue}|${input.date || ''}`);
}

function randomInt(prng, limit) {
  return Math.floor(prng() * limit);
}

function shuffle(values, prng) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = randomInt(prng, index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function neighborsOf([row, col]) {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS) {
        neighbors.push([nextRow, nextCol]);
      }
    }
  }
  return neighbors;
}

function generateHexalinkPath(prng, options = {}) {
  const attempts = options.pathAttempts || 500;
  const starts = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) starts.push([row, col]);
  }

  for (let attempt = 0; attempt < attempts; attempt++) {
    const start = shuffle(starts, prng)[0];
    const pathCells = [start];
    const used = new Set([start.join(',')]);

    while (pathCells.length < qjynnRules.MAX_CHAIN_LENGTH) {
      const last = pathCells[pathCells.length - 1];
      const candidates = shuffle(neighborsOf(last), prng).filter(([row, col]) => !used.has(`${row},${col}`));
      if (!candidates.length) break;
      const next = candidates[0];
      pathCells.push(next);
      used.add(next.join(','));
    }

    if (pathCells.length === qjynnRules.MAX_CHAIN_LENGTH) return pathCells;
  }

  throw new Error('Unable to generate a six-cell Hexalink path.');
}

function subtractHexalinkInventory(hexalink, baselineCounts = BASE_CONSONANT_COUNTS) {
  const counts = { ...baselineCounts };
  for (const letter of hexalink) {
    if (!Object.prototype.hasOwnProperty.call(counts, letter)) {
      return { ok: false, error: { code: 'inventory.invalidHexalinkLetter', message: `No baseline inventory entry for ${letter}.` } };
    }
    counts[letter]--;
    if (counts[letter] < 0) {
      return {
        ok: false,
        error: {
          code: 'inventory.hexalinkExceedsBaseline',
          message: `Hexalink uses more ${letter} tiles than the baseline inventory permits.`
        }
      };
    }
  }
  return { ok: true, counts };
}

function remainingLettersFromCounts(counts) {
  const letters = [];
  for (const letter of CONSONANTS) {
    for (let count = 0; count < (counts[letter] || 0); count++) letters.push(letter);
  }
  return letters;
}

function fillGrid(hexalink, hexarowcol, prng, options = {}) {
  const inventory = subtractHexalinkInventory(hexalink, options.baselineCounts);
  if (!inventory.ok) return { ok: false, error: inventory.error };

  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (let index = 0; index < hexalink.length; index++) {
    const [row, col] = hexarowcol[index];
    grid[row][col] = hexalink[index];
  }

  const remaining = shuffle(remainingLettersFromCounts(inventory.counts), prng);
  if (remaining.length !== ROWS * COLS - qjynnRules.MAX_CHAIN_LENGTH) {
    return { ok: false, error: { code: 'inventory.invalidTotal', message: 'Remaining inventory must fill exactly 42 cells.' } };
  }

  let cursor = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!grid[row][col]) grid[row][col] = remaining[cursor++];
    }
  }

  return { ok: true, grid };
}

function publicPuzzleFor({ date, clue, grid, hexalink, hexarowcol }) {
  return {
    schema_version: 1,
    date,
    clue,
    grid,
    hexalink,
    hexarowcol
  };
}

function failureResult(input, normalized, stats, reason, details = {}) {
  return {
    ok: false,
    failure: {
      answer: normalized.answer,
      hexalink: normalized.hexalink,
      seed: normalized.seed,
      attemptsMade: stats.attempts,
      structurallyValidCandidates: stats.structurallyValidCandidates,
      goldCertifiedCandidates: stats.goldCertifiedCandidates,
      solverTimingSummary: {
        solverCalls: stats.solverCalls,
        totalSolverMs: stats.totalSolverMs,
        averageSolverMs: stats.averageSolverMs
      },
      reason,
      details
    }
  };
}

function generatePuzzle(input, wordIndex, options = {}) {
  const generationStart = process.hrtime.bigint();
  const editorial = validateEditorialInput(input, wordIndex);
  const stats = {
    attempts: 0,
    structurallyValidCandidates: 0,
    goldCertifiedCandidates: 0,
    solverCalls: 0,
    totalSolverMs: 0,
    averageSolverMs: 0,
    generationMs: 0
  };

  if (!editorial.ok) {
    stats.generationMs = Number(process.hrtime.bigint() - generationStart) / 1e6;
    return failureResult(input, { ...editorial, seed: input?.seed }, stats, 'invalid-input', { errors: editorial.errors });
  }

  const seed = normalizeSeed(input?.seed, input);
  const normalized = { ...editorial, seed };
  const maxAttempts = options.maxAttempts || input?.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const goldThreshold = options.goldThreshold || input?.goldThreshold || DEFAULT_GOLD_THRESHOLD;
  const prng = createPrng(seed);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    stats.attempts = attempt;
    let hexarowcol;
    let filled;
    try {
      hexarowcol = generateHexalinkPath(prng, options);
      filled = fillGrid(editorial.hexalink, hexarowcol, prng, options);
    } catch (error) {
      return failureResult(input, normalized, stats, 'generation-error', { message: error.message });
    }

    if (!filled.ok) return failureResult(input, normalized, stats, filled.error.code, filled.error);

    const puzzle = publicPuzzleFor({
      date: input?.date || null,
      clue: editorial.clue,
      grid: filled.grid,
      hexalink: editorial.hexalink,
      hexarowcol
    });
    const validation = validatePuzzle(puzzle, { answer: editorial.answer, wordIndex });
    if (!validation.ok) continue;
    stats.structurallyValidCandidates++;

    const solverStart = process.hrtime.bigint();
    const solution = solveBoard({ ...puzzle, maxTurns: qjynnRules.MAX_TURNS, goldThreshold }, wordIndex, { mode: MODE_FIND_GOLD });
    const solverMs = Number(process.hrtime.bigint() - solverStart) / 1e6;
    stats.solverCalls++;
    stats.totalSolverMs += solverMs;
    stats.averageSolverMs = stats.totalSolverMs / stats.solverCalls;

    if (!solution.goldReachable) continue;
    const replay = replaySequence(puzzle, solution.goldCertificate);
    if (replay.score !== solution.maxScore || replay.score < goldThreshold || replay.turnsUsed > qjynnRules.MAX_TURNS) {
      return failureResult(input, normalized, stats, 'certificate-replay-failed', { replay, reportedScore: solution.maxScore });
    }

    stats.goldCertifiedCandidates++;
    stats.generationMs = Number(process.hrtime.bigint() - generationStart) / 1e6;
    stats.rawM4MoveCount = solution.stats.rawStartingMoveCount;
    stats.solverRelevantMoveCount = solution.stats.solverRelevantMoveCount;
    stats.goldScore = solution.maxScore;
    stats.goldTurns = solution.turnsUsed;

    const privateMetadata = {
      answer: editorial.answer,
      seed,
      attempt,
      goldCertified: true,
      goldScore: solution.maxScore,
      goldCertificate: solution.goldCertificate,
      rulesVersion: RULES_VERSION,
      vocabularyVersion: VOCABULARY_VERSION
    };
    const privateCertification = {
      schemaVersion: 1,
      generatorVersion: GENERATOR_VERSION,
      rulesVersion: RULES_VERSION,
      vocabularyVersion: VOCABULARY_VERSION,
      answer: editorial.answer,
      clue: editorial.clue,
      date: input?.date || null,
      seed,
      attemptNumber: attempt,
      hexalink: editorial.hexalink,
      hexarowcol,
      goldScore: solution.maxScore,
      goldTurns: solution.turnsUsed,
      goldCertificate: solution.goldCertificate,
      certificateReplayResult: replay,
      generationStats: { ...stats }
    };

    return {
      ok: true,
      puzzle,
      privateMetadata,
      privateCertification,
      stats
    };
  }

  stats.generationMs = Number(process.hrtime.bigint() - generationStart) / 1e6;
  return failureResult(input, normalized, stats, 'max-attempts-exhausted');
}

function writePuzzleFiles(result, outputDir = 'puzzles') {
  if (!result?.ok) throw new Error('Cannot write files for a failed generation result.');
  const date = result.puzzle.date;
  if (!date) throw new Error('A date is required when writing puzzle files.');
  const publicDir = path.join(outputDir, 'public');
  const privateDir = path.join(outputDir, 'private', 'certificates');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(privateDir, { recursive: true });
  const publicPath = path.join(publicDir, `${date}.json`);
  const privatePath = path.join(privateDir, `${date}.json`);
  fs.writeFileSync(publicPath, `${JSON.stringify(result.puzzle, null, 2)}\n`);
  fs.writeFileSync(privatePath, `${JSON.stringify(result.privateCertification, null, 2)}\n`);
  return { publicPath, privatePath };
}

module.exports = {
  GENERATOR_VERSION,
  RULES_VERSION,
  VOCABULARY_VERSION,
  BASE_CONSONANT_COUNTS,
  createPrng,
  hashSeed,
  normalizeSeed,
  shuffle,
  generateHexalinkPath,
  subtractHexalinkInventory,
  fillGrid,
  publicPuzzleFor,
  generatePuzzle,
  writePuzzleFiles,
  deriveHexalink: consonantSkeleton
};
