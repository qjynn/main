const SIMULATOR_VERSION = 'm8.1';
const PLAYER_MODEL_VERSION = 'm8.1.players.0';
const M8_HEURISTIC_BASELINE = 'M8_HEURISTIC_BASELINE';
const M81_FREQUENCY_MODEL = 'M81_FREQUENCY_MODEL';

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

const FREQUENCY_CURVES = Object.freeze({
  CASUAL: { midpoint: 0.7, slope: 4.2, ceiling: 0.76, floor: 0.02 },
  REGULAR: { midpoint: 0.58, slope: 4.8, ceiling: 0.88, floor: 0.04 },
  STRONG: { midpoint: 0.45, slope: 5.2, ceiling: 0.96, floor: 0.06 },
  EXPERT: { midpoint: 0.32, slope: 5.5, ceiling: 0.995, floor: 0.08 },
  ORACLE: { midpoint: 0, slope: 1, ceiling: 1, floor: 1 }
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
  const modelName = name === M8_HEURISTIC_BASELINE || name === M81_FREQUENCY_MODEL ? 'REGULAR' : name;
  if (!MODEL_CONFIGS[modelName]) throw new Error(`Unknown player model: ${name}`);
  return Object.freeze(mergeConfig({ ...MODEL_CONFIGS[modelName], name: modelName }, typeof model === 'object' ? model : overrides));
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

function mapFamiliarityToRecognition(familiarityScore, playerModel, wordLength, options = {}) {
  const model = resolvePlayerModel(playerModel);
  const curve = { ...FREQUENCY_CURVES[model.name], ...(options.curveOverrides?.[model.name] || {}) };
  const score = Math.max(0, Math.min(1, Number(familiarityScore) || 0));
  const logistic = 1 / (1 + Math.exp(-curve.slope * (score - curve.midpoint)));
  const mapped = curve.floor + (curve.ceiling - curve.floor) * logistic;
  if (wordLength === 2) {
    return Math.max(0, Math.min(1, mapped * 0.35 + model.twoLetterRecognition * 0.65));
  }
  return Math.max(0, Math.min(1, mapped));
}

function getWordAccessibility(word, playerModel, options = {}) {
  const model = resolvePlayerModel(playerModel);
  const provider = options.frequencyProvider || options.familiarityProvider;
  const normalized = normalizeWord(word);
  if (provider && options.accessibilitySystem !== M8_HEURISTIC_BASELINE) {
    const raw = typeof provider === 'function' ? provider(normalized) : provider.lookup(normalized);
    if (Number.isFinite(raw)) return { value: Math.max(0, Math.min(1, raw)), knownProbability: Math.max(0, Math.min(1, raw)), familiarityScore: raw, basis: 'provider', rank: null };
    const record = Number.isFinite(raw) ? { found: true, familiarityScore: raw, rank: null } : raw;
    if (record?.found && Number.isFinite(record.familiarityScore)) {
      const knownProbability = mapFamiliarityToRecognition(record.familiarityScore, model, normalized.length, options);
      return { value: knownProbability, knownProbability, noticeProbability: null, familiarityScore: record.familiarityScore, basis: 'frequency', rank: record.rank ?? null, source: record.source, sourceVersion: record.sourceVersion, normalizationVersion: record.normalizationVersion };
    }
  }
  const value = fallbackAccessibility(normalized, model, options);
  return { value, knownProbability: value, noticeProbability: null, familiarityScore: value, basis: 'heuristic', rank: null };
}

module.exports = {
  SIMULATOR_VERSION,
  PLAYER_MODEL_VERSION,
  MODEL_CONFIGS,
  FREQUENCY_CURVES,
  M8_HEURISTIC_BASELINE,
  M81_FREQUENCY_MODEL,
  resolvePlayerModel,
  mapFamiliarityToRecognition,
  getWordAccessibility,
  fallbackAccessibility
};
