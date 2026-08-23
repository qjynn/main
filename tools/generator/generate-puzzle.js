#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generatePuzzle, writePuzzleFiles } = require('./grid-generator.js');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index++;
    }
  }
  return args;
}

function loadDefaultWordIndex() {
  const vocabularyPath = path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt');
  return buildVocabularyIndex(parseWordList(fs.readFileSync(vocabularyPath, 'utf8')));
}

function printFailure(result) {
  console.error('Qjynn puzzle generation failed');
  console.error('');
  console.error(`Reason:          ${result.failure.reason}`);
  console.error(`Answer:          ${result.failure.answer || ''}`);
  console.error(`Hexalink:        ${result.failure.hexalink || ''}`);
  console.error(`Seed:            ${result.failure.seed ?? ''}`);
  console.error(`Attempts:        ${result.failure.attemptsMade}`);
}

function printSuccess(result, paths, verbose = false) {
  console.log('Qjynn puzzle generated');
  console.log('');
  console.log(`Answer:          ${result.privateCertification.answer}`);
  console.log(`Hexalink:        ${result.puzzle.hexalink}`);
  console.log(`Seed:            ${result.privateCertification.seed}`);
  console.log(`Attempts:        ${result.stats.attempts}`);
  console.log('Gold certified:  yes');
  console.log(`Gold score:      ${result.privateCertification.goldScore}`);
  console.log(`Gold turns:      ${result.privateCertification.goldTurns}`);
  console.log('');
  console.log('Public:');
  console.log(paths.publicPath);
  console.log('');
  console.log('Private:');
  console.log(paths.privatePath);
  if (verbose) {
    console.log('');
    console.log(JSON.stringify(result.privateCertification.goldCertificate, null, 2));
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const wordIndex = loadDefaultWordIndex();
  const result = generatePuzzle({
    answer: args.answer,
    clue: args.clue,
    date: args.date,
    seed: args.seed,
    maxAttempts: args['max-attempts'] ? Number(args['max-attempts']) : undefined
  }, wordIndex);

  if (!result.ok) {
    printFailure(result);
    process.exitCode = 1;
    return;
  }

  const outputDir = args['output-dir'] || 'puzzles';
  const paths = writePuzzleFiles(result, outputDir);
  printSuccess(result, paths, Boolean(args.verbose));
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  loadDefaultWordIndex,
  main
};
