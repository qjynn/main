const qjynnRules = require('../../qjynn-rules.js');
const {
  createPrng,
  shuffle,
  generateHexalinkPath,
  subtractHexalinkInventory
} = require('../generator/grid-generator.js');
const { ROWS, COLS, CONSONANTS } = require('../generator/puzzle-validator.js');
const { legalMoveContext, scoreFirstMoves } = require('../analyzer/puzzle-analyzer.js');

const STRATEGY_VERSION = 'm7a.1';
const STRATEGIES = Object.freeze({
  RANDOM_BASELINE: 'RANDOM_BASELINE',
  COMMON_CONSONANT_CLUSTERED: 'COMMON_CONSONANT_CLUSTERED',
  COMMON_CONSONANT_DISPERSED: 'COMMON_CONSONANT_DISPERSED',
  RARE_LETTER_SEPARATED: 'RARE_LETTER_SEPARATED',
  HEXALINK_CENTRIC: 'HEXALINK_CENTRIC',
  HEXALINK_ISOLATED: 'HEXALINK_ISOLATED',
  DEGREE_BALANCED: 'DEGREE_BALANCED',
  HIGH_VALUE_PATH_SUPPRESSED: 'HIGH_VALUE_PATH_SUPPRESSED'
});

const COMMON_LETTERS = new Set(['N', 'R', 'T', 'L', 'S', 'D', 'C', 'H']);
const RARE_LETTERS = new Set(['J', 'K', 'Q', 'X', 'Z']);

function allCells() {
  const cells = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) cells.push([row, col]);
  }
  return cells;
}

function cellKey([row, col]) {
  return `${row},${col}`;
}

function coordDistance(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

function degree([row, col]) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS) count++;
    }
  }
  return count;
}

function remainingLetters(hexalink) {
  const inventory = subtractHexalinkInventory(hexalink);
  if (!inventory.ok) return inventory;
  const letters = [];
  for (const letter of CONSONANTS) {
    for (let count = 0; count < (inventory.counts[letter] || 0); count++) letters.push(letter);
  }
  return { ok: true, letters };
}

function createGrid(hexalink, hexarowcol) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (let index = 0; index < hexalink.length; index++) {
    const [row, col] = hexarowcol[index];
    grid[row][col] = hexalink[index];
  }
  return grid;
}

function fillByOrder(hexalink, hexarowcol, letters, cellOrder, letterOrder) {
  const grid = createGrid(hexalink, hexarowcol);
  const open = cellOrder.filter(([row, col]) => !grid[row][col]);
  for (let index = 0; index < open.length; index++) {
    const [row, col] = open[index];
    grid[row][col] = letterOrder[index] || letters[index];
  }
  return grid;
}

function randomBaseline(hexalink, hexarowcol, seed) {
  const remaining = remainingLetters(hexalink);
  if (!remaining.ok) return remaining;
  const prng = createPrng(seed);
  return {
    ok: true,
    grid: fillByOrder(hexalink, hexarowcol, remaining.letters, allCells(), shuffle(remaining.letters, prng))
  };
}

function commonClustered(hexalink, hexarowcol, seed) {
  const remaining = remainingLetters(hexalink);
  if (!remaining.ok) return remaining;
  const prng = createPrng(seed);
  const center = [Math.floor(ROWS / 2), Math.floor(COLS / 2)];
  const cells = shuffle(allCells(), prng).sort((a, b) => coordDistance(a, center) - coordDistance(b, center));
  const common = shuffle(remaining.letters.filter(letter => COMMON_LETTERS.has(letter)), prng);
  const other = shuffle(remaining.letters.filter(letter => !COMMON_LETTERS.has(letter)), prng);
  return { ok: true, grid: fillByOrder(hexalink, hexarowcol, remaining.letters, cells, [...common, ...other]) };
}

function commonDispersed(hexalink, hexarowcol, seed) {
  const remaining = remainingLetters(hexalink);
  if (!remaining.ok) return remaining;
  const prng = createPrng(seed);
  const cells = shuffle(allCells(), prng).sort((a, b) => degree(a) - degree(b) || (a[0] + a[1]) - (b[0] + b[1]));
  const common = shuffle(remaining.letters.filter(letter => COMMON_LETTERS.has(letter)), prng);
  const other = shuffle(remaining.letters.filter(letter => !COMMON_LETTERS.has(letter)), prng);
  const orderedLetters = [];
  let commonIndex = 0;
  let otherIndex = 0;
  for (let index = 0; index < remaining.letters.length; index++) {
    orderedLetters.push(index % 2 === 0 && commonIndex < common.length ? common[commonIndex++] : other[otherIndex++] || common[commonIndex++]);
  }
  return { ok: true, grid: fillByOrder(hexalink, hexarowcol, remaining.letters, cells, orderedLetters) };
}

function rareSeparated(hexalink, hexarowcol, seed) {
  const remaining = remainingLetters(hexalink);
  if (!remaining.ok) return remaining;
  const prng = createPrng(seed);
  const cornersFirst = shuffle(allCells(), prng).sort((a, b) => degree(a) - degree(b));
  const rare = shuffle(remaining.letters.filter(letter => RARE_LETTERS.has(letter)), prng);
  const other = shuffle(remaining.letters.filter(letter => !RARE_LETTERS.has(letter)), prng);
  return { ok: true, grid: fillByOrder(hexalink, hexarowcol, remaining.letters, cornersFirst, [...rare, ...other]) };
}

function hexalinkCentric(hexalink, hexarowcol, seed) {
  const remaining = remainingLetters(hexalink);
  if (!remaining.ok) return remaining;
  const prng = createPrng(seed);
  const cells = shuffle(allCells(), prng).sort((a, b) => {
    const da = Math.min(...hexarowcol.map(cell => coordDistance(a, cell)));
    const db = Math.min(...hexarowcol.map(cell => coordDistance(b, cell)));
    return da - db;
  });
  const common = shuffle(remaining.letters.filter(letter => COMMON_LETTERS.has(letter)), prng);
  const other = shuffle(remaining.letters.filter(letter => !COMMON_LETTERS.has(letter)), prng);
  return { ok: true, grid: fillByOrder(hexalink, hexarowcol, remaining.letters, cells, [...common, ...other]) };
}

function hexalinkIsolated(hexalink, hexarowcol, seed) {
  const remaining = remainingLetters(hexalink);
  if (!remaining.ok) return remaining;
  const prng = createPrng(seed);
  const cells = shuffle(allCells(), prng).sort((a, b) => {
    const da = Math.min(...hexarowcol.map(cell => coordDistance(a, cell)));
    const db = Math.min(...hexarowcol.map(cell => coordDistance(b, cell)));
    return da - db;
  });
  const rare = shuffle(remaining.letters.filter(letter => RARE_LETTERS.has(letter)), prng);
  const other = shuffle(remaining.letters.filter(letter => !RARE_LETTERS.has(letter)), prng);
  return { ok: true, grid: fillByOrder(hexalink, hexarowcol, remaining.letters, cells, [...rare, ...other]) };
}

function degreeBalanced(hexalink, hexarowcol, seed) {
  const remaining = remainingLetters(hexalink);
  if (!remaining.ok) return remaining;
  const prng = createPrng(seed);
  const cellsByDegree = shuffle(allCells(), prng).sort((a, b) => degree(b) - degree(a));
  const letters = shuffle(remaining.letters, prng).sort((a, b) => {
    const ca = qjynnRules.CONSONANT_INVENTORY[a] || 0;
    const cb = qjynnRules.CONSONANT_INVENTORY[b] || 0;
    return cb - ca || a.localeCompare(b);
  });
  return { ok: true, grid: fillByOrder(hexalink, hexarowcol, remaining.letters, cellsByDegree, letters) };
}

function highValuePathSuppressed(hexalink, hexarowcol, seed, wordIndex, options = {}) {
  const candidateCount = options.highValueCandidateCount || 8;
  let best = null;
  for (let index = 0; index < candidateCount; index++) {
    const candidate = randomBaseline(hexalink, hexarowcol, seed + index * 9973);
    if (!candidate.ok) return candidate;
    const puzzle = { grid: candidate.grid, hexalink, hexarowcol };
    const context = legalMoveContext(puzzle, wordIndex);
    const scored = scoreFirstMoves(puzzle, context.prepared.moves);
    const maxScore = Math.max(...scored.map(move => move.immediateScore));
    const highValueCount = scored.filter(move => move.immediateScore >= 20).length;
    const score = maxScore * 100000 + highValueCount;
    if (!best || score < best.score) best = { score, grid: candidate.grid, diagnostics: { maxScore, highValueCount } };
  }
  return { ok: true, grid: best.grid, diagnostics: best.diagnostics };
}

function placeExperimentalGrid({ strategy, hexalink, hexarowcol, seed, wordIndex, options = {} }) {
  switch (strategy) {
    case STRATEGIES.RANDOM_BASELINE:
      return randomBaseline(hexalink, hexarowcol, seed);
    case STRATEGIES.COMMON_CONSONANT_CLUSTERED:
      return commonClustered(hexalink, hexarowcol, seed);
    case STRATEGIES.COMMON_CONSONANT_DISPERSED:
      return commonDispersed(hexalink, hexarowcol, seed);
    case STRATEGIES.RARE_LETTER_SEPARATED:
      return rareSeparated(hexalink, hexarowcol, seed);
    case STRATEGIES.HEXALINK_CENTRIC:
      return hexalinkCentric(hexalink, hexarowcol, seed);
    case STRATEGIES.HEXALINK_ISOLATED:
      return hexalinkIsolated(hexalink, hexarowcol, seed);
    case STRATEGIES.DEGREE_BALANCED:
      return degreeBalanced(hexalink, hexarowcol, seed);
    case STRATEGIES.HIGH_VALUE_PATH_SUPPRESSED:
      return highValuePathSuppressed(hexalink, hexarowcol, seed, wordIndex, options);
    default:
      return { ok: false, error: { code: 'strategy.unknown', message: `Unknown strategy: ${strategy}` } };
  }
}

function generateStrategyPath(seed, strategy, options = {}) {
  const prng = createPrng(seed ^ strategy.length);
  return generateHexalinkPath(prng, options);
}

module.exports = {
  STRATEGY_VERSION,
  STRATEGIES,
  COMMON_LETTERS,
  RARE_LETTERS,
  allCells,
  degree,
  remainingLetters,
  placeExperimentalGrid,
  generateStrategyPath
};
