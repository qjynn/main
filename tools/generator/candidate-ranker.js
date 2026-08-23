function boolRank(value) {
  return value === true ? 1 : 0;
}

function headroomLower(candidate) {
  return candidate.rankingEvidence?.headroom?.headroomLowerBound ?? Infinity;
}

function firstUnreachable(candidate) {
  return candidate.rankingEvidence?.headroom?.firstProvenUnreachableThreshold ?? Infinity;
}

function timeoutCount(candidate) {
  return candidate.rankingEvidence?.headroom?.unresolvedThresholds?.length || 0;
}

function participationPct(candidate) {
  return candidate.rankingEvidence?.hexalinkMoveParticipationPct ?? 0;
}

function centered(value, target) {
  if (!Number.isFinite(value)) return Infinity;
  return Math.abs(value - target);
}

function comparisonReasons(a, b) {
  const reasons = [];
  const av = a.rankingEvidence || {};
  const bv = b.rankingEvidence || {};

  if (av.canonicalMinimumGoldTurns !== bv.canonicalMinimumGoldTurns) {
    reasons.push(`${a.candidateIndex} requires ${av.canonicalMinimumGoldTurns} turns; ${b.candidateIndex} requires ${bv.canonicalMinimumGoldTurns}.`);
    return reasons;
  }
  reasons.push(`Both require ${av.canonicalMinimumGoldTurns} canonical Gold turns.`);

  if (firstUnreachable(a) !== firstUnreachable(b)) {
    reasons.push(`${a.candidateIndex} first proven unreachable threshold ${firstUnreachable(a)}; ${b.candidateIndex} ${firstUnreachable(b)}.`);
    return reasons;
  }
  if (headroomLower(a) !== headroomLower(b)) {
    reasons.push(`${a.candidateIndex} headroom lower bound ${headroomLower(a)}; ${b.candidateIndex} ${headroomLower(b)}.`);
    return reasons;
  }
  if (timeoutCount(a) !== timeoutCount(b)) {
    reasons.push(`${a.candidateIndex} has ${timeoutCount(a)} unresolved headroom probes; ${b.candidateIndex} has ${timeoutCount(b)}.`);
    return reasons;
  }
  reasons.push('Headroom evidence tied.');

  if (boolRank(av.goldReachableWithoutHexalink) !== boolRank(bv.goldReachableWithoutHexalink)) {
    reasons.push(`${a.candidateIndex} Gold without Hexalink=${av.goldReachableWithoutHexalink}; ${b.candidateIndex}=${bv.goldReachableWithoutHexalink}.`);
    return reasons;
  }
  if (participationPct(a) !== participationPct(b)) {
    reasons.push(`${a.candidateIndex} Hexalink participation ${participationPct(a)}; ${b.candidateIndex} ${participationPct(b)}.`);
    return reasons;
  }

  const aMasks = av.uniqueTileMasks ?? Infinity;
  const bMasks = bv.uniqueTileMasks ?? Infinity;
  if (centered(aMasks, 1800) !== centered(bMasks, 1800)) {
    reasons.push(`${a.candidateIndex} unique tile masks ${aMasks}; ${b.candidateIndex} ${bMasks}.`);
    return reasons;
  }

  const aSpread = av.tileParticipationSpread ?? Infinity;
  const bSpread = bv.tileParticipationSpread ?? Infinity;
  if (aSpread !== bSpread) {
    reasons.push(`${a.candidateIndex} tile participation spread ${aSpread}; ${b.candidateIndex} ${bSpread}.`);
    return reasons;
  }

  const aDirection = av.hexalinkDirectionChanges ?? 0;
  const bDirection = bv.hexalinkDirectionChanges ?? 0;
  if (aDirection !== bDirection) {
    reasons.push(`${a.candidateIndex} Hexalink direction changes ${aDirection}; ${b.candidateIndex} ${bDirection}.`);
    return reasons;
  }

  reasons.push(`Complete tie resolved by candidate index ${a.candidateIndex} vs ${b.candidateIndex}.`);
  return reasons;
}

function compareCandidates(a, b) {
  const av = a.rankingEvidence || {};
  const bv = b.rankingEvidence || {};
  const checks = [
    [bv.canonicalMinimumGoldTurns ?? -Infinity, av.canonicalMinimumGoldTurns ?? -Infinity],
    [firstUnreachable(a), firstUnreachable(b)],
    [headroomLower(a), headroomLower(b)],
    [timeoutCount(a), timeoutCount(b)],
    [boolRank(av.goldReachableWithoutHexalink), boolRank(bv.goldReachableWithoutHexalink)],
    [participationPct(b), participationPct(a)],
    [centered(av.uniqueTileMasks ?? Infinity, 1800), centered(bv.uniqueTileMasks ?? Infinity, 1800)],
    [av.tileParticipationSpread ?? Infinity, bv.tileParticipationSpread ?? Infinity],
    [bv.hexalinkDirectionChanges ?? 0, av.hexalinkDirectionChanges ?? 0],
    [a.candidateIndex, b.candidateIndex]
  ];

  for (const [left, right] of checks) {
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}

function rankCandidates(candidates) {
  const ranked = candidates.slice().sort(compareCandidates);
  return ranked.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    rankingReasons: index === 0 && ranked[1] ? comparisonReasons(candidate, ranked[1]) : candidate.rankingReasons || []
  }));
}

module.exports = {
  compareCandidates,
  comparisonReasons,
  rankCandidates
};
