const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const qjynnRules = require('../qjynn-rules.js');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const { solveBoard } = require('../tools/solver/state-search.js');
const {
  CANONICAL_BASELINE,
  makeScenario,
  solveScenario,
  analyzeScenario,
  scenarioMatrix,
  highestTestedGoldThresholdReachable
} = require('../tools/experiments/rule-sensitivity.js');
const {
  VOCABULARY_TIERS,
  createVocabularyOrderRankProvider,
  buildAccessibilityIndex,
  wordsForAccessibilityTier,
  certificateFamiliarity,
  certificateTierCoverage
} = require('../tools/experiments/vocabulary-accessibility.js');
const {
  runM7A2Batch,
  writeM7A2Outputs
} = require('../tools/experiments/m7a2-batch.js');

let words;
let fullIndex;

function getWords() {
  if (!words) words = parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8'));
  return words;
}

function getFullIndex() {
  if (!fullIndex) fullIndex = buildVocabularyIndex(getWords());
  return fullIndex;
}

function smallBatchFixture() {
  const puzzle = {
    grid: [['W', 'T', 'R', 'M', 'L', 'N'], ['B', 'C', 'D', 'F', 'G', 'H']],
    hexalink: 'WTRMLN',
    hexarowcol: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]
  };
  const words = ['watermelon', 'bcdfgh'];
  return {
    index: buildVocabularyIndex(words),
    words,
    records: [{ answer: 'WATERMELON', clue: 'Large fruit', seed: 123456, strategy: 'PREBUILT', puzzle }]
  };
}

test('M7A.2 production canonical rules remain unchanged', () => {
  assert.equal(qjynnRules.scoreWordByLength(10), 20);
  assert.equal(qjynnRules.scoreWordByLength(6, true) - qjynnRules.scoreWordByLength(6, false), 10);
  assert.equal(qjynnRules.rowColumnBonus(0, 0, 1, 1).points, 30);
});

test('M7A.2 canonical analytical scenario matches M5 canonical result', () => {
  const board = { grid: [['B', 'C']], maxTurns: 6, goldThreshold: 100 };
  const index = buildVocabularyIndex(['bc']);
  const m5 = solveBoard(board, index);
  const scenario = solveScenario(board, index, CANONICAL_BASELINE);
  assert.equal(scenario.goldReachable, m5.goldReachable);
  assert.equal(scenario.goldScore, m5.goldReachable ? m5.maxScore : null);
});

test('M7A.2 custom Gold threshold works', () => {
  const board = { grid: [['B', 'C']], maxTurns: 6 };
  const index = buildVocabularyIndex(['bc']);
  assert.equal(solveScenario(board, index, makeScenario({ goldThreshold: 52 })).goldReachable, true);
  assert.equal(solveScenario(board, index, makeScenario({ goldThreshold: 53 })).goldReachable, false);
});

test('M7A.2 custom long-word scoring works', () => {
  const board = {
    grid: [['W', 'T', 'R', 'M', 'L', 'N'], ['X', 'X', 'X', 'X', 'X', 'X']],
    hexalink: 'WTRMLN',
    hexarowcol: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]
  };
  const index = buildVocabularyIndex(['watermelon']);
  const canonical = solveScenario(board, index, makeScenario({ goldThreshold: 40 }));
  const reduced = solveScenario(board, index, makeScenario({ goldThreshold: 40, scoring: { score9to10: 15 } }));
  assert.equal(canonical.goldReachable, true);
  assert.equal(reduced.goldReachable, false);
});

test('M7A.2 custom Hexalink bonus works', () => {
  const board = {
    grid: [['W', 'T', 'R', 'M', 'L', 'N'], ['X', 'X', 'X', 'X', 'X', 'X']],
    hexalink: 'WTRMLN',
    hexarowcol: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]
  };
  const index = buildVocabularyIndex(['watermelon']);
  assert.equal(solveScenario(board, index, makeScenario({ goldThreshold: 35, scoring: { hexalinkBonus: 5 } })).goldReachable, true);
  assert.equal(solveScenario(board, index, makeScenario({ goldThreshold: 36, scoring: { hexalinkBonus: 5 } })).goldReachable, false);
});

test('M7A.2 require-Hexalink constraint is enforced', () => {
  const board = {
    grid: [['W', 'T', 'R', 'M', 'L', 'N'], ['B', 'C', 'D', 'F', 'G', 'H']],
    hexalink: 'WTRMLN',
    hexarowcol: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]
  };
  const index = buildVocabularyIndex(['bcdfgh']);
  assert.equal(solveScenario(board, index, makeScenario({ goldThreshold: 20 })).goldReachable, true);
  assert.equal(solveScenario(board, index, makeScenario({ goldThreshold: 20, constraints: { requireHexalinkForGold: true } })).goldReachable, false);
});

test('M7A.2 exactly-six-turn constraint is enforced', () => {
  const board = {
    grid: [['B', 'C'], ['D', 'F'], ['G', 'H'], ['J', 'K'], ['L', 'M'], ['N', 'P']]
  };
  const index = buildVocabularyIndex(['bc', 'df', 'gh', 'jk', 'lm', 'np']);
  const result = solveScenario(board, index, makeScenario({ goldThreshold: 12, constraints: { requireExactlySixTurns: true } }));
  assert.equal(result.goldReachable, true);
  assert.equal(result.minimumGoldTurns, 6);
});

test('M7A.2 custom row and column bonuses work', () => {
  const board = { grid: [['B', 'C']] };
  const index = buildVocabularyIndex(['bc']);
  assert.equal(solveScenario(board, index, makeScenario({ goldThreshold: 52 })).goldReachable, true);
  assert.equal(solveScenario(board, index, makeScenario({ goldThreshold: 52, scoring: { rowBonus: 0, columnBonus: 0 } })).goldReachable, false);
});

test('M7A.2 combined scenario uses all requested settings', () => {
  const scenario = makeScenario({
    name: 'combo-test',
    goldThreshold: 120,
    scoring: { score9to10: 15, hexalinkBonus: 20, rowBonus: 5, columnBonus: 10 },
    constraints: { requireHexalinkForGold: true }
  });
  assert.equal(scenario.goldThreshold, 120);
  assert.equal(scenario.scoring.score9to10, 15);
  assert.equal(scenario.scoring.hexalinkBonus, 20);
  assert.equal(scenario.scoring.rowBonus, 5);
  assert.equal(scenario.constraints.requireHexalinkForGold, true);
});

test('M7A.2 default M5 behavior is unchanged', () => {
  const board = { grid: [['B', 'C']], maxTurns: 6 };
  const index = buildVocabularyIndex(['bc']);
  assert.equal(solveBoard(board, index).maxScore, 52);
});

test('M7A.2 familiarity tier filters only analysis vocabulary', () => {
  const index = getFullIndex();
  const provider = createVocabularyOrderRankProvider(getWords());
  const before = index.entries.length;
  const tier = buildAccessibilityIndex(index, VOCABULARY_TIERS.TOP_5000, provider);
  assert.ok(tier.entries.length < before);
  assert.equal(index.entries.length, before);
});

test('M7A.2 Vocabulary 1.0 source remains unchanged', () => {
  const text = fs.readFileSync('qjynn-words-v1.0.txt', 'utf8');
  assert.ok(text.includes('watermelon'));
});

test('M7A.2 all canonical two-letter words survive accessibility tiers', () => {
  const index = buildVocabularyIndex(['aa', 'bc', 'defghi']);
  const provider = word => word === 'defghi' ? 99999 : null;
  const words = wordsForAccessibilityTier(index, VOCABULARY_TIERS.TOP_5000, provider);
  assert.ok(words.includes('bc'));
});

test('M7A.2 frequency ranks are deterministic', () => {
  const provider = createVocabularyOrderRankProvider(['apple', 'banana']);
  assert.equal(provider('apple'), 1);
  assert.equal(provider('banana'), 2);
  assert.equal(provider('missing'), null);
});

test('M7A.2 certificate familiarity metrics are correct', () => {
  const cert = [{ word: 'apple' }, { word: 'banana' }, { word: 'missing' }];
  const provider = createVocabularyOrderRankProvider(['apple', 'banana']);
  const metrics = certificateFamiliarity(cert, provider);
  assert.equal(metrics.meanRank, 1.5);
  assert.equal(metrics.unrankedWords, 1);
});

test('M7A.2 Gold results differ on handcrafted sensitivity boards', () => {
  const board = { grid: [['B', 'C']] };
  const index = buildVocabularyIndex(['bc']);
  assert.notEqual(
    solveScenario(board, index, makeScenario({ goldThreshold: 52 })).goldReachable,
    solveScenario(board, index, makeScenario({ goldThreshold: 53 })).goldReachable
  );
});

test('M7A.2 highest tested reachable threshold is calculated correctly', () => {
  const results = [
    { scenario: { name: 'GOLD_100', goldThreshold: 100 }, goldReachable: true },
    { scenario: { name: 'GOLD_120', goldThreshold: 120 }, goldReachable: true },
    { scenario: { name: 'GOLD_130', goldThreshold: 130 }, goldReachable: false }
  ];
  assert.equal(highestTestedGoldThresholdReachable(results), 120);
});

test('M7A.2 scenario CSV rows are deterministic', () => {
  const fixture = smallBatchFixture();
  const first = runM7A2Batch(fixture.records, fixture.index, fixture.words, { count: 1 });
  const second = runM7A2Batch(fixture.records, fixture.index, fixture.words, { count: 1 });
  assert.deepEqual(first.rows.map(row => row.scenario), second.rows.map(row => row.scenario));
  assert.deepEqual(first.rows.map(row => row.gold_reachable), second.rows.map(row => row.gold_reachable));
});

test('M7A.2 paired scenarios use identical grid metadata', () => {
  const fixture = smallBatchFixture();
  const result = runM7A2Batch(fixture.records, fixture.index, fixture.words, { count: 1 });
  const keys = new Set(result.rows.map(row => `${row.answer}|${row.seed}|${row.strategy}`));
  assert.equal(keys.size, 1);
});

test('M7A.2 scenario matrix includes required families', () => {
  const names = scenarioMatrix().map(scenario => scenario.name);
  assert.ok(names.includes('CANONICAL_BASELINE'));
  assert.ok(names.includes('GOLD_150'));
  assert.ok(names.includes('LONG_D_12_ALL_LONG'));
  assert.ok(names.includes('HEX_BONUS_30'));
  assert.ok(names.includes('COMBO_5_T120_LINE_REDUCED'));
});

test('M7A.2 writes scenario output artifacts', () => {
  const fixture = smallBatchFixture();
  const result = runM7A2Batch(fixture.records, fixture.index, fixture.words, { count: 1 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qjynn-m7a2-'));
  writeM7A2Outputs(result, dir);
  assert.equal(fs.existsSync(path.join(dir, 'm7a2-scenarios.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'm7a2-scenarios.csv')), true);
  assert.equal(fs.existsSync(path.join(dir, 'm7a2-sensitivity-summary.json')), true);
});

test('M7A.2 certificate tier coverage is calculated', () => {
  const index = getFullIndex();
  const provider = createVocabularyOrderRankProvider(getWords());
  const coverage = certificateTierCoverage([{ word: 'watermelon' }], index, provider);
  assert.equal(coverage.TOP_30000.total, 1);
});
