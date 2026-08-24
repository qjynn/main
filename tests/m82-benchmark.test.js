const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const { loadFrequencyFile } = require('../tools/simulator/familiarity-provider.js');
const { resolvePlayerModel, M81_FREQUENCY_MODEL, SIMULATOR_VERSION, PLAYER_MODEL_VERSION } = require('../tools/simulator/player-models.js');
const {
  BENCHMARK_VERSION, deriveReplicateSeed, bandForRank, assignBands, bandStability,
  deterministicHoldout, spearmanFromRows, rankMap, validateManifest, metricSnapshot, runBenchmark
} = require('../tools/simulator/benchmark-m82.js');

test('M8.2 replicate seed derivation is deterministic and independent', () => {
  assert.equal(deriveReplicateSeed('PUZZLE', 'REGULAR', 'A'), deriveReplicateSeed('PUZZLE', 'REGULAR', 'A'));
  assert.notEqual(deriveReplicateSeed('PUZZLE', 'REGULAR', 'A'), deriveReplicateSeed('PUZZLE', 'REGULAR', 'B'));
  assert.notEqual(deriveReplicateSeed('PUZZLE', 'REGULAR', 'A'), deriveReplicateSeed('PUZZLE', 'STRONG', 'A'));
  assert.match(BENCHMARK_VERSION, /^m8\.2/);
});

test('M8.2 rank calculation handles difficulty direction', () => {
  const easyHigh = [{ puzzle_id: 'a', score: 90 }, { puzzle_id: 'b', score: 50 }, { puzzle_id: 'c', score: 20 }];
  const hardHigh = [{ puzzle_id: 'a', score: 10 }, { puzzle_id: 'b', score: 50 }, { puzzle_id: 'c', score: 80 }];
  assert.equal(spearmanFromRows(easyHigh, hardHigh, 'score', true), -1);
  assert.equal(spearmanFromRows(easyHigh, hardHigh, 'score', false), -1);
  assert.equal(rankMap(easyHigh, 'score', true).get('a'), 1);
  assert.equal(rankMap(easyHigh, 'score', false).get('a'), 3);
});

test('M8.2 band assignment and stability are deterministic', () => {
  assert.equal(bandForRank(1, 9, 3), 0);
  assert.equal(bandForRank(9, 9, 3), 2);
  const a = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ puzzle_id: id, gold_rate: 1 - i / 10 }));
  const b = a.slice().reverse();
  assert.deepEqual(Array.from(assignBands(a, 'gold_rate')), Array.from(assignBands(a, 'gold_rate')));
  const stability = bandStability(a, b, 'gold_rate');
  assert.equal(stability.n, 6);
  assert.ok(stability.sameOrAdjacentBandPct >= stability.sameBandPct);
});

test('M8.2 holdout split is deterministic and disjoint', () => {
  const first = deterministicHoldout(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 0.3);
  const second = deterministicHoldout(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 0.3);
  assert.deepEqual(first, second);
  assert.equal(first.analysis.filter(id => first.holdout.includes(id)).length, 0);
});

test('M8.2 benchmark rejects missing real familiarity data', () => {
  assert.throws(() => runBenchmark({ frequencyFile: '/tmp/qjynn-missing-frequency.json', records: [] }), /requires real familiarity data/);
});

test('M8.2 manifest rejects duplicate grid hashes', () => {
  assert.throws(() => validateManifest([{ grid_hash: 'same' }, { grid_hash: 'same' }]), /Duplicate grid hash/);
  assert.deepEqual(validateManifest([{ grid_hash: 'a' }, { grid_hash: 'b' }]), { ok: true, distinctGrids: 2 });
});

test('M8.2 benchmark rejects accidental heuristic fallback', () => {
  const file = '/tmp/qjynn-m82-fallback-fixture.json';
  fs.writeFileSync(file, JSON.stringify([{ word: 'house', zipf: 6 }]));
  assert.throws(() => runBenchmark({ frequencyFile: file, records: [] }), /sanity words did not activate/);
});

test('M8.2 real provider and frozen model versions are active', () => {
  const provider = loadFrequencyFile('data/familiarity/wordfreq-en-large.json');
  assert.equal(provider.lookup('house').basis, 'frequency');
  assert.equal(resolvePlayerModel('REGULAR').name, 'REGULAR');
  assert.equal(M81_FREQUENCY_MODEL, 'M81_FREQUENCY_MODEL');
  assert.ok(SIMULATOR_VERSION.startsWith('m8.1'));
  assert.ok(PLAYER_MODEL_VERSION.startsWith('m8.1'));
});

test('M8.2 parameter perturbation does not mutate frozen baseline config', () => {
  const before = JSON.stringify(resolvePlayerModel('REGULAR'));
  const perturbed = resolvePlayerModel('REGULAR', { discovery: { maxCandidateMoves: 12 } });
  assert.equal(perturbed.discovery.maxCandidateMoves, 12);
  assert.equal(JSON.stringify(resolvePlayerModel('REGULAR')), before);
});

test('M8.2 mathematical metric snapshot is deterministic for a puzzle', () => {
  const index = buildVocabularyIndex(parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8')));
  const puzzle = JSON.parse(fs.readFileSync('analysis/m7a3-production-grids.json', 'utf8')).results.find(item => item.ok).puzzle;
  const a = metricSnapshot({ puzzle, puzzle_id: 'fixture' }, index);
  const b = metricSnapshot({ puzzle, puzzle_id: 'fixture' }, index);
  assert.equal(a.raw_legal_moves, b.raw_legal_moves);
  assert.equal(a.solver_relevant_moves, b.solver_relevant_moves);
});
