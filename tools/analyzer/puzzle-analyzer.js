const qjynnRules = require('../../qjynn-rules.js');
const { enumerateLegalMoves } = require('../solver/grid-word-finder.js');
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
} = require('../solver/state-search.js');
const { validatePuzzle } = require('../generator/puzzle-validator.js');
const {
  mean,
  median,
  percentile,
  summary,
  percentage,
  round
} = require('./metrics-utils.js');

const ANALYZER_VERSION = 'm7a.0';
const DEFAULT_TOP_N = 20;
const DEFAULT_GOLD_FIRST_MOVE_LIMIT = 75;
const DEFAULT_MAX_GOLD_CERTIFICATES = 25;

function pathKey(path) {
  return path.map(([row, col]) => `${row},${col}`).join('|');
}

function maskKey(move, colCount) {
  return pathMask(move.path, colCount).toString();
}

function cloneMove(move) {
  return {
    ...move,
    path: move.path.map(pair => pair.slice()),
    insertedVowels: move.insertedVowels?.slice() || [],
    vowelPlacements: (move.vowelPlacements || []).map(run => ({ ...run }))
  };
}

function createInitialScoringState(puzzle) {
  const rowCount = puzzle.grid.length;
  const colCount = puzzle.grid[0].length;
  const { rows: rowMasks, columns: colMasks } = lineMasks(rowCount, colCount);
  const usedMask = initialUsedMask(puzzle.grid, puzzle.tileStates);
  return {
    state: {
      usedMask,
      completedRows: completedMask(usedMask, rowMasks),
      completedCols: completedMask(usedMask, colMasks),
      turnsUsed: 0,
      score: 0
    },
    context: { rowMasks, colMasks },
    colCount,
    tileCount: rowCount * colCount
  };
}

function legalMoveContext(puzzle, wordIndex) {
  const started = process.hrtime.bigint();
  const rawMoves = enumerateLegalMoves(puzzle, wordIndex);
  const enumerationMs = Number(process.hrtime.bigint() - started) / 1e6;
  const { colCount, tileCount } = createInitialScoringState(puzzle);
  const prepared = prepareSolverMoves(rawMoves, colCount, tileCount);
  return { rawMoves, prepared, enumerationMs, colCount, tileCount };
}

function vocabularyMetrics(rawMoves) {
  const uniqueWords = new Map();
  const skeletonToWords = new Map();
  for (const move of rawMoves) {
    uniqueWords.set(move.word, move);
    if (!skeletonToWords.has(move.consonantSkeleton)) skeletonToWords.set(move.consonantSkeleton, new Set());
    skeletonToWords.get(move.consonantSkeleton).add(move.word);
  }

  const words = Array.from(uniqueWords.values());
  const lengthDistribution = {};
  for (let length = 2; length <= 10; length++) {
    const count = words.filter(move => move.word.length === length).length;
    lengthDistribution[length] = {
      count,
      pct: round(percentage(count, words.length))
    };
  }

  const grouped = {
    short2To3: lengthDistribution[2].count + lengthDistribution[3].count,
    medium4To6: lengthDistribution[4].count + lengthDistribution[5].count + lengthDistribution[6].count,
    long7To10: lengthDistribution[7].count + lengthDistribution[8].count + lengthDistribution[9].count + lengthDistribution[10].count
  };
  grouped.shortPct = round(percentage(grouped.short2To3, words.length));
  grouped.mediumPct = round(percentage(grouped.medium4To6, words.length));
  grouped.longPct = round(percentage(grouped.long7To10, words.length));

  const wordsPerSkeleton = Array.from(skeletonToWords.values()).map(set => set.size);
  const topSkeletons = Array.from(skeletonToWords.entries())
    .map(([skeleton, wordSet]) => ({
      skeleton,
      wordCount: wordSet.size,
      representativeWords: Array.from(wordSet).sort().slice(0, 10)
    }))
    .sort((a, b) => b.wordCount - a.wordCount || a.skeleton.localeCompare(b.skeleton))
    .slice(0, 10);

  return {
    uniqueWords: words.length,
    wordLengthDistribution: lengthDistribution,
    groupedWordLengths: grouped,
    uniqueConsonantSkeletons: skeletonToWords.size,
    wordsPerSkeleton: {
      mean: mean(wordsPerSkeleton),
      median: median(wordsPerSkeleton),
      max: wordsPerSkeleton.length ? Math.max(...wordsPerSkeleton) : 0
    },
    topSkeletons
  };
}

function pathMetrics(rawMoves, colCount) {
  const paths = new Map();
  const masks = new Map();
  const wordsByPath = new Map();
  const wordsByMask = new Map();
  const pathLengths = {};

  for (let length = 1; length <= 6; length++) {
    pathLengths[length] = { uniquePaths: 0, uniquePlayableWords: 0 };
  }

  for (const move of rawMoves) {
    const pKey = pathKey(move.path);
    const mKey = maskKey(move, colCount);
    paths.set(pKey, move.path);
    masks.set(mKey, move.path);
    if (!wordsByPath.has(pKey)) wordsByPath.set(pKey, new Set());
    if (!wordsByMask.has(mKey)) wordsByMask.set(mKey, new Set());
    wordsByPath.get(pKey).add(move.word);
    wordsByMask.get(mKey).add(move.word);
  }

  for (const [pKey, path] of paths.entries()) {
    const words = wordsByPath.get(pKey);
    pathLengths[path.length].uniquePaths++;
    pathLengths[path.length].uniquePlayableWords += words.size;
  }

  return {
    uniqueCoordinatePaths: paths.size,
    uniqueTileMasks: masks.size,
    meanWordsPerPath: mean(Array.from(wordsByPath.values()).map(set => set.size)),
    meanWordsPerTileMask: mean(Array.from(wordsByMask.values()).map(set => set.size)),
    maxWordsPerTileMask: Math.max(0, ...Array.from(wordsByMask.values()).map(set => set.size)),
    pathLengths
  };
}

function scoreFirstMoves(puzzle, preparedMoves) {
  const { state, context } = createInitialScoringState(puzzle);
  return preparedMoves.map(move => {
    const applied = applyMove(state, move, context);
    return {
      ...cloneMove(move),
      tileMask: move.mask.toString(),
      rowBonus: applied.scoredMove.rowBonus,
      columnBonus: applied.scoredMove.columnBonus,
      immediateScore: applied.scoreDelta
    };
  });
}

function scoringMetrics(scoredMoves) {
  const immediateScores = scoredMoves.map(move => move.immediateScore);
  const countAtLeast = threshold => immediateScores.filter(score => score >= threshold).length;
  return {
    baseWordScores: summary(scoredMoves.map(move => move.baseScore)),
    hexalinkBonuses: summary(scoredMoves.map(move => move.hexalinkBonus)),
    rowBonuses: summary(scoredMoves.map(move => move.rowBonus)),
    columnBonuses: summary(scoredMoves.map(move => move.columnBonus)),
    immediateScores: {
      max: immediateScores.length ? Math.max(...immediateScores) : 0,
      mean: mean(immediateScores),
      median: median(immediateScores),
      p90: percentile(immediateScores, 90)
    },
    firstMoveScoreCounts: {
      gte10: countAtLeast(10),
      gte20: countAtLeast(20),
      gte30: countAtLeast(30),
      gte40: countAtLeast(40)
    }
  };
}

function topFirstMoves(scoredMoves, topN = DEFAULT_TOP_N) {
  const byMask = new Map();
  for (const move of scoredMoves) {
    const existing = byMask.get(move.tileMask);
    if (!existing || move.immediateScore > existing.immediateScore ||
      (move.immediateScore === existing.immediateScore && move.word.localeCompare(existing.word) < 0)) {
      byMask.set(move.tileMask, move);
    }
  }
  return Array.from(byMask.values())
    .sort((a, b) => b.immediateScore - a.immediateScore || a.word.localeCompare(b.word))
    .slice(0, topN)
    .map(move => ({
      word: move.word,
      consonantSkeleton: move.consonantSkeleton,
      path: move.path,
      tileMask: move.tileMask,
      baseScore: move.baseScore,
      hexalinkBonus: move.hexalinkBonus,
      rowBonus: move.rowBonus,
      columnBonus: move.columnBonus,
      immediateScore: move.immediateScore
    }));
}

function hexalinkMetrics(puzzle, wordIndex, answer) {
  const path = puzzle.hexarowcol;
  const rows = new Set(path.map(([row]) => row));
  const columns = new Set(path.map(([, col]) => col));
  let diagonalSteps = 0;
  let horizontalSteps = 0;
  let verticalSteps = 0;
  let directionChanges = 0;
  let previousDirection = null;

  for (let index = 1; index < path.length; index++) {
    const [prevRow, prevCol] = path[index - 1];
    const [row, col] = path[index];
    const dr = Math.sign(row - prevRow);
    const dc = Math.sign(col - prevCol);
    if (dr !== 0 && dc !== 0) diagonalSteps++;
    else if (dc !== 0) horizontalSteps++;
    else verticalSteps++;
    const direction = `${dr},${dc}`;
    if (previousDirection && previousDirection !== direction) directionChanges++;
    previousDirection = direction;
  }

  const entries = wordIndex.bySkeleton.get(puzzle.hexalink) || [];
  const tenLetterWords = entries.filter(entry => entry.word.length === 10).map(entry => entry.word).sort();
  return {
    hexalink: puzzle.hexalink,
    pathCoordinates: path.map(pair => pair.slice()),
    geometricSpan: {
      rowMin: Math.min(...path.map(([row]) => row)),
      rowMax: Math.max(...path.map(([row]) => row)),
      colMin: Math.min(...path.map(([, col]) => col)),
      colMax: Math.max(...path.map(([, col]) => col))
    },
    diagonalSteps,
    horizontalSteps,
    verticalSteps,
    directionChanges,
    rowsTouched: rows.size,
    columnsTouched: columns.size,
    vocabularyWordsSharingSkeleton: entries.length,
    intendedAnswerTenLetterStatus: tenLetterWords.length <= 1 ? 'only-10-letter-word' : 'one-of-several',
    competingTenLetterWords: tenLetterWords.filter(word => word !== String(answer || '').toLowerCase())
  };
}

function filteredFindGold(puzzle, wordIndex, options = {}) {
  const started = process.hrtime.bigint();
  const rawMoves = enumerateLegalMoves(puzzle, wordIndex)
    .filter(move => options.excludeHexalink ? !move.isHexalink : true);
  const { state: initialState, context, colCount, tileCount } = createInitialScoringState(puzzle);
  const prepared = prepareSolverMoves(rawMoves, colCount, tileCount).moves;
  const goldThreshold = options.goldThreshold || 100;
  const maxTurns = options.maxTurns || qjynnRules.MAX_TURNS;
  const maxStates = options.maxStates || 25000;
  const requireHexalink = Boolean(options.requireHexalink);
  const stats = { statesExplored: 0, statesPruned: 0, elapsedMs: 0, stateLimitReached: false };
  let certificate = null;

  function search(state, sequence, hexalinkUsed) {
    stats.statesExplored++;
    if (stats.statesExplored > maxStates) {
      stats.stateLimitReached = true;
      return false;
    }
    if (state.score >= goldThreshold && (!requireHexalink || hexalinkUsed)) {
      certificate = sequence;
      return true;
    }
    if (state.turnsUsed >= maxTurns) return false;

    for (const move of prepared) {
      if ((move.mask & state.usedMask) !== 0n) continue;
      const applied = applyMove(state, move, context);
      const nextState = {
        ...applied.state,
        score: state.score + applied.scoreDelta
      };
      if (search(nextState, [...sequence, applied.scoredMove], hexalinkUsed || move.isHexalink)) return true;
      if (stats.stateLimitReached) return false;
    }
    return false;
  }

  const reachable = search({ ...initialState, score: 0 }, [], false);
  stats.elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  return { goldReachable: reachable, goldCertificate: certificate, stats };
}

function goldCertificateMetrics(puzzle, solution) {
  const certificate = solution.goldCertificate || [];
  const replay = certificate.length ? replaySequence(puzzle, certificate) : { score: 0, turnsUsed: 0 };
  const hexalinkTurn = certificate.findIndex(move => move.isHexalink) + 1;
  return {
    goldScore: solution.maxScore || replay.score,
    turnsUsed: certificate.length,
    hexalinkUsed: hexalinkTurn > 0,
    hexalinkTurn: hexalinkTurn || null,
    wordGroups: {
      short2To3: certificate.filter(move => move.word.length <= 3).length,
      medium4To6: certificate.filter(move => move.word.length >= 4 && move.word.length <= 6).length,
      long7To10: certificate.filter(move => move.word.length >= 7).length
    },
    rowBonusesEarned: certificate.reduce((total, move) => total + move.rowBonus, 0),
    columnBonusesEarned: certificate.reduce((total, move) => total + move.columnBonus, 0),
    replayScore: replay.score,
    replayTurns: replay.turnsUsed,
    replaySucceeded: replay.score === (solution.maxScore || replay.score),
    sequence: certificate
  };
}

function tileOpportunityMetrics(rawMoves, rowCount, colCount) {
  const matrix = Array.from({ length: rowCount }, () => Array(colCount).fill(0));
  for (const move of rawMoves) {
    const seen = new Set(move.path.map(([row, col]) => `${row},${col}`));
    for (const key of seen) {
      const [row, col] = key.split(',').map(Number);
      matrix[row][col]++;
    }
  }
  const values = matrix.flat();
  return {
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
    mean: mean(values),
    median: median(values),
    matrix
  };
}

function rowColumnMetrics(rawMoves, colCount, goldCertificate = []) {
  const rowMoves = Array.from({ length: 8 }, () => ({ legalMovesTouching: 0, uniqueTileMasksTouching: new Set() }));
  const colMoves = Array.from({ length: 6 }, () => ({ legalMovesTouching: 0, uniqueTileMasksTouching: new Set() }));
  for (const move of rawMoves) {
    const rows = new Set(move.path.map(([row]) => row));
    const cols = new Set(move.path.map(([, col]) => col));
    const key = maskKey(move, colCount);
    for (const row of rows) {
      rowMoves[row].legalMovesTouching++;
      rowMoves[row].uniqueTileMasksTouching.add(key);
    }
    for (const col of cols) {
      colMoves[col].legalMovesTouching++;
      colMoves[col].uniqueTileMasksTouching.add(key);
    }
  }
  return {
    rows: rowMoves.map(row => ({
      legalMovesTouching: row.legalMovesTouching,
      uniqueTileMasksTouching: row.uniqueTileMasksTouching.size
    })),
    columns: colMoves.map(col => ({
      legalMovesTouching: col.legalMovesTouching,
      uniqueTileMasksTouching: col.uniqueTileMasksTouching.size
    })),
    completedByGoldCertificate: {
      rows: goldCertificate.flatMap((move, index) => move.rowBonus > 0 ? [{ turn: index + 1, points: move.rowBonus }] : []),
      columns: goldCertificate.flatMap((move, index) => move.columnBonus > 0 ? [{ turn: index + 1, points: move.columnBonus }] : [])
    }
  };
}

function firstMoveGoldAccessibility(puzzle, wordIndex, scoredMoves, options = {}) {
  const limit = options.goldViableFirstMoveLimit ?? DEFAULT_GOLD_FIRST_MOVE_LIMIT;
  const movesToEvaluate = scoredMoves.slice(0, limit === Infinity ? scoredMoves.length : limit);
  const started = process.hrtime.bigint();
  let viable = 0;
  let viableUsingHexalink = 0;
  const viableScores = [];

  for (const move of movesToEvaluate) {
    const tileStates = Array.from({ length: puzzle.grid.length }, (_, row) =>
      Array.from({ length: puzzle.grid[0].length }, (_, col) =>
        move.path.some(([r, c]) => r === row && c === col) ? 2 : 0));
    const remainingThreshold = Math.max(1, 100 - move.immediateScore);
    const result = solveBoard({
      ...puzzle,
      tileStates,
      maxTurns: qjynnRules.MAX_TURNS - 1,
      goldThreshold: remainingThreshold
    }, wordIndex, { mode: MODE_FIND_GOLD });
    if (result.goldReachable) {
      viable++;
      viableScores.push(move.immediateScore);
      if (move.isHexalink) viableUsingHexalink++;
    }
  }

  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  return {
    solverRelevantFirstMoveCount: scoredMoves.length,
    evaluatedFirstMoveCount: movesToEvaluate.length,
    exact: movesToEvaluate.length === scoredMoves.length,
    goldViableFirstMoveCount: viable,
    goldViableFirstMovePct: round(percentage(viable, movesToEvaluate.length)),
    scoreDistribution: {
      min: viableScores.length ? Math.min(...viableScores) : 0,
      max: viableScores.length ? Math.max(...viableScores) : 0,
      mean: mean(viableScores),
      median: median(viableScores)
    },
    goldViableUsingHexalink: viableUsingHexalink,
    goldViableWithoutHexalink: viable - viableUsingHexalink,
    elapsedMs
  };
}

function boundedGoldCertificates(puzzle, wordIndex, options = {}) {
  const requested = options.maxGoldCertificates ?? DEFAULT_MAX_GOLD_CERTIFICATES;
  const rawMoves = enumerateLegalMoves(puzzle, wordIndex);
  const { state: initialState, context, colCount, tileCount } = createInitialScoringState(puzzle);
  const prepared = prepareSolverMoves(rawMoves, colCount, tileCount).moves;
  const started = process.hrtime.bigint();
  const certificates = [];
  const seenSequences = new Set();
  let statesExplored = 0;
  let limitReached = false;

  function search(state, sequence) {
    statesExplored++;
    if (certificates.length >= requested) {
      limitReached = true;
      return;
    }
    if (state.score >= 100) {
      const key = sequence.map(move => pathMask(move.path, colCount).toString()).join('>');
      if (!seenSequences.has(key)) {
        seenSequences.add(key);
        certificates.push(sequence);
      }
      return;
    }
    if (state.turnsUsed >= qjynnRules.MAX_TURNS || statesExplored > 50000) {
      if (statesExplored > 50000) limitReached = true;
      return;
    }
    for (const move of prepared) {
      if ((move.mask & state.usedMask) !== 0n) continue;
      const applied = applyMove(state, move, context);
      search({
        ...applied.state,
        score: state.score + applied.scoreDelta
      }, [...sequence, applied.scoredMove]);
      if (limitReached) return;
    }
  }

  search({ ...initialState, score: 0 }, []);
  return {
    requested,
    found: certificates.length,
    searchLimitReached: limitReached,
    uniqueFirstMoves: new Set(certificates.map(sequence => sequence[0]?.resultingUsedMask).filter(Boolean)).size,
    uniqueHexalinkUsePatterns: new Set(certificates.map(sequence => sequence.map(move => move.isHexalink ? 'H' : '-').join(''))).size,
    elapsedMs: Number(process.hrtime.bigint() - started) / 1e6
  };
}

function familiarityMetrics(rawMoves, provider) {
  if (typeof provider !== 'function') return { familiarityMetricsAvailable: false };
  const uniqueWords = Array.from(new Set(rawMoves.map(move => move.word)));
  const scores = uniqueWords.map(word => provider(word)).filter(value => typeof value === 'number' && Number.isFinite(value));
  return {
    familiarityMetricsAvailable: true,
    scoredWordCount: scores.length,
    mean: mean(scores),
    median: median(scores)
  };
}

function analyzePuzzle(input, wordIndex, options = {}) {
  const started = process.hrtime.bigint();
  const puzzle = input.puzzle;
  const privateCertification = input.privateCertification || {};
  const validation = validatePuzzle(puzzle, { answer: privateCertification.answer, wordIndex });
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const moveContext = legalMoveContext(puzzle, wordIndex);
  const scoredMoves = scoreFirstMoves(puzzle, moveContext.prepared.moves);
  const normalStarted = process.hrtime.bigint();
  const normalGold = solveBoard({ ...puzzle, maxTurns: qjynnRules.MAX_TURNS, goldThreshold: 100 }, wordIndex, { mode: MODE_FIND_GOLD });
  const normalGoldMs = Number(process.hrtime.bigint() - normalStarted) / 1e6;
  const noHex = filteredFindGold(puzzle, wordIndex, { excludeHexalink: true, maxStates: options.hexalinkAnalysisMaxStates });
  const requireHex = options.requireHexalinkAnalysis === false
    ? { skipped: true }
    : filteredFindGold(puzzle, wordIndex, { requireHexalink: true, maxStates: options.hexalinkAnalysisMaxStates });
  const certificateMetrics = goldCertificateMetrics(puzzle, normalGold);
  const firstMoveMetrics = firstMoveGoldAccessibility(puzzle, wordIndex, scoredMoves, options);
  const multiRoute = boundedGoldCertificates(puzzle, wordIndex, options);
  const totalAnalyzerMs = Number(process.hrtime.bigint() - started) / 1e6;

  return {
    ok: true,
    puzzleId: puzzle.date || null,
    answer: privateCertification.answer || null,
    hexalink: puzzle.hexalink,
    reproducibility: {
      generatorVersion: privateCertification.generatorVersion || null,
      rulesVersion: privateCertification.rulesVersion || 'qjynn-rules-local',
      vocabularyVersion: privateCertification.vocabularyVersion || '1.0',
      analyzerVersion: ANALYZER_VERSION,
      seed: privateCertification.seed ?? null
    },
    initialMoves: {
      rawLegalWordPathMoves: moveContext.rawMoves.length,
      uniqueWords: new Set(moveContext.rawMoves.map(move => move.word)).size,
      uniqueConsonantSkeletons: new Set(moveContext.rawMoves.map(move => move.consonantSkeleton)).size,
      uniquePaths: new Set(moveContext.rawMoves.map(move => pathKey(move.path))).size,
      uniqueTileMasks: new Set(moveContext.rawMoves.map(move => maskKey(move, moveContext.colCount))).size,
      solverRelevantMoves: moveContext.prepared.stats.solverRelevantMoveCount,
      deduplicatedMoves: moveContext.prepared.stats.solverRelevantMoveCount
    },
    vocabulary: vocabularyMetrics(moveContext.rawMoves),
    paths: pathMetrics(moveContext.rawMoves, moveContext.colCount),
    scoring: scoringMetrics(scoredMoves),
    topFirstMoves: topFirstMoves(scoredMoves, options.topN || DEFAULT_TOP_N),
    hexalinkMetrics: hexalinkMetrics(puzzle, wordIndex, privateCertification.answer),
    gold: {
      goldReachableNormally: normalGold.goldReachable,
      goldReachableWithoutHexalink: noHex.goldReachable,
      goldReachableWithHexalinkRequired: requireHex.skipped ? null : requireHex.goldReachable,
      withoutHexalinkStateLimitReached: Boolean(noHex.stats?.stateLimitReached),
      withHexalinkRequiredStateLimitReached: Boolean(requireHex.stats?.stateLimitReached),
      certificate: certificateMetrics
    },
    strategy: {
      firstMoveGoldAccessibility: firstMoveMetrics,
      boundedMultipleGoldRoutes: multiRoute
    },
    coverage: {
      tiles: tileOpportunityMetrics(moveContext.rawMoves, puzzle.grid.length, puzzle.grid[0].length),
      rowColumn: rowColumnMetrics(moveContext.rawMoves, moveContext.colCount, normalGold.goldCertificate || [])
    },
    familiarity: familiarityMetrics(moveContext.rawMoves, options.wordFamiliarity),
    solver: {
      normalGoldStats: normalGold.stats,
      noHexalinkGoldStats: noHex.stats,
      withHexalinkRequiredStats: requireHex.stats || null,
      solverCalls: 1 + 1 + (requireHex.skipped ? 0 : 1) + firstMoveMetrics.evaluatedFirstMoveCount
    },
    performance: {
      m4EnumerationMs: moveContext.enumerationMs,
      m5NormalGoldMs: normalGoldMs,
      m5NoHexalinkGoldMs: noHex.stats.elapsedMs,
      goldFirstMoveAnalysisMs: firstMoveMetrics.elapsedMs,
      boundedMultiRouteAnalysisMs: multiRoute.elapsedMs,
      totalAnalyzerMs
    }
  };
}

module.exports = {
  ANALYZER_VERSION,
  analyzePuzzle,
  legalMoveContext,
  vocabularyMetrics,
  pathMetrics,
  scoreFirstMoves,
  scoringMetrics,
  topFirstMoves,
  hexalinkMetrics,
  filteredFindGold,
  firstMoveGoldAccessibility,
  boundedGoldCertificates,
  familiarityMetrics
};
