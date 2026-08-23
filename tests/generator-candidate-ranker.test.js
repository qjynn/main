const test = require('node:test');
const assert = require('node:assert/strict');
const { compareCandidates, comparisonReasons, rankCandidates } = require('../tools/generator/candidate-ranker.js');

function candidate(index, overrides = {}) {
  return {
    candidateIndex: index,
    rankingEvidence: {
      canonicalMinimumGoldTurns: 5,
      headroom: {
        headroomLowerBound: 40,
        firstProvenUnreachableThreshold: 150,
        unresolvedThresholds: []
      },
      goldReachableWithoutHexalink: true,
      hexalinkMoveParticipationPct: 0.01,
      uniqueTileMasks: 1800,
      tileParticipationSpread: 1000,
      hexalinkDirectionChanges: 3,
      ...overrides
    }
  };
}

test('M7B 6-turn candidate beats otherwise identical 5-turn candidate', () => {
  assert.equal(compareCandidates(
    candidate(1, { canonicalMinimumGoldTurns: 6 }),
    candidate(2, { canonicalMinimumGoldTurns: 5 })
  ), -1);
});

test('M7B 5-turn candidate beats 4-turn candidate', () => {
  assert.equal(compareCandidates(
    candidate(1, { canonicalMinimumGoldTurns: 5 }),
    candidate(2, { canonicalMinimumGoldTurns: 4 })
  ), -1);
});

test('M7B proven lower headroom beats proven higher headroom when turns tie', () => {
  assert.equal(compareCandidates(
    candidate(1, { headroom: { headroomLowerBound: 20, firstProvenUnreachableThreshold: 130, unresolvedThresholds: [] } }),
    candidate(2, { headroom: { headroomLowerBound: 40, firstProvenUnreachableThreshold: 150, unresolvedThresholds: [] } })
  ), -1);
});

test('M7B timeout does not beat proven unreachable', () => {
  assert.equal(compareCandidates(
    candidate(1, { headroom: { headroomLowerBound: 20, firstProvenUnreachableThreshold: null, unresolvedThresholds: [130] } }),
    candidate(2, { headroom: { headroomLowerBound: 20, firstProvenUnreachableThreshold: 130, unresolvedThresholds: [] } })
  ), 1);
});

test('M7B Hexalink-dependent candidate wins the appropriate tie', () => {
  assert.equal(compareCandidates(
    candidate(1, { goldReachableWithoutHexalink: false }),
    candidate(2, { goldReachableWithoutHexalink: true })
  ), -1);
});

test('M7B secondary metrics only affect lower ranking tiers', () => {
  assert.equal(compareCandidates(
    candidate(1, { canonicalMinimumGoldTurns: 6, uniqueTileMasks: 2200 }),
    candidate(2, { canonicalMinimumGoldTurns: 5, uniqueTileMasks: 1800 })
  ), -1);
});

test('M7B deterministic candidate index resolves a complete tie', () => {
  assert.equal(compareCandidates(candidate(1), candidate(2)), -1);
});

test('M7B comparison reasons match the actual ranking decision', () => {
  const a = candidate(7, { canonicalMinimumGoldTurns: 6 });
  const b = candidate(12, { canonicalMinimumGoldTurns: 5 });
  const reasons = comparisonReasons(a, b);
  assert.equal(compareCandidates(a, b), -1);
  assert.match(reasons[0], /requires 6 turns/);
});

test('M7B rankCandidates assigns stable ranks', () => {
  const ranked = rankCandidates([candidate(3), candidate(1), candidate(2)]);
  assert.deepEqual(ranked.map(item => item.candidateIndex), [1, 2, 3]);
  assert.deepEqual(ranked.map(item => item.rank), [1, 2, 3]);
});
