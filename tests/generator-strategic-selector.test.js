const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const crypto = require('crypto');
const qjynnRules = require('../qjynn-rules.js');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const { generatePuzzle } = require('../tools/generator/grid-generator.js');
const { validatePuzzle } = require('../tools/generator/puzzle-validator.js');
const {
  deriveCandidateSeed,
  canonicalGridHash,
  generateCandidatePool
} = require('../tools/generator/candidate-pool.js');
const {
  selectStrategicDailyGrid,
  shortlistCandidates,
  validationRecords
} = require('../tools/generator/strategic-selector.js');

let fullIndex;
let smallIndex;
let selection;

function sha256(path) {
  return crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
}

function getFullIndex() {
  if (!fullIndex) fullIndex = buildVocabularyIndex(parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8')));
  return fullIndex;
}

function getSmallIndex() {
  if (!smallIndex) smallIndex = buildVocabularyIndex(['bc', 'df', 'gh', 'jk', 'lm']);
  return smallIndex;
}

function prebuiltCandidates() {
  return [
    {
      puzzle: {
        grid: [['B', 'C'], ['D', 'F'], ['G', 'H'], ['J', 'K'], ['L', 'M']],
        hexalink: 'BC',
        hexarowcol: [[0, 0], [0, 1]]
      }
    },
    {
      puzzle: {
        grid: [['D', 'F'], ['B', 'C'], ['G', 'H'], ['J', 'K'], ['L', 'M']],
        hexalink: 'DF',
        hexarowcol: [[0, 0], [0, 1]]
      }
    }
  ];
}

function getSelection() {
  if (!selection) {
    selection = selectStrategicDailyGrid({
      answer: 'BC',
      clue: 'Letters',
      date: '2027-04-01',
      masterSeed: 910001
    }, getSmallIndex(), {
      candidatePoolSize: 2,
      shortlistSize: 2,
      analysisTimeoutMs: null,
      headroomThresholds: [60],
      prebuiltCandidates: prebuiltCandidates()
    });
  }
  assert.equal(selection.ok, true);
  return selection;
}

test('M7B candidate seed derivation is deterministic', () => {
  assert.equal(deriveCandidateSeed(123, 4), deriveCandidateSeed(123, 4));
  assert.notEqual(deriveCandidateSeed(123, 4), deriveCandidateSeed(123, 5));
});

test('M7B candidate pool is deterministic', () => {
  const input = { answer: 'BC', clue: 'Letters', date: '2027-04-02', masterSeed: 910002 };
  const config = { candidatePoolSize: 2, prebuiltCandidates: prebuiltCandidates() };
  const first = generateCandidatePool(input, getSmallIndex(), config);
  const second = generateCandidatePool(input, getSmallIndex(), config);
  assert.deepEqual(first.candidates.map(candidate => candidate.gridHash), second.candidates.map(candidate => candidate.gridHash));
});

test('M7B duplicate grid detection keeps one grid hash', () => {
  const grid = [['B', 'C']];
  assert.equal(canonicalGridHash(grid), canonicalGridHash([['B', 'C']]));
});

test('M7B candidates preserve canonical inventory and exact Hexalink', () => {
  const generated = generatePuzzle({
    answer: 'WATERMELON',
    clue: 'Large fruit',
    date: '2027-04-02',
    seed: 910002,
    maxAttempts: 5
  }, getFullIndex());
  assert.equal(generated.ok, true);
  const validation = validatePuzzle(generated.puzzle, { answer: 'WATERMELON', wordIndex: getFullIndex() });
  assert.equal(validation.ok, true);
});

test('M7B M6 hard gates remain unchanged', () => {
  const generated = generatePuzzle({
    answer: 'WATERMELON',
    clue: 'Large fruit',
    date: '2027-04-03',
    seed: 910003,
    maxAttempts: 5
  }, getFullIndex());
  assert.equal(generated.ok, true);
});

test('M7B invalid candidates never enter ranking', () => {
  const result = selectStrategicDailyGrid({
    answer: 'INVALID',
    clue: 'Nope',
    date: '2027-04-04',
    masterSeed: 910004
  }, getFullIndex(), { candidatePoolSize: 2, shortlistSize: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'candidatePool.exhausted');
});

test('M7B shortlist size is respected', () => {
  const candidates = [
    { candidateIndex: 1, hardGateStatus: 'accepted', rankingEvidence: { canonicalMinimumGoldTurns: 5 } },
    { candidateIndex: 2, hardGateStatus: 'accepted', rankingEvidence: { canonicalMinimumGoldTurns: 6 } },
    { candidateIndex: 3, hardGateStatus: 'accepted', rankingEvidence: { canonicalMinimumGoldTurns: 4 } }
  ];
  assert.equal(shortlistCandidates(candidates, { shortlistSize: 2 }).length, 2);
});

test('M7B expensive analysis runs only on shortlist', () => {
  const result = getSelection();
  assert.ok(result.rankedCandidates.length <= 2);
  assert.equal(result.allCandidates.filter(candidate => candidate.rankingEvidence?.headroom).length, 0);
  assert.equal(result.rankedCandidates.every(candidate => candidate.rankingEvidence?.headroom), true);
});

test('M7B winner belongs to candidate pool', () => {
  const result = getSelection();
  assert.ok(result.allCandidates.some(candidate => candidate.candidateIndex === result.selectedCandidate.candidateIndex));
});

test('M7B repeated invocation selects identical winner', () => {
  const input = { answer: 'BC', clue: 'Letters', date: '2027-04-05', masterSeed: 910005 };
  const config = { candidatePoolSize: 2, shortlistSize: 1, analysisTimeoutMs: null, headroomThresholds: [60], prebuiltCandidates: prebuiltCandidates() };
  const first = selectStrategicDailyGrid(input, getSmallIndex(), config);
  const second = selectStrategicDailyGrid(input, getSmallIndex(), config);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.privateManifest.selectedCandidateIndex, second.privateManifest.selectedCandidateIndex);
});

test('M7B fallback selects best valid candidate', () => {
  const result = selectStrategicDailyGrid({
    answer: 'BC',
    clue: 'Letters',
    date: '2027-04-06',
    masterSeed: 910006
  }, getSmallIndex(), { candidatePoolSize: 1, shortlistSize: 1, analysisTimeoutMs: null, headroomThresholds: [60], prebuiltCandidates: prebuiltCandidates() });
  assert.equal(result.ok, true);
  assert.equal(result.privateManifest.selectedCandidateIndex, result.allCandidates[0].candidateIndex);
});

test('M7B returns structured failure when no valid candidate exists', () => {
  const result = selectStrategicDailyGrid({
    answer: 'ZZZZZZZZZZ',
    clue: 'Impossible',
    date: '2027-04-07',
    masterSeed: 910007
  }, getFullIndex(), { candidatePoolSize: 1, shortlistSize: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'candidatePool.exhausted');
  assert.equal(result.error.candidateCount, 1);
});

test('M7B public output contains no private ranking data', () => {
  const publicPuzzle = getSelection().publicPuzzle;
  assert.equal(Object.prototype.hasOwnProperty.call(publicPuzzle, 'answer'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicPuzzle, 'goldCertificate'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicPuzzle, 'candidateRanking'), false);
});

test('M7B private manifest contains required evidence', () => {
  const manifest = getSelection().privateManifest;
  assert.equal(manifest.answer, 'BC');
  assert.equal(typeof manifest.selectedCandidateIndex, 'number');
  assert.equal(typeof manifest.selectedMetrics.canonicalMinimumGoldTurns, 'number');
  assert.ok(Array.isArray(manifest.rankingReasons));
});

test('M7B validation records expose at least 20 answers', () => {
  assert.equal(validationRecords(20).length, 20);
});

test('M7B production safety invariants remain unchanged', () => {
  const gameHash = sha256('game.js');
  const vocabHash = sha256('qjynn-words-v1.0.txt');
  selectStrategicDailyGrid({
    answer: 'BC',
    clue: 'Letters',
    date: '2027-04-08',
    masterSeed: 910008
  }, getSmallIndex(), { candidatePoolSize: 1, shortlistSize: 1, analysisTimeoutMs: null, headroomThresholds: [60], prebuiltCandidates: prebuiltCandidates() });
  assert.equal(sha256('game.js'), gameHash);
  assert.equal(sha256('qjynn-words-v1.0.txt'), vocabHash);
  assert.equal(Object.values(qjynnRules.CONSONANT_INVENTORY).reduce((sum, value) => sum + value, 0), 48);
});
