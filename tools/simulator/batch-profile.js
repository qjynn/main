#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generatePuzzle } = require('../generator/grid-generator.js');
const { profilePuzzle, HUMAN_MODELS, profileSpread, spearman } = require('./puzzle-profiler.js');
const { toCsv } = require('../analyzer/batch-analyzer.js');
const { hashSeed } = require('./simulate-game.js');

const ANSWERS = Object.freeze([
  'WATERMELON', 'OSCILLATED', 'ABANDONING', 'ABSOLUTELY', 'ACCESSIBLE', 'ACCOUNTING',
  'ADVENTURES', 'AGGRAVATED', 'AFTERTASTE', 'AFFORDABLE', 'ABSTAINING', 'ACCIDENTAL',
  'ADJECTIVES', 'AESTHETICS', 'AIRFREIGHT', 'ALCOHOLISM', 'ALLIGATORS', 'AMBULANCES',
  'ANCHOVIES', 'APOLOGIZED', 'BEAUTIFUL', 'CELEBRATED', 'CHOCOLATE', 'DISCOVERED',
  'EDUCATION', 'FANTASTIC', 'HIGHLIGHT', 'IMPORTANT', 'KNOWLEDGE', 'LANGUAGES'
]);

function loadIndex() {
  return buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
}

function generateDataset(wordIndex, count = 30) {
  const dataset = [];
  const failures = [];
  ANSWERS.slice(0, count).forEach((answer, index) => {
    const generated = generatePuzzle({ answer, clue: `Clue for ${answer.toLowerCase()}`, date: `2028-01-${String(index + 1).padStart(2, '0')}`, seed: 880000 + index, maxAttempts: 20 }, wordIndex);
    if (generated.ok) dataset.push({ puzzleId: answer, answer, masterSeed: 880000 + index, puzzleSource: 'M6_CERTIFIED_GRID', puzzle: generated.puzzle, privateCertification: generated.privateCertification });
    else failures.push({ answer, failure: generated.failure });
  });
  return { dataset, failures };
}

function loadExistingDataset(count = 30) {
  const sourcePath = path.join(__dirname, '..', '..', 'analysis', 'm7a3-production-grids.json');
  if (!fs.existsSync(sourcePath)) return null;
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const valid = (source.results || []).filter(result => result.ok && result.puzzle);
  if (!valid.length) return null;
  const dataset = [];
  for (let repeat = 0; dataset.length < count; repeat++) {
    for (const result of valid) {
      if (dataset.length >= count) break;
      const certificate = result.canonicalCertificate?.certificate || result.scenarioResults?.find(item => item.scenario === 'CANONICAL')?.certificate || [];
      const score = certificate.at(-1)?.cumulativeScore || result.canonicalCertificate?.scoreComposition?.total || 0;
      dataset.push({
        puzzleId: `${result.answer}#${repeat + 1}`,
        answer: result.answer,
        masterSeed: result.seed + repeat * 100000,
        puzzleSource: 'M7A3_EXISTING_M6_GRID',
        puzzle: result.puzzle,
        privateCertification: { answer: result.answer, goldScore: score, goldCertificate: certificate }
      });
    }
  }
  return { dataset, failures: [] };
}

function profileRow(profile, model) {
  const result = profile.models[model];
  return {
    puzzle_id: profile.puzzleId, answer: profile.answer, seed: profile.seed, puzzle_source: profile.puzzleSource,
    player_model: model, runs: result.runs ?? 1, mean_score: result.meanScore, median_score: result.medianScore,
    score_std_dev: result.scoreStdDev ?? 0, p10_score: result.p10Score, p25_score: result.p25Score,
    p75_score: result.p75Score, p90_score: result.p90Score, gold_rate: result.goldRate,
    silver_rate: result.silverRate, bronze_rate: result.bronzeRate, no_medal_rate: result.noMedalRate,
    hexalink_rate: result.hexalinkRate, mean_hexalink_turn: result.meanHexalinkTurn ?? '',
    completion_rate: result.completionRate, mean_turns_used: result.meanTurnsUsed,
    mean_rows_completed: result.meanRowsCompleted, mean_columns_completed: result.meanColumnsCompleted,
    mean_invalid_attempts: result.meanInvalidAttempts, mean_hint_use: result.meanHintUse,
    mean_valid_words: result.meanValidWords, simulation_ms: result.simulationMs
  };
}

function runBatch(options = {}) {
  const index = options.wordIndex || loadIndex();
  const datasetResult = options.dataset
    ? { dataset: options.dataset, failures: [] }
    : (options.useExistingDataset ? loadExistingDataset(options.puzzleCount ?? 30) : null) || generateDataset(index, options.puzzleCount ?? 30);
  const runs = options.runs ?? Number(process.env.M8_RUNS || 250);
  const profiles = datasetResult.dataset.map(record => profilePuzzle(record, index, { ...options, runs, models: HUMAN_MODELS }));
  const convergence = [];
  const representative = datasetResult.dataset[0];
  for (const count of [100, 250, 500]) {
    const result = profilePuzzle(representative, index, { ...options, runs: count, models: ['REGULAR'] });
    convergence.push({ runs: count, model: 'REGULAR', mean_score: result.models.REGULAR.meanScore, gold_rate: result.models.REGULAR.goldRate, hexalink_rate: result.models.REGULAR.hexalinkRate });
  }
  const sensitivity = [];
  for (const setting of [
    { parameter: 'maxCandidateMoves', value: 8, modelOverrides: { discovery: { maxCandidateMoves: 8 } } },
    { parameter: 'maxCandidateMoves', value: 40, modelOverrides: { discovery: { maxCandidateMoves: 40 } } },
    { parameter: 'temperature', value: 1.5, modelOverrides: { decision: { temperature: 1.5 } } },
    { parameter: 'temperature', value: 5, modelOverrides: { decision: { temperature: 5 } } },
    { parameter: 'hexalinkRecognition', value: 0.2, modelOverrides: { hexalink: { baseRecognitionProbability: 0.2 } } },
    { parameter: 'hexalinkRecognition', value: 0.7, modelOverrides: { hexalink: { baseRecognitionProbability: 0.7 } } }
  ]) {
    const result = profilePuzzle(representative, index, { ...options, runs: 100, models: ['REGULAR'], modelOverrides: setting.modelOverrides });
    sensitivity.push({ parameter: setting.parameter, model: 'REGULAR', setting: setting.value, mean_score: result.models.REGULAR.meanScore, gold_rate: result.models.REGULAR.goldRate });
  }
  const modelRows = [...HUMAN_MODELS, 'ORACLE'].map(model => {
    const values = profiles.map(profile => profile.models[model]);
    return { player_model: model, mean_puzzle_score: values.reduce((sum, value) => sum + value.meanScore, 0) / Math.max(1, values.length), mean_gold_rate: values.reduce((sum, value) => sum + value.goldRate, 0) / Math.max(1, values.length), mean_silver_rate: values.reduce((sum, value) => sum + value.silverRate, 0) / Math.max(1, values.length), mean_bronze_rate: values.reduce((sum, value) => sum + value.bronzeRate, 0) / Math.max(1, values.length), mean_hexalink_rate: values.reduce((sum, value) => sum + value.hexalinkRate, 0) / Math.max(1, values.length), mean_completion_rate: values.reduce((sum, value) => sum + value.completionRate, 0) / Math.max(1, values.length) };
  });
  const summary = { puzzleCount: profiles.length, distinctAnswers: new Set(datasetResult.dataset.map(item => item.answer)).size, repeatedSeedComposition: datasetResult.dataset.length > new Set(datasetResult.dataset.map(item => item.answer)).size, failures: datasetResult.failures, runsPerModel: runs, models: modelRows, spread: Object.fromEntries(HUMAN_MODELS.map(model => [model, profileSpread(profiles, model)])), skillOrdering: { regularVsCasual: orderingRate(profiles, 'REGULAR', 'CASUAL'), strongVsRegular: orderingRate(profiles, 'STRONG', 'REGULAR'), expertVsStrong: orderingRate(profiles, 'EXPERT', 'STRONG') }, rankCorrelations: { casualRegular: correlation(profiles, 'CASUAL', 'REGULAR'), regularStrong: correlation(profiles, 'REGULAR', 'STRONG'), strongExpert: correlation(profiles, 'STRONG', 'EXPERT') }, familiarityBasis: options.frequencyProvider || options.familiarityProvider ? 'provider' : 'heuristic' };
  return { profiles, summary: { ...summary, convergence, sensitivity, m6VsM7b: 'not available: no paired M7B puzzle artifact in repository' }, convergence, sensitivity, dataset: datasetResult.dataset };
}

function orderingRate(profiles, stronger, weaker) {
  if (!profiles.length) return 0;
  return profiles.filter(profile => profile.models[stronger].meanScore >= profile.models[weaker].meanScore).length / profiles.length;
}
function correlation(profiles, a, b) {
  return spearman(profiles.map(profile => profile.models[a].goldRate), profiles.map(profile => profile.models[b].goldRate));
}

function writeOutputs(result, outputDir = 'analysis') {
  fs.mkdirSync(outputDir, { recursive: true });
  const rows = result.profiles.flatMap(profile => [...HUMAN_MODELS, 'ORACLE'].map(model => profileRow(profile, model)));
  fs.writeFileSync(path.join(outputDir, 'm8-puzzle-profiles.json'), `${JSON.stringify(result.profiles, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'm8-puzzle-profiles.csv'), toCsv(rows));
  fs.writeFileSync(path.join(outputDir, 'm8-model-summary.csv'), toCsv(result.summary.models));
  fs.writeFileSync(path.join(outputDir, 'm8-score-distributions.csv'), toCsv(rows.map(row => ({ puzzle_id: row.puzzle_id, player_model: row.player_model, runs: row.runs, mean_score: row.mean_score, median_score: row.median_score, p10_score: row.p10_score, p25_score: row.p25_score, p75_score: row.p75_score, p90_score: row.p90_score, gold_rate: row.gold_rate }))));
  fs.writeFileSync(path.join(outputDir, 'm8-convergence.csv'), toCsv(result.convergence));
  fs.writeFileSync(path.join(outputDir, 'm8-model-sensitivity.csv'), toCsv(result.sensitivity));
  fs.writeFileSync(path.join(outputDir, 'm8-m6-vs-m7b.csv'), 'answer,player_model,mean_score_delta,gold_rate_delta,hexalink_rate_delta\n');
  fs.writeFileSync(path.join(outputDir, 'm8-summary.json'), `${JSON.stringify(result.summary, null, 2)}\n`);
}

if (require.main === module) {
  const result = runBatch({ puzzleCount: Number(process.env.M8_PUZZLES || 30), runs: Number(process.env.M8_RUNS || 250), useExistingDataset: process.env.M8_SOURCE !== 'generate' });
  writeOutputs(result);
  console.log(`M8 profiled ${result.profiles.length} puzzles at ${result.summary.runsPerModel} runs/model.`);
  console.log(`M8 generation failures: ${result.summary.failures.length}`);
}

module.exports = { ANSWERS, generateDataset, runBatch, writeOutputs, profileRow };
