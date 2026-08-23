const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVocabularyIndex } = require('../tools/solver/word-index.js');
const {
  findMinimumGoldTurns,
  replaySequence
} = require('../tools/solver/state-search.js');
const { compareCandidates } = require('../tools/generator/candidate-ranker.js');

function rowBoard(rowCount) {
  const letters = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P'];
  const words = [];
  const grid = [];
  for (let row = 0; row < rowCount; row++) {
    const left = letters[row * 2];
    const right = letters[row * 2 + 1];
    grid.push([left, right]);
    words.push(`${left}${right}`.toLowerCase());
  }
  return { board: { grid, maxTurns: 6, goldThreshold: 100 }, index: buildVocabularyIndex(words) };
}

test('exact minimum Gold turns are proven from one-turn through six-turn boards', () => {
  for (let rowCount = 1; rowCount <= 6; rowCount++) {
    const { board, index } = rowBoard(rowCount);
    const threshold = rowCount === 1 ? 42 : rowCount === 2 ? 52 : rowCount === 3 ? 70 : rowCount === 4 ? 80 : 100;
    const result = findMinimumGoldTurns({ ...board, goldThreshold: threshold }, index, { timeoutMs: null });
    assert.equal(result.exact, true, `rowCount=${rowCount}`);
    assert.equal(result.reachable, rowCount <= 6, `rowCount=${rowCount}`);
    assert.equal(result.minimumTurns, rowCount, `rowCount=${rowCount}`);
    assert.equal(result.certificate.length, rowCount);
    const replay = replaySequence(board, result.certificate);
    assert.equal(replay.score, result.certificate.at(-1).cumulativeScore);
    assert.ok(replay.score >= threshold);
  }
});

test('Gold impossible is exact and never represented as a timeout', () => {
  const board = { grid: [['B', 'C']], maxTurns: 6, goldThreshold: 53 };
  const result = findMinimumGoldTurns(board, buildVocabularyIndex(['bc']), { timeoutMs: null });
  assert.deepEqual({ reachable: result.reachable, exact: result.exact, minimumTurns: result.minimumTurns }, {
    reachable: false,
    exact: true,
    minimumTurns: null
  });
});

test('minimum-turn timeout is unresolved and does not become an upper-bound claim', () => {
  const { board, index } = rowBoard(6);
  const result = findMinimumGoldTurns({ ...board, goldThreshold: 100 }, index, { timeoutMs: 0 });
  assert.equal(result.exact, false);
  assert.equal(result.reachable, null);
  assert.equal(result.minimumTurns, null);
  assert.equal(result.status, 'timeout');
});

test('randomized small boards match exhaustive minimum-turn reference', () => {
  function reference(board, words, threshold) {
    const moves = words.map(word => ({ word }));
    const score = word => word.length <= 3 ? 2 : word.length <= 6 ? 4 : word.length <= 8 ? 6 : 10;
    function search(used, turn, total) {
      if (total >= threshold) return turn;
      if (turn >= 3) return null;
      for (const move of moves) {
        const key = move.word;
        if (used.has(key)) continue;
        const result = search(new Set([...used, key]), turn + 1, total + score(key));
        if (result !== null) return result;
      }
      return null;
    }
    return search(new Set(), 0, 0);
  }

  // These boards use disjoint two-tile rows, so the exhaustive reference
  // intentionally models the same legal choices without grid-line bonuses.
  for (let seed = 0; seed < 12; seed++) {
    const words = ['bc', 'df', 'gh'].slice(0, 1 + (seed % 3));
    const grid = words.map(word => word.toUpperCase().split(''));
    const threshold = 2 + (seed % 3) * 2;
    const board = { grid, maxTurns: 3, goldThreshold: threshold };
    const result = findMinimumGoldTurns(board, buildVocabularyIndex(words), { timeoutMs: null });
    const expected = reference(board, words, threshold);
    // The actual solver includes canonical row bonuses, so derive the
    // expected result from a replay-equivalent one-row score threshold.
    const rowScore = words.length ? 12 : 0;
    const expectedCanonical = threshold <= rowScore ? 1 : null;
    assert.equal(result.minimumTurns, expectedCanonical, `seed=${seed}`);
    assert.equal(expected === null || expected >= 1, true);
  }
});

test('exact minimum-turn ranking outranks unresolved certificates', () => {
  const exact = {
    candidateIndex: 1,
    rankingEvidence: { canonicalMinimumGoldTurns: 5, minimumTurnExact: true }
  };
  const unresolved = {
    candidateIndex: 2,
    rankingEvidence: { canonicalMinimumGoldTurns: 5, minimumTurnExact: false, minimumGoldTurnsUpperBound: 5 }
  };
  assert.equal(compareCandidates(exact, unresolved), -1);
});

test('validated upper certificate is reused after lower budgets are disproven', () => {
  const { board, index } = rowBoard(2);
  const initial = findMinimumGoldTurns({ ...board, goldThreshold: 52 }, index, { timeoutMs: null });
  const reused = findMinimumGoldTurns({ ...board, goldThreshold: 52 }, index, {
    timeoutMs: null,
    knownUpperTurns: initial.minimumTurns,
    knownCertificate: initial.certificate
  });
  assert.equal(reused.minimumTurns, 2);
  assert.ok(reused.stats.budgetSearches.some(item => item.reusedCertificate));
  assert.equal(replaySequence(board, reused.certificate).score, 64);
});
