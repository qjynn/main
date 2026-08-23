const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const qjynnRules = require('../qjynn-rules.js');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const { generatePuzzle } = require('../tools/generator/grid-generator.js');
const { solveBoard } = require('../tools/solver/state-search.js');
const {
  HEADROOM_SCENARIOS,
  solveGoldProbe,
  thresholdProbeOrdering,
  thresholdSummary,
  certificateScoreComposition,
  aggregateProductionResults,
  analyzeProductionPuzzle,
  runProductionHeadroom
} = require('../tools/experiments/production-headroom.js');

let fullIndex;
let generated;

function getFullIndex() {
  if (!fullIndex) fullIndex = buildVocabularyIndex(parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8')));
  return fullIndex;
}

function getGenerated() {
  if (!generated) {
    generated = generatePuzzle({
      answer: 'WATERMELON',
      clue: 'Large fruit',
      date: '2027-02-01',
      seed: 820001,
      maxAttempts: 5
    }, getFullIndex());
  }
  assert.equal(generated.ok, true);
  return generated;
}

test('M7A.3 ingests a production-size 8x6 puzzle', () => {
  const result = getGenerated();
  const analysis = analyzeProductionPuzzle({
    answer: 'WATERMELON',
    seed: 820001,
    strategy: 'M6_BASELINE',
    puzzle: result.puzzle
  }, getFullIndex(), { thresholds: [100] });
  assert.equal(analysis.ok, true);
  assert.equal(analysis.puzzle.grid.length, 8);
  assert.equal(analysis.puzzle.grid[0].length, 6);
});

test('M7A.3 Gold headroom calculation uses highest proven threshold', () => {
  const summary = thresholdSummary([
    { threshold: 100, exact: true, goldReachable: true },
    { threshold: 110, exact: true, goldReachable: true },
    { threshold: 120, exact: true, goldReachable: false }
  ]);
  assert.equal(summary.highestProvenReachableThreshold, 110);
  assert.equal(summary.firstProvenUnreachableThreshold, 120);
  assert.equal(summary.goldHeadroom, 10);
});

test('M7A.3 timeout is not treated as unreachable', () => {
  const board = { grid: [['B', 'C']] };
  const index = buildVocabularyIndex(['bc']);
  const probe = solveGoldProbe(board, index, { goldThreshold: 1, timeoutMs: 0 });
  assert.equal(probe.exact, false);
  assert.equal(probe.status, 'timeout');
  assert.equal(probe.goldReachable, null);
});

test('M7A.3 threshold probe ordering is ascending', () => {
  assert.deepEqual(thresholdProbeOrdering([140, 100, 120, 110]), [100, 110, 120, 140]);
});

test('M7A.3 minimum Gold turns is exact on a handcrafted board', () => {
  const board = { grid: [['B', 'C']] };
  const index = buildVocabularyIndex(['bc']);
  const probe = solveGoldProbe(board, index, { goldThreshold: 52 });
  assert.equal(probe.exact, true);
  assert.equal(probe.goldReachable, true);
  assert.equal(probe.minimumGoldTurns, 1);
});

test('M7A.3 canonical scenario matches production M5', () => {
  const board = { grid: [['B', 'C']] };
  const index = buildVocabularyIndex(['bc']);
  const m5 = solveBoard({ ...board, goldThreshold: 52 }, index);
  const probe = solveGoldProbe(board, index, { goldThreshold: 52 });
  assert.equal(probe.goldReachable, m5.goldReachable);
  assert.equal(probe.minimumGoldTurns, m5.turnsUsed);
});

test('M7A.3 reduced-line scenario is analytical only', () => {
  const before = qjynnRules.ROW_COMPLETE_BONUS;
  const board = { grid: [['B', 'C']] };
  const index = buildVocabularyIndex(['bc']);
  const reduced = solveGoldProbe(board, index, { goldThreshold: 52, scoringPolicy: { rowBonus: 5, columnBonus: 10 } });
  assert.equal(reduced.goldReachable, false);
  assert.equal(qjynnRules.ROW_COMPLETE_BONUS, before);
});

test('M7A.3 require-Hexalink scenario is exact', () => {
  const board = {
    grid: [['W', 'T', 'R', 'M', 'L', 'N'], ['B', 'C', 'D', 'F', 'G', 'H']],
    hexalink: 'WTRMLN',
    hexarowcol: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]
  };
  const index = buildVocabularyIndex(['bcdfgh']);
  const probe = solveGoldProbe(board, index, { goldThreshold: 20, requireHexalink: true });
  assert.equal(probe.exact, true);
  assert.equal(probe.goldReachable, false);
});

test('M7A.3 canonical rules remain unchanged', () => {
  assert.equal(qjynnRules.rowColumnBonus(0, 0, 1, 1).points, 30);
  assert.equal(qjynnRules.scoreWordByLength(10, true) - qjynnRules.scoreWordByLength(10, false), 10);
});

test('M7A.3 certificate score decomposition sums correctly', () => {
  const certificate = [
    { baseScore: 12, hexalinkBonus: 10, rowBonus: 5, columnBonus: 0, cumulativeScore: 27 },
    { baseScore: 8, hexalinkBonus: 0, rowBonus: 0, columnBonus: 20, cumulativeScore: 55 }
  ];
  assert.deepEqual(certificateScoreComposition(certificate), {
    baseWordPoints: 20,
    hexalinkBonus: 10,
    rowBonuses: 5,
    columnBonuses: 20,
    total: 55
  });
});

test('M7A.3 aggregation excludes unresolved exact values where appropriate', () => {
  const aggregate = aggregateProductionResults([
    {
      headroom: { goldHeadroom: 20, highestProvenReachableThreshold: 120 },
      derived: { canonicalMinTurns: 2, goldWithoutHexalink100: true, goldWithoutHexalink120: true, hexalinkRequiredGold100: true, hexalinkRequiredGold120: true },
      moveSpaceMetrics: { uniqueTileMasks: 10, highValueFirstMoves: 2, tileParticipationSpread: 5 },
      scenarioResults: HEADROOM_SCENARIOS.map(scenario => ({ scenario: scenario.name, exact: true, goldReachable: true, minimumGoldTurns: 2, solverElapsedMs: 1 }))
    },
    {
      headroom: { goldHeadroom: null, highestProvenReachableThreshold: null },
      derived: { canonicalMinTurns: null },
      moveSpaceMetrics: { uniqueTileMasks: 20, highValueFirstMoves: 3, tileParticipationSpread: 6 },
      scenarioResults: HEADROOM_SCENARIOS.map(scenario => ({ scenario: scenario.name, exact: false, goldReachable: null, minimumGoldTurns: null, solverElapsedMs: 1 }))
    }
  ]);
  assert.equal(aggregate.headroomDistribution.goldHeadroom.median, 20);
  assert.equal(aggregate.scenarioSummary[0].exactPuzzles, 1);
});

test('M7A.3 deterministic results for same puzzle/scenario', () => {
  const board = { grid: [['B', 'C']] };
  const index = buildVocabularyIndex(['bc']);
  const first = solveGoldProbe(board, index, { goldThreshold: 52 });
  const second = solveGoldProbe(board, index, { goldThreshold: 52 });
  assert.equal(first.goldReachable, second.goldReachable);
  assert.equal(first.minimumGoldTurns, second.minimumGoldTurns);
});
