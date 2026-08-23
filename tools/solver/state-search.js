const qjynnRules = require('../../qjynn-rules.js');
const { enumerateLegalMoves } = require('./grid-word-finder.js');

const DEFAULT_MAX_TURNS = 6;
const DEFAULT_GOLD_THRESHOLD = 100;
const OFF_STATE = 0;
const MODE_FIND_GOLD = 'findGold';
const MODE_MAXIMIZE_SCORE = 'maximizeScore';
const HEXALINK_BONUS = qjynnRules.scoreWordByLength(2, true) - qjynnRules.scoreWordByLength(2, false);
const ROW_COMPLETE_BONUS = qjynnRules.rowColumnBonus(0, 0, 1, 0).points;
const COLUMN_COMPLETE_BONUS = qjynnRules.rowColumnBonus(0, 0, 0, 1).points;

const CANONICAL_SCORING_POLICY = Object.freeze({
  score2to3: null,
  score4to6: null,
  score7to8: null,
  score9to10: null,
  hexalinkBonus: HEXALINK_BONUS,
  rowBonus: ROW_COMPLETE_BONUS,
  columnBonus: COLUMN_COMPLETE_BONUS
});

function scoreWordLengthWithPolicy(length, policy = {}) {
  if (length >= 2 && length <= 3 && policy.score2to3 !== undefined && policy.score2to3 !== null) return policy.score2to3;
  if (length >= 4 && length <= 6 && policy.score4to6 !== undefined && policy.score4to6 !== null) return policy.score4to6;
  if (length >= 7 && length <= 8 && policy.score7to8 !== undefined && policy.score7to8 !== null) return policy.score7to8;
  if (length >= 9 && length <= 10 && policy.score9to10 !== undefined && policy.score9to10 !== null) return policy.score9to10;
  return qjynnRules.scoreWordByLength(length, false);
}

function resolveScoringPolicy(policy = {}) {
  return {
    score2to3: policy.score2to3 ?? CANONICAL_SCORING_POLICY.score2to3,
    score4to6: policy.score4to6 ?? CANONICAL_SCORING_POLICY.score4to6,
    score7to8: policy.score7to8 ?? CANONICAL_SCORING_POLICY.score7to8,
    score9to10: policy.score9to10 ?? CANONICAL_SCORING_POLICY.score9to10,
    hexalinkBonus: policy.hexalinkBonus ?? CANONICAL_SCORING_POLICY.hexalinkBonus,
    rowBonus: policy.rowBonus ?? CANONICAL_SCORING_POLICY.rowBonus,
    columnBonus: policy.columnBonus ?? CANONICAL_SCORING_POLICY.columnBonus
  };
}

function normalizeGrid(grid) {
  if (!Array.isArray(grid) || grid.length === 0) throw new Error('grid must be a non-empty array');
  return grid.map(row => row.map(cell => String(cell?.letter || cell?.l || cell || '').toUpperCase()));
}

function bitFor(row, col, colCount) {
  return 1n << BigInt(row * colCount + col);
}

function pathMask(path, colCount) {
  return path.reduce((mask, [row, col]) => mask | bitFor(row, col, colCount), 0n);
}

function tileStateAt(tileStates, row, col, colCount, cell) {
  if (Array.isArray(tileStates)) {
    if (Array.isArray(tileStates[row])) return tileStates[row][col];
    return tileStates[row * colCount + col];
  }
  if (tileStates && typeof tileStates === 'object') return tileStates[`${row},${col}`];
  return cell?.state;
}

function isInitiallyUsed(state) {
  return !(state === undefined || state === OFF_STATE || state === 'OFF');
}

function initialUsedMask(gridInput, tileStates) {
  const colCount = gridInput[0].length;
  let mask = 0n;
  for (let row = 0; row < gridInput.length; row++) {
    for (let col = 0; col < gridInput[row].length; col++) {
      const state = tileStateAt(tileStates, row, col, colCount, gridInput[row][col]);
      if (isInitiallyUsed(state)) mask |= bitFor(row, col, colCount);
    }
  }
  return mask;
}

function lineMasks(rowCount, colCount) {
  const rows = [];
  const columns = [];
  for (let row = 0; row < rowCount; row++) {
    let mask = 0n;
    for (let col = 0; col < colCount; col++) mask |= bitFor(row, col, colCount);
    rows.push(mask);
  }
  for (let col = 0; col < colCount; col++) {
    let mask = 0n;
    for (let row = 0; row < rowCount; row++) mask |= bitFor(row, col, colCount);
    columns.push(mask);
  }
  return { rows, columns };
}

function completedMask(usedMask, masks) {
  let result = 0;
  masks.forEach((mask, index) => {
    if ((usedMask & mask) === mask) result |= (1 << index);
  });
  return result;
}

function lineSubsetBounds(rowMasks, colMasks, scoringPolicy = CANONICAL_SCORING_POLICY) {
  const lines = [
    ...rowMasks.map((mask, index) => ({ bit: 1 << index, mask, bonus: scoringPolicy.rowBonus })),
    ...colMasks.map((mask, index) => ({
      bit: 1 << (rowMasks.length + index),
      mask,
      bonus: scoringPolicy.columnBonus
    }))
  ];
  const subsets = [{ bits: 0, mask: 0n, bonus: 0 }];

  for (const line of lines) {
    const existing = subsets.slice();
    for (const subset of existing) {
      subsets.push({
        bits: subset.bits | line.bit,
        mask: subset.mask | line.mask,
        bonus: subset.bonus + line.bonus
      });
    }
  }

  subsets.sort((a, b) => b.bonus - a.bonus);
  return subsets;
}

function popcountBits(value) {
  let count = 0;
  let n = value >>> 0;
  while (n) {
    n &= n - 1;
    count++;
  }
  return count;
}

function popcountBigInt(value) {
  let count = 0;
  let n = value;
  while (n) {
    n &= n - 1n;
    count++;
  }
  return count;
}

function topNSum(values, limit) {
  if (limit <= 0) return 0;
  const top = [];
  for (const value of values) {
    let inserted = false;
    for (let index = 0; index < top.length; index++) {
      if (value > top[index]) {
        top.splice(index, 0, value);
        inserted = true;
        break;
      }
    }
    if (!inserted && top.length < limit) top.push(value);
    if (top.length > limit) top.pop();
  }
  return top.reduce((sum, value) => sum + value, 0);
}

function maskToIndexes(mask, tileCount) {
  const indexes = [];
  for (let index = 0; index < tileCount; index++) {
    if ((mask & (1n << BigInt(index))) !== 0n) indexes.push(index);
  }
  return indexes;
}

function touchedLineBits(path) {
  let rows = 0;
  let columns = 0;
  for (const [row, col] of path) {
    rows |= (1 << row);
    columns |= (1 << col);
  }
  return { rows, columns };
}

function moveWithMask(move, colCount, tileCount, scoringPolicy = CANONICAL_SCORING_POLICY) {
  const mask = pathMask(move.path, colCount);
  const touched = touchedLineBits(move.path);
  const baseScore = scoreWordLengthWithPolicy(move.word.length, scoringPolicy);
  const hexalinkBonus = move.isHexalink ? scoringPolicy.hexalinkBonus : 0;
  return {
    ...move,
    baseScore,
    mask,
    tileIndexes: maskToIndexes(mask, tileCount),
    touchedRows: touched.rows,
    touchedCols: touched.columns,
    hexalinkBonus,
    staticScore: move.baseScore + hexalinkBonus
  };
}

function chooseCertificateMove(existing, candidate) {
  if (!existing) return candidate;
  if (candidate.staticScore !== existing.staticScore) {
    return candidate.staticScore > existing.staticScore ? candidate : existing;
  }
  if (candidate.word !== existing.word) return candidate.word < existing.word ? candidate : existing;
  return JSON.stringify(candidate.path) < JSON.stringify(existing.path) ? candidate : existing;
}

function prepareSolverMoves(rawMoves, colCount, tileCount, scoringPolicy = CANONICAL_SCORING_POLICY) {
  const byMask = new Map();
  const uniqueMaskScore = new Set();
  const uniquePaths = new Set();

  for (const rawMove of rawMoves) {
    const move = moveWithMask(rawMove, colCount, tileCount, scoringPolicy);
    const maskKey = move.mask.toString();
    uniqueMaskScore.add(`${maskKey}|${move.staticScore}`);
    uniquePaths.add(JSON.stringify(move.path));
    byMask.set(maskKey, chooseCertificateMove(byMask.get(maskKey), move));
  }

  const moves = Array.from(byMask.values());
  moves.sort((a, b) =>
    b.staticScore - a.staticScore ||
    a.word.localeCompare(b.word) ||
    JSON.stringify(a.path).localeCompare(JSON.stringify(b.path)));

  return {
    moves,
    stats: {
      rawMoveCount: rawMoves.length,
      solverRelevantMoveCount: moves.length,
      uniqueTileMasks: byMask.size,
      uniqueMaskScoreCount: uniqueMaskScore.size,
      uniquePaths: uniquePaths.size,
      dominatedMoveCount: rawMoves.length - moves.length
    }
  };
}

function applyMove(state, move, context) {
  const usedMask = state.usedMask | move.mask;
  const touched = move.touchedRows === undefined || move.touchedCols === undefined
    ? touchedLineBits(move.path)
    : { rows: move.touchedRows, columns: move.touchedCols };
  let nextRowMask = state.completedRows;
  let nextColMask = state.completedCols;

  for (let row = 0; row < context.rowMasks.length; row++) {
    const bit = 1 << row;
    if ((touched.rows & bit) === 0 || (nextRowMask & bit) !== 0) continue;
    if ((usedMask & context.rowMasks[row]) === context.rowMasks[row]) nextRowMask |= bit;
  }
  for (let col = 0; col < context.colMasks.length; col++) {
    const bit = 1 << col;
    if ((touched.columns & bit) === 0 || (nextColMask & bit) !== 0) continue;
    if ((usedMask & context.colMasks[col]) === context.colMasks[col]) nextColMask |= bit;
  }

  const newlyCompletedRows = nextRowMask & ~state.completedRows;
  const newlyCompletedCols = nextColMask & ~state.completedCols;
  const scoringPolicy = context.scoringPolicy || CANONICAL_SCORING_POLICY;
  const rowBonus = popcountBits(newlyCompletedRows) * scoringPolicy.rowBonus;
  const columnBonus = popcountBits(newlyCompletedCols) * scoringPolicy.columnBonus;
  const scoreDelta = move.baseScore + move.hexalinkBonus + rowBonus + columnBonus;

  return {
    state: {
      usedMask,
      completedRows: nextRowMask,
      completedCols: nextColMask,
      turnsUsed: state.turnsUsed + 1
    },
    scoredMove: {
      word: move.word,
      consonantSkeleton: move.consonantSkeleton,
      path: move.path.map(pair => pair.slice()),
      insertedVowels: move.insertedVowels.slice(),
      vowelPlacements: move.vowelPlacements.map(run => ({ ...run })),
      baseScore: move.baseScore,
      isHexalink: Boolean(move.isHexalink),
      hexalinkBonus: move.hexalinkBonus,
      rowBonus,
      columnBonus,
      scoreDelta,
      cumulativeScore: state.score + scoreDelta,
      unavailableTiles: move.path.map(pair => pair.slice()),
      resultingUsedMask: usedMask.toString()
    },
    scoreDelta
  };
}

function remainingLineBonusBound(state, context) {
  return maxFutureLineBonusBound(state, context, context.allTilesMask, DEFAULT_MAX_TURNS);
}

function maxFutureLineBonusBound(state, context, availableTileMask, remainingTurns) {
  const lineSubsets = context.lineSubsets || lineSubsetBounds(context.rowMasks, context.colMasks, context.scoringPolicy);
  const completedLineBits = state.completedRows | (state.completedCols << context.rowMasks.length);
  const maxNewTiles = remainingTurns * qjynnRules.MAX_CHAIN_LENGTH;

  for (const subset of lineSubsets) {
    if ((subset.bits & completedLineBits) !== 0) continue;
    const missingTiles = subset.mask & ~state.usedMask;
    if ((missingTiles & ~availableTileMask) !== 0n) continue;
    if (popcountBigInt(missingTiles) <= maxNewTiles) return subset.bonus;
  }

  return 0;
}

function optimisticUpperBound(state, availableMoves, context, remainingTurns) {
  const staticScores = [];
  let availableTileMask = 0n;
  for (const move of availableMoves) {
    if ((move.mask & state.usedMask) !== 0n) continue;
    staticScores.push(move.staticScore);
    availableTileMask |= move.mask;
  }
  return topNSum(staticScores, remainingTurns) +
    maxFutureLineBonusBound(state, context, availableTileMask, remainingTurns);
}

function replaySequence(boardState, sequence) {
  const grid = normalizeGrid(boardState.grid);
  const rowCount = grid.length;
  const colCount = grid[0].length;
  const { rows: rowMasks, columns: colMasks } = lineMasks(rowCount, colCount);
  const usedMask = initialUsedMask(boardState.grid, boardState.tileStates);
  const initial = {
    usedMask,
    completedRows: completedMask(usedMask, rowMasks),
    completedCols: completedMask(usedMask, colMasks),
    turnsUsed: 0,
    score: 0
  };
  const scoringPolicy = resolveScoringPolicy(boardState.scoringPolicy);
  const context = { rowMasks, colMasks, scoringPolicy };
  let state = initial;
  const replayed = [];

  for (const rawMove of sequence) {
    const move = {
      ...rawMove,
      mask: pathMask(rawMove.path, colCount),
      hexalinkBonus: rawMove.isHexalink ? scoringPolicy.hexalinkBonus : rawMove.hexalinkBonus || 0
    };
    if ((move.mask & state.usedMask) !== 0n) throw new Error(`Move reuses unavailable tile: ${rawMove.word}`);
    const applied = applyMove(state, move, context);
    replayed.push(applied.scoredMove);
    state = { ...applied.state, score: applied.scoredMove.cumulativeScore };
  }

  return {
    score: state.score,
    turnsUsed: state.turnsUsed,
    sequence: replayed,
    finalUsedMask: state.usedMask.toString()
  };
}

function rebaseSequence(sequence, startingScore) {
  let cumulativeScore = startingScore;
  return sequence.map(move => {
    cumulativeScore += move.scoreDelta;
    return {
      ...move,
      path: move.path.map(pair => pair.slice()),
      insertedVowels: move.insertedVowels.slice(),
      vowelPlacements: move.vowelPlacements.map(run => ({ ...run })),
      unavailableTiles: move.unavailableTiles.map(pair => pair.slice()),
      cumulativeScore
    };
  });
}

function solveBoard(boardState, wordIndex, options = {}) {
  const started = process.hrtime.bigint();
  const grid = normalizeGrid(boardState.grid);
  const rowCount = grid.length;
  const colCount = grid[0].length;
  const tileCount = rowCount * colCount;
  const maxTurns = boardState.maxTurns || options.maxTurns || DEFAULT_MAX_TURNS;
  const goldThreshold = boardState.goldThreshold || options.goldThreshold || DEFAULT_GOLD_THRESHOLD;
  const scoringPolicy = resolveScoringPolicy(options.scoringPolicy || boardState.scoringPolicy);
  const moveFilter = options.moveFilter || boardState.moveFilter || null;
  const certificateConstraint = options.certificateConstraint || boardState.certificateConstraint || null;
  const mode = options.mode || boardState.mode || MODE_MAXIMIZE_SCORE;
  const timeoutMs = options.timeoutMs || boardState.timeoutMs || null;
  let timedOut = false;
  if (![MODE_FIND_GOLD, MODE_MAXIMIZE_SCORE].includes(mode)) {
    throw new Error(`Unsupported solver mode: ${mode}`);
  }
  const rawMoves = enumerateLegalMoves(boardState, wordIndex).filter(move => !moveFilter || moveFilter(move));
  const prepared = prepareSolverMoves(rawMoves, colCount, tileCount, scoringPolicy);
  const allMoves = prepared.moves;

  const { rows: rowMasks, columns: colMasks } = lineMasks(rowCount, colCount);
  const initialMask = initialUsedMask(boardState.grid, boardState.tileStates);
  const initialState = {
    usedMask: initialMask,
    completedRows: completedMask(initialMask, rowMasks),
    completedCols: completedMask(initialMask, colMasks),
    turnsUsed: 0,
    score: 0
  };

  const context = {
    rowMasks,
    colMasks,
    lineSubsets: lineSubsetBounds(rowMasks, colMasks, scoringPolicy),
    allTilesMask: (1n << BigInt(tileCount)) - 1n,
    scoringPolicy
  };
  const memo = new Map();
  const stats = {
    statesExplored: 0,
    statesPruned: 0,
    memoHits: 0,
    compatibilityCacheHits: 0,
    rawStartingMoveCount: prepared.stats.rawMoveCount,
    startingLegalMoveCount: prepared.stats.rawMoveCount,
    solverRelevantMoveCount: prepared.stats.solverRelevantMoveCount,
    uniqueTileMasks: prepared.stats.uniqueTileMasks,
    uniqueMaskScoreCount: prepared.stats.uniqueMaskScoreCount,
    uniquePaths: prepared.stats.uniquePaths,
    dominatedMoveCount: prepared.stats.dominatedMoveCount,
    elapsedMs: 0,
    timedOut: false
  };
  let incumbentScore = 0;
  let incumbentSequence = [];
  let goldSequence = null;
  const compatibleMovesCache = new Map();
  const bestScoreAtState = new Map();

  function memoKey(state) {
    return `${state.turnsUsed}|${state.usedMask.toString()}|${state.completedRows}|${state.completedCols}`;
  }

  function compatibleMovesFor(usedMask) {
    const key = usedMask.toString();
    const cached = compatibleMovesCache.get(key);
    if (cached) {
      stats.compatibilityCacheHits++;
      return cached;
    }
    const compatible = allMoves.filter(move => (move.mask & usedMask) === 0n);
    compatibleMovesCache.set(key, compatible);
    return compatible;
  }

  function noteIncumbent(state, sequence) {
    if (state.score > incumbentScore) {
      incumbentScore = state.score;
      incumbentSequence = sequence.map(move => ({ ...move, path: move.path.map(pair => pair.slice()) }));
    }
    if (mode === MODE_FIND_GOLD && state.score >= goldThreshold && !goldSequence &&
      (!certificateConstraint || certificateConstraint(sequence, state))) {
      goldSequence = sequence.map(move => ({ ...move, path: move.path.map(pair => pair.slice()) }));
    }
  }

  function deadlineReached() {
    if (!timeoutMs) return false;
    if (Number(process.hrtime.bigint() - started) / 1e6 < timeoutMs) return false;
    timedOut = true;
    stats.timedOut = true;
    return true;
  }

  function search(state, sequence = []) {
    if (deadlineReached()) return { score: 0, sequence: [] };
    stats.statesExplored++;
    noteIncumbent(state, sequence);
    if (mode === MODE_FIND_GOLD && goldSequence) return { score: 0, sequence: [] };

    const remainingTurns = maxTurns - state.turnsUsed;
    if (remainingTurns <= 0) return { score: 0, sequence: [] };

    const compatibleMoves = compatibleMovesFor(state.usedMask);
    if (compatibleMoves.length === 0) return { score: 0, sequence: [] };

    const optimistic = optimisticUpperBound(state, compatibleMoves, context, remainingTurns);
    const targetScore = mode === MODE_FIND_GOLD ? goldThreshold - 1 : incumbentScore;
    if (state.score + optimistic <= targetScore) {
      stats.statesPruned++;
      return { score: 0, sequence: [] };
    }

    const key = memoKey(state);
    const previousBestScore = bestScoreAtState.get(key);
    if (previousBestScore !== undefined && previousBestScore >= state.score) {
      stats.statesPruned++;
      return { score: 0, sequence: [] };
    }
    bestScoreAtState.set(key, state.score);

    if (memo.has(key)) {
      stats.memoHits++;
      const cached = memo.get(key);
      return {
        score: cached.score,
        sequence: rebaseSequence(cached.sequence, state.score)
      };
    }

    let best = { score: 0, sequence: [] };
    for (const move of compatibleMoves) {
      if (deadlineReached()) break;
      const applied = applyMove(state, move, context);
      const nextState = {
        ...applied.state,
        score: state.score + applied.scoreDelta
      };
      const nextSequence = [...sequence, applied.scoredMove];
      const future = search(nextState, nextSequence);
      const total = applied.scoreDelta + future.score;
      if (total > best.score) {
        best = {
          score: total,
          sequence: [applied.scoredMove, ...future.sequence]
        };
      }
      if (mode === MODE_FIND_GOLD && goldSequence) {
        best = { score: goldSequence.at(-1).cumulativeScore - state.score, sequence: goldSequence.slice(sequence.length) };
        break;
      }
    }

    memo.set(key, {
      score: best.score,
      sequence: rebaseSequence(best.sequence, 0)
    });
    return best;
  }

  const result = search(initialState);
  const bestSequence = mode === MODE_FIND_GOLD && goldSequence ? goldSequence : (incumbentSequence.length ? incumbentSequence : result.sequence);
  const maxScore = mode === MODE_FIND_GOLD && goldSequence
    ? goldSequence.at(-1).cumulativeScore
    : Math.max(result.score, incumbentScore);
  const goldReachable = mode === MODE_FIND_GOLD ? Boolean(goldSequence) : maxScore >= goldThreshold;
  const goldCertificate = goldReachable ? (goldSequence || bestSequence) : null;
  stats.elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  stats.timedOut = timedOut;

  return {
    maxScore,
    goldReachable,
    turnsUsed: bestSequence.length,
    bestSequence,
    goldCertificate,
    stats,
    mode,
    replay: replaySequence(boardState, bestSequence)
  };
}

module.exports = {
  solveBoard,
  replaySequence,
  applyMove,
  optimisticUpperBound,
  remainingLineBonusBound,
  maxFutureLineBonusBound,
  prepareSolverMoves,
  initialUsedMask,
  pathMask,
  lineMasks,
  completedMask,
  MODE_FIND_GOLD,
  MODE_MAXIMIZE_SCORE,
  CANONICAL_SCORING_POLICY,
  resolveScoringPolicy,
  scoreWordLengthWithPolicy
};
