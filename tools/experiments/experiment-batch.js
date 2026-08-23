#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { analyzePuzzle } = require('../analyzer/puzzle-analyzer.js');
const { parseCsv, toCsv } = require('../analyzer/batch-analyzer.js');
const { summary, round } = require('../analyzer/metrics-utils.js');
const { STRATEGIES } = require('./placement-strategies.js');
const { generateExperimentalPuzzle } = require('./strategic-experiment.js');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      index++;
    }
  }
  return args;
}

function loadDefaultWordIndex() {
  return buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
}

function scalarExperimentRow(record) {
  const analysis = record.analysis;
  return {
    strategy: record.strategy,
    answer: analysis.answer,
    seed: analysis.reproducibility.seed,
    ok: true,
    unique_words: analysis.vocabulary.uniqueWords,
    unique_masks: analysis.initialMoves.uniqueTileMasks,
    short_word_pct: analysis.vocabulary.groupedWordLengths.shortPct,
    long_words: analysis.vocabulary.groupedWordLengths.long7To10,
    max_first_score: analysis.scoring.immediateScores.max,
    high_value_first_moves: analysis.scoring.firstMoveScoreCounts.gte20,
    gold_score: analysis.gold.certificate.goldScore,
    gold_turns: analysis.gold.certificate.turnsUsed,
    gold_without_hexalink: analysis.gold.goldReachableWithoutHexalink,
    gold_with_hexalink_required: analysis.gold.goldReachableWithHexalinkRequired,
    gold_viable_first_moves: analysis.strategy.firstMoveGoldAccessibility.goldViableFirstMoveCount,
    gold_viable_first_move_pct: analysis.strategy.firstMoveGoldAccessibility.goldViableFirstMovePct,
    tile_participation_min: analysis.coverage.tiles.min,
    tile_participation_max: analysis.coverage.tiles.max,
    tile_participation_spread: analysis.coverage.tiles.max - analysis.coverage.tiles.min,
    hexalink_direction_changes: analysis.hexalinkMetrics.directionChanges,
    analysis_ms: round(analysis.performance.totalAnalyzerMs)
  };
}

function summarizeByStrategy(records) {
  const byStrategy = new Map();
  for (const record of records) {
    if (!record.ok) continue;
    if (!byStrategy.has(record.strategy)) byStrategy.set(record.strategy, []);
    byStrategy.get(record.strategy).push(scalarExperimentRow(record));
  }
  const values = (rows, key) => rows.map(row => Number(row[key])).filter(value => Number.isFinite(value));
  const result = {};
  for (const [strategy, rows] of byStrategy.entries()) {
    result[strategy] = {
      count: rows.length,
      uniqueWords: summary(values(rows, 'unique_words')),
      uniqueMasks: summary(values(rows, 'unique_masks')),
      highValueFirstMoves: summary(values(rows, 'high_value_first_moves')),
      goldViableFirstMovePct: summary(values(rows, 'gold_viable_first_move_pct')),
      tileParticipationSpread: summary(values(rows, 'tile_participation_spread')),
      goldWithoutHexalinkRate: rows.filter(row => row.gold_without_hexalink === true || row.gold_without_hexalink === 'true').length / rows.length
    };
  }
  return result;
}

function runExperimentBatch(records, wordIndex, options = {}) {
  const strategies = options.strategies || Object.values(STRATEGIES);
  const count = Math.min(records.length, options.count || records.length);
  const results = [];
  const failures = [];

  for (let recordIndex = 0; recordIndex < count; recordIndex++) {
    const record = records[recordIndex];
    for (const strategy of strategies) {
      const generated = generateExperimentalPuzzle({
        answer: record.answer,
        clue: record.clue || `Experiment clue ${recordIndex + 1}`,
        date: record.date || `2026-11-${String(recordIndex + 1).padStart(2, '0')}`,
        seed: Number(record.seed || 1000 + recordIndex),
        strategy,
        maxAttempts: options.maxAttempts || 10
      }, wordIndex, options.generationOptions || {});
      if (!generated.ok) {
        const failure = { ok: false, strategy, answer: record.answer, failure: generated.failure };
        failures.push(failure);
        results.push(failure);
        continue;
      }
      const analysis = analyzePuzzle({
        puzzle: generated.puzzle,
        privateCertification: generated.privateCertification
      }, wordIndex, options.analysisOptions || {});
      if (!analysis.ok) {
        const failure = { ok: false, strategy, answer: record.answer, failure: analysis.errors };
        failures.push(failure);
        results.push(failure);
        continue;
      }
      results.push({ ok: true, strategy, generated, analysis });
    }
  }

  const successful = results.filter(result => result.ok);
  return {
    results,
    failures,
    strategySummary: summarizeByStrategy(successful),
    csvRows: successful.map(scalarExperimentRow)
  };
}

function writeExperimentOutputs(result, outputPath, csvPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({
    results: result.results,
    failures: result.failures,
    strategySummary: result.strategySummary
  }, null, 2)}\n`);
  if (csvPath) {
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    fs.writeFileSync(csvPath, toCsv(result.csvRows));
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const wordIndex = loadDefaultWordIndex();
  const records = parseCsv(fs.readFileSync(args.input, 'utf8'));
  const strategies = args.strategies ? args.strategies.split(',') : Object.values(STRATEGIES);
  const output = args.output || 'analysis/m7a1-strategy-experiment.json';
  const csv = args.csv || 'analysis/m7a1-strategy-experiment.csv';
  const result = runExperimentBatch(records, wordIndex, {
    strategies,
    count: args.count ? Number(args.count) : undefined,
    maxAttempts: args['max-attempts'] ? Number(args['max-attempts']) : 10,
    analysisOptions: {
      goldViableFirstMoveLimit: args['first-move-limit'] ? Number(args['first-move-limit']) : 10,
      maxGoldCertificates: args['max-gold-certificates'] ? Number(args['max-gold-certificates']) : 5,
      hexalinkAnalysisMaxStates: args['hexalink-max-states'] ? Number(args['hexalink-max-states']) : 5000
    }
  });
  writeExperimentOutputs(result, output, csv);
  console.log(`Experiment results ${result.results.length}`);
  console.log(`Failures ${result.failures.length}`);
  console.log(`JSON ${output}`);
  console.log(`CSV ${csv}`);
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  scalarExperimentRow,
  summarizeByStrategy,
  runExperimentBatch,
  writeExperimentOutputs
};
