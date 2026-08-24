const { simulateGame, hashSeed } = require('./simulate-game.js');
const { resolvePlayerModel } = require('./player-models.js');
const { createSolverContext } = require('../solver/state-search.js');

function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function percentile(values, pct) {
  if (!values.length) return 0;
  const ordered = values.slice().sort((a, b) => a - b);
  return ordered[Math.max(0, Math.min(ordered.length - 1, Math.ceil(ordered.length * pct / 100) - 1))];
}

function summarizeRunResults(results) {
  const scores = results.map(result => result.finalScore);
  const words = results.flatMap(result => result.moveHistory.filter(move => move.type === 'move'));
  const gold = results.filter(result => result.medal === 'gold');
  const goldWords = gold.flatMap(result => result.moveHistory.filter(move => move.type === 'move'));
  const diagnostics = results.flatMap(result => result.simulationMetadata?.discoveryDiagnostics || []);
  return {
    runs: results.length,
    meanScore: mean(scores),
    medianScore: percentile(scores, 50),
    scoreStdDev: scores.length > 1 ? Math.sqrt(scores.reduce((sum, score) => sum + (score - mean(scores)) ** 2, 0) / (scores.length - 1)) : 0,
    goldRate: results.filter(result => result.medal === 'gold').length / Math.max(1, results.length),
    silverRate: results.filter(result => result.medal === 'silver').length / Math.max(1, results.length),
    bronzeRate: results.filter(result => result.medal === 'bronze').length / Math.max(1, results.length),
    hexalinkRate: results.filter(result => result.hexalinkFound).length / Math.max(1, results.length),
    meanFamiliarity: mean(words.map(move => move.accessibility).filter(Number.isFinite)),
    rareWordDependency: gold.length ? gold.filter(result => result.moveHistory.filter(move => move.type === 'move').some(move => Number.isFinite(move.accessibility) && move.accessibility < 0.5)).length / gold.length : 0,
    familiarOnlyGoldRate: gold.length ? gold.filter(result => result.moveHistory.filter(move => move.type === 'move').every(move => !Number.isFinite(move.accessibility) || move.accessibility >= 0.5)).length / gold.length : 0,
    meanKnownMoves: mean(diagnostics.map(item => item.estimatedKnownMoves)),
    meanNoticedMoves: mean(diagnostics.map(item => item.noticedMoves)),
    meanTurnsUsed: mean(results.map(result => result.turnsPlayed)),
    meanValidWords: mean(results.map(result => result.wordsPlayed))
  };
}

function runIncrementalMonteCarlo(input, wordIndex, options = {}) {
  const model = resolvePlayerModel(input.playerModel || options.playerModel || 'REGULAR', options.modelOverrides || {});
  const maxRuns = Math.max(1, Math.floor(options.maxRuns ?? input.runs ?? 500));
  const masterSeed = input.masterSeed ?? hashSeed(`${input.puzzle?.date || ''}|${model.name}`);
  const preparedContext = options.preparedContext || createSolverContext(input.puzzle, wordIndex, { moveFilter: options.moveFilter });
  const results = [];
  const started = process.hrtime.bigint();
  for (let runIndex = 0; runIndex < maxRuns; runIndex++) {
    const runSeed = hashSeed(`${masterSeed}|${input.puzzle?.date || ''}|${model.name}|${runIndex}`);
    results.push(simulateGame({ ...input, playerModel: model, simulationSeed: runSeed }, wordIndex, { ...options, preparedContext }));
  }
  const profiles = {};
  for (const count of options.profileRuns || [maxRuns]) profiles[count] = summarizeRunResults(results.slice(0, count));
  return { masterSeed, model: model.name, profiles, results, simulationMs: Number(process.hrtime.bigint() - started) / 1e6 };
}

module.exports = { runIncrementalMonteCarlo, summarizeRunResults };
