const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVocabularyIndex } = require('../tools/solver/word-index.js');
const { enumerateLegalMoves } = require('../tools/solver/grid-word-finder.js');

function moveIds(moves) {
  return moves.map(move => `${move.word}:${JSON.stringify(move.path)}`).sort();
}

test('enumerates adjacency in all 8 directions', () => {
  const grid = [
    ['B', 'C', 'D'],
    ['F', 'M', 'G'],
    ['H', 'J', 'K']
  ];
  const words = ['mb', 'mc', 'md', 'mf', 'mg', 'mh', 'mj', 'mk'];
  const moves = enumerateLegalMoves({ grid }, buildVocabularyIndex(words));
  assert.deepEqual(moveIds(moves), [
    'mb:[[1,1],[0,0]]',
    'mc:[[1,1],[0,1]]',
    'md:[[1,1],[0,2]]',
    'mf:[[1,1],[1,0]]',
    'mg:[[1,1],[1,2]]',
    'mh:[[1,1],[2,0]]',
    'mj:[[1,1],[2,1]]',
    'mk:[[1,1],[2,2]]'
  ]);
});

test('does not enumerate illegal jumps', () => {
  const grid = [['M', 'X', 'B']];
  const moves = enumerateLegalMoves({ grid }, buildVocabularyIndex(['mb']));
  assert.deepEqual(moves, []);
});

test('does not use unavailable tiles', () => {
  const grid = [['M', 'B']];
  const tileStates = [[0, 2]];
  const moves = enumerateLegalMoves({ grid, tileStates }, buildVocabularyIndex(['mb']));
  assert.deepEqual(moves, []);
});

test('never reuses a tile within a chain', () => {
  const oneM = enumerateLegalMoves({ grid: [['M', 'C']] }, buildVocabularyIndex(['mcm']));
  assert.deepEqual(oneM, []);

  const twoM = enumerateLegalMoves({ grid: [['M', 'C', 'M']] }, buildVocabularyIndex(['mcm']));
  assert.deepEqual(moveIds(twoM), [
    'mcm:[[0,0],[0,1],[0,2]]',
    'mcm:[[0,2],[0,1],[0,0]]'
  ]);
});

test('enumerates forward and reverse paths as distinct legal moves', () => {
  const grid = [['M', 'B']];
  const moves = enumerateLegalMoves({ grid }, buildVocabularyIndex(['mb', 'bm']));
  assert.deepEqual(moveIds(moves), [
    'bm:[[0,1],[0,0]]',
    'mb:[[0,0],[0,1]]'
  ]);
});

test('recognizes exact Hexalink forward and reverse paths', () => {
  const grid = [
    ['W', 'T', 'R', 'M', 'L', 'N'],
    ['B', 'C', 'D', 'F', 'G', 'H']
  ];
  const hexarowcol = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]];
  const index = buildVocabularyIndex(['watermelon', 'nlmrtw']);
  const moves = enumerateLegalMoves({ grid, hexalink: 'WTRMLN', hexarowcol }, index);
  const watermelon = moves.find(move => move.word === 'watermelon');
  const reverse = moves.find(move => move.word === 'nlmrtw');

  assert.deepEqual(watermelon, {
    word: 'watermelon',
    consonantSkeleton: 'wtrmln',
    path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
    insertedVowels: ['a', 'e', 'e', 'o'],
    vowelPlacements: [
      { index: 1, letters: 'a' },
      { index: 2, letters: 'e' },
      { index: 4, letters: 'e' },
      { index: 5, letters: 'o' }
    ],
    baseScore: 20,
    isHexalink: true
  });
  assert.equal(reverse.isHexalink, true);
  assert.deepEqual(reverse.path, [[0, 5], [0, 4], [0, 3], [0, 2], [0, 1], [0, 0]]);
});

test('returns multiple valid words sharing one consonant skeleton on one path', () => {
  const grid = [['C', 'T']];
  const moves = enumerateLegalMoves({ grid }, buildVocabularyIndex(['cat', 'coat', 'cute']));
  assert.deepEqual(moves.map(move => move.word), ['cat', 'coat', 'cute']);
  assert.deepEqual(moves.map(move => move.path), [
    [[0, 0], [0, 1]],
    [[0, 0], [0, 1]],
    [[0, 0], [0, 1]]
  ]);
});

test('known handcrafted board returns the complete expected move set', () => {
  const grid = [
    ['B', 'C'],
    ['D', 'F']
  ];
  const words = ['bc', 'bd', 'bf', 'cb', 'cd', 'cf', 'db', 'dc', 'df', 'fb', 'fc', 'fd', 'bcd'];
  const moves = enumerateLegalMoves({ grid }, buildVocabularyIndex(words));
  assert.deepEqual(moveIds(moves), [
    'bc:[[0,0],[0,1]]',
    'bcd:[[0,0],[0,1],[1,0]]',
    'bd:[[0,0],[1,0]]',
    'bf:[[0,0],[1,1]]',
    'cb:[[0,1],[0,0]]',
    'cd:[[0,1],[1,0]]',
    'cf:[[0,1],[1,1]]',
    'db:[[1,0],[0,0]]',
    'dc:[[1,0],[0,1]]',
    'df:[[1,0],[1,1]]',
    'fb:[[1,1],[0,0]]',
    'fc:[[1,1],[0,1]]',
    'fd:[[1,1],[1,0]]'
  ]);
});
