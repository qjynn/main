#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const qjynnRules = require('../../qjynn-rules.js');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generatePuzzle } = require('../generator/grid-generator.js');
const { validatePuzzle } = require('../generator/puzzle-validator.js');
const { solveBoard, replaySequence, MODE_FIND_GOLD } = require('../solver/state-search.js');
const { legalMoveContext, scoreFirstMoves } = require('../analyzer/puzzle-analyzer.js');
const { summary, mean, median, round } = require('../analyzer/metrics-utils.js');
const { toCsv } = require('../analyzer/batch-analyzer.js');

const CANONICAL_GOLD_THRESHOLD = 100;
const THRESHOLD_PROBES = Object.freeze([100, 110, 120, 130, 140, 150, 160, 170, 180, 200]);
const HEADROOM_SCENARIOS = Object.freeze([
  { name: 'CANONICAL', goldThreshold: 100, scoringPolicy: {} },
  { name: 'GOLD_110', goldThreshold: 110, scoringPolicy: {} },
  { name: 'GOLD_120', goldThreshold: 120, scoringPolicy: {} },
  { name: 'GOLD_130', goldThreshold: 130, scoringPolicy: {} },
  { name: 'REDUCED_LINES', goldThreshold: 100, scoringPolicy: { rowBonus: 5, columnBonus: 10 } },
  { name: 'REDUCED_LINES_GOLD_120', goldThreshold: 120, scoringPolicy: { rowBonus: 5, columnBonus: 10 } },
  { name: 'HEXALINK_REQUIRED', goldThreshold: 100, scoringPolicy: {}, requireHexalink: true },
  { name: 'HEXALINK_REQUIRED_GOLD_120', goldThreshold: 120, scoringPolicy: {}, requireHexalink: true }
]);

const DEFAULT_DATASET = Object.freeze([
  ['WATERMELON', 'Large summer striped fruit', 810001],
  ['OSCILLATED', 'Moved back and forth', 810002],
  ['ABANDONING', 'Leaving behind', 810003],
  ['ABSOLUTELY', 'Without qualification', 810004],
  ['ACCESSIBLE', 'Able to be reached', 810005],
  ['ACCOUNTING', 'Keeping financial records', 810006],
  ['ADVENTURES', 'Exciting undertakings', 810007],
  ['AGGRAVATED', 'Made worse', 810008],
  ['AFTERTASTE', 'Lingering flavor', 810009],
  ['AFFORDABLE', 'Reasonably priced', 810010]
]);

function elapsedMsSince(started) {
  return Number(process.hrtime.bigint() - started) / 1e6;
}

function timeoutResult(threshold, elapsedMs, status = 'timeout') {
  return {
    threshold,
    exact: false,
    status,
    goldReachable: null,
    minimumGoldTurns: null,
    solverElapsedMs: elapsedMs,
    statesExplored: null,
    statesPruned: null,
    memoHits: null,
    certificate: null
  };
}

function solveGoldProbe(puzzle, wordIndex, options = {}) {
  const threshold = options.goldThreshold ?? CANONICAL_GOLD_THRESHOLD;
  const started = process.hrtime.bigint();
  const moveFilter = options.excludeHexalink ? move => !move.isHexalink : null;
  const certificateConstraint = options.requireHexalink
    ? sequence => sequence.some(move => move.isHexalink)
    : null;
  const result = solveBoard({
    ...puzzle,
    maxTurns: qjynnRules.MAX_TURNS,
    goldThreshold: threshold,
    scoringPolicy: options.scoringPolicy || {},
    timeoutMs: options.timeoutMs
  }, wordIndex, {
    mode: MODE_FIND_GOLD,
    scoringPolicy: options.scoringPolicy || {},
    moveFilter,
    certificateConstraint,
    timeoutMs: options.timeoutMs
  });
  const elapsedMs = elapsedMsSince(started);
  if (result.stats?.timedOut) return timeoutResult(threshold, elapsedMs);
  if (options.timeoutMs !== undefined && elapsedMs >= options.timeoutMs) return timeoutResult(threshold, elapsedMs);
  return {
    threshold,
    exact: true,
    status: result.goldReachable ? 'reachable' : 'unreachable',
    goldReachable: result.goldReachable,
    minimumGoldTurns: result.goldReachable ? result.turnsUsed : null,
    solverElapsedMs: elapsedMs,
    statesExplored: result.stats?.statesExplored ?? null,
    statesPruned: result.stats?.statesPruned ?? null,
    memoHits: result.stats?.memoHits ?? null,
    certificate: result.goldCertificate || null,
    result
  };
}

function thresholdProbeOrdering(thresholds = THRESHOLD_PROBES) {
  return thresholds.slice().sort((a, b) => a - b);
}

function probeThresholds(puzzle, wordIndex, options = {}) {
  const thresholds = thresholdProbeOrdering(options.thresholds || THRESHOLD_PROBES);
  const probes = [];
  let consecutiveUnreachable = 0;
  for (const threshold of thresholds) {
    if (consecutiveUnreachable >= 2) break;
    const probe = solveGoldProbe(puzzle, wordIndex, {
      goldThreshold: threshold,
      timeoutMs: options.timeoutMs
    });
    probes.push(probe);
    if (probe.exact && probe.goldReachable === false) consecutiveUnreachable++;
    else if (probe.exact && probe.goldReachable === true) consecutiveUnreachable = 0;
  }
  return probes;
}

function thresholdSummary(probes, canonicalThreshold = CANONICAL_GOLD_THRESHOLD) {
  const exact = probes.filter(probe => probe.exact);
  const reachable = exact.filter(probe => probe.goldReachable);
  const unreachable = exact.filter(probe => probe.goldReachable === false);
  const highest = reachable.length ? Math.max(...reachable.map(probe => probe.threshold)) : null;
  const firstUnreachableAboveHighest = highest === null
    ? (unreachable.length ? Math.min(...unreachable.map(probe => probe.threshold)) : null)
    : (unreachable.filter(probe => probe.threshold > highest).map(probe => probe.threshold).sort((a, b) => a - b)[0] ?? null);
  return {
    highestProvenReachableThreshold: highest,
    firstProvenUnreachableThreshold: firstUnreachableAboveHighest,
    goldHeadroom: highest === null ? null : highest - canonicalThreshold,
    unresolvedThresholds: probes.filter(probe => !probe.exact).map(probe => probe.threshold)
  };
}

function headroomBand(headroom) {
  if (headroom === null || headroom === undefined) return 'unresolved';
  if (headroom <= 10) return '0-10';
  if (headroom <= 30) return '20-30';
  if (headroom <= 50) return '40-50';
  return '60+';
}

function certificateScoreComposition(certificate = []) {
  return {
    baseWordPoints: certificate.reduce((sum, move) => sum + (move.baseScore || 0), 0),
    hexalinkBonus: certificate.reduce((sum, move) => sum + (move.hexalinkBonus || 0), 0),
    rowBonuses: certificate.reduce((sum, move) => sum + (move.rowBonus || 0), 0),
    columnBonuses: certificate.reduce((sum, move) => sum + (move.columnBonus || 0), 0),
    total: certificate.length ? certificate.at(-1).cumulativeScore : 0
  };
}

function certificateCharacteristics(certificate = []) {
  const hexalinkIndex = certificate.findIndex(move => move.isHexalink);
  const tileKeys = new Set();
  for (const move of certificate) {
    for (const [row, col] of move.path || []) tileKeys.add(`${row},${col}`);
  }
  return {
    turnsUsed: certificate.length,
    wordLengths: certificate.map(move => move.word.length),
    hexalinkUsed: hexalinkIndex >= 0,
    hexalinkTurn: hexalinkIndex >= 0 ? hexalinkIndex + 1 : null,
    rowsCompleted: certificate.filter(move => (move.rowBonus || 0) > 0).length,
    columnsCompleted: certificate.filter(move => (move.columnBonus || 0) > 0).length,
    uniqueConsonantTilesConsumed: tileKeys.size
  };
}

function nrtlsAdjacencyCount(grid) {
  const common = new Set(['N', 'R', 'T', 'L', 'S']);
  let count = 0;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (!common.has(String(grid[row][col]).toUpperCase())) continue;
      for (const [dr, dc] of [[0, 1], [1, -1], [1, 0], [1, 1]]) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow >= 0 && nextRow < grid.length && nextCol >= 0 && nextCol < grid[row].length &&
          common.has(String(grid[nextRow][nextCol]).toUpperCase())) {
          count++;
        }
      }
    }
  }
  return count;
}

function moveSpaceMetrics(puzzle, wordIndex) {
  const context = legalMoveContext(puzzle, wordIndex);
  const scored = scoreFirstMoves(puzzle, context.prepared.moves);
  const tileParticipation = Array.from({ length: puzzle.grid.length }, () => Array(puzzle.grid[0].length).fill(0));
  for (const move of context.rawMoves) {
    for (const [row, col] of move.path) tileParticipation[row][col]++;
  }
  const participationValues = tileParticipation.flat();
  const uniqueWords = new Set(context.rawMoves.map(move => move.word)).size;
  const shortWords = new Set(context.rawMoves.filter(move => move.word.length <= 3).map(move => move.word)).size;
  return {
    rawMoves: context.rawMoves.length,
    solverRelevantMoves: context.prepared.stats.solverRelevantMoveCount,
    uniquePlayableWords: uniqueWords,
    uniqueTileMasks: context.prepared.stats.uniqueTileMasks,
    highValueFirstMoves: scored.filter(move => move.immediateScore >= 30).length,
    shortWordFraction: uniqueWords ? shortWords / uniqueWords : 0,
    tileParticipationSpread: Math.max(...participationValues) - Math.min(...participationValues),
    hexalinkMoveParticipation: context.rawMoves.filter(move => move.isHexalink).length,
    nrtlsAdjacencyCount: nrtlsAdjacencyCount(puzzle.grid),
    enumerationMs: context.enumerationMs
  };
}

function analyzeScenarioSet(puzzle, wordIndex, options = {}) {
  return HEADROOM_SCENARIOS.map(scenario => {
    const normal = solveGoldProbe(puzzle, wordIndex, {
      goldThreshold: scenario.goldThreshold,
      scoringPolicy: scenario.scoringPolicy,
      requireHexalink: scenario.requireHexalink,
      timeoutMs: options.timeoutMs
    });
    const withoutHex = solveGoldProbe(puzzle, wordIndex, {
      goldThreshold: scenario.goldThreshold,
      scoringPolicy: scenario.scoringPolicy,
      excludeHexalink: true,
      timeoutMs: options.timeoutMs
    });
    const withHexRequired = solveGoldProbe(puzzle, wordIndex, {
      goldThreshold: scenario.goldThreshold,
      scoringPolicy: scenario.scoringPolicy,
      requireHexalink: true,
      timeoutMs: options.timeoutMs
    });
    return {
      scenario: scenario.name,
      goldThreshold: scenario.goldThreshold,
      exact: normal.exact,
      status: normal.status,
      goldReachable: normal.goldReachable,
      minimumGoldTurns: normal.minimumGoldTurns,
      goldReachableWithoutHexalink: withoutHex.goldReachable,
      goldReachableWithHexalinkRequired: withHexRequired.goldReachable,
      solverElapsedMs: normal.solverElapsedMs,
      statesExplored: normal.statesExplored,
      statesPruned: normal.statesPruned,
      memoHits: normal.memoHits,
      certificate: normal.certificate
    };
  });
}

function analyzeProductionPuzzle(record, wordIndex, options = {}) {
  const started = process.hrtime.bigint();
  const puzzle = record.puzzle;
  const validation = validatePuzzle(puzzle, { answer: record.answer, wordIndex });
  if (!validation.ok) return { ok: false, record, errors: validation.errors };

  const thresholdProbes = probeThresholds(puzzle, wordIndex, options);
  const threshold = thresholdSummary(thresholdProbes);
  const scenarioResults = analyzeScenarioSet(puzzle, wordIndex, options);
  const scenarioByName = new Map(scenarioResults.map(result => [result.scenario, result]));
  const metrics = moveSpaceMetrics(puzzle, wordIndex);
  const canonical = scenarioByName.get('CANONICAL');
  const highestProbe = threshold.highestProvenReachableThreshold === null
    ? null
    : thresholdProbes.find(probe => probe.threshold === threshold.highestProvenReachableThreshold && probe.goldReachable);
  const canonicalCertificate = canonical?.certificate || [];
  const highestCertificate = highestProbe?.certificate || [];
  if (canonicalCertificate.length) {
    const replay = replaySequence(puzzle, canonicalCertificate);
    if (replay.score !== canonicalCertificate.at(-1).cumulativeScore) {
      return { ok: false, record, errors: [{ code: 'certificate.replay', message: 'Canonical certificate replay failed.' }] };
    }
  }

  const lineDelta100 = scenarioByName.get('REDUCED_LINES')?.minimumGoldTurns !== null && canonical?.minimumGoldTurns !== null
    ? scenarioByName.get('REDUCED_LINES').minimumGoldTurns - canonical.minimumGoldTurns
    : null;
  const hexDelta100 = scenarioByName.get('HEXALINK_REQUIRED')?.minimumGoldTurns !== null && canonical?.minimumGoldTurns !== null
    ? scenarioByName.get('HEXALINK_REQUIRED').minimumGoldTurns - canonical.minimumGoldTurns
    : null;
  const gold120 = scenarioByName.get('GOLD_120');
  const hex120 = scenarioByName.get('HEXALINK_REQUIRED_GOLD_120');

  return {
    ok: true,
    answer: record.answer,
    seed: record.seed,
    strategy: record.strategy || 'M6_BASELINE',
    puzzle,
    validation: { ok: true },
    thresholdProbes,
    scenarioResults,
    headroom: {
      ...threshold,
      headroomBand: headroomBand(threshold.goldHeadroom)
    },
    canonicalCertificate: {
      scoreComposition: certificateScoreComposition(canonicalCertificate),
      characteristics: certificateCharacteristics(canonicalCertificate)
    },
    highestThresholdCertificate: {
      threshold: threshold.highestProvenReachableThreshold,
      scoreComposition: certificateScoreComposition(highestCertificate),
      characteristics: certificateCharacteristics(highestCertificate)
    },
    derived: {
      canonicalGoldReachable: canonical?.goldReachable ?? null,
      canonicalMinTurns: canonical?.minimumGoldTurns ?? null,
      goldWithoutHexalink100: canonical?.goldReachableWithoutHexalink ?? null,
      gold120Reachable: gold120?.goldReachable ?? null,
      goldWithoutHexalink120: gold120?.goldReachableWithoutHexalink ?? null,
      gold130Reachable: scenarioByName.get('GOLD_130')?.goldReachable ?? null,
      reducedLinesGold100: scenarioByName.get('REDUCED_LINES')?.goldReachable ?? null,
      reducedLinesGold120: scenarioByName.get('REDUCED_LINES_GOLD_120')?.goldReachable ?? null,
      hexalinkRequiredGold100: scenarioByName.get('HEXALINK_REQUIRED')?.goldReachable ?? null,
      hexalinkRequiredGold120: hex120?.goldReachable ?? null,
      hexalinkRequirementTurnDeltaAt100: hexDelta100,
      hexalinkRequirementTurnDeltaAt120: hex120?.minimumGoldTurns !== null && gold120?.minimumGoldTurns !== null
        ? hex120.minimumGoldTurns - gold120.minimumGoldTurns
        : null,
      lineBonusChangesReachability: canonical?.goldReachable !== scenarioByName.get('REDUCED_LINES')?.goldReachable ||
        gold120?.goldReachable !== scenarioByName.get('REDUCED_LINES_GOLD_120')?.goldReachable,
      lineBonusMinimumTurnDelta: lineDelta100
    },
    moveSpaceMetrics: metrics,
    analysisMs: elapsedMsSince(started)
  };
}

function scalarProductionRow(result) {
  return {
    answer: result.answer,
    seed: result.seed,
    strategy: result.strategy,
    canonicalGoldReachable: result.derived.canonicalGoldReachable,
    canonicalMinTurns: result.derived.canonicalMinTurns ?? '',
    goldWithoutHexalink100: result.derived.goldWithoutHexalink100,
    gold120Reachable: result.derived.gold120Reachable,
    goldWithoutHexalink120: result.derived.goldWithoutHexalink120,
    gold130Reachable: result.derived.gold130Reachable,
    highestProvenReachableThreshold: result.headroom.highestProvenReachableThreshold ?? '',
    firstProvenUnreachableThreshold: result.headroom.firstProvenUnreachableThreshold ?? '',
    goldHeadroom: result.headroom.goldHeadroom ?? '',
    headroomBand: result.headroom.headroomBand,
    reducedLinesGold100: result.derived.reducedLinesGold100,
    reducedLinesGold120: result.derived.reducedLinesGold120,
    hexalinkRequiredGold100: result.derived.hexalinkRequiredGold100,
    hexalinkRequiredGold120: result.derived.hexalinkRequiredGold120,
    canonicalCertificateBasePoints: result.canonicalCertificate.scoreComposition.baseWordPoints,
    canonicalCertificateLineBonus: result.canonicalCertificate.scoreComposition.rowBonuses + result.canonicalCertificate.scoreComposition.columnBonuses,
    canonicalCertificateHexalinkBonus: result.canonicalCertificate.scoreComposition.hexalinkBonus,
    uniquePlayableWords: result.moveSpaceMetrics.uniquePlayableWords,
    uniqueTileMasks: result.moveSpaceMetrics.uniqueTileMasks,
    highValueFirstMoves: result.moveSpaceMetrics.highValueFirstMoves,
    shortWordFraction: round(result.moveSpaceMetrics.shortWordFraction),
    tileParticipationSpread: result.moveSpaceMetrics.tileParticipationSpread,
    nrtlsAdjacencyCount: result.moveSpaceMetrics.nrtlsAdjacencyCount,
    analysisMs: round(result.analysisMs)
  };
}

function thresholdProbeRows(results) {
  return results.flatMap(result => result.thresholdProbes.map(probe => ({
    answer: result.answer,
    seed: result.seed,
    strategy: result.strategy,
    threshold: probe.threshold,
    exact: probe.exact,
    status: probe.status,
    goldReachable: probe.goldReachable,
    minimumGoldTurns: probe.minimumGoldTurns ?? '',
    solverElapsedMs: round(probe.solverElapsedMs),
    statesExplored: probe.statesExplored ?? '',
    statesPruned: probe.statesPruned ?? '',
    memoHits: probe.memoHits ?? ''
  })));
}

function aggregateScenarioSummary(results) {
  const rows = [];
  for (const scenario of HEADROOM_SCENARIOS.map(item => item.name)) {
    const items = results.map(result => result.scenarioResults.find(row => row.scenario === scenario)).filter(Boolean);
    const exact = items.filter(item => item.exact);
    rows.push({
      scenario,
      exactPuzzles: exact.length,
      goldCapablePct: exact.length ? exact.filter(item => item.goldReachable).length / exact.length * 100 : null,
      medianMinTurns: median(exact.map(item => item.minimumGoldTurns).filter(value => Number.isFinite(value))),
      medianSolverTime: median(exact.map(item => item.solverElapsedMs).filter(value => Number.isFinite(value)))
    });
  }
  return rows;
}

function pearson(xs, ys) {
  const pairs = xs.map((x, index) => [x, ys[index]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 2) return null;
  const xMean = mean(pairs.map(([x]) => x));
  const yMean = mean(pairs.map(([, y]) => y));
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - xMean) * (y - yMean), 0);
  const xDen = Math.sqrt(pairs.reduce((sum, [x]) => sum + (x - xMean) ** 2, 0));
  const yDen = Math.sqrt(pairs.reduce((sum, [, y]) => sum + (y - yMean) ** 2, 0));
  return xDen && yDen ? numerator / (xDen * yDen) : null;
}

function findCounterexamples(results) {
  const byHeadroom = results.filter(result => Number.isFinite(result.headroom.goldHeadroom));
  const similarMaskDifferentHeadroom = (() => {
    for (let i = 0; i < byHeadroom.length; i++) {
      for (let j = i + 1; j < byHeadroom.length; j++) {
        const a = byHeadroom[i];
        const b = byHeadroom[j];
        if (Math.abs(a.moveSpaceMetrics.uniqueTileMasks - b.moveSpaceMetrics.uniqueTileMasks) <= 100 &&
          Math.abs(a.headroom.goldHeadroom - b.headroom.goldHeadroom) >= 20) {
          return [a.answer, b.answer];
        }
      }
    }
    return null;
  })();
  const similarHeadroomDifferentMetrics = (() => {
    for (let i = 0; i < byHeadroom.length; i++) {
      for (let j = i + 1; j < byHeadroom.length; j++) {
        const a = byHeadroom[i];
        const b = byHeadroom[j];
        if (Math.abs(a.headroom.goldHeadroom - b.headroom.goldHeadroom) <= 10 &&
          Math.abs(a.moveSpaceMetrics.uniqueTileMasks - b.moveSpaceMetrics.uniqueTileMasks) >= 500) {
          return [a.answer, b.answer];
        }
      }
    }
    return null;
  })();
  return {
    lowHeadroomAtMost10: byHeadroom.find(result => result.headroom.goldHeadroom <= 10)?.answer || null,
    highHeadroomAtLeast50: byHeadroom.find(result => result.headroom.goldHeadroom >= 50)?.answer || null,
    gold100WithoutHexButNot120WithoutHex: results.find(result => result.derived.goldWithoutHexalink100 && result.derived.goldWithoutHexalink120 === false)?.answer || null,
    gold100RequiresHexalink: results.find(result => result.derived.goldWithoutHexalink100 === false && result.derived.canonicalGoldReachable)?.answer || null,
    reducedLinesMakeCanonicalGoldImpossible: results.find(result => result.derived.canonicalGoldReachable && result.derived.reducedLinesGold100 === false)?.answer || null,
    reducedLinesPreserveGoldButIncreaseTurns: results.find(result => result.derived.reducedLinesGold100 && result.derived.lineBonusMinimumTurnDelta > 0)?.answer || null,
    similarMaskCountsDifferentHeadroom: similarMaskDifferentHeadroom,
    similarHeadroomDifferentMoveSpaceMetrics: similarHeadroomDifferentMetrics
  };
}

function aggregateProductionResults(results) {
  const exactHeadroom = results.filter(result => Number.isFinite(result.headroom.goldHeadroom));
  const headrooms = exactHeadroom.map(result => result.headroom.goldHeadroom);
  const thresholds = exactHeadroom.map(result => result.headroom.highestProvenReachableThreshold);
  const minTurns = results.map(result => result.derived.canonicalMinTurns).filter(value => Number.isFinite(value));
  const scenarioSummary = aggregateScenarioSummary(results);
  const pct = (count, total) => total ? count / total * 100 : null;
  const exactCanonical = results.filter(result => result.scenarioResults.find(row => row.scenario === 'CANONICAL')?.exact);
  const exactGold120 = results.filter(result => result.scenarioResults.find(row => row.scenario === 'GOLD_120')?.exact);
  const correlations = {
    uniqueTileMasksVsGoldHeadroom: pearson(results.map(result => result.moveSpaceMetrics.uniqueTileMasks), results.map(result => result.headroom.goldHeadroom)),
    highValueFirstMovesVsGoldHeadroom: pearson(results.map(result => result.moveSpaceMetrics.highValueFirstMoves), results.map(result => result.headroom.goldHeadroom)),
    tileParticipationSpreadVsGoldHeadroom: pearson(results.map(result => result.moveSpaceMetrics.tileParticipationSpread), results.map(result => result.headroom.goldHeadroom))
  };
  return {
    datasetSize: results.length,
    headroomDistribution: {
      highestProvenReachableThreshold: summary(thresholds),
      goldHeadroom: { ...summary(headrooms), standardDeviation: standardDeviation(headrooms) },
      canonicalMinimumGoldTurns: summary(minTurns)
    },
    scenarioSummary,
    hexalinkImportance: {
      gold100WithoutHexalinkPct: pct(exactCanonical.filter(result => result.derived.goldWithoutHexalink100).length, exactCanonical.length),
      gold120WithoutHexalinkPct: pct(exactGold120.filter(result => result.derived.goldWithoutHexalink120).length, exactGold120.length),
      gold100WithHexalinkRequiredPct: pct(exactCanonical.filter(result => result.derived.hexalinkRequiredGold100).length, exactCanonical.length),
      gold120WithHexalinkRequiredPct: pct(exactGold120.filter(result => result.derived.hexalinkRequiredGold120).length, exactGold120.length),
      medianHexalinkTurnDeltaAt100: median(results.map(result => result.derived.hexalinkRequirementTurnDeltaAt100).filter(value => Number.isFinite(value))),
      medianHexalinkTurnDeltaAt120: median(results.map(result => result.derived.hexalinkRequirementTurnDeltaAt120).filter(value => Number.isFinite(value)))
    },
    lineBonus: {
      canonical100: scenarioSummary.find(row => row.scenario === 'CANONICAL'),
      reduced100: scenarioSummary.find(row => row.scenario === 'REDUCED_LINES'),
      canonical120: scenarioSummary.find(row => row.scenario === 'GOLD_120'),
      reduced120: scenarioSummary.find(row => row.scenario === 'REDUCED_LINES_GOLD_120')
    },
    correlations,
    counterexamples: findCounterexamples(results)
  };
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map(value => (value - avg) ** 2)));
}

function generateProductionDataset(wordIndex, options = {}) {
  const records = options.records || DEFAULT_DATASET.map(([answer, clue, seed], index) => ({
    answer,
    clue,
    seed,
    date: `2027-01-${String(index + 1).padStart(2, '0')}`,
    strategy: 'M6_BASELINE'
  }));
  const count = Math.min(records.length, options.count || records.length);
  const generated = [];
  const failures = [];
  for (let index = 0; index < count; index++) {
    const record = records[index];
    const result = record.puzzle ? { ok: true, puzzle: record.puzzle, privateCertification: record.privateCertification || record } :
      generatePuzzle({ ...record, maxAttempts: options.maxAttempts || 20 }, wordIndex);
    if (!result.ok) {
      failures.push({ record, failure: result.failure });
      continue;
    }
    generated.push({
      answer: record.answer,
      seed: record.seed,
      strategy: record.strategy || 'M6_BASELINE',
      puzzle: result.puzzle,
      privateCertification: result.privateCertification
    });
  }
  return { records: generated, failures };
}

function runProductionHeadroom(records, wordIndex, options = {}) {
  const results = [];
  const failures = [];
  for (const record of records) {
    const analysis = analyzeProductionPuzzle(record, wordIndex, options);
    if (analysis.ok) results.push(analysis);
    else failures.push(analysis);
  }
  return {
    results,
    failures,
    aggregate: aggregateProductionResults(results)
  };
}

function writeProductionHeadroomOutputs(result, baseDir = 'analysis') {
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(path.join(baseDir, 'm7a3-production-grids.json'), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(baseDir, 'm7a3-production-grids.csv'), toCsv(result.results.map(scalarProductionRow)));
  fs.writeFileSync(path.join(baseDir, 'm7a3-threshold-probes.csv'), toCsv(thresholdProbeRows(result.results)));
  fs.writeFileSync(path.join(baseDir, 'm7a3-scenario-summary.json'), `${JSON.stringify(result.aggregate, null, 2)}\n`);
  fs.writeFileSync(path.join(baseDir, 'm7a3-counterexamples.json'), `${JSON.stringify(result.aggregate.counterexamples, null, 2)}\n`);
}

function loadDefaultWordIndex() {
  return buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
}

function main() {
  const wordIndex = loadDefaultWordIndex();
  const dataset = generateProductionDataset(wordIndex, { count: Number(process.env.M7A3_COUNT || 10) });
  const result = runProductionHeadroom(dataset.records, wordIndex, {
    timeoutMs: process.env.M7A3_TIMEOUT_MS ? Number(process.env.M7A3_TIMEOUT_MS) : undefined
  });
  result.generationFailures = dataset.failures;
  writeProductionHeadroomOutputs(result);
  console.log(`Analyzed ${result.results.length} production grids`);
  console.log(`Failures ${result.failures.length + dataset.failures.length}`);
}

if (require.main === module) main();

module.exports = {
  CANONICAL_GOLD_THRESHOLD,
  THRESHOLD_PROBES,
  HEADROOM_SCENARIOS,
  DEFAULT_DATASET,
  solveGoldProbe,
  thresholdProbeOrdering,
  probeThresholds,
  thresholdSummary,
  headroomBand,
  certificateScoreComposition,
  certificateCharacteristics,
  nrtlsAdjacencyCount,
  moveSpaceMetrics,
  analyzeScenarioSet,
  analyzeProductionPuzzle,
  scalarProductionRow,
  thresholdProbeRows,
  aggregateScenarioSummary,
  pearson,
  findCounterexamples,
  aggregateProductionResults,
  generateProductionDataset,
  runProductionHeadroom,
  writeProductionHeadroomOutputs,
  standardDeviation
};
