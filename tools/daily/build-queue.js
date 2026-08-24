#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generatePublicationReadyDaily, writePublicationReady } = require('./generate-publication-ready.js');

function parseCsv(file) { const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/); const headers = lines.shift().split(','); return lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [headers[i], value]))); }
function buildQueue(options = {}) {
  const inputs = options.inputs || parseCsv(options.input);
  const index = options.wordIndex || buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
  const results = [];
  for (const input of inputs) {
    const result = generatePublicationReadyDaily({ ...input, seed: Number(input.seed), wordIndex: index, frequencyFile: options.frequencyFile, config: options.config, history: options.history || [] });
    if (result.ok) { const outputDir = path.join(options.output || path.join(process.cwd(), 'generated-queue'), input.date); results.push({ date: input.date, ...result, paths: writePublicationReady(result, outputDir) }); }
    else results.push({ date: input.date, ...result });
  }
  return results;
}
if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((out, token, i, all) => { if (token.startsWith('--')) out[token.slice(2)] = all[i + 1]; return out; }, {}));
  const results = buildQueue({ input: args.input, output: args.output, frequencyFile: args.frequencyFile });
  console.log(JSON.stringify({ entries: results.map(result => ({ date: result.date, status: result.status, ok: result.ok })) }, null, 2));
  if (results.some(result => !result.ok)) process.exitCode = 1;
}
module.exports = { parseCsv, buildQueue };
