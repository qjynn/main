#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generatePuzzle } = require('../generator/grid-generator.js');
const { analyzePuzzle } = require('./puzzle-analyzer.js');
const { summary, round } = require('./metrics-utils.js');

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

function parseCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(header => header.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(value => value.trim());
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    return record;
  });
}

function loadDefaultWordIndex() {
  const vocabularyPath = path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt');
  return buildVocabularyIndex(parseWordList(fs.readFileSync(vocabularyPath, 'utf8')));
}

function scalarRow(analysis) {
  return {
    answer: analysis.answer || '',
    hexalink: analysis.hexalink,
    seed: analysis.reproducibility.seed ?? '',
    unique_words: analysis.vocabulary.uniqueWords,
    unique_masks: analysis.initialMoves.uniqueTileMasks,
    words_2_3: analysis.vocabulary.groupedWordLengths.short2To3,
    words_4_6: analysis.vocabulary.groupedWordLengths.medium4To6,
    words_7_10: analysis.vocabulary.groupedWordLengths.long7To10,
    max_first_score: analysis.scoring.immediateScores.max,
    median_first_score: analysis.scoring.immediateScores.median,
    gold_score: analysis.gold.certificate.goldScore,
    gold_turns: analysis.gold.certificate.turnsUsed,
    gold_without_hexalink: analysis.gold.goldReachableWithoutHexalink,
    gold_viable_first_moves: analysis.strategy.firstMoveGoldAccessibility.goldViableFirstMoveCount,
    gold_viable_first_move_pct: analysis.strategy.firstMoveGoldAccessibility.goldViableFirstMovePct,
    hexalink_rows_touched: analysis.hexalinkMetrics.rowsTouched,
    hexalink_columns_touched: analysis.hexalinkMetrics.columnsTouched,
    hexalink_direction_changes: analysis.hexalinkMetrics.directionChanges,
    analysis_ms: round(analysis.performance.totalAnalyzerMs)
  };
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))
  ].join('\n') + '\n';
}

function aggregateAnalyses(analyses) {
  const scalar = analyses.map(scalarRow);
  const values = key => scalar.map(row => Number(row[key])).filter(value => Number.isFinite(value));
  return {
    count: analyses.length,
    uniquePlayableWords: summary(values('unique_words')),
    uniqueTileMasks: summary(values('unique_masks')),
    shortWordCount: summary(values('words_2_3')),
    longWordCount: summary(values('words_7_10')),
    maximumFirstMoveScore: summary(values('max_first_score')),
    goldViableFirstMovePct: summary(values('gold_viable_first_move_pct')),
    goldTurns: summary(values('gold_turns')),
    analyzerRuntimeMs: summary(values('analysis_ms')),
    goldWithoutHexalinkRate: analyses.length
      ? analyses.filter(analysis => analysis.gold.goldReachableWithoutHexalink).length / analyses.length
      : 0
  };
}

function analyzeBatch(records, wordIndex, options = {}) {
  const analyses = [];
  const failures = [];
  const count = Math.min(records.length, options.count || records.length);

  for (let index = 0; index < count; index++) {
    const record = records[index];
    const generated = generatePuzzle({
      answer: record.answer,
      clue: record.clue || `Batch clue ${index + 1}`,
      date: record.date || `2026-10-${String(index + 1).padStart(2, '0')}`,
      seed: record.seed || (1000 + index),
      maxAttempts: options.maxAttempts || 20
    }, wordIndex);
    if (!generated.ok) {
      failures.push({ record, failure: generated.failure });
      continue;
    }
    const analysis = analyzePuzzle({
      puzzle: generated.puzzle,
      privateCertification: generated.privateCertification
    }, wordIndex, options.analysisOptions || {});
    if (analysis.ok) analyses.push(analysis);
    else failures.push({ record, failure: analysis.errors });
  }

  return {
    analyses,
    failures,
    aggregate: aggregateAnalyses(analyses),
    csvRows: analyses.map(scalarRow)
  };
}

function writeBatchOutputs(result, outputPath, csvPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({
    analyses: result.analyses,
    failures: result.failures,
    aggregate: result.aggregate
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
  const output = args.output || 'analysis/m7a-batch.json';
  const csv = args.csv || 'analysis/m7a-puzzles.csv';
  const result = analyzeBatch(records, wordIndex, {
    count: args.count ? Number(args.count) : undefined,
    maxAttempts: args['max-attempts'] ? Number(args['max-attempts']) : undefined,
    analysisOptions: {
      goldViableFirstMoveLimit: args['first-move-limit'] ? Number(args['first-move-limit']) : 25,
      maxGoldCertificates: args['max-gold-certificates'] ? Number(args['max-gold-certificates']) : 10
    }
  });
  writeBatchOutputs(result, output, csv);
  console.log(`Analyzed ${result.analyses.length} puzzles`);
  console.log(`Failures ${result.failures.length}`);
  console.log(`JSON ${output}`);
  console.log(`CSV ${csv}`);
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  parseCsv,
  scalarRow,
  toCsv,
  aggregateAnalyses,
  analyzeBatch,
  writeBatchOutputs
};
