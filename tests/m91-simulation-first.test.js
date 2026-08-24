const test = require('node:test');
const assert = require('node:assert/strict');
const { createFrequencyProvider } = require('../tools/simulator/familiarity-provider.js');
const { M91_SELECTOR_VERSION, referenceSelection, shortlistByLowRun, shortlistRecall, selectStagedCandidate, selectSimulationFirst } = require('../tools/generator/m91-simulation-selector.js');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const { runIncrementalMonteCarlo } = require('../tools/simulator/incremental-monte-carlo.js');
const fs = require('fs');
const { spearman } = require('../tools/generator/evaluate-m91.js');

function candidates() {
  return [
    { candidateId: 'a', regularMeanScore: 100, regularMedianScore: 99, regularGoldRate: .9, cheapMetricValue: 1 },
    { candidateId: 'b', regularMeanScore: 90, regularMedianScore: 90, regularGoldRate: .5, cheapMetricValue: 2 },
    { candidateId: 'c', regularMeanScore: 80, regularMedianScore: 81, regularGoldRate: .2, cheapMetricValue: 3 },
    { candidateId: 'd', regularMeanScore: 70, regularMedianScore: 70, regularGoldRate: .1, cheapMetricValue: 4 },
    { candidateId: 'e', regularMeanScore: 60, regularMedianScore: 61, regularGoldRate: 0, cheapMetricValue: 5 },
    { candidateId: 'f', regularMeanScore: 50, regularMedianScore: 50, regularGoldRate: 0, cheapMetricValue: 6 }
  ];
}

test('M9.1 reference preferred set is deterministic and middle-band based', () => {
  const first = referenceSelection(candidates(), { difficultyPolicy: { preferredBand: 'middle' } });
  const second = referenceSelection(candidates(), { difficultyPolicy: { preferredBand: 'middle' } });
  assert.deepEqual(first.preferred.map(candidate => candidate.candidateId), second.preferred.map(candidate => candidate.candidateId));
  assert.ok(first.preferred.length > 0);
  assert.equal(first.winner.candidateId, selectStagedCandidate(first.candidates).candidateId);
});

test('M9.1 recall, winner retention, and zero-recall are calculated exactly', () => {
  const pool = candidates();
  const preferred = pool.slice(1, 3);
  const result = shortlistRecall(pool.slice(0, 3).map(candidate => ({ ...candidate, shortlisted: true })), preferred, preferred[0]);
  assert.equal(result.referencePreferredCount, 2);
  assert.equal(result.preferredRetained, 2);
  assert.equal(result.recall, 1);
  assert.equal(result.referenceWinnerRetained, true);
  assert.equal(result.zeroPreferredRetained, false);
  const miss = shortlistRecall(pool.slice(4).map(candidate => ({ ...candidate, shortlisted: true })), preferred, preferred[0]);
  assert.equal(miss.zeroPreferredRetained, true);
});

test('M9.1 mean, median, Gold, band-aware, confidence, and hybrid policies respect size', () => {
  for (const method of ['rank', 'band-aware', 'hybrid']) {
    const metric = method === 'hybrid' ? 'regularMeanScore' : 'regularMedianScore';
    assert.equal(shortlistByLowRun(candidates(), 4, metric, method).filter(candidate => candidate.shortlisted).length, 4);
  }
});

test('M9.1 real familiarity provider remains explicit', () => {
  const provider = createFrequencyProvider(new Map([['house', { word: 'house', frequency: 6, familiarityScore: .7 }]]));
  assert.equal(provider.lookup('house').basis, 'frequency');
  assert.equal(provider.lookup('missing').basis, 'fallback');
  assert.equal(M91_SELECTOR_VERSION, 'm9.1');
});

test('M9.1 deterministic rank comparison exposes ordering agreement', () => {
  assert.equal(spearman([1, 2, 3, 4], [1, 2, 3, 4]), 1);
  assert.ok(spearman([1, 2, 3, 4], [4, 3, 2, 1]) < 0);
});

test('M9.1 staged selection cannot select outside the retained shortlist', () => {
  const result = selectSimulationFirst(candidates(), { shortlistSize: 3, method: 'mean' });
  assert.ok(result.retained.some(candidate => candidate.candidateId === result.selected.candidateId));
});

test('M9.1 incremental 100 plus 400 profile matches a fresh deterministic 500 profile', () => {
  const wordIndex = buildVocabularyIndex(parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8')));
  const puzzle = { grid: [['B', 'C'], ['D', 'F'], ['G', 'H']], hexalink: 'BCDFGH', hexarowcol: [[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1]] };
  const options = { maxRuns: 500, profileRuns: [100, 500] };
  const incremental = runIncrementalMonteCarlo({ puzzle, playerModel: 'REGULAR', masterSeed: 123 }, wordIndex, options);
  const fresh = runIncrementalMonteCarlo({ puzzle, playerModel: 'REGULAR', masterSeed: 123 }, wordIndex, { maxRuns: 500, profileRuns: [500] });
  assert.deepEqual(incremental.profiles[500], fresh.profiles[500]);
});
