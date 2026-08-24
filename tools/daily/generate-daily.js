#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { selectDailyGridM9 } = require('../generator/m9-hybrid-selector.js');

function args(argv) {
  const values = {};
  for (let i = 2; i < argv.length; i++) if (argv[i].startsWith('--')) values[argv[i].slice(2)] = argv[++i];
  return values;
}

if (require.main === module) {
  const input = args(process.argv);
  const words = fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8');
  const index = buildVocabularyIndex(parseWordList(words));
  const result = selectDailyGridM9({ answer: input.answer, date: input.date, seed: input.seed ? Number(input.seed) : undefined, frequencyFile: input.frequencyFile, wordIndex: index });
  if (!result.ok) { console.error(JSON.stringify(result, null, 2)); process.exitCode = 1; }
  else {
    const output = input.output || path.join(process.cwd(), 'generated-daily');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'public.json'), `${JSON.stringify(result.publicPuzzle, null, 2)}\n`);
    fs.writeFileSync(path.join(output, 'private.json'), `${JSON.stringify(result.privateManifest, null, 2)}\n`);
    console.log(JSON.stringify({ status: result.status, publicPath: path.join(output, 'public.json'), privatePath: path.join(output, 'private.json'), candidateCounts: result.privateManifest.candidateCounts }, null, 2));
  }
}

module.exports = { args };
