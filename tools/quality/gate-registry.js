const M10_POLICY_VERSION = 'm10.0';
const M10_GATE_VERSION = 'm10.gates.0';
const DEFAULT_M10_CONFIG = Object.freeze({
  candidatePoolSize: 10,
  certifiedCandidateTarget: 10,
  minimumCertifiedCandidates: 10,
  regularRuns: 500,
  strongFinalistCount: 3,
  strongRuns: 250,
  requiredBackups: 2,
  maxRegenerationRounds: 1,
  historyWindow: 30,
  allowDegradedReserve: false,
  difficultyPolicy: { preferredBand: 'middle', allowAdjacentBands: true },
  qualityWarningsAllowEligibility: true
});
const GATE_DEFINITIONS = Object.freeze([
  ['STRUCTURAL_CERTIFICATION', 'MANDATORY'], ['DATA_INTEGRITY', 'MANDATORY'], ['REAL_FAMILIARITY', 'MANDATORY'],
  ['COMPARATIVE_DIFFICULTY', 'QUALITY'], ['MEDAL_DISTRIBUTION', 'QUALITY'], ['VOCABULARY_ACCESSIBILITY', 'QUALITY'],
  ['MOVE_SPACE_SANITY', 'DIAGNOSTIC'], ['TILE_PARTICIPATION', 'DIAGNOSTIC'], ['HEXALINK_SANITY', 'DIAGNOSTIC'],
  ['HISTORICAL_SIMILARITY', 'QUALITY'], ['SELECTION_MARGIN', 'QUALITY'], ['MONTE_CARLO_STABILITY', 'QUALITY'],
  ['PUBLIC_PRIVATE_SEPARATION', 'MANDATORY'], ['ARTIFACT_SCHEMA', 'MANDATORY'], ['REPRODUCIBILITY', 'MANDATORY']
].map(([id, severity]) => Object.freeze({ id, version: M10_GATE_VERSION, severity })));

function resolveM10Config(config = {}) {
  const merged = { ...DEFAULT_M10_CONFIG, ...config };
  for (const field of ['candidatePoolSize', 'certifiedCandidateTarget', 'minimumCertifiedCandidates', 'regularRuns', 'strongFinalistCount', 'strongRuns']) {
    if (!Number.isInteger(merged[field]) || merged[field] < 1) throw new Error(`${field} must be a positive integer.`);
  }
  for (const field of ['requiredBackups', 'maxRegenerationRounds']) if (!Number.isInteger(merged[field]) || merged[field] < 0) throw new Error(`${field} must be a non-negative integer.`);
  if (merged.minimumCertifiedCandidates > merged.certifiedCandidateTarget) throw new Error('minimumCertifiedCandidates cannot exceed certifiedCandidateTarget.');
  if (merged.candidatePoolSize < merged.certifiedCandidateTarget) throw new Error('candidatePoolSize must reach certifiedCandidateTarget.');
  if (merged.regularRuns < 100 || merged.strongRuns < 100) throw new Error('Publication profiles require at least 100 runs.');
  return Object.freeze({ ...merged, difficultyPolicy: Object.freeze({ ...DEFAULT_M10_CONFIG.difficultyPolicy, ...(config.difficultyPolicy || {}) }) });
}

function gateDefinition(id) { return GATE_DEFINITIONS.find(gate => gate.id === id) || null; }

module.exports = { M10_POLICY_VERSION, M10_GATE_VERSION, DEFAULT_M10_CONFIG, GATE_DEFINITIONS, resolveM10Config, gateDefinition };
