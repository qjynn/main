const { simulateGame, hashSeed } = require('./simulate-game.js');
const { resolvePlayerModel } = require('./player-models.js');
const { createSolverContext } = require('../solver/state-search.js');

function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * pct / 100) - 1))];
}
function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}
function confidenceInterval(rate, runs) {
  const margin = 1.96 * Math.sqrt(Math.max(0, rate * (1 - rate)) / Math.max(1, runs));
  return { lower: Math.max(0, rate - margin), upper: Math.min(1, rate + margin) };
}

function goldVocabularyMetrics(results, thresholds = [0.25, 0.5, 0.75]) {
  const gold = results.filter(result => result.medal === 'gold');
  const goldWords = gold.flatMap(result => result.moveHistory.filter(move => move.type === 'move'));
  const familiarity = goldWords.map(move => move.accessibility).filter(Number.isFinite);
  const low = threshold => gold.length ? gold.filter(result => {
    const words = result.moveHistory.filter(move => move.type === 'move');
    return words.some(move => Number.isFinite(move.accessibility) && move.accessibility < threshold);
  }).length / gold.length : 0;
  const multipleLow = threshold => gold.length ? gold.filter(result => {
    const words = result.moveHistory.filter(move => move.type === 'move');
    return words.filter(move => Number.isFinite(move.accessibility) && move.accessibility < threshold).length >= 2;
  }).length / gold.length : 0;
  return {
    goldGames: gold.length,
    meanGoldWordFamiliarity: mean(familiarity),
    medianGoldWordFamiliarity: percentile(familiarity, 50),
    leastFamiliarGoldWord: goldWords.sort((a, b) => a.accessibility - b.accessibility)[0]?.word || null,
    byThreshold: Object.fromEntries(thresholds.map(threshold => [threshold, { familiarOnlyGoldRate: gold.length ? gold.filter(result => result.moveHistory.filter(move => move.type === 'move').every(move => move.accessibility >= threshold)).length / gold.length : 0, rareWordDependencyRate: low(threshold), multipleRareWordDependencyRate: multipleLow(threshold) }]))
  };
}

function simulatePuzzleMonteCarlo(input, wordIndex, options = {}) {
  const model = resolvePlayerModel(input.playerModel || options.playerModel || 'REGULAR', options.modelOverrides || {});
  const runs = Math.max(1, Math.floor(input.runs ?? options.runs ?? 1000));
  const masterSeed = input.masterSeed ?? options.masterSeed ?? hashSeed(`${input.puzzle?.date || ''}|${model.name}`);
  const preparedContext = options.preparedContext || createSolverContext(input.puzzle, wordIndex, { moveFilter: options.moveFilter });
  const results = [];
  const started = process.hrtime.bigint();
  for (let index = 0; index < runs; index++) {
    const runSeed = hashSeed(`${masterSeed}|${input.puzzle?.date || ''}|${model.name}|${index}`);
    results.push(simulateGame({ ...input, playerModel: model, simulationSeed: runSeed }, wordIndex, { ...options, preparedContext }));
  }
  const scores = results.map(result => result.finalScore);
  const goldRate = results.filter(result => result.medal === 'gold').length / runs;
  const count = medal => results.filter(result => result.medal === medal).length / runs;
  const hexTurns = results.map(result => result.hexalinkTurn).filter(Number.isFinite);
  const numeric = key => mean(results.map(result => result[key]));
  const diagnostics = results.flatMap(result => result.simulationMetadata.discoveryDiagnostics || []);
  return {
    runs,
    playerModel: model.name,
    masterSeed,
    meanScore: mean(scores),
    medianScore: percentile(scores, 50),
    scoreStdDev: standardDeviation(scores),
    p10Score: percentile(scores, 10), p25Score: percentile(scores, 25),
    p75Score: percentile(scores, 75), p90Score: percentile(scores, 90),
    goldRate, silverRate: count('silver'), bronzeRate: count('bronze'), noMedalRate: count('none'),
    goldRate95Ci: confidenceInterval(goldRate, runs),
    hexalinkRate: results.filter(result => result.hexalinkFound).length / runs,
    meanHexalinkTurn: mean(hexTurns), medianHexalinkTurn: percentile(hexTurns, 50),
    completionRate: results.filter(result => result.completed).length / runs,
    meanTurnsUsed: numeric('turnsPlayed'), meanRowsCompleted: numeric('rowsCompleted'),
    meanColumnsCompleted: numeric('columnsCompleted'), meanInvalidAttempts: numeric('invalidAttempts'),
    meanHintUse: numeric('hintUsed'), meanValidWords: numeric('wordsPlayed'),
    meanKnownMoves: mean(diagnostics.map(item => item.estimatedKnownMoves)),
    meanNoticedMoves: mean(diagnostics.map(item => item.noticedMoves)),
    meanSampledMoves: mean(diagnostics.map(item => item.sampledMoves)),
    meanLegalMovesAvailable: mean(diagnostics.map(item => item.legalMovesAvailable)),
    goldVocabulary: goldVocabularyMetrics(results),
    meanImmediateScorePerTurn: mean(results.flatMap(result => result.moveHistory.filter(move => move.type === 'move').map(move => move.scoreDelta))),
    meanWordLength: mean(results.flatMap(result => result.moveHistory.filter(move => move.type === 'move').map(move => move.word.length))),
    meanRemainingLegalMoves: mean(results.flatMap(result => result.moveHistory.filter(move => move.type === 'move').map(move => move.remainingLegalMoves))),
    familiarity: {
      mean: mean(results.flatMap(result => result.moveHistory.filter(move => move.type === 'move').map(move => move.accessibility).filter(Number.isFinite))),
      median: percentile(results.flatMap(result => result.moveHistory.filter(move => move.type === 'move').map(move => move.accessibility).filter(Number.isFinite)), 50),
      leastAccessibleWord: results.flatMap(result => result.moveHistory.filter(move => move.type === 'move').map(move => ({ word: move.word, value: move.accessibility }))).sort((a, b) => a.value - b.value)[0] || null,
      advancedWordFraction: (() => { const words = results.flatMap(result => result.moveHistory.filter(move => move.type === 'move')); return words.length ? words.filter(move => move.accessibility < 0.4).length / words.length : 0; })()
    },
    simulationMs: Number(process.hrtime.bigint() - started) / 1e6,
    simulationVersion: results[0]?.simulationMetadata.simulatorVersion || 'm8.0',
    playerModelVersion: results[0]?.simulationMetadata.playerModelVersion || 'm8.players.0'
  };
}

module.exports = { simulatePuzzleMonteCarlo, percentile, standardDeviation, confidenceInterval, goldVocabularyMetrics };
