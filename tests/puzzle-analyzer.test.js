const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const { generatePuzzle } = require('../tools/generator/grid-generator.js');
const { enumerateLegalMoves } = require('../tools/solver/grid-word-finder.js');
const {
  analyzePuzzle,
  legalMoveContext,
  vocabularyMetrics,
  pathMetrics,
  scoreFirstMoves,
  scoringMetrics,
  topFirstMoves,
  hexalinkMetrics,
  filteredFindGold,
  firstMoveGoldAccessibility,
  boundedGoldCertificates,
  familiarityMetrics
} = require('../tools/analyzer/puzzle-analyzer.js');
const {
  parseCsv,
  analyzeBatch,
  writeBatchOutputs,
  toCsv
} = require('../tools/analyzer/batch-analyzer.js');
const { replaySequence } = require('../tools/solver/state-search.js');

let fullIndex;
let generated;
let analysis;

function getFullIndex() {
  if (!fullIndex) {
    fullIndex = buildVocabularyIndex(parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8')));
  }
  return fullIndex;
}

function getGenerated() {
  if (!generated) {
    generated = generatePuzzle({
      answer: 'WATERMELON',
      clue: 'Large summer striped fruit',
      date: '2026-09-01',
      seed: 123456,
      maxAttempts: 5
    }, getFullIndex());
  }
  assert.equal(generated.ok, true);
  return generated;
}

function getAnalysis() {
  if (!analysis) {
    const result = getGenerated();
    analysis = analyzePuzzle({
      puzzle: result.puzzle,
      privateCertification: result.privateCertification
    }, getFullIndex(), {
      goldViableFirstMoveLimit: 5,
      maxGoldCertificates: 3,
      hexalinkAnalysisMaxStates: 10000
    });
  }
  assert.equal(analysis.ok, true);
  return analysis;
}

test('M7A analyzer accepts a valid M6 puzzle', () => {
  assert.equal(getAnalysis().ok, true);
});

test('M7A invalid puzzle is rejected', () => {
  const result = getGenerated();
  const invalid = { ...result.puzzle, grid: [['W']] };
  const rejected = analyzePuzzle({ puzzle: invalid, privateCertification: result.privateCertification }, getFullIndex());
  assert.equal(rejected.ok, false);
});

test('M7A raw move count matches M4 enumeration', () => {
  const result = getGenerated();
  const direct = enumerateLegalMoves(result.puzzle, getFullIndex());
  assert.equal(getAnalysis().initialMoves.rawLegalWordPathMoves, direct.length);
});

test('M7A unique-word count is correct on a handcrafted board', () => {
  const moves = enumerateLegalMoves({ grid: [['C', 'T']] }, buildVocabularyIndex(['cat', 'coat', 'cute']));
  assert.equal(vocabularyMetrics(moves).uniqueWords, 3);
});

test('M7A word-length distribution sums correctly', () => {
  const vocab = getAnalysis().vocabulary;
  const total = Object.values(vocab.wordLengthDistribution).reduce((sum, bucket) => sum + bucket.count, 0);
  assert.equal(total, vocab.uniqueWords);
});

test('M7A skeleton counts are correct', () => {
  const moves = enumerateLegalMoves({ grid: [['C', 'T']] }, buildVocabularyIndex(['cat', 'coat', 'cute']));
  const metrics = vocabularyMetrics(moves);
  assert.equal(metrics.uniqueConsonantSkeletons, 1);
  assert.equal(metrics.wordsPerSkeleton.max, 3);
});

test('M7A path-length counts are correct', () => {
  const moves = enumerateLegalMoves({ grid: [['B', 'C', 'D']] }, buildVocabularyIndex(['bc', 'bcd']));
  const metrics = pathMetrics(moves, 3);
  assert.equal(metrics.pathLengths[2].uniquePaths, 1);
  assert.equal(metrics.pathLengths[3].uniquePaths, 1);
});

test('M7A tile-mask deduplication is correct', () => {
  const moves = enumerateLegalMoves({ grid: [['B', 'C', 'D', 'F', 'G', 'H']] }, buildVocabularyIndex(['bcdfgh', 'bacodefugh']));
  const context = legalMoveContext({ grid: [['B', 'C', 'D', 'F', 'G', 'H']] }, buildVocabularyIndex(['bcdfgh', 'bacodefugh']));
  assert.equal(moves.length, 2);
  assert.equal(context.prepared.stats.solverRelevantMoveCount, 1);
});

test('M7A scoring distribution uses canonical rules', () => {
  const board = {
    grid: [
      ['W', 'T', 'R', 'M', 'L', 'N'],
      ['X', 'X', 'X', 'X', 'X', 'X']
    ],
    hexalink: 'WTRMLN',
    hexarowcol: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]
  };
  const context = legalMoveContext(board, buildVocabularyIndex(['watermelon']));
  const scored = scoreFirstMoves(board, context.prepared.moves);
  const metrics = scoringMetrics(scored);
  assert.equal(metrics.immediateScores.max, 40);
});

test('M7A top first moves are ordered correctly', () => {
  const top = topFirstMoves(getAnalysis().topFirstMoves, 3);
  assert.ok(top[0].immediateScore >= top.at(-1).immediateScore);
});

test('M7A same-mask word variants do not inflate strategic move count', () => {
  const board = { grid: [['B', 'C', 'D', 'F', 'G', 'H']] };
  const context = legalMoveContext(board, buildVocabularyIndex(['bcdfgh', 'bacodefugh']));
  assert.equal(context.rawMoves.length, 2);
  assert.equal(context.prepared.stats.solverRelevantMoveCount, 1);
});

test('M7A Hexalink geometry metrics are correct', () => {
  const puzzle = {
    hexalink: 'WTRMLN',
    hexarowcol: [[0, 0], [0, 1], [1, 2], [2, 2], [2, 1], [1, 0]]
  };
  const metrics = hexalinkMetrics(puzzle, buildVocabularyIndex(['watermelon']), 'WATERMELON');
  assert.equal(metrics.horizontalSteps, 2);
  assert.equal(metrics.verticalSteps, 1);
  assert.equal(metrics.diagonalSteps, 2);
  assert.equal(metrics.directionChanges, 4);
});

test('M7A competing Hexalink vocabulary words are detected', () => {
  const puzzle = { hexalink: 'WTRMLN', hexarowcol: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] };
  const index = buildVocabularyIndex(['watermelon', 'watermelan']);
  const metrics = hexalinkMetrics(puzzle, index, 'WATERMELON');
  assert.equal(metrics.intendedAnswerTenLetterStatus, 'one-of-several');
  assert.deepEqual(metrics.competingTenLetterWords, ['watermelan']);
});

test('M7A normal Gold search matches M5 certificate replay', () => {
  const result = getGenerated();
  const report = getAnalysis();
  const replay = replaySequence(result.puzzle, report.gold.certificate.sequence);
  assert.equal(report.gold.goldReachableNormally, true);
  assert.equal(replay.score, report.gold.certificate.goldScore);
});

test('M7A no-Hexalink Gold search prohibits exact Hexalink moves', () => {
  const result = filteredFindGold(getGenerated().puzzle, getFullIndex(), { excludeHexalink: true, maxStates: 5000 });
  if (result.goldCertificate) {
    assert.equal(result.goldCertificate.some(move => move.isHexalink), false);
  }
});

test('M7A Gold certificate replay succeeds', () => {
  assert.equal(getAnalysis().gold.certificate.replaySucceeded, true);
});

test('M7A Gold-certificate metrics are correct', () => {
  const cert = getAnalysis().gold.certificate;
  assert.equal(cert.goldScore, cert.replayScore);
  assert.equal(cert.turnsUsed, cert.sequence.length);
});

test('M7A Gold-viable first-move count is correct on a small handcrafted board', () => {
  const board = {
    grid: [
      ['B', 'C'],
      ['D', 'F'],
      ['G', 'H'],
      ['J', 'K'],
      ['L', 'M']
    ]
  };
  const index = buildVocabularyIndex(['bc', 'df', 'gh', 'jk', 'lm']);
  const context = legalMoveContext(board, index);
  const scored = scoreFirstMoves(board, context.prepared.moves);
  const accessibility = firstMoveGoldAccessibility(board, index, scored, { goldViableFirstMoveLimit: Infinity });
  assert.equal(accessibility.exact, true);
  assert.equal(accessibility.goldViableFirstMoveCount, 5);
});

test('M7A tile participation matrix is correct', () => {
  const report = getAnalysis();
  assert.equal(report.coverage.tiles.matrix.length, 8);
  assert.equal(report.coverage.tiles.matrix[0].length, 6);
  assert.ok(report.coverage.tiles.max >= report.coverage.tiles.min);
});

test('M7A row and column opportunity counts are correct', () => {
  const report = getAnalysis();
  assert.equal(report.coverage.rowColumn.rows.length, 8);
  assert.equal(report.coverage.rowColumn.columns.length, 6);
  assert.ok(report.coverage.rowColumn.rows[0].legalMovesTouching > 0);
});

test('M7A optional familiarity provider works when supplied', () => {
  const moves = enumerateLegalMoves({ grid: [['C', 'T']] }, buildVocabularyIndex(['cat', 'coat']));
  const metrics = familiarityMetrics(moves, word => word === 'cat' ? 1 : 0.5);
  assert.equal(metrics.familiarityMetricsAvailable, true);
  assert.equal(metrics.scoredWordCount, 2);
});

test('M7A reports familiarity unavailable when no provider is supplied', () => {
  const moves = enumerateLegalMoves({ grid: [['C', 'T']] }, buildVocabularyIndex(['cat']));
  assert.equal(familiarityMetrics(moves).familiarityMetricsAvailable, false);
});

test('M7A bounded multiple-Gold search respects its limit', () => {
  const result = boundedGoldCertificates(getGenerated().puzzle, getFullIndex(), { maxGoldCertificates: 2 });
  assert.ok(result.found <= 2);
});

test('M7A batch JSON output is valid', () => {
  const records = parseCsv('answer,clue,seed\nWATERMELON,Large fruit,123456\nOSCILLATED,Moved,234567\n');
  const result = analyzeBatch(records, getFullIndex(), {
    count: 1,
    analysisOptions: { goldViableFirstMoveLimit: 2, maxGoldCertificates: 1, requireHexalinkAnalysis: false }
  });
  assert.equal(result.analyses.length, 1);
  assert.equal(result.failures.length, 0);
  assert.equal(typeof result.aggregate.count, 'number');
});

test('M7A CSV contains one row per analyzed puzzle', () => {
  const records = parseCsv('answer,clue,seed\nWATERMELON,Large fruit,123456\n');
  const result = analyzeBatch(records, getFullIndex(), {
    count: 1,
    analysisOptions: { goldViableFirstMoveLimit: 2, maxGoldCertificates: 1, requireHexalinkAnalysis: false }
  });
  const csv = toCsv(result.csvRows);
  assert.equal(csv.trim().split(/\r?\n/).length, 2);
});

test('M7A deterministic repeated analysis produces identical scalar metrics', () => {
  const result = getGenerated();
  const first = analyzePuzzle({ puzzle: result.puzzle, privateCertification: result.privateCertification }, getFullIndex(), {
    goldViableFirstMoveLimit: 3,
    maxGoldCertificates: 2,
    requireHexalinkAnalysis: false
  });
  const second = analyzePuzzle({ puzzle: result.puzzle, privateCertification: result.privateCertification }, getFullIndex(), {
    goldViableFirstMoveLimit: 3,
    maxGoldCertificates: 2,
    requireHexalinkAnalysis: false
  });
  assert.equal(first.initialMoves.rawLegalWordPathMoves, second.initialMoves.rawLegalWordPathMoves);
  assert.equal(first.vocabulary.uniqueWords, second.vocabulary.uniqueWords);
  assert.equal(first.gold.certificate.goldScore, second.gold.certificate.goldScore);
});

test('M7A writes batch JSON and CSV files', () => {
  const records = parseCsv('answer,clue,seed\nWATERMELON,Large fruit,123456\n');
  const result = analyzeBatch(records, getFullIndex(), {
    count: 1,
    analysisOptions: { goldViableFirstMoveLimit: 1, maxGoldCertificates: 1, requireHexalinkAnalysis: false }
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qjynn-m7a-'));
  const jsonPath = path.join(dir, 'batch.json');
  const csvPath = path.join(dir, 'batch.csv');
  writeBatchOutputs(result, jsonPath, csvPath);
  assert.equal(fs.existsSync(jsonPath), true);
  assert.equal(fs.existsSync(csvPath), true);
});
