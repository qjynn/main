const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  consonantSkeleton,
  insertedVowelsForWord,
  reconstructWord,
  buildVocabularyIndex,
  parseWordList,
  explainVocabularyExclusions
} = require('../tools/solver/word-index.js');

test('generates consonant skeletons by removing A/E/I/O/U', () => {
  assert.equal(consonantSkeleton('watermelon'), 'WTRMLN');
  assert.equal(consonantSkeleton('cat'), 'CT');
});

test('preserves repeated consonants in skeletons', () => {
  assert.equal(consonantSkeleton('letter'), 'LTTR');
  assert.equal(consonantSkeleton('mississippi'), 'MSSSSPP');
});

test('supports words containing no vowels', () => {
  assert.equal(consonantSkeleton('my'), 'MY');
});

test('tracks multiple vowels between and around consonants', () => {
  assert.deepEqual(insertedVowelsForWord('queue'), [{ index: 1, letters: 'UEUE' }]);
  assert.deepEqual(insertedVowelsForWord('area'), [
    { index: 0, letters: 'A' },
    { index: 1, letters: 'EA' }
  ]);
});

test('reconstructs words exactly from skeleton and vowel placements', () => {
  const words = [
    'watermelon',
    'oscillated',
    'knees',
    'area',
    'banjo',
    'queue',
    'letter',
    'my'
  ];

  for (const word of words) {
    const index = buildVocabularyIndex([word]);
    const entry = index.entries[0];
    assert.equal(
      reconstructWord(entry.consonantSkeleton, entry.vowelPlacements).toLowerCase(),
      entry.word
    );
  }
});

test('indexes multiple words sharing one consonant skeleton', () => {
  const index = buildVocabularyIndex(['cat', 'coat', 'cute']);
  const words = index.bySkeleton.get('CT').map(entry => entry.word);
  assert.deepEqual(words, ['cat', 'coat', 'cute']);
  assert.equal(index.skeletonPrefixes.has('C'), true);
  assert.equal(index.skeletonPrefixes.has('CT'), true);
});

test('all indexed vocabulary entries reconstruct exactly', () => {
  const words = parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8'));
  const index = buildVocabularyIndex(words);
  assert.equal(index.stats.indexedWords, 41814);

  for (const entry of index.entries) {
    assert.equal(
      reconstructWord(entry.consonantSkeleton, entry.vowelPlacements).toLowerCase(),
      entry.word
    );
  }
});

test('vocabulary exclusion counts account for every excluded word', () => {
  const words = parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8'));
  const counts = explainVocabularyExclusions(words);
  assert.deepEqual(counts, {
    indexed: 41814,
    excluded: 2569,
    zeroConsonantSkeleton: 6,
    moreThanSixConsonants: 2563,
    invalidLength: 0,
    invalidCharacters: 0,
    tooFewConsonants: 0,
    other: 0
  });
  assert.equal(counts.indexed + counts.excluded, words.length);
});

test('filters words outside Qjynn move-index constraints', () => {
  const index = buildVocabularyIndex(['a', 'ae', 'watermelon', 'mississippi', 'abc123']);
  assert.equal(index.bySkeleton.has(''), false);
  assert.equal(index.bySkeleton.has('WTRMLN'), true);
  assert.equal(index.bySkeleton.has('MSSSSPP'), false);
  assert.equal(index.stats.indexedWords, 1);
});
