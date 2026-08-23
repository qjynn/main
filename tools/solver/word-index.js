const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const MIN_WORD_LENGTH = 2;
const MAX_WORD_LENGTH = 10;
const MIN_SKELETON_LENGTH = 1;
const MAX_SKELETON_LENGTH = 6;

function normalizeWord(word) {
  return String(word || '').trim().toUpperCase();
}

function isAsciiLetters(value) {
  return /^[A-Z]+$/.test(value);
}

function consonantSkeleton(word) {
  return normalizeWord(word)
    .split('')
    .filter(letter => !VOWELS.has(letter))
    .join('');
}

function insertedVowelsForWord(word) {
  const normalized = normalizeWord(word);
  const runs = [];
  let consonantIndex = 0;

  for (const letter of normalized) {
    if (VOWELS.has(letter)) {
      if (!runs[consonantIndex]) runs[consonantIndex] = '';
      runs[consonantIndex] += letter;
    } else {
      consonantIndex++;
      if (!runs[consonantIndex]) runs[consonantIndex] = '';
    }
  }

  const result = [];
  for (let index = 0; index < runs.length; index++) {
    if (runs[index]) result.push({ index, letters: runs[index] });
  }
  return result;
}

function normalizeVowelPlacements(vowelPlacements) {
  return (vowelPlacements || []).map(run => ({
    index: run.index,
    letters: String(run.letters || '').toUpperCase()
  }));
}

function reconstructWord(consonantSkeletonValue, vowelPlacements) {
  const skeleton = normalizeWord(consonantSkeletonValue);
  const vowelsByIndex = new Map();

  for (const run of normalizeVowelPlacements(vowelPlacements)) {
    if (!Number.isInteger(run.index) || run.index < 0 || run.index > skeleton.length) {
      throw new Error(`Invalid vowel placement index: ${run.index}`);
    }
    vowelsByIndex.set(run.index, (vowelsByIndex.get(run.index) || '') + run.letters);
  }

  let word = '';
  for (let index = 0; index <= skeleton.length; index++) {
    word += vowelsByIndex.get(index) || '';
    if (index < skeleton.length) word += skeleton[index];
  }
  return word;
}

function createWordEntry(word) {
  const normalized = normalizeWord(word);
  return {
    word: normalized.toLowerCase(),
    consonantSkeleton: consonantSkeleton(normalized).toLowerCase(),
    skeleton: consonantSkeleton(normalized),
    insertedVowels: insertedVowelsForWord(normalized),
    vowelPlacements: insertedVowelsForWord(normalized).map(run => ({
      index: run.index,
      letters: run.letters.toLowerCase()
    })),
    length: normalized.length
  };
}

function exclusionReasonForWord(word, options = {}) {
  const normalized = normalizeWord(word);
  const minWordLength = options.minWordLength || MIN_WORD_LENGTH;
  const maxWordLength = options.maxWordLength || MAX_WORD_LENGTH;
  const minSkeletonLength = options.minSkeletonLength || MIN_SKELETON_LENGTH;
  const maxSkeletonLength = options.maxSkeletonLength || MAX_SKELETON_LENGTH;

  if (!isAsciiLetters(normalized)) return 'invalidCharacters';
  if (normalized.length < minWordLength || normalized.length > maxWordLength) return 'invalidLength';
  const skeletonLength = consonantSkeleton(normalized).length;
  if (skeletonLength === 0) return 'zeroConsonantSkeleton';
  if (skeletonLength < minSkeletonLength) return 'tooFewConsonants';
  if (skeletonLength > maxSkeletonLength) return 'moreThanSixConsonants';
  return null;
}

function isIndexableWord(word, options = {}) {
  return exclusionReasonForWord(word, options) === null;
}

function explainVocabularyExclusions(words, options = {}) {
  const counts = {
    indexed: 0,
    excluded: 0,
    zeroConsonantSkeleton: 0,
    moreThanSixConsonants: 0,
    invalidLength: 0,
    invalidCharacters: 0,
    tooFewConsonants: 0,
    other: 0
  };

  for (const word of words) {
    const reason = exclusionReasonForWord(word, options);
    if (!reason) {
      counts.indexed++;
      continue;
    }
    counts.excluded++;
    if (Object.prototype.hasOwnProperty.call(counts, reason)) counts[reason]++;
    else counts.other++;
  }

  return counts;
}

function buildVocabularyIndex(words, options = {}) {
  const bySkeleton = new Map();
  const skeletonPrefixes = new Set();
  const entries = [];
  let skipped = 0;

  for (const rawWord of words) {
    if (!isIndexableWord(rawWord, options)) {
      skipped++;
      continue;
    }

    const entry = createWordEntry(rawWord);
    entries.push(entry);

    if (!bySkeleton.has(entry.skeleton)) bySkeleton.set(entry.skeleton, []);
    bySkeleton.get(entry.skeleton).push(entry);

    for (let i = 1; i <= entry.skeleton.length; i++) {
      skeletonPrefixes.add(entry.skeleton.slice(0, i));
    }
  }

  for (const skeletonEntries of bySkeleton.values()) {
    skeletonEntries.sort((a, b) => a.word.localeCompare(b.word));
  }

  return {
    bySkeleton,
    skeletonPrefixes,
    entries,
    stats: {
      indexedWords: entries.length,
      skippedWords: skipped,
      skeletonCount: bySkeleton.size
    }
  };
}

function parseWordList(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

module.exports = {
  VOWELS,
  MIN_WORD_LENGTH,
  MAX_WORD_LENGTH,
  MIN_SKELETON_LENGTH,
  MAX_SKELETON_LENGTH,
    normalizeWord,
    consonantSkeleton,
    insertedVowelsForWord,
    reconstructWord,
    createWordEntry,
    exclusionReasonForWord,
    isIndexableWord,
    explainVocabularyExclusions,
    buildVocabularyIndex,
    parseWordList
  };
