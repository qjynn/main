const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVocabularyIndex } = require('../tools/solver/word-index.js');
const { simulateGame } = require('../tools/simulator/simulate-game.js');
const { createSolverContext } = require('../tools/solver/state-search.js');

function board() {
  return { grid: [['B', 'C'], ['D', 'F'], ['G', 'H']], hexalink: 'BCDFGH', hexarowcol: [[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1]], clue: 'Letters' };
}

function index() { return buildVocabularyIndex(['bc', 'df', 'gh']); }

test('M8 simulation is deterministic for the same seed and model', () => {
  const input = { puzzle: board(), playerModel: 'REGULAR', simulationSeed: 42 };
  const first = simulateGame(input, index());
  const second = simulateGame(input, index());
  assert.deepEqual(first, second);
});

test('M8 different seeds can change bounded player choices', () => {
  const first = simulateGame({ puzzle: board(), playerModel: 'CASUAL', simulationSeed: 1 }, index());
  const second = simulateGame({ puzzle: board(), playerModel: 'CASUAL', simulationSeed: 2 }, index());
  assert.notDeepEqual(first.moveHistory, second.moveHistory);
});

test('M8 simulation enforces six turns and canonical score/medal thresholds', () => {
  const result = simulateGame({ puzzle: board(), playerModel: 'EXPERT', simulationSeed: 9 }, index());
  assert.ok(result.turnsPlayed <= 6);
  assert.equal(result.medal, require('../qjynn-rules.js').medalForScore(result.finalScore));
  for (const move of result.moveHistory.filter(item => item.type === 'move')) assert.ok(move.path.length <= 6);
});

test('M8 trace mode does not alter the simulation result', () => {
  const input = { puzzle: board(), playerModel: 'STRONG', simulationSeed: 10 };
  const normal = simulateGame(input, index());
  const traced = simulateGame(input, index(), { trace: true });
  assert.equal(traced.finalScore, normal.finalScore);
  assert.equal(traced.moveHistory.length, normal.moveHistory.length);
  assert.ok(Array.isArray(traced.simulationMetadata.trace));
});

test('M8 bounded models do not invoke the exact solver', () => {
  const context = createSolverContext(board(), index());
  const result = simulateGame({ puzzle: board(), playerModel: 'REGULAR', simulationSeed: 11 }, index(), { preparedContext: context });
  assert.equal(result.simulationMetadata.model, 'REGULAR');
  assert.equal(result.simulationMetadata.oracle, undefined);
});

test('M8 unavailable tiles cannot be reused', () => {
  const result = simulateGame({ puzzle: { ...board(), tileStates: [['ON', 'OFF'], ['OFF', 'OFF'], ['OFF', 'OFF']] }, playerModel: 'EXPERT', simulationSeed: 12 }, index());
  const seen = new Set();
  for (const move of result.moveHistory.filter(item => item.type === 'move')) {
    for (const cell of move.path) {
      const key = cell.join(',');
      assert.equal(seen.has(key), false);
      seen.add(key);
    }
  }
});
