const { simulatePuzzleMonteCarlo } = require('./monte-carlo.js');
const { resolvePlayerModel, SIMULATOR_VERSION, PLAYER_MODEL_VERSION } = require('./player-models.js');

const HUMAN_MODELS = Object.freeze(['CASUAL', 'REGULAR', 'STRONG', 'EXPERT']);

function oracleCertificateBenchmark(privateCertification) {
  const certificate = privateCertification?.goldCertificate || [];
  const score = privateCertification?.goldScore ?? (certificate.at(-1)?.cumulativeScore || 0);
  return {
    playerModel: 'ORACLE', oracleBasis: 'M6_gold_certificate', meanScore: score, medianScore: score,
    p10Score: score, p25Score: score, p75Score: score, p90Score: score,
    goldRate: score >= 100 ? 1 : 0, silverRate: score >= 70 && score < 100 ? 1 : 0,
    bronzeRate: score >= 40 && score < 70 ? 1 : 0, noMedalRate: score < 40 ? 1 : 0,
    hexalinkRate: certificate.some(move => move.isHexalink) ? 1 : 0,
    meanHexalinkTurn: certificate.findIndex(move => move.isHexalink) + 1 || null,
    completionRate: certificate.length >= 6 ? 1 : 0, meanTurnsUsed: certificate.length,
    meanRowsCompleted: certificate.filter(move => move.rowBonus > 0).length,
    meanColumnsCompleted: certificate.filter(move => move.columnBonus > 0).length,
    meanInvalidAttempts: 0, meanHintUse: 0, meanValidWords: certificate.length,
    simulationMs: 0, simulationVersion: SIMULATOR_VERSION, playerModelVersion: PLAYER_MODEL_VERSION
  };
}

function profilePuzzle(input, wordIndex, options = {}) {
  const models = options.models || HUMAN_MODELS;
  const modelResults = {};
  for (const model of models) {
    modelResults[model] = simulatePuzzleMonteCarlo({
      ...input,
      playerModel: model,
      runs: options.runs ?? 1000,
      masterSeed: input.masterSeed ?? options.masterSeed
    }, wordIndex, options);
  }
  modelResults.ORACLE = options.runExactOracle
    ? simulatePuzzleMonteCarlo({ ...input, playerModel: 'ORACLE', runs: 1 }, wordIndex, options)
    : oracleCertificateBenchmark(input.privateCertification);
  return {
    puzzleId: input.puzzleId || input.puzzle?.date || input.answer || 'unknown',
    answer: input.answer || input.privateCertification?.answer || null,
    seed: input.masterSeed ?? input.puzzle?.seed ?? null,
    puzzleSource: input.puzzleSource || 'M6_CERTIFIED_GRID',
    models: modelResults,
    metadata: {
      simulatorVersion: SIMULATOR_VERSION,
      playerModelVersion: PLAYER_MODEL_VERSION,
      familiarityBasis: options.frequencyProvider || options.familiarityProvider ? 'provider' : 'heuristic',
      clueAccessibility: options.clueAccessibility ?? input.puzzle?.clueAccessibility ?? 'neutral'
    }
  };
}

function rankValues(values, descending = true) {
  const sorted = values.slice().sort((a, b) => descending ? b.value - a.value : a.value - b.value);
  const ranks = new Map(sorted.map((item, index) => [item.id, index + 1]));
  return values.map(item => ranks.get(item.id));
}

function spearman(xs, ys) {
  if (xs.length < 2) return 0;
  const rx = rankValues(xs.map((value, index) => ({ id: index, value })));
  const ry = rankValues(ys.map((value, index) => ({ id: index, value })));
  const n = xs.length;
  const sum = rx.reduce((sum, rank, index) => sum + (rank - ry[index]) ** 2, 0);
  return 1 - (6 * sum) / (n * (n * n - 1));
}

function profileSpread(profiles, model, metric = 'goldRate') {
  const values = profiles.map(profile => profile.models[model]?.[metric] || 0).sort((a, b) => a - b);
  const at = pct => values.length ? values[Math.max(0, Math.min(values.length - 1, Math.ceil(values.length * pct) - 1))] : 0;
  return { min: at(0), p25: at(0.25), median: at(0.5), p75: at(0.75), max: at(1) };
}

module.exports = { HUMAN_MODELS, profilePuzzle, oracleCertificateBenchmark, profileSpread, spearman };
