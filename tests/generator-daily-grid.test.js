const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const qjynnRules = require('../qjynn-rules.js');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const {
  BASE_CONSONANT_COUNTS,
  createPrng,
  deriveHexalink,
  fillGrid,
  generateHexalinkPath,
  generatePuzzle,
  writePuzzleFiles
} = require('../tools/generator/grid-generator.js');
const {
  CONSONANT_SET,
  gridForRules,
  validateEditorialInput,
  validatePuzzle
} = require('../tools/generator/puzzle-validator.js');
const { replaySequence } = require('../tools/solver/state-search.js');

let fullIndex;
let generatedWatermelon;

function getFullIndex() {
  if (!fullIndex) {
    fullIndex = buildVocabularyIndex(parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8')));
  }
  return fullIndex;
}

function getWatermelonPuzzle() {
  if (!generatedWatermelon) {
    generatedWatermelon = generatePuzzle({
      answer: 'WATERMELON',
      clue: 'Large summer striped fruit',
      date: '2026-09-01',
      seed: 123456,
      maxAttempts: 5
    }, getFullIndex());
  }
  assert.equal(generatedWatermelon.ok, true);
  return generatedWatermelon;
}

function errorCodes(result) {
  return result.errors.map(error => error.code);
}

function countLetters(letters) {
  const counts = {};
  for (const letter of letters) counts[letter] = (counts[letter] || 0) + 1;
  return counts;
}

test('M6 accepts a valid 10-letter four-vowel answer', () => {
  const result = validateEditorialInput({
    answer: 'WATERMELON',
    clue: 'Large summer striped fruit',
    date: '2026-09-01',
    seed: 123456
  }, getFullIndex());

  assert.equal(result.ok, true);
  assert.equal(result.answer, 'WATERMELON');
});

test('M6 rejects invalid answer length', () => {
  const result = validateEditorialInput({ answer: 'MELON', clue: 'Fruit' }, getFullIndex());
  assert.equal(result.ok, false);
  assert.ok(errorCodes(result).includes('answer.invalidLength'));
});

test('M6 rejects answers with wrong vowel or consonant count', () => {
  const result = validateEditorialInput({ answer: 'AAAAAAAAAA', clue: 'No consonants' }, getFullIndex());
  assert.equal(result.ok, false);
  assert.ok(errorCodes(result).includes('answer.wrongVowelCount'));
  assert.ok(errorCodes(result).includes('answer.wrongConsonantCount'));
});

test('M6 rejects answers outside Qjynn Vocabulary 1.0', () => {
  const result = validateEditorialInput({ answer: 'BCDFGHJKLM', clue: 'Invalid' }, getFullIndex());
  assert.equal(result.ok, false);
  assert.ok(errorCodes(result).includes('answer.notInVocabulary'));
});

test('M6 derives the Hexalink exactly from the answer', () => {
  assert.equal(deriveHexalink('WATERMELON'), 'WTRMLN');
});

test('M6 generated Hexalink path has six unique adjacent cells', () => {
  const pathCells = generateHexalinkPath(createPrng(7));
  assert.equal(pathCells.length, 6);
  assert.equal(new Set(pathCells.map(pair => pair.join(','))).size, 6);
  for (let index = 1; index < pathCells.length; index++) {
    assert.equal(qjynnRules.areAdjacent(
      { row: pathCells[index - 1][0], col: pathCells[index - 1][1] },
      { row: pathCells[index][0], col: pathCells[index][1] }
    ), true);
  }
});

test('M6 Hexalink letters match generated path coordinates', () => {
  const result = getWatermelonPuzzle();
  const letters = result.puzzle.hexarowcol.map(([row, col]) => result.puzzle.grid[row][col]).join('');
  assert.equal(letters, result.puzzle.hexalink);
});

test('M6 reverse exact Hexalink remains canonical-rule valid', () => {
  const result = getWatermelonPuzzle();
  const chain = result.puzzle.hexarowcol.map(([row, col]) => ({ row, col }));
  assert.equal(qjynnRules.isExactHexalink(
    chain.slice().reverse(),
    gridForRules(result.puzzle.grid),
    result.puzzle.hexalink,
    result.puzzle.hexarowcol
  ), true);
});

test('M6 generated grid contains 48 valid consonants', () => {
  const result = getWatermelonPuzzle();
  const letters = result.puzzle.grid.flat();
  assert.equal(letters.length, 48);
  assert.equal(letters.every(letter => CONSONANT_SET.has(letter)), true);
});

test('M6 generated grid has exactly the canonical consonant inventory', () => {
  const result = getWatermelonPuzzle();
  assert.deepEqual(countLetters(result.puzzle.grid.flat()), qjynnRules.CONSONANT_INVENTORY);
});

test('M6 board dimensions are exactly 8 by 6', () => {
  const result = getWatermelonPuzzle();
  assert.equal(result.puzzle.grid.length, 8);
  assert.equal(result.puzzle.grid.every(row => row.length === 6), true);
});

test('M6 seeded generation is deterministic', () => {
  const input = { answer: 'WATERMELON', clue: 'Large summer striped fruit', date: '2026-09-01', seed: 123456, maxAttempts: 5 };
  const first = generatePuzzle(input, getFullIndex());
  const second = generatePuzzle(input, getFullIndex());
  assert.equal(first.ok, true);
  assert.deepEqual(first.puzzle, second.puzzle);
  assert.deepEqual(first.privateCertification.goldCertificate, second.privateCertification.goldCertificate);
});

test('M6 different seeds can generate different candidate boards', () => {
  const firstPath = generateHexalinkPath(createPrng(1));
  const secondPath = generateHexalinkPath(createPrng(2));
  const first = fillGrid('WTRMLN', firstPath, createPrng(11));
  const second = fillGrid('WTRMLN', secondPath, createPrng(22));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notDeepEqual({ grid: first.grid, path: firstPath }, { grid: second.grid, path: secondPath });
});

test('M6 Hexalink placement plus fill reconstructs canonical inventory exactly', () => {
  const hexalink = 'WTRMLN';
  const hexarowcol = generateHexalinkPath(createPrng(99));
  const filled = fillGrid(hexalink, hexarowcol, createPrng(100));
  assert.equal(filled.ok, true);
  assert.deepEqual(countLetters(filled.grid.flat()), qjynnRules.CONSONANT_INVENTORY);
  assert.equal(hexarowcol.map(([row, col]) => filled.grid[row][col]).join(''), hexalink);
});

test('M6 structural validator rejects malformed grids', () => {
  const puzzle = { ...getWatermelonPuzzle().puzzle, grid: [['W']] };
  const validation = validatePuzzle(puzzle, { answer: 'WATERMELON', wordIndex: getFullIndex() });
  assert.equal(validation.ok, false);
  assert.ok(errorCodes(validation).includes('grid.rows'));
});

test('M6 structural validator rejects duplicate Hexalink coordinates', () => {
  const puzzle = { ...getWatermelonPuzzle().puzzle, hexarowcol: [[0, 0], [0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] };
  const validation = validatePuzzle(puzzle, { answer: 'WATERMELON', wordIndex: getFullIndex() });
  assert.equal(validation.ok, false);
  assert.ok(errorCodes(validation).includes('hexarowcol.duplicate'));
});

test('M6 structural validator rejects nonadjacent Hexalink coordinates', () => {
  const puzzle = { ...getWatermelonPuzzle().puzzle, hexarowcol: [[0, 0], [7, 5], [7, 4], [7, 3], [7, 2], [7, 1]] };
  const validation = validatePuzzle(puzzle, { answer: 'WATERMELON', wordIndex: getFullIndex() });
  assert.equal(validation.ok, false);
  assert.ok(errorCodes(validation).includes('hexarowcol.nonAdjacent'));
});

test('M6 structural validator rejects incorrect Hexalink letters', () => {
  const original = getWatermelonPuzzle().puzzle;
  const grid = original.grid.map(row => row.slice());
  const [row, col] = original.hexarowcol[0];
  grid[row][col] = 'B';
  const validation = validatePuzzle({ ...original, grid }, { answer: 'WATERMELON', wordIndex: getFullIndex() });
  assert.equal(validation.ok, false);
  assert.ok(errorCodes(validation).includes('hexalink.lettersMismatch'));
});

test('M6 generated candidate is rejected when findGold says false', () => {
  const sparseIndex = buildVocabularyIndex(['watermelon']);
  const result = generatePuzzle({
    answer: 'WATERMELON',
    clue: 'Large summer striped fruit',
    date: '2026-09-01',
    seed: 123456,
    maxAttempts: 1
  }, sparseIndex);

  assert.equal(result.ok, false);
  assert.equal(result.failure.reason, 'max-attempts-exhausted');
  assert.equal(result.failure.goldCertifiedCandidates, 0);
});

test('M6 generated candidate is accepted only when findGold says true', () => {
  const result = getWatermelonPuzzle();
  assert.equal(result.ok, true);
  assert.equal(result.privateMetadata.goldCertified, true);
  assert.ok(result.privateCertification.goldScore >= 100);
});

test('M6 accepted Gold certificate replays exactly', () => {
  const result = getWatermelonPuzzle();
  const replay = replaySequence(result.puzzle, result.privateCertification.goldCertificate);
  assert.equal(replay.score, result.privateCertification.goldScore);
});

test('M6 accepted certificate score is at least 100', () => {
  assert.ok(getWatermelonPuzzle().privateCertification.goldScore >= 100);
});

test('M6 accepted certificate uses no more than six turns', () => {
  assert.ok(getWatermelonPuzzle().privateCertification.goldTurns <= 6);
});

test('M6 generator respects maxAttempts', () => {
  const sparseIndex = buildVocabularyIndex(['watermelon']);
  const result = generatePuzzle({
    answer: 'WATERMELON',
    clue: 'Large summer striped fruit',
    seed: 5,
    maxAttempts: 2
  }, sparseIndex);
  assert.equal(result.ok, false);
  assert.equal(result.failure.attemptsMade, 2);
});

test('M6 failure after maxAttempts is structured and non-destructive', () => {
  const sparseIndex = buildVocabularyIndex(['watermelon']);
  const result = generatePuzzle({
    answer: 'WATERMELON',
    clue: 'Large summer striped fruit',
    seed: 6,
    maxAttempts: 1
  }, sparseIndex);
  assert.equal(result.ok, false);
  assert.equal(result.failure.answer, 'WATERMELON');
  assert.equal(result.failure.hexalink, 'WTRMLN');
  assert.equal(result.failure.reason, 'max-attempts-exhausted');
});

test('M6 public output does not contain answer or certificate', () => {
  const result = getWatermelonPuzzle();
  const text = JSON.stringify(result.puzzle);
  assert.equal(Object.prototype.hasOwnProperty.call(result.puzzle, 'answer'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.puzzle, 'goldCertificate'), false);
  assert.equal(text.includes('WATERMELON'), false);
});

test('M6 private certificate contains reproducibility metadata', () => {
  const cert = getWatermelonPuzzle().privateCertification;
  assert.equal(cert.generatorVersion, 'm6.0');
  assert.equal(cert.vocabularyVersion, '1.0');
  assert.equal(cert.answer, 'WATERMELON');
  assert.equal(cert.seed, 123456);
  assert.ok(Array.isArray(cert.goldCertificate));
});

test('M6 writes public and private puzzle files', () => {
  const result = getWatermelonPuzzle();
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qjynn-m6-'));
  const paths = writePuzzleFiles(result, outputDir);
  assert.equal(fs.existsSync(paths.publicPath), true);
  assert.equal(fs.existsSync(paths.privatePath), true);
  const publicJson = JSON.parse(fs.readFileSync(paths.publicPath, 'utf8'));
  const privateJson = JSON.parse(fs.readFileSync(paths.privatePath, 'utf8'));
  assert.equal(publicJson.answer, undefined);
  assert.equal(privateJson.answer, 'WATERMELON');
});

test('M6 rejects Hexalinks that exceed the canonical consonant inventory', () => {
  const filled = fillGrid('WWWWWW', generateHexalinkPath(createPrng(3)), createPrng(4), {
    baselineCounts: BASE_CONSONANT_COUNTS
  });
  assert.equal(filled.ok, false);
  assert.equal(filled.error.code, 'inventory.hexalinkExceedsBaseline');
});

test('M6 full generation with known answer produces a certified puzzle', () => {
  const result = getWatermelonPuzzle();
  const validation = validatePuzzle(result.puzzle, { answer: 'WATERMELON', wordIndex: getFullIndex() });
  assert.equal(result.ok, true);
  assert.equal(validation.ok, true);
  assert.equal(result.puzzle.hexalink, 'WTRMLN');
  assert.equal(result.privateMetadata.goldCertified, true);
});
