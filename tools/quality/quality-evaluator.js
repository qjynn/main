const qjynnRules = require('../../qjynn-rules.js');
const { GATE_DEFINITIONS, gateDefinition } = require('./gate-registry.js');
const { outsideEnvelope } = require('./historical-envelope.js');

function result(id, status, reason, observedValue = null, expected = null, extra = {}) {
  const definition = gateDefinition(id);
  return { gateId: id, gateVersion: definition.version, severity: definition.severity, result: status, reason, observedValue, expectedEnvelope: expected, ...extra };
}
function quantile(values, fraction) { const a = values.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor((a.length - 1) * fraction))] : null; }

function evaluateCandidateGates(candidate, context = {}) {
  const profiles = context.pool || [];
  const publicPuzzle = candidate.puzzle;
  const privateCertification = candidate.privateCertification || {};
  const metadata = context.metadata || {};
  const gates = [];
  gates.push(candidate.certified && privateCertification.goldCertificate?.length && privateCertification.certificateReplayResult?.score >= 100
    ? result('STRUCTURAL_CERTIFICATION', 'PASS', 'M6 certification and Gold replay passed.', { certified: candidate.certified, score: privateCertification.certificateReplayResult.score }, 'certified=true; replay score>=100')
    : result('STRUCTURAL_CERTIFICATION', 'FAIL', 'M6 certification or certificate replay failed.', { certified: candidate.certified, replay: privateCertification.certificateReplayResult || null }, 'certified=true; replay score>=100'));
  const integrityOk = [metadata.rulesVersion, metadata.vocabularyVersion, metadata.generatorVersion, metadata.selectorVersion, metadata.simulatorVersion, metadata.playerModelVersion].every(Boolean) && candidate.gridHash;
  gates.push(integrityOk ? result('DATA_INTEGRITY', 'PASS', 'Required versions and grid hash are present.', metadata, 'known versions and grid hash') : result('DATA_INTEGRITY', 'FAIL', 'A required version or grid hash is missing.', metadata, 'known versions and grid hash'));
  const familiarityOk = metadata.familiarity?.provider === 'wordfreq' && metadata.familiarity?.sourceVersion && metadata.familiarity?.normalizationVersion;
  gates.push(familiarityOk ? result('REAL_FAMILIARITY', 'PASS', 'Approved real familiarity provider is active.', metadata.familiarity, 'wordfreq with source and normalization metadata') : result('REAL_FAMILIARITY', 'FAIL', 'Real familiarity metadata is unavailable or not approved.', metadata.familiarity, 'wordfreq with source and normalization metadata'));
  const band = candidate.difficultyBand;
  gates.push(band === 'middle' ? result('COMPARATIVE_DIFFICULTY', 'PASS', 'Candidate is in the preferred middle band.', band, 'middle') : context.allowAdjacentBands && ['easier', 'harder'].includes(band) ? result('COMPARATIVE_DIFFICULTY', 'WARN', 'Candidate is in an adjacent relative band.', band, 'middle or explicit adjacent fallback') : result('COMPARATIVE_DIFFICULTY', 'FAIL', 'Candidate is outside the allowed relative difficulty region.', band, 'middle'));
  const medalTotal = Number(candidate.regularGoldRate || 0) + Number(candidate.regularSilverRate || 0) + Number(candidate.regularBronzeRate || 0);
  const medalDegenerate = Number(candidate.regularGoldRate || 0) >= .98 || (medalTotal > 0 && Number(candidate.regularGoldRate || 0) < .001 && Number(candidate.regularSilverRate || 0) < .001);
  gates.push(medalDegenerate ? result('MEDAL_DISTRIBUTION', 'WARN', 'REGULAR medal distribution is near a boundary; retained as diagnostic.', { gold: candidate.regularGoldRate, silver: candidate.regularSilverRate, bronze: candidate.regularBronzeRate }, 'not degenerate') : result('MEDAL_DISTRIBUTION', 'PASS', 'REGULAR medal distribution is non-degenerate.', { gold: candidate.regularGoldRate, silver: candidate.regularSilverRate, bronze: candidate.regularBronzeRate }, 'not degenerate'));
  const rare = Number(candidate.regularRareWordDependency ?? candidate.rareWordDependency ?? 0);
  const familiarity = Number(candidate.regularPlayedFamiliarity ?? candidate.meanFamiliarity);
  gates.push(rare > .95 || (Number.isFinite(familiarity) && familiarity < .1) ? result('VOCABULARY_ACCESSIBILITY', 'WARN', 'Vocabulary accessibility is an extreme relative diagnostic.', { rareWordDependency: rare, meanPlayedFamiliarity: familiarity }, 'rare dependency<=.95 and familiarity>=.1') : result('VOCABULARY_ACCESSIBILITY', 'PASS', 'Vocabulary accessibility is within the configured diagnostic envelope.', { rareWordDependency: rare, meanPlayedFamiliarity: familiarity }, 'rare dependency<=.95 and familiarity>=.1'));
  const moves = Number(candidate.uniquePlayableWords || candidate.cheapMetricValue);
  const moveValues = profiles.map(item => Number(item.uniquePlayableWords || item.cheapMetricValue)).filter(Number.isFinite);
  const moveLow = quantile(moveValues, .1); const moveHigh = quantile(moveValues, .9);
  gates.push(Number.isFinite(moves) && (moves < moveLow || moves > moveHigh) ? result('MOVE_SPACE_SANITY', 'WARN', 'Opportunity density is in a pool tail.', moves, { p10: moveLow, p90: moveHigh }) : result('MOVE_SPACE_SANITY', 'PASS', 'Opportunity density is not a pool-tail outlier.', moves, { p10: moveLow, p90: moveHigh }));
  const spread = Number(candidate.tileParticipationSpread);
  gates.push(Number.isFinite(spread) && spread > .9 ? result('TILE_PARTICIPATION', 'WARN', 'Tile participation is uneven but not a hard validity failure.', spread, '<=0.9') : result('TILE_PARTICIPATION', 'PASS', 'Tile participation is acceptable.', spread, '<=0.9'));
  const hexRate = Number(candidate.regularHexalinkRate ?? candidate.hexalinkRate);
  gates.push(Number.isFinite(hexRate) && (hexRate < .01 || hexRate > .95) ? result('HEXALINK_SANITY', 'WARN', 'Synthetic Hexalink participation is an extreme diagnostic.', hexRate, '.01-.95') : result('HEXALINK_SANITY', 'PASS', 'Hexalink geometry and participation are non-pathological.', hexRate, '.01-.95'));
  const historical = context.historical?.envelope?.regularMeanScore;
  gates.push(context.historical?.mode === 'ACTIVE' && outsideEnvelope(Number(candidate.regularMeanScore), historical) ? result('HISTORICAL_SIMILARITY', 'WARN', 'Score is outside the historical diagnostic envelope.', candidate.regularMeanScore, historical) : result('HISTORICAL_SIMILARITY', 'PASS', context.historical?.mode === 'WARMUP' ? 'Historical envelope is in warm-up.' : 'Candidate is within the historical diagnostic envelope.', candidate.regularMeanScore, historical || 'warm-up'));
  const margin = Number(candidate.difficultyRank);
  gates.push(Number.isFinite(margin) && candidate.difficultyBand === 'middle' ? result('SELECTION_MARGIN', 'PASS', 'Candidate is in the selected relative region.', { band, rank: margin }, 'middle band') : result('SELECTION_MARGIN', 'WARN', 'Candidate has limited relative selection margin.', { band, rank: margin }, 'middle band'));
  const standardError = Number(candidate.scoreStdDev) / Math.sqrt(Math.max(1, Number(candidate.regularRuns || 500)));
  gates.push(Number.isFinite(standardError) && standardError > 2 ? result('MONTE_CARLO_STABILITY', 'WARN', 'REGULAR score uncertainty is elevated.', standardError, '<=2') : result('MONTE_CARLO_STABILITY', 'PASS', 'REGULAR score uncertainty is bounded.', standardError, '<=2'));
  gates.push(context.publicPrivateOk === true ? result('PUBLIC_PRIVATE_SEPARATION', 'PASS', 'Public artifact contains no private fields.', true, true) : result('PUBLIC_PRIVATE_SEPARATION', 'FAIL', 'Public/private separation failed.', context.publicPrivateOk, true));
  gates.push(context.schemaOk === true ? result('ARTIFACT_SCHEMA', 'PASS', 'Public, private, and queue schemas passed.', true, true) : result('ARTIFACT_SCHEMA', 'FAIL', 'An artifact schema failed.', context.schemaOk, true));
  gates.push(context.reproducible === true ? result('REPRODUCIBILITY', 'PASS', 'Regeneration reproduced candidate identity and hashes.', true, true) : result('REPRODUCIBILITY', 'FAIL', 'Regeneration did not reproduce candidate identity or hashes.', context.reproducible, true));
  return gates;
}

function classifyConfidence(gates, config = {}) {
  if (gates.some(gate => gate.result === 'FAIL' && gate.severity === 'MANDATORY')) return 'REJECT';
  const qualityWarns = gates.filter(gate => gate.result === 'WARN' && gate.severity === 'QUALITY').length;
  if (qualityWarns > 1 || gates.some(gate => gate.result === 'FAIL')) return 'REVIEW_RECOMMENDED';
  if (qualityWarns === 1) return config.qualityWarningsAllowEligibility === false ? 'REVIEW_RECOMMENDED' : 'ACCEPTABLE';
  return 'HIGH_CONFIDENCE';
}
function gateSummary(gates) { return Object.fromEntries(GATE_DEFINITIONS.map(definition => [definition.id, gates.find(gate => gate.gateId === definition.id)?.result || 'NOT_AVAILABLE'])); }
module.exports = { result, evaluateCandidateGates, classifyConfidence, gateSummary };
