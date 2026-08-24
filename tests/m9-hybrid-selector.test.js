const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const { selectDailyGridM9, resolveM9Config, shortlistCertified, chooseFinalist, M9_SELECTOR_VERSION } = require('../tools/generator/m9-hybrid-selector.js');

const index = buildVocabularyIndex(parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8')));
const frequencyFile = 'data/familiarity/wordfreq-en-large.json';

test('M9 requires real familiarity and fails closed when unavailable', () => {
  const result = selectDailyGridM9({ answer: 'WATERMELON', seed: 44, wordIndex: index, frequencyFile: '/tmp/no-m9-frequency.json' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'REAL_FAMILIARITY_REQUIRED');
});

test('M9 configuration validates runs and central policy', () => {
  assert.equal(resolveM9Config({ regularRuns: 100, strongRuns: 100 }).shortlistSize, 8);
  assert.throws(() => resolveM9Config({ regularRuns: 99 }), /at least 100/);
  assert.throws(() => resolveM9Config({ shortlistSize: 9, certifiedCandidateTarget: 8 }), /cannot exceed/);
});

test('M9 cheap shortlist is central and deterministic', () => {
  const candidates = Array.from({ length: 10 }, (_, i) => ({ candidateId: String(i), cheapMetricValue: i }));
  const a = shortlistCertified(candidates, { shortlistSize: 4 });
  const b = shortlistCertified(candidates, { shortlistSize: 4 });
  assert.deepEqual(a.map(x => x.shortlisted), b.map(x => x.shortlisted));
  assert.deepEqual(a.filter(x => x.shortlisted).map(x => x.candidateId), ['3', '4', '5', '6']);
});

test('M9 final choice prefers middle band and does not use Gold as sole score', () => {
  const candidates = [
    { candidateId: 'easy', difficultyBand: 'easier', regularMeanScore: 100, regularMedianScore: 100, regularRareWordDependency: 0, strongMeanScore: 110 },
    { candidateId: 'middle', difficultyBand: 'middle', regularMeanScore: 85, regularMedianScore: 85, regularRareWordDependency: 0.4, strongMeanScore: 92 },
    { candidateId: 'hard', difficultyBand: 'harder', regularMeanScore: 70, regularMedianScore: 70, regularRareWordDependency: 0.9, strongMeanScore: 80 }
  ];
  assert.equal(chooseFinalist(candidates, resolveM9Config({ shortlistSize: 3, certifiedCandidateTarget: 3, regularRuns: 100, strongRuns: 100 })).candidateId, 'middle');
});

test('M9 selects only certified candidates and separates public/private output', { timeout: 120000 }, () => {
  const result = selectDailyGridM9({ answer: 'WATERMELON', seed: 12345, wordIndex: index, frequencyFile, config: { rawCandidates: 3, certifiedCandidateTarget: 1, shortlistSize: 1, regularRuns: 100, strongFinalistCount: 1, strongRuns: 100 } });
  assert.equal(result.ok, true);
  assert.equal(result.selected.certified, true);
  assert.equal(result.privateManifest.selectorVersion, M9_SELECTOR_VERSION);
  assert.ok(result.privateManifest.certificate.length > 0);
  assert.equal(Object.prototype.hasOwnProperty.call(result.publicPuzzle, 'answer'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.publicPuzzle, 'privateCertification'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.publicPuzzle, 'syntheticScore'), false);
});

test('M9 selection is deterministic for identical input and configuration', { timeout: 240000 }, () => {
  const config = { rawCandidates: 3, certifiedCandidateTarget: 1, shortlistSize: 1, regularRuns: 100, strongFinalistCount: 1, strongRuns: 100 };
  const a = selectDailyGridM9({ answer: 'WATERMELON', seed: 12346, wordIndex: index, frequencyFile, config });
  const b = selectDailyGridM9({ answer: 'WATERMELON', seed: 12346, wordIndex: index, frequencyFile, config });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.privateManifest.selectedGridHash, b.privateManifest.selectedGridHash);
  assert.deepEqual(a.publicPuzzle.grid, b.publicPuzzle.grid);
});
