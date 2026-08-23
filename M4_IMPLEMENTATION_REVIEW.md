# M4 Implementation Review

## Summary

M4 implemented a standalone Vocabulary Index + Legal Move Enumerator under `tools/solver/`. It does not modify `game.js` and does not implement M5, M6, or M7.

It can:

- Build a vocabulary index keyed by consonant skeleton.
- Convert words like `WATERMELON` into `WTRMLN`.
- Enumerate legal playable moves from a Qjynn board.
- Respect OFF-only tile use, 8-direction adjacency, no tile reuse, and max 6 consonants.
- Return move objects with word, skeleton, path, inserted vowels, base score, and Hexalink status.

## Files Created

```text
tools/solver/word-index.js
tools/solver/grid-word-finder.js
tests/solver-word-index.test.js
tests/solver-grid-word-finder.test.js
```

## Main Modules

```js
// tools/solver/word-index.js
consonantSkeleton(word)
insertedVowelsForWord(word)
createWordEntry(word)
reconstructWord(consonantSkeleton, vowelPlacements)
explainVocabularyExclusions(words, options)
isIndexableWord(word, options)
buildVocabularyIndex(words, options)
parseWordList(text)

// tools/solver/grid-word-finder.js
normalizeBoard(board, tileStates)
isTileAvailable(cell)
neighborsOf(pos, rowCount, colCount)
enumerateLegalMoves(boardState, vocabularyOrIndex, options)
```

## Public API

```js
const { buildVocabularyIndex } = require('./tools/solver/word-index');
const { enumerateLegalMoves } = require('./tools/solver/grid-word-finder');

const wordIndex = buildVocabularyIndex(words);

const moves = enumerateLegalMoves({
  grid,
  tileStates,
  hexalink,
  hexarowcol
}, wordIndex);
```

Expected input:

```js
{
  grid: [
    ['W','T','R','M','L','N']
  ],
  tileStates: [[0,0,0,0,0,0]],
  hexalink: 'WTRMLN',
  hexarowcol: [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]]
}
```

Returned move shape:

```js
{
  word: "watermelon",
  consonantSkeleton: "wtrmln",
  path: [[5,0],[6,1],[5,2],[4,3],[4,4],[3,5]],
  insertedVowels: ["a","e","e","o"],
  vowelPlacements: [
    { index: 1, letters: "a" },
    { index: 2, letters: "e" },
    { index: 4, letters: "e" },
    { index: 5, letters: "o" }
  ],
  baseScore: 20,
  isHexalink: true
}
```

## Consonant Skeleton Logic

`vowelPlacements.index` semantics: `index` is the zero-based consonant boundary before which the vowel run is inserted. `index: 0` means leading vowels before the first consonant. `index === consonantSkeleton.length` means trailing vowels after the final consonant.

```js
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

function normalizeWord(word) {
  return String(word || '').trim().toUpperCase();
}

function consonantSkeleton(word) {
  return normalizeWord(word)
    .split('')
    .filter(letter => !VOWELS.has(letter))
    .join('');
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
```

Examples:

```text
WATERMELON -> WTRMLN
OSCILLATED -> SCLLTD
LETTER -> LTTR
MISSISSIPPI -> MSSSSPP
MY -> MY
CRYPT -> CRYPT
```

`Y` is treated as a consonant because only `A/E/I/O/U` are removed.

Reconstruction invariant:

```text
reconstructWord(entry.consonantSkeleton, entry.vowelPlacements) === entry.word
```

The invariant was run against every indexed vocabulary entry. Result: all 41,814 indexed words pass.

Examples covered by tests:

```text
WATERMELON
OSCILLATED
KNEES
AREA        leading vowels
BANJO       trailing vowels
QUEUE       consecutive vowels
LETTER      repeated consonants
MY          no A/E/I/O/U vowels
```

## Move Legality Rules Enforced

- OFF tiles only: playable if `state === undefined`, `state === 0`, or `state === "OFF"`.
- 8-direction adjacency: horizontal, vertical, and diagonal neighbors are legal.
- No tile reuse within one chain.
- Maximum 6 consonant tiles.
- Words indexed only if length is 2-10 letters and skeleton length is 1-6.
- Forward and reverse paths are both enumerated when valid.
- Exact Hexalink uses the M1-M3 `qjynn-rules.js` coordinate/letter check.

## Key Implementation: Vocabulary Index

```js
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
```

## Vocabulary Exclusions

The source vocabulary contains 44,383 words. M4 indexes 41,814 and excludes 2,569. Exact exclusion counts:

```text
indexed: 41,814
excluded: 2,569
zero-consonant skeleton: 6
more than six consonants: 2,563
invalid length: 0
invalid characters: 0
too few consonants: 0
other: 0
```

The categories account for every excluded word with no unexplained remainder.

Implementation:

```js
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
```

## Key Implementation: Grid Path Search + Enumeration

```js
function enumerateLegalMoves(boardState, vocabularyOrIndex, options = {}) {
  const board = normalizeBoard(boardState.grid, boardState.tileStates);
  const rowCount = board.length;
  const colCount = board[0].length;
  const index = vocabularyOrIndex?.bySkeleton
    ? vocabularyOrIndex
    : buildVocabularyIndex(vocabularyOrIndex || [], options.indexOptions);

  const maxChainLength = options.maxChainLength || MAX_SKELETON_LENGTH;
  const hexalink = String(boardState.hexalink || options.hexalink || '').toUpperCase();
  const hexarowcol = boardState.hexarowcol || options.hexarowcol || [];
  const rulesGrid = makeGridForRules(board);
  const moves = [];
  const seen = new Set();

  function emitMovesForSkeleton(skeleton, path) {
    const entries = index.bySkeleton.get(skeleton);
    if (!entries) return;

    for (const entry of entries) {
      const key = moveKey(entry.word, path);
      if (seen.has(key)) continue;
      seen.add(key);

      const isExactHexalink = qjynnRules.isExactHexalink(path, rulesGrid, hexalink, hexarowcol);
      const vowelPlacements = entry.vowelPlacements.map(run => ({ ...run }));

      moves.push({
        word: entry.word,
        consonantSkeleton: entry.consonantSkeleton,
        path: normalizePathForOutput(path),
        insertedVowels: flattenInsertedVowels(vowelPlacements),
        vowelPlacements,
        baseScore: qjynnRules.scoreWordByLength(entry.length, false),
        isHexalink: isExactHexalink
      });
    }
  }

  function visit(path, used, skeleton) {
    emitMovesForSkeleton(skeleton, path);
    if (path.length >= maxChainLength) return;

    const last = path[path.length - 1];
    for (const next of neighborsOf(last, rowCount, colCount)) {
      const key = `${next.row},${next.col}`;
      if (used.has(key)) continue;

      const cell = board[next.row][next.col];
      if (!isTileAvailable(cell)) continue;

      const nextSkeleton = skeleton + cell.letter;
      if (!index.skeletonPrefixes.has(nextSkeleton)) continue;

      used.add(key);
      path.push({ row: next.row, col: next.col });
      visit(path, used, nextSkeleton);
      path.pop();
      used.delete(key);
    }
  }

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const cell = board[row][col];
      if (!isTileAvailable(cell)) continue;
      const skeleton = cell.letter;
      if (!index.skeletonPrefixes.has(skeleton)) continue;
      visit([{ row, col }], new Set([`${row},${col}`]), skeleton);
    }
  }

  return moves.sort((a, b) =>
    a.word.localeCompare(b.word) ||
    JSON.stringify(a.path).localeCompare(JSON.stringify(b.path)));
}
```

## Tests

Command:

```bash
node --test tests/*.test.js
```

M4 test names:

```text
enumerates adjacency in all 8 directions
does not enumerate illegal jumps
does not use unavailable tiles
never reuses a tile within a chain
enumerates forward and reverse paths as distinct legal moves
recognizes exact Hexalink forward and reverse paths
returns multiple valid words sharing one consonant skeleton on one path
known handcrafted board returns the complete expected move set
generates consonant skeletons by removing A/E/I/O/U
preserves repeated consonants in skeletons
supports words containing no vowels
tracks multiple vowels between and around consonants
reconstructs words exactly from skeleton and vowel placements
indexes multiple words sharing one consonant skeleton
all indexed vocabulary entries reconstruct exactly
vocabulary exclusion counts account for every excluded word
filters words outside Qjynn move-index constraints
```

Full result:

```text
tests 26
pass 26
fail 0
duration_ms 522.724888
```

Handcrafted board:

```js
const grid = [
  ['B', 'C'],
  ['D', 'F']
];

const words = ['bc', 'bd', 'bf', 'cb', 'cd', 'cf', 'db', 'dc', 'df', 'fb', 'fc', 'fd', 'bcd'];
```

Expected moves:

```text
bc:[[0,0],[0,1]]
bcd:[[0,0],[0,1],[1,0]]
bd:[[0,0],[1,0]]
bf:[[0,0],[1,1]]
cb:[[0,1],[0,0]]
cd:[[0,1],[1,0]]
cf:[[0,1],[1,1]]
db:[[1,0],[0,0]]
dc:[[1,0],[0,1]]
df:[[1,0],[1,1]]
fb:[[1,1],[0,0]]
fc:[[1,1],[0,1]]
fd:[[1,1],[1,0]]
```

## Enumerator Example

Representative returned moves from the tutorial-style board:

```js
{
  word: "knees",
  consonantSkeleton: "kns",
  path: [[4,0],[4,1],[4,2]],
  insertedVowels: ["e","e"],
  vowelPlacements: [{ index: 2, letters: "ee" }],
  baseScore: 10,
  isHexalink: false
}
```

```js
{
  word: "shed",
  consonantSkeleton: "shd",
  path: [[5,4],[6,4],[7,4]],
  insertedVowels: ["e"],
  vowelPlacements: [{ index: 2, letters: "e" }],
  baseScore: 8,
  isHexalink: false
}
```

```js
{
  word: "watermelon",
  consonantSkeleton: "wtrmln",
  path: [[5,0],[6,1],[5,2],[4,3],[4,4],[3,5]],
  insertedVowels: ["a","e","e","o"],
  vowelPlacements: [
    { index: 1, letters: "a" },
    { index: 2, letters: "e" },
    { index: 4, letters: "e" },
    { index: 5, letters: "o" }
  ],
  baseScore: 20,
  isHexalink: true
}
```

## Performance

Measured on full `qjynn-words-v1.0.txt` and the 8x6 tutorial-style grid:

```text
Vocabulary words: 44,383
Indexed words: 41,814
Skeletons: 28,305
Legal moves found: 15,607
Hexalink moves: 1
Index build time: ~351.65 ms
Move enumeration time: ~130.26 ms
Total: ~481.90 ms
```

## Known Limitations / Ambiguities

- All-vowel words are excluded because Qjynn requires a consonant chain. Skeleton length must be 1-6.
- `baseScore` excludes Hexalink bonus by design. The returned `isHexalink` lets later scoring add the Hexalink bonus.
- `insertedVowels` is flat for the public API, while `vowelPlacements` preserves positions for future solver use.
- Tile state handling currently treats `undefined`, `0`, and `"OFF"` as playable. Other states are unavailable.
- This enumerates individual word/path pairs. It does not apply moves to state, recurse over turns, optimize score, or certify Gold routes.

## Git Status

```text
?? tests/solver-grid-word-finder.test.js
?? tests/solver-word-index.test.js
?? tools/
```

## Git Diff Stat

```text
```

`git diff --stat` is empty because the M4 files are currently untracked.
