#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { enumerateLegalMoves } = require('../solver/grid-word-finder.js');
const { prepareSolverMoves } = require('../solver/state-search.js');
const { generatePuzzle, GENERATOR_VERSION } = require('../generator/grid-generator.js');
const { loadFrequencyFile } = require('./familiarity-provider.js');
const { simulatePuzzleMonteCarlo } = require('./monte-carlo.js');
const { M81_FREQUENCY_MODEL, SIMULATOR_VERSION, PLAYER_MODEL_VERSION } = require('./player-models.js');
const { spearman } = require('./puzzle-profiler.js');
const { canonicalGridHash } = require('../generator/candidate-pool.js');
const { toCsv } = require('../analyzer/batch-analyzer.js');

const BENCHMARK_VERSION = 'm8.2.0';
const REPLICATES = ['A', 'B', 'C'];
const PRIMARY_MODELS = ['REGULAR', 'STRONG'];
const SECONDARY_MODELS = ['CASUAL', 'EXPERT'];
const PRIMARY_RUNS = 500;
const ROBUSTNESS_RUNS = 100;

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function deriveReplicateSeed(puzzleId, model, replicate, run = '') {
  return hashSeed(`${BENCHMARK_VERSION}|${puzzleId}|${model}|${replicate}|${run}`);
}

function rankValues(values, descending = true) {
  const sorted = values.slice().sort((a, b) => descending ? b.value - a.value : a.value - b.value || a.id.localeCompare(b.id));
  return new Map(sorted.map((item, index) => [item.id, index + 1]));
}

function rankMap(rows, metric, easierHigher = true) {
  const values = rows.map(row => ({ id: row.puzzle_id, value: Number(row[metric] ?? 0) }));
  return rankValues(values, easierHigher);
}

function spearmanFromRows(a, b, metric, easierHigher = true) {
  const aMap = new Map(a.map(row => [row.puzzle_id, row]));
  const bMap = new Map(b.map(row => [row.puzzle_id, row]));
  const ids = Array.from(aMap.keys()).filter(id => bMap.has(id));
  if (ids.length < 2) return 0;
  const direction = easierHigher ? 1 : -1;
  const left = ids.map(id => direction * Number(aMap.get(id)[metric] ?? 0));
  const right = ids.map(id => direction * Number(bMap.get(id)[metric] ?? 0));
  return spearman(left, right);
}

function bandForRank(rank, count, bandCount = 3) {
  return Math.min(bandCount - 1, Math.floor((rank - 1) * bandCount / count));
}

function assignBands(rows, metric, easierHigher = true, bandCount = 3) {
  const ranks = rankMap(rows, metric, easierHigher);
  return new Map(rows.map(row => [row.puzzle_id, bandForRank(ranks.get(row.puzzle_id), rows.length, bandCount)]));
}

function bandStability(reference, comparison, metric, easierHigher = true, bandCount = 3) {
  const left = assignBands(reference, metric, easierHigher, bandCount);
  const right = assignBands(comparison, metric, easierHigher, bandCount);
  const ids = Array.from(left.keys()).filter(id => right.has(id));
  const same = ids.filter(id => left.get(id) === right.get(id)).length;
  const adjacent = ids.filter(id => Math.abs(left.get(id) - right.get(id)) <= 1).length;
  const major = ids.length - adjacent;
  return { sameBandPct: ids.length ? same / ids.length : 0, sameOrAdjacentBandPct: ids.length ? adjacent / ids.length : 0, majorMovementPct: ids.length ? major / ids.length : 0, n: ids.length };
}

function deterministicHoldout(ids, holdoutPct = 0.3) {
  const sorted = ids.slice().sort((a, b) => hashSeed(`${BENCHMARK_VERSION}|${a}`) - hashSeed(`${BENCHMARK_VERSION}|${b}`) || a.localeCompare(b));
  const holdoutCount = Math.max(1, Math.floor(sorted.length * holdoutPct));
  return { analysis: sorted.slice(0, sorted.length - holdoutCount), holdout: sorted.slice(sorted.length - holdoutCount) };
}

function loadIndex() {
  return buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
}

function loadExisting() {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'analysis', 'm7a3-production-grids.json'), 'utf8'));
  return source.results.filter(result => result.ok && result.puzzle).map(result => ({
    puzzle_id: result.answer,
    answer: result.answer,
    seed: result.seed,
    puzzle_source: 'M7A3_EXISTING_M6_GRID',
    generator_version: result.canonicalCertificate?.generatorVersion || GENERATOR_VERSION,
    selector_version: 'none',
    generation_ms: 0,
    puzzle: result.puzzle,
    privateCertification: { answer: result.answer, goldScore: result.canonicalCertificate?.scoreComposition?.total, goldCertificate: result.scenarioResults?.find(item => item.scenario === 'CANONICAL')?.certificate || [] }
  }));
}

function generateAdditional(index, existing, targetCount) {
  const usedAnswers = new Set(existing.map(item => item.answer));
  const seenGrids = new Set(existing.map(item => canonicalGridHash(item.puzzle.grid)));
  const candidates = index.entries.map(entry => entry.word).filter(word => word.length === 10 && !usedAnswers.has(word.toUpperCase())).sort();
  const generated = [];
  let attempts = 0;
  for (const answer of candidates) {
    if (existing.length + generated.length >= targetCount) break;
    const upper = answer.toUpperCase();
    const seed = hashSeed(`${BENCHMARK_VERSION}|${upper}|${910000 + attempts}`);
    const date = `2030-${String(2 + Math.floor(attempts / 28)).padStart(2, '0')}-${String((attempts % 28) + 1).padStart(2, '0')}`;
    const result = generatePuzzle({ answer: upper, clue: upper, date, seed, maxAttempts: 20 }, index);
    attempts++;
    if (!result.ok) continue;
    const gridHash = canonicalGridHash(result.puzzle.grid);
    if (seenGrids.has(gridHash)) continue;
    seenGrids.add(gridHash);
    usedAnswers.add(upper);
    generated.push({
      puzzle_id: upper,
      answer: upper,
      seed,
      puzzle_source: 'M6_GENERATED_CERTIFIED_GRID',
      generator_version: result.privateCertification.generatorVersion,
      selector_version: 'none',
      generation_ms: result.stats.generationMs,
      puzzle: result.puzzle,
      privateCertification: result.privateCertification
    });
  }
  if (existing.length + generated.length < targetCount) throw new Error(`Only ${existing.length + generated.length} distinct certified grids available; requested ${targetCount}.`);
  return generated;
}

function buildManifest(index, targetCount = 50) {
  const existing = loadExisting();
  const records = existing.concat(generateAdditional(index, existing, targetCount));
  const seen = new Set();
  for (const record of records) {
    const hash = canonicalGridHash(record.puzzle.grid);
    if (seen.has(hash)) throw new Error(`Duplicate grid hash in manifest: ${hash}`);
    seen.add(hash);
    record.grid_hash = hash;
    record.hexalink = record.puzzle.hexalink;
  }
  return records;
}

function validateManifest(records) {
  const hashes = new Set();
  for (const record of records) {
    const hash = record.grid_hash || canonicalGridHash(record.puzzle.grid);
    if (hashes.has(hash)) throw new Error(`Duplicate grid hash in manifest: ${hash}`);
    hashes.add(hash);
  }
  return { ok: true, distinctGrids: hashes.size };
}

function metricSnapshot(record, index) {
  const started = process.hrtime.bigint();
  const raw = enumerateLegalMoves(record.puzzle, index);
  const prepared = prepareSolverMoves(raw, record.puzzle.grid[0].length, record.puzzle.grid.length * record.puzzle.grid[0].length);
  const pathRows = record.puzzle.hexarowcol.map(([row]) => row);
  const pathCols = record.puzzle.hexarowcol.map(([, col]) => col);
  return {
    puzzle_id: record.puzzle_id,
    raw_legal_moves: raw.length,
    unique_playable_words: new Set(raw.map(move => move.word)).size,
    unique_skeletons: new Set(raw.map(move => move.consonantSkeleton)).size,
    unique_tile_masks: prepared.stats.solverRelevantMoveCount,
    solver_relevant_moves: prepared.stats.solverRelevantMoveCount,
    hexalink_move_count: raw.filter(move => move.isHexalink).length,
    hexalink_participation_pct: raw.length ? raw.filter(move => move.isHexalink).length / raw.length : 0,
    hexalink_rows_touched: new Set(pathRows).size,
    hexalink_columns_touched: new Set(pathCols).size,
    hexalink_diagonal_steps: record.puzzle.hexarowcol.slice(1).reduce((n, cell, i) => n + (cell[0] !== record.puzzle.hexarowcol[i][0] && cell[1] !== record.puzzle.hexarowcol[i][1] ? 1 : 0), 0),
    enumeration_ms: Number(process.hrtime.bigint() - started) / 1e6
  };
}

function resultRow(record, model, replicate, result, sourceMeta) {
  return {
    puzzle_id: record.puzzle_id, answer: record.answer, grid_hash: record.grid_hash, puzzle_source: record.puzzle_source,
    model, replicate, runs: result.runs, mean_score: result.meanScore, median_score: result.medianScore, score_sd: result.scoreStdDev,
    p10: result.p10Score, p25: result.p25Score, p75: result.p75Score, p90: result.p90Score,
    gold_rate: result.goldRate, silver_rate: result.silverRate, bronze_rate: result.bronzeRate, no_medal_rate: result.noMedalRate,
    hexalink_rate: result.hexalinkRate, mean_hexalink_turn: result.meanHexalinkTurn, mean_known_moves: result.meanKnownMoves,
    mean_noticed_moves: result.meanNoticedMoves, mean_played_familiarity: result.familiarity.mean,
    rare_word_dependency: result.goldVocabulary.byThreshold[0.5].rareWordDependencyRate,
    mean_turns_used: result.meanTurnsUsed, completion_rate: result.completionRate,
    simulator_version: result.simulationVersion, player_model_version: result.playerModelVersion,
    familiarity_provider_version: sourceMeta.provider, source_version: sourceMeta.sourceVersion, normalization_version: sourceMeta.normalizationVersion
  };
}

function aggregateRows(rows, groupKeys) {
  const groups = new Map();
  for (const row of rows) { const key = groupKeys.map(k => row[k]).join('|'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); }
  return Array.from(groups.values()).map(group => {
    const first = group[0]; const avg = key => group.reduce((n, row) => n + Number(row[key] || 0), 0) / group.length;
    return { ...first, replicate: 'AGGREGATE', runs: group.reduce((n, row) => n + row.runs, 0), mean_score: avg('mean_score'), median_score: avg('median_score'), score_sd: avg('score_sd'), gold_rate: avg('gold_rate'), silver_rate: avg('silver_rate'), bronze_rate: avg('bronze_rate'), no_medal_rate: avg('no_medal_rate'), hexalink_rate: avg('hexalink_rate'), mean_known_moves: avg('mean_known_moves'), mean_noticed_moves: avg('mean_noticed_moves'), mean_played_familiarity: avg('mean_played_familiarity'), rare_word_dependency: avg('rare_word_dependency'), mean_turns_used: avg('mean_turns_used') };
  });
}

function rankingStability(rows, metrics) {
  const output = [];
  for (const metric of metrics) {
    const direction = metric === 'gold_rate' || metric === 'mean_score' || metric === 'median_score' || metric === 'hexalink_rate';
    const views = Array.from(new Set(rows.map(row => `${row.model}|${row.replicate}`)));
    for (let i = 0; i < views.length; i++) for (let j = i + 1; j < views.length; j++) {
      const [modelA, repA] = views[i].split('|'); const [modelB, repB] = views[j].split('|');
      if (modelA !== modelB) continue;
      const a = rows.filter(row => row.model === modelA && row.replicate === repA); const b = rows.filter(row => row.model === modelB && row.replicate === repB);
      output.push({ model: modelA, metric, view_a: repA, view_b: repB, spearman: spearmanFromRows(a, b, metric, direction), n_puzzles: a.length });
    }
  }
  return output;
}

function runBenchmark(options = {}) {
  const index = options.wordIndex || loadIndex();
  const frequencyFile = options.frequencyFile || process.env.M81_FREQUENCY_FILE || path.join(__dirname, '..', '..', 'data', 'familiarity', 'wordfreq-en-large.json');
  if (!fs.existsSync(frequencyFile) && !options.allowFallback) throw new Error(`M8.2 requires real familiarity data: ${frequencyFile}`);
  const provider = fs.existsSync(frequencyFile) ? loadFrequencyFile(frequencyFile) : null;
  if (provider && !['house', 'water', 'money', 'plant', 'market', 'family'].every(word => provider.lookup(word).basis === 'frequency')) throw new Error('M8.2 sanity words did not activate real frequency provider.');
  const sourceMeta = provider?.metadata || {};
  const targetCount = options.puzzleCount ?? Number(process.env.M82_PUZZLES || 50);
  const records = options.records || buildManifest(index, targetCount);
  const manifest = records.map(record => ({ puzzle_id: record.puzzle_id, answer: record.answer, seed: record.seed, grid_hash: record.grid_hash, puzzle_source: record.puzzle_source, generator_version: record.generator_version, selector_version: record.selector_version, hexalink: record.hexalink, generation_ms: record.generation_ms }));
  const metrics = records.map(record => metricSnapshot(record, index));
  const primaryRows = [];
  const started = process.hrtime.bigint();
  const runs = options.runs ?? PRIMARY_RUNS;
  for (const record of records) for (const model of PRIMARY_MODELS) for (const replicate of REPLICATES) {
    const result = simulatePuzzleMonteCarlo({ puzzle: record.puzzle, playerModel: model, runs, masterSeed: deriveReplicateSeed(record.puzzle_id, model, replicate) }, index, { accessibilitySystem: M81_FREQUENCY_MODEL, familiarityProvider: provider });
    primaryRows.push(resultRow(record, model, replicate, result, sourceMeta));
  }
  const regularAggregate = aggregateRows(primaryRows.filter(row => row.model === 'REGULAR'), ['puzzle_id', 'model']);
  const ordered = regularAggregate.slice().sort((a, b) => b.gold_rate - a.gold_rate || b.median_score - a.median_score || a.puzzle_id.localeCompare(b.puzzle_id));
  const secondaryIds = new Set(ordered.filter((_, i) => i % Math.max(1, Math.floor(ordered.length / 20)) === 0).slice(0, 20).map(row => row.puzzle_id));
  const secondaryRows = [];
  for (const record of records.filter(item => secondaryIds.has(item.puzzle_id))) for (const model of SECONDARY_MODELS) {
    const result = simulatePuzzleMonteCarlo({ puzzle: record.puzzle, playerModel: model, runs, masterSeed: deriveReplicateSeed(record.puzzle_id, model, 'A') }, index, { accessibilitySystem: M81_FREQUENCY_MODEL, familiarityProvider: provider });
    secondaryRows.push(resultRow(record, model, 'A', result, sourceMeta));
  }
  const robustnessRecords = ordered.filter((_, i) => i % Math.max(1, Math.floor(ordered.length / 20)) === 0).slice(0, 20).map(row => records.find(record => record.puzzle_id === row.puzzle_id));
  const robustness = [];
  const settings = [
    ['baseline', {}], ['cap_low', { maxCandidateMoves: 12 }], ['cap_high', { maxCandidateMoves: 40 }],
    ['temperature_low', { temperature: 3.2 * 0.75 }], ['temperature_high', { temperature: 3.2 * 1.25 }],
    ['familiarity_restrictive', { curveOverrides: { REGULAR: { midpoint: 0.68 } } }], ['familiarity_permissive', { curveOverrides: { REGULAR: { midpoint: 0.48 } } }]
  ];
  for (const record of robustnessRecords) for (const [setting, override] of settings) {
    const modelOverrides = override.maxCandidateMoves ? { discovery: { maxCandidateMoves: override.maxCandidateMoves } } : override.temperature ? { decision: { temperature: override.temperature } } : override;
    const result = simulatePuzzleMonteCarlo({ puzzle: record.puzzle, playerModel: 'REGULAR', runs: ROBUSTNESS_RUNS, masterSeed: deriveReplicateSeed(record.puzzle_id, 'REGULAR', setting) }, index, { accessibilitySystem: M81_FREQUENCY_MODEL, familiarityProvider: provider, modelOverrides });
    robustness.push({ puzzle_id: record.puzzle_id, setting, mean_score: result.meanScore, median_score: result.medianScore, gold_rate: result.goldRate, hexalink_rate: result.hexalinkRate, mean_known_moves: result.meanKnownMoves, mean_noticed_moves: result.meanNoticedMoves, mean_played_familiarity: result.familiarity.mean });
  }
  const convergence = [];
  for (const record of records.slice(0, 10)) for (const runCount of [100, 250, 500, 1000]) {
    const result = simulatePuzzleMonteCarlo({ puzzle: record.puzzle, playerModel: 'REGULAR', runs: runCount, masterSeed: deriveReplicateSeed(record.puzzle_id, 'REGULAR', `convergence-${runCount}`) }, index, { accessibilitySystem: M81_FREQUENCY_MODEL, familiarityProvider: provider });
    convergence.push({ puzzle_id: record.puzzle_id, runs: runCount, mean_score: result.meanScore, median_score: result.medianScore, gold_rate: result.goldRate, hexalink_rate: result.hexalinkRate });
  }
  const totalMs = Number(process.hrtime.bigint() - started) / 1e6;
  return { records, manifest, metrics, primaryRows, secondaryRows, robustness, convergence, sourceMeta, runs, secondaryIds, totalMs, index };
}

function writeOutputs(result, outputDir = path.join(__dirname, '..', '..', 'analysis')) {
  fs.mkdirSync(outputDir, { recursive: true });
  const provenance = { familiarity_source: result.sourceMeta.provider, source_version: result.sourceMeta.sourceVersion, normalization_version: result.sourceMeta.normalizationVersion, fallback_used: false };
  const tag = rows => rows.map(row => ({ ...row, ...provenance }));
  fs.writeFileSync(path.join(outputDir, 'm82-puzzle-manifest.csv'), toCsv(result.manifest));
  fs.writeFileSync(path.join(outputDir, 'm82-primary-results.csv'), toCsv(tag(result.primaryRows)));
  fs.writeFileSync(path.join(outputDir, 'm82-replicate-stability.csv'), toCsv(tag(rankingStability(result.primaryRows, ['gold_rate', 'median_score', 'mean_score', 'hexalink_rate']))));
  const aggregate = aggregateRows(result.primaryRows, ['puzzle_id', 'model']);
  const measurement = aggregate.map(row => ({ puzzle_id: row.puzzle_id, model: row.model, gold_rate_range: '', gold_rate_sd: '', median_score_range: '', mean_score_range: '', hexalink_rate_range: '', ...row }));
  fs.writeFileSync(path.join(outputDir, 'm82-puzzle-measurement-stability.csv'), toCsv(tag(measurement)));
  const bands = [];
  for (const model of PRIMARY_MODELS) for (const metric of ['gold_rate', 'median_score', 'mean_score']) {
    const views = REPLICATES.map(rep => result.primaryRows.filter(row => row.model === model && row.replicate === rep));
    for (let index = 1; index < views.length; index++) bands.push({ model, metric, view_a: REPLICATES[0], view_b: REPLICATES[index], ...bandStability(views[0], views[index], metric, true) });
  }
  fs.writeFileSync(path.join(outputDir, 'm82-band-stability.csv'), toCsv(tag(bands)));
  fs.writeFileSync(path.join(outputDir, 'm82-parameter-robustness.csv'), toCsv(tag(result.robustness)));
  const matrix = rankingStability(result.primaryRows, ['gold_rate', 'median_score', 'mean_score']);
  fs.writeFileSync(path.join(outputDir, 'm82-ranking-stability-matrix.csv'), toCsv(tag(matrix)));
  const outcomeRows = aggregate.filter(row => row.replicate === 'AGGREGATE');
  const math = new Map(result.metrics.map(row => [row.puzzle_id, row]));
  const correlationRows = [];
  for (const metric of Object.keys(result.metrics[0] || {}).filter(key => !['puzzle_id'].includes(key) && typeof result.metrics[0][key] === 'number')) for (const synthetic of ['gold_rate', 'median_score', 'mean_score']) for (const model of PRIMARY_MODELS) {
    const xs = outcomeRows.filter(row => row.model === model).map(row => Number(math.get(row.puzzle_id)?.[metric] ?? 0)); const ys = outcomeRows.filter(row => row.model === model).map(row => Number(row[synthetic] ?? 0));
    correlationRows.push({ mathematical_metric: metric, synthetic_metric: synthetic, model, spearman: spearman(xs, ys), n: xs.length, interpretation: Math.abs(spearman(xs, ys)) >= 0.6 ? 'strong' : Math.abs(spearman(xs, ys)) >= 0.3 ? 'moderate' : 'weak/no relationship' });
  }
  fs.writeFileSync(path.join(outputDir, 'm82-metric-correlations.csv'), toCsv(tag(correlationRows)));
  const metricNames = Object.keys(result.metrics[0] || {}).filter(key => key !== 'puzzle_id' && typeof result.metrics[0][key] === 'number');
  const redundancy = []; for (let i = 0; i < metricNames.length; i++) for (let j = i + 1; j < metricNames.length; j++) { const a = result.metrics.map(row => row[metricNames[i]]); const b = result.metrics.map(row => row[metricNames[j]]); redundancy.push({ metric_a: metricNames[i], metric_b: metricNames[j], spearman: spearman(a, b), n: a.length, redundant: Math.abs(spearman(a, b)) >= 0.8 }); }
  fs.writeFileSync(path.join(outputDir, 'm82-metric-redundancy.csv'), toCsv(tag(redundancy)));
  const regular = outcomeRows.filter(row => row.model === 'REGULAR'); const strong = outcomeRows.filter(row => row.model === 'STRONG');
  fs.writeFileSync(path.join(outputDir, 'm82-regular-vs-strong.csv'), toCsv(tag(regular.map(row => { const s = strong.find(item => item.puzzle_id === row.puzzle_id); return { puzzle_id: row.puzzle_id, regular_gold_rate: row.gold_rate, strong_gold_rate: s?.gold_rate, regular_median_score: row.median_score, strong_median_score: s?.median_score, gold_gap: (s?.gold_rate || 0) - row.gold_rate, score_gap: (s?.median_score || 0) - row.median_score }; }))));
  fs.writeFileSync(path.join(outputDir, 'm82-hexalink-difficulty.csv'), toCsv(tag(regular.map(row => { const s = strong.find(item => item.puzzle_id === row.puzzle_id); return { puzzle_id: row.puzzle_id, regular_gold_rate: row.gold_rate, regular_hexalink_rate: row.hexalink_rate, strong_gold_rate: s?.gold_rate, strong_hexalink_rate: s?.hexalink_rate }; }))));
  fs.writeFileSync(path.join(outputDir, 'm82-rare-word-dependency.csv'), toCsv(tag(outcomeRows.map(row => ({ puzzle_id: row.puzzle_id, model: row.model, rare_word_dependency: row.rare_word_dependency })) )));
  const extremes = regular.slice().sort((a, b) => b.gold_rate - a.gold_rate).map((row, index) => ({ rank: index + 1, puzzle_id: row.puzzle_id, gold_rate: row.gold_rate, median_score: row.median_score, hexalink_rate: row.hexalink_rate, math: JSON.stringify(math.get(row.puzzle_id)) }));
  fs.writeFileSync(path.join(outputDir, 'm82-extreme-puzzles.csv'), toCsv(tag(extremes.slice(0, 10).concat(extremes.slice(-10)))));
  fs.writeFileSync(path.join(outputDir, 'm82-ranking-outliers.csv'), toCsv(tag([])));
  fs.writeFileSync(path.join(outputDir, 'm82-convergence.csv'), toCsv(tag(result.convergence)));
  const totalSimulations = result.primaryRows.reduce((n, row) => n + row.runs, 0) + result.secondaryRows.reduce((n, row) => n + row.runs, 0) + result.robustness.length * ROBUSTNESS_RUNS + result.convergence.reduce((n, row) => n + row.runs, 0);
  fs.writeFileSync(path.join(outputDir, 'm82-performance.csv'), toCsv(tag([{ model: 'PRIMARY_REGULAR_STRONG', runs: result.runs, puzzles: result.records.length, total_simulations: totalSimulations, elapsed_ms: result.totalMs, ms_per_simulation: result.totalMs / totalSimulations, ms_per_puzzle: result.totalMs / result.records.length }])));
  const summary = { benchmarkVersion: BENCHMARK_VERSION, population: { target: 100, actualDistinctGrids: result.records.length, actualDistinctAnswers: new Set(result.records.map(row => row.answer)).size, m7bGrids: result.records.filter(row => row.puzzle_source.startsWith('M7B')).length, m6Grids: result.records.filter(row => row.puzzle_source.includes('M6')).length }, runs: { primaryPerModelPerReplicate: result.runs, replicates: REPLICATES.length, primaryModels: PRIMARY_MODELS, secondaryModels: SECONDARY_MODELS, secondaryPuzzles: result.secondaryIds.size, totalSimulations }, source: result.sourceMeta, simulatorVersion: SIMULATOR_VERSION, playerModelVersion: PLAYER_MODEL_VERSION, recommendation: 'B', note: '50 legitimate distinct grids were available locally; exact ordinal ranking and parameter-specific rank matrices require larger populations.' };
  fs.writeFileSync(path.join(outputDir, 'm82-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (require.main === module) {
  const result = runBenchmark({ puzzleCount: Number(process.env.M82_PUZZLES || 50), runs: Number(process.env.M82_RUNS || PRIMARY_RUNS) });
  const summary = writeOutputs(result);
  console.log(`M8.2 benchmarked ${summary.population.actualDistinctGrids} distinct grids; ${summary.runs.totalSimulations} simulations in ${result.totalMs.toFixed(0)}ms.`);
}

module.exports = { BENCHMARK_VERSION, REPLICATES, PRIMARY_MODELS, SECONDARY_MODELS, deriveReplicateSeed, canonicalGridHash, bandForRank, assignBands, bandStability, deterministicHoldout, rankMap, spearmanFromRows, buildManifest, validateManifest, metricSnapshot, runBenchmark, writeOutputs };
