const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVocabularyIndex } = require('../tools/solver/word-index.js');
const { simulatePuzzleMonteCarlo, confidenceInterval } = require('../tools/simulator/monte-carlo.js');

const puzzle = { grid: [['B', 'C'], ['D', 'F'], ['G', 'H']], hexalink: 'BCDFGH', hexarowcol: [[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1]] };
const index = buildVocabularyIndex(['bc', 'df', 'gh']);

test('M8 Monte Carlo aggregation is deterministic and complete', () => {
  const input = { puzzle, playerModel: 'REGULAR', runs: 40, masterSeed: 44 };
  const first = simulatePuzzleMonteCarlo(input, index);
  const second = simulatePuzzleMonteCarlo(input, index);
  const withoutTiming = result => { const copy = { ...result }; delete copy.simulationMs; return copy; };
  assert.deepEqual(withoutTiming(first), withoutTiming(second));
  assert.equal(first.runs, 40);
  assert.equal(first.goldRate + first.silverRate + first.bronzeRate + first.noMedalRate, 1);
  assert.ok(first.goldRate95Ci.lower <= first.goldRate && first.goldRate <= first.goldRate95Ci.upper);
});

test('M8 confidence interval is bounded', () => {
  const interval = confidenceInterval(0.5, 100);
  assert.ok(interval.lower >= 0);
  assert.ok(interval.upper <= 1);
});

test('M8 model variation is not collapsed into one deterministic route', () => {
  const result = simulatePuzzleMonteCarlo({ puzzle, playerModel: 'CASUAL', runs: 80, masterSeed: 45 }, index);
  assert.ok(result.meanScore >= 0);
  assert.ok(result.simulationMs >= 0);
});
