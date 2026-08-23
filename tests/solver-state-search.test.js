const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVocabularyIndex } = require('../tools/solver/word-index.js');
const { enumerateLegalMoves } = require('../tools/solver/grid-word-finder.js');
const {
  solveBoard,
  replaySequence,
  applyMove,
  prepareSolverMoves,
  initialUsedMask,
  lineMasks,
  completedMask,
  pathMask,
  MODE_FIND_GOLD
} = require('../tools/solver/state-search.js');

function withIndex(words) {
  return buildVocabularyIndex(words);
}

function bruteForceSolve(boardState, wordIndex) {
  const rowCount = boardState.grid.length;
  const colCount = boardState.grid[0].length;
  const maxTurns = boardState.maxTurns || 6;
  const moves = enumerateLegalMoves(boardState, wordIndex).map(move => ({
    ...move,
    mask: pathMask(move.path, colCount),
    hexalinkBonus: move.isHexalink ? 10 : 0
  }));
  const { rows: rowMasks, columns: colMasks } = lineMasks(rowCount, colCount);
  const usedMask = initialUsedMask(boardState.grid, boardState.tileStates);
  const context = { rowMasks, colMasks };
  const initial = {
    usedMask,
    completedRows: completedMask(usedMask, rowMasks),
    completedCols: completedMask(usedMask, colMasks),
    turnsUsed: 0,
    score: 0
  };

  function search(state) {
    if (state.turnsUsed >= maxTurns) return { score: 0, sequence: [] };
    let best = { score: 0, sequence: [] };
    for (const move of moves) {
      if ((move.mask & state.usedMask) !== 0n) continue;
      const applied = applyMove(state, move, context);
      const nextState = {
        ...applied.state,
        score: state.score + applied.scoreDelta
      };
      const future = search(nextState);
      const total = applied.scoreDelta + future.score;
      if (total > best.score) {
        best = { score: total, sequence: [applied.scoredMove, ...future.sequence] };
      }
    }
    return best;
  }

  return search(initial);
}

test('Gold impossible', () => {
  const board = { grid: [['B', 'C']], maxTurns: 6, goldThreshold: 100 };
  const result = solveBoard(board, withIndex(['bc']));
  assert.equal(result.maxScore, 52);
  assert.equal(result.goldReachable, false);
});

test('Gold exactly 100', () => {
  const board = {
    grid: [
      ['B', 'C'],
      ['D', 'F'],
      ['G', 'H'],
      ['J', 'K'],
      ['L', 'M']
    ],
    maxTurns: 6,
    goldThreshold: 100
  };
  const result = solveBoard(board, withIndex(['bc', 'df', 'gh', 'jk', 'lm']));
  assert.equal(result.maxScore, 100);
  assert.equal(result.goldReachable, true);
  assert.equal(result.goldCertificate.at(-1).cumulativeScore, 100);
});

test('Gold greater than 100', () => {
  const board = {
    grid: [
      ['B', 'C'],
      ['D', 'F'],
      ['G', 'H'],
      ['J', 'K'],
      ['L', 'M'],
      ['N', 'P']
    ],
    maxTurns: 6,
    goldThreshold: 100
  };
  const result = solveBoard(board, withIndex(['bc', 'df', 'gh', 'jk', 'lm', 'np']));
  assert.equal(result.maxScore, 112);
  assert.equal(result.goldReachable, true);
});

test('greedily taking the best first move can be worse', () => {
  const board = {
    grid: [
      ['B', 'C', 'D', 'F', 'G', 'H'],
      ['X', 'X', 'X', 'X', 'X', 'X']
    ],
    maxTurns: 2,
    goldThreshold: 100
  };
  const index = withIndex(['bacedifogh', 'baceda', 'fegahi']);
  const result = solveBoard(board, index);
  const brute = bruteForceSolve(board, index);

  assert.equal(result.maxScore, 34);
  assert.equal(brute.score, 34);
  assert.deepEqual(result.bestSequence.map(move => move.word), ['baceda', 'fegahi']);
});

test('used tiles cannot be reused', () => {
  const board = { grid: [['B', 'C', 'D']], maxTurns: 2 };
  const result = solveBoard(board, withIndex(['bc', 'cd']));
  assert.equal(result.maxScore, 42);
  assert.equal(result.bestSequence.length, 1);
});

test('row bonuses are awarded exactly once', () => {
  const board = { grid: [['B', 'C'], ['X', 'X']], maxTurns: 2 };
  const result = solveBoard(board, withIndex(['bc']));
  assert.equal(result.bestSequence[0].rowBonus, 10);
  assert.equal(result.maxScore, 12);
});

test('column bonuses are awarded exactly once', () => {
  const board = { grid: [['B'], ['C']], maxTurns: 2 };
  const result = solveBoard(board, withIndex(['bc']));
  assert.equal(result.bestSequence[0].columnBonus, 20);
  assert.equal(result.maxScore, 42);
});

test('exact Hexalink bonus is applied correctly', () => {
  const board = {
    grid: [['W', 'T', 'R', 'M', 'L', 'N'], ['X', 'X', 'X', 'X', 'X', 'X']],
    hexalink: 'WTRMLN',
    hexarowcol: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
    maxTurns: 1
  };
  const result = solveBoard(board, withIndex(['watermelon']));
  assert.equal(result.bestSequence[0].hexalinkBonus, 10);
  assert.equal(result.bestSequence[0].scoreDelta, 40);
});

test('reverse Hexalink is handled correctly', () => {
  const board = {
    grid: [['W', 'T', 'R', 'M', 'L', 'N'], ['X', 'X', 'X', 'X', 'X', 'X']],
    hexalink: 'WTRMLN',
    hexarowcol: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
    maxTurns: 1
  };
  const result = solveBoard(board, withIndex(['nlmrtw']));
  assert.equal(result.bestSequence[0].isHexalink, true);
  assert.equal(result.bestSequence[0].hexalinkBonus, 10);
});

test('solver never exceeds six successful moves', () => {
  const board = {
    grid: [
      ['B', 'C'],
      ['D', 'F'],
      ['G', 'H'],
      ['J', 'K'],
      ['L', 'M'],
      ['N', 'P'],
      ['Q', 'R']
    ],
    maxTurns: 6
  };
  const result = solveBoard(board, withIndex(['bc', 'df', 'gh', 'jk', 'lm', 'np', 'qr']));
  assert.equal(result.turnsUsed, 6);
  assert.equal(result.bestSequence.length, 6);
});

test('replaying a Gold certificate reproduces the reported final score', () => {
  const board = {
    grid: [
      ['B', 'C'],
      ['D', 'F'],
      ['G', 'H'],
      ['J', 'K'],
      ['L', 'M']
    ],
    maxTurns: 6,
    goldThreshold: 100
  };
  const result = solveBoard(board, withIndex(['bc', 'df', 'gh', 'jk', 'lm']));
  const replay = replaySequence(board, result.goldCertificate);
  assert.equal(replay.score, result.maxScore);
  assert.equal(replay.score, 100);
});

test('optimized solver matches brute-force reference on a handcrafted board', () => {
  const board = {
    grid: [
      ['B', 'C', 'D'],
      ['F', 'G', 'H']
    ],
    maxTurns: 3
  };
  const index = withIndex(['bc', 'cd', 'fg', 'gh', 'bcdf', 'dfh']);
  const optimized = solveBoard(board, index);
  const brute = bruteForceSolve(board, index);
  assert.equal(optimized.maxScore, brute.score);
});

test('move dominance keeps only the highest scoring move for one tile mask', () => {
  const board = { grid: [['B', 'C', 'D', 'F', 'G', 'H']], maxTurns: 1 };
  const index = withIndex(['bcdfgh', 'bacodefugh']);
  const rawMoves = enumerateLegalMoves(board, index);
  const prepared = prepareSolverMoves(rawMoves, 6, 6);
  const result = solveBoard(board, index);
  const brute = bruteForceSolve(board, index);

  assert.equal(rawMoves.length, 2);
  assert.equal(prepared.stats.solverRelevantMoveCount, 1);
  assert.equal(prepared.stats.dominatedMoveCount, 1);
  assert.equal(result.maxScore, brute.score);
  assert.equal(result.bestSequence[0].word, 'bacodefugh');
});

test('same-mask dominance preserves exact Hexalink certificate metadata', () => {
  const board = {
    grid: [
      ['W', 'T', 'R'],
      ['N', 'L', 'M']
    ],
    hexalink: 'WTRMLN',
    hexarowcol: [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0]],
    maxTurns: 1,
    goldThreshold: 100
  };
  const index = withIndex(['wtrmln', 'wanolutirm']);
  const rawMoves = enumerateLegalMoves(board, index);
  const prepared = prepareSolverMoves(rawMoves, 3, 6);
  const sameMaskMoves = rawMoves.filter(move => pathMask(move.path, 3) === pathMask(board.hexarowcol, 3));
  const result = solveBoard(board, index, { mode: MODE_FIND_GOLD });
  const certificateMove = result.goldCertificate[0];
  const replay = replaySequence(board, result.goldCertificate);

  assert.equal(sameMaskMoves.length, 2);
  assert.equal(sameMaskMoves.filter(move => move.isHexalink).length, 1);
  assert.equal(sameMaskMoves.filter(move => !move.isHexalink).length, 1);
  assert.equal(prepared.stats.solverRelevantMoveCount, 1);
  assert.equal(prepared.stats.dominatedMoveCount, 1);
  assert.equal(result.goldReachable, true);
  assert.equal(certificateMove.word, 'wtrmln');
  assert.equal(certificateMove.isHexalink, true);
  assert.equal(certificateMove.hexalinkBonus, 10);
  assert.deepEqual(certificateMove.path, board.hexarowcol);
  assert.equal(replay.score, result.maxScore);
  assert.equal(replay.sequence[0].isHexalink, true);
  assert.equal(replay.sequence[0].hexalinkBonus, 10);
});

test('findGold returns an exact certificate without proving maximum score', () => {
  const board = {
    grid: [
      ['B', 'C'],
      ['D', 'F'],
      ['G', 'H'],
      ['J', 'K'],
      ['L', 'M'],
      ['N', 'P']
    ],
    maxTurns: 6,
    goldThreshold: 100
  };
  const index = withIndex(['bc', 'df', 'gh', 'jk', 'lm', 'np']);
  const gold = solveBoard(board, index, { mode: MODE_FIND_GOLD });
  const maximum = solveBoard(board, index);
  const replay = replaySequence(board, gold.goldCertificate);

  assert.equal(gold.goldReachable, true);
  assert.ok(gold.maxScore >= 100);
  assert.equal(replay.score, gold.maxScore);
  assert.equal(maximum.maxScore, 112);
  assert.ok(gold.stats.statesExplored <= maximum.stats.statesExplored);
});

test('optimized solver matches brute force across small feasible boards', () => {
  const cases = [
    {
      board: { grid: [['B', 'C', 'D'], ['F', 'G', 'H']], maxTurns: 3 },
      words: ['bc', 'cd', 'fg', 'gh', 'bcdf', 'dfh', 'cfg']
    },
    {
      board: { grid: [['S', 'T', 'R'], ['L', 'N', 'M']], maxTurns: 2 },
      words: ['star', 'stern', 'storm', 'trim', 'slant', 'tram']
    },
    {
      board: { grid: [['B', 'L'], ['D', 'R'], ['S', 'T']], maxTurns: 3 },
      words: ['bald', 'bird', 'blast', 'bristle', 'stir', 'drab']
    }
  ];

  for (const { board, words } of cases) {
    const index = withIndex(words);
    const optimized = solveBoard(board, index);
    const brute = bruteForceSolve(board, index);
    assert.equal(optimized.maxScore, brute.score);
    assert.equal(replaySequence(board, optimized.bestSequence).score, optimized.maxScore);
  }
});
