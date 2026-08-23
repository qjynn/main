const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../qjynn-rules.js');

test('adjacency and chain limits match gameplay rules', () => {
  assert.equal(rules.areAdjacent({ row: 1, col: 1 }, { row: 2, col: 2 }), true);
  assert.equal(rules.areAdjacent({ row: 1, col: 1 }, { row: 3, col: 1 }), false);
  assert.equal(rules.canAppendToChain([], { row: 0, col: 0 }), true);
  assert.equal(rules.canAppendToChain([{ row: 0, col: 0 }], { row: 0, col: 1 }), true);
  assert.equal(rules.canAppendToChain([{ row: 0, col: 0 }], { row: 0, col: 0 }), false);
  assert.equal(rules.canAppendToChain(Array.from({ length: 6 }, (_, col) => ({ row: 0, col })), { row: 1, col: 5 }), false);
});

test('word length limits are 2 through 10 letters', () => {
  assert.equal(rules.isValidWordLength(1), false);
  assert.equal(rules.isValidWordLength(2), true);
  assert.equal(rules.isValidWordLength(10), true);
  assert.equal(rules.isValidWordLength(11), false);
});

test('scoring tiers and Hexalink bonus are characterized', () => {
  assert.equal(rules.scoreWordByLength(2), 2);
  assert.equal(rules.scoreWordByLength(6), 12);
  assert.equal(rules.scoreWordByLength(8), 15);
  assert.equal(rules.scoreWordByLength(10), 20);
  assert.equal(rules.scoreWordByLength(6, true), 22);
});

test('row and column bonuses count newly completed lines', () => {
  const grid = [
    [{ state: 2 }, { state: 2 }],
    [{ state: 2 }, { state: 0 }]
  ];
  assert.equal(rules.countFullRows(grid, [2, 3]), 1);
  assert.equal(rules.countFullColumns(grid, [2, 3]), 1);
  assert.deepEqual(rules.rowColumnBonus(0, 0, 1, 1), {
    completedRows: 1,
    completedColumns: 1,
    points: 30
  });
});

test('six-turn accounting and medal thresholds are stable', () => {
  assert.deepEqual(rules.nextTurn(5), { turns: 6, gameOver: true });
  assert.equal(rules.medalForScore(39), 'none');
  assert.equal(rules.medalForScore(40), 'bronze');
  assert.equal(rules.medalForScore(70), 'silver');
  assert.equal(rules.medalForScore(100), 'gold');
});

test('Hexalink requires exact designated path and letters in either direction', () => {
  const grid = [
    [{ letter: 'A' }, { letter: 'B' }, { letter: 'C' }],
    [{ letter: 'D' }, { letter: 'E' }, { letter: 'F' }]
  ];
  const path = [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0]];
  const chain = path.map(([row, col]) => ({ row, col }));
  assert.equal(rules.isExactHexalink(chain, grid, 'ABCFED', path), true);
  assert.equal(rules.isExactHexalink(chain.slice().reverse(), grid, 'ABCFED', path), true);
  assert.equal(rules.isExactHexalink(chain, grid, 'ABCDEF', path), false);
  assert.equal(rules.isExactHexalink([{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 }], grid, 'ABCFED', path), false);
});
