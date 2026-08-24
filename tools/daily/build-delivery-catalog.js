#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generatePublicationReadyDaily } = require('./generate-publication-ready.js');
const { DailyPuzzleCatalog } = require('../delivery/daily-catalog.js');
const { FileStorageAdapter } = require('../delivery/file-storage-adapter.js');
const { inventoryHealth } = require('../delivery/inventory-health.js');
function parseCsv(file) { const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/); const headers = lines.shift().split(','); return lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [headers[i], value]))); }
function buildDeliveryCatalog(options = {}) {
  const inputs = options.inputs || parseCsv(options.input); const selected = options.days ? inputs.slice(0, Number(options.days)) : inputs; const dates = new Set(); for (const input of selected) { if (dates.has(input.date)) throw new Error(`Duplicate input date: ${input.date}`); dates.add(input.date); }
  const wordIndex = options.wordIndex || buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8'))); const catalog = options.catalog || new DailyPuzzleCatalog({ store: new FileStorageAdapter(options.output || path.join(process.cwd(), 'runtime-catalog')), wordIndex, policy: options.policy }); const results = [];
  for (const input of selected) { const result = generatePublicationReadyDaily({ ...input, seed: Number(input.seed), wordIndex, frequencyFile: options.frequencyFile, config: options.m10Config }); if (result.ok) results.push({ date: input.date, ...catalog.putDaily(result) }); else results.push({ date: input.date, ok: false, status: result.status, reason: result.reason }); }
  return { catalog, results, health: inventoryHealth(catalog, { today: options.today, horizon: options.horizon, inputAvailable: selected.length > 0 }) };
}
if (require.main === module) { const args = Object.fromEntries(process.argv.slice(2).reduce((out, token, i, all) => { if (token.startsWith('--')) out[token.slice(2)] = all[i + 1]; return out; }, {})); const result = buildDeliveryCatalog({ input: args.input, days: args.days, output: args.output, frequencyFile: args.frequencyFile }); console.log(JSON.stringify({ results: result.results, health: result.health }, null, 2)); if (result.results.some(row => !row.ok)) process.exitCode = 1; }
module.exports = { parseCsv, buildDeliveryCatalog };
