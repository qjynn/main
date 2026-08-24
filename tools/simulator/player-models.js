const SIMULATOR_VERSION = 'm8.0';
const PLAYER_MODEL_VERSION = 'm8.players.0';

const MODEL_CONFIGS = Object.freeze({
  CASUAL: {
    name: 'CASUAL', vocabularyAccess: 0.42,
    discovery: { maxCandidateMoves: 8, sampleSize: 40, noticeProbability: 0.34 },
    planning: { lookaheadDepth: 0, beamWidth: 0, nodeCap: 0 },
    hexalink: { baseRecognitionProbability: 0.16, turnAdjustment: 0.035, overlapAdjustment: 0.08 },
    decision: { temperature: 5.5, scoreWeight: 0.8, familiarityWeight: 2.4, coverageWeight: 0.35, flexibilityWeight: 0.2 },
    invalidAttemptProbability: 0.045, hintProbability: 0.025, hintTurn: 5, twoLetterRecognition: 0.35
  },
  REGULAR: {
    name: 'REGULAR', vocabularyAccess: 0.62,
    discovery: { maxCandidateMoves: 18, sampleSize: 80, noticeProbability: 0.53 },
    planning: { lookaheadDepth: 1, beamWidth: 5, nodeCap: 35 },
    hexalink: { baseRecognitionProbability: 0.31, turnAdjustment: 0.05, overlapAdjustment: 0.12 },
    decision: { temperature: 3.2, scoreWeight: 1.15, familiarityWeight: 1.35, coverageWeight: 0.65, flexibilityWeight: 0.35 },
    invalidAttemptProbability: 0.018, hintProbability: 0.045, hintTurn: 5, twoLetterRecognition: 0.58
  },
  STRONG: {
    name: 'STRONG', vocabularyAccess: 0.8,
    discovery: { maxCandidateMoves: 32, sampleSize: 130, noticeProbability: 0.72 },
    planning: { lookaheadDepth: 1, beamWidth: 8, nodeCap: 80 },
    hexalink: { baseRecognitionProbability: 0.5, turnAdjustment: 0.065, overlapAdjustment: 0.17 },
    decision: { temperature: 2.0, scoreWeight: 1.45, familiarityWeight: 0.85, coverageWeight: 0.9, flexibilityWeight: 0.55 },
    invalidAttemptProbability: 0.008, hintProbability: 0.06, hintTurn: 5, twoLetterRecognition: 0.78
  },
  EXPERT: {
    name: 'EXPERT', vocabularyAccess: 0.93,
    discovery: { maxCandidateMoves: 55, sampleSize: 220, noticeProbability: 0.88 },
    planning: { lookaheadDepth: 2, beamWidth: 12, nodeCap: 150 },
    hexalink: { baseRecognitionProbability: 0.68, turnAdjustment: 0.075, overlapAdjustment: 0.22 },
    decision: { temperature: 1.25, scoreWeight: 1.7, familiarityWeight: 0.45, coverageWeight: 1.1, flexibilityWeight: 0.75 },
    invalidAttemptProbability: 0.003, hintProbability: 0.075, hintTurn: 5, twoLetterRecognition: 0.92
  },
  ORACLE: {
    name: 'ORACLE', vocabularyAccess: 1,
    discovery: { maxCandidateMoves: Infinity, sampleSize: Infinity, noticeProbability: 1 },
    planning: { lookaheadDepth: Infinity, beamWidth: Infinity, nodeCap: Infinity },
    hexalink: { baseRecognitionProbability: 1, turnAdjustment: 0, overlapAdjustment: 0 },
    decision: { temperature: 0, scoreWeight: 1, familiarityWeight: 0, coverageWeight: 0, flexibilityWeight: 0 },
    invalidAttemptProbability: 0, hintProbability: 0, hintTurn: 6, twoLetterRecognition: 1
  }
});

function mergeConfig(base, override = {}) {
  return {
    ...base,
    ...override,
    discovery: { ...base.discovery, ...(override.discovery || {}) },
    planning: { ...base.planning, ...(override.planning || {}) },
    hexalink: { ...base.hexalink, ...(override.hexalink || {}) },
    decision: { ...base.decision, ...(override.decision || {}) }
  };
}

function resolvePlayerModel(model = 'REGULAR', overrides = {}) {
  const name = typeof model === 'string' ? model.toUpperCase() : model.name?.toUpperCase();
  if (!MODEL_CONFIGS[name]) throw new Error(`Unknown player model: ${name}`);
  return Object.freeze(mergeConfig(MODEL_CONFIGS[name], typeof model === 'object' ? model : overrides));
}

function normalizeWord(word) {
  return String(word || '').trim().toLowerCase();
}

function fallbackAccessibility(word, model, options = {}) {
  const normalized = normalizeWord(word);
  const overrides = options.familiarityOverrides || {};
  if (Number.isFinite(overrides[normalized])) return Math.max(0, Math.min(1, overrides[normalized]));
  if (normalized.length === 2) return model.twoLetterRecognition;
  let score = 0.78 - Math.max(0, normalized.length - 5) * 0.045;
  if (/[jqxz]/.test(normalized)) score -= 0.18;
  if (/(tion|ness|ment|ingly|ously|ations|ities)$/.test(normalized)) score -= 0.08;
  if (/[bcdfghjklmnpqrstvwxyz]{4,}/.test(normalized)) score -= 0.14;
  return Math.max(0.05, Math.min(0.98, score * (0.72 + model.vocabularyAccess * 0.3)));
}

function getWordAccessibility(word, playerModel, options = {}) {
  const model = resolvePlayerModel(playerModel);
  const provider = options.frequencyProvider || options.familiarityProvider;
  const normalized = normalizeWord(word);
  if (provider) {
    const value = provider(normalized);
    if (Number.isFinite(value)) return { value: Math.max(0, Math.min(1, value)), basis: 'provider', rank: value };
  }
  return { value: fallbackAccessibility(normalized, model, options), basis: 'heuristic', rank: null };
}

module.exports = {
  SIMULATOR_VERSION,
  PLAYER_MODEL_VERSION,
  MODEL_CONFIGS,
  resolvePlayerModel,
  getWordAccessibility,
  fallbackAccessibility
};
