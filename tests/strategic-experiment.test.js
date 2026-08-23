const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const qjynnRules = require('../qjynn-rules.js');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const { validatePuzzle } = require('../tools/generator/puzzle-validator.js');
const { analyzePuzzle } = require('../tools/analyzer/puzzle-analyzer.js');
const {
  STRATEGIES,
  STRATEGY_VERSION,
  placeExperimentalGrid,
  generateStrategyPath
} = require('../tools/experiments/placement-strategies.js');
const { generateExperimentalPuzzle } = require('../tools/experiments/strategic-experiment.js');
const { runExperimentBatch, writeExperimentOutputs } = require('../tools/experiments/experiment-batch.js');

let fullIndex;

function getFullIndex() {
  if (!fullIndex) {
    fullIndex = buildVocabularyIndex(parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8')));
  }
  return fullIndex;
}

function countLetters(grid) {
  const counts = {};
  for (const letter of grid.flat()) counts[letter] = (counts[letter] || 0) + 1;
  return counts;
}

test('M7A.1 exports all required placement strategies', () => {
  assert.deepEqual(Object.keys(STRATEGIES).sort(), [
    'COMMON_CONSONANT_CLUSTERED',
    'COMMON_CONSONANT_DISPERSED',
    'DEGREE_BALANCED',
    'HEXALINK_CENTRIC',
    'HEXALINK_ISOLATED',
    'HIGH_VALUE_PATH_SUPPRESSED',
    'RANDOM_BASELINE',
    'RARE_LETTER_SEPARATED'
  ].sort());
});

test('M7A.1 every strategy preserves canonical inventory and Hexalink placement', () => {
  const hexalink = 'WTRMLN';
  const hexarowcol = generateStrategyPath(1234, STRATEGIES.RANDOM_BASELINE);
  for (const strategy of Object.values(STRATEGIES)) {
    const placed = placeExperimentalGrid({ strategy, hexalink, hexarowcol, seed: 1234, wordIndex: getFullIndex() });
    assert.equal(placed.ok, true, strategy);
    assert.deepEqual(countLetters(placed.grid), qjynnRules.CONSONANT_INVENTORY);
    assert.equal(hexarowcol.map(([row, col]) => placed.grid[row][col]).join(''), hexalink);
  }
});

test('M7A.1 experimental puzzle is structurally valid and Gold certified', () => {
  const result = generateExperimentalPuzzle({
    answer: 'WATERMELON',
    clue: 'Large summer striped fruit',
    date: '2026-11-01',
    seed: 123456,
    strategy: STRATEGIES.HEXALINK_CENTRIC,
    maxAttempts: 3
  }, getFullIndex(), { hexalinkAnalysisMaxStates: 5000 });

  assert.equal(result.ok, true);
  assert.equal(validatePuzzle(result.puzzle, { answer: 'WATERMELON', wordIndex: getFullIndex() }).ok, true);
  assert.ok(result.privateCertification.goldScore >= 100);
  assert.equal(result.privateCertification.strategy, STRATEGIES.HEXALINK_CENTRIC);
});

test('M7A.1 generation is deterministic by answer seed and strategy', () => {
  const input = {
    answer: 'WATERMELON',
    clue: 'Large summer striped fruit',
    seed: 999,
    strategy: STRATEGIES.RARE_LETTER_SEPARATED,
    maxAttempts: 3
  };
  const first = generateExperimentalPuzzle(input, getFullIndex());
  const second = generateExperimentalPuzzle(input, getFullIndex());
  assert.equal(first.ok, true);
  assert.deepEqual(first.puzzle, second.puzzle);
  assert.deepEqual(first.privateCertification.goldCertificate, second.privateCertification.goldCertificate);
});

test('M7A.1 strategy metadata is recorded', () => {
  const result = generateExperimentalPuzzle({
    answer: 'WATERMELON',
    clue: 'Large summer striped fruit',
    seed: 111,
    strategy: STRATEGIES.COMMON_CONSONANT_CLUSTERED,
    maxAttempts: 3
  }, getFullIndex());
  assert.equal(result.ok, true);
  assert.equal(result.strategyMetadata.strategyVersion, STRATEGY_VERSION);
  assert.equal(result.privateCertification.strategyVersion, STRATEGY_VERSION);
});

test('M7A.1 unknown strategy returns a structured failure', () => {
  const result = generateExperimentalPuzzle({
    answer: 'WATERMELON',
    clue: 'Large summer striped fruit',
    seed: 111,
    strategy: 'NOPE',
    maxAttempts: 1
  }, getFullIndex());
  assert.equal(result.ok, false);
  assert.equal(result.failure.reason, 'strategy.unknown');
});

test('M7A.1 analyzer uses explicit Hexalink-required naming', () => {
  const generated = generateExperimentalPuzzle({
    answer: 'WATERMELON',
    clue: 'Large summer striped fruit',
    seed: 222,
    strategy: STRATEGIES.RANDOM_BASELINE,
    maxAttempts: 3
  }, getFullIndex());
  const analysis = analyzePuzzle({
    puzzle: generated.puzzle,
    privateCertification: generated.privateCertification
  }, getFullIndex(), { goldViableFirstMoveLimit: 2, maxGoldCertificates: 1 });
  assert.equal(analysis.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(analysis.gold, 'goldReachableWithHexalinkRequired'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(analysis.gold, 'hexalinkRequiredGold'), false);
});

test('M7A.1 batch runs multiple strategies and writes artifacts', () => {
  const result = runExperimentBatch([
    { answer: 'WATERMELON', clue: 'Large fruit', seed: 123456, date: '2026-11-01' }
  ], getFullIndex(), {
    strategies: [STRATEGIES.RANDOM_BASELINE, STRATEGIES.HEXALINK_ISOLATED],
    count: 1,
    maxAttempts: 3,
    analysisOptions: { goldViableFirstMoveLimit: 2, maxGoldCertificates: 1, requireHexalinkAnalysis: false }
  });
  assert.equal(result.results.length, 2);
  assert.equal(result.failures.length, 0);
  assert.equal(result.csvRows.length, 2);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qjynn-m7a1-'));
  const jsonPath = path.join(dir, 'experiment.json');
  const csvPath = path.join(dir, 'experiment.csv');
  writeExperimentOutputs(result, jsonPath, csvPath);
  assert.equal(fs.existsSync(jsonPath), true);
  assert.equal(fs.existsSync(csvPath), true);
});
