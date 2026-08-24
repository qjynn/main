#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { FileStorageAdapter } = require('../delivery/file-storage-adapter.js');
const { DailyPuzzleCatalog } = require('../delivery/daily-catalog.js');
const { getTodayPublicPuzzle } = require('../delivery/runtime-delivery.js');
function main() { const args = Object.fromEntries(process.argv.slice(2).reduce((out, token, i, all) => { if (token.startsWith('--')) out[token.slice(2)] = all[i + 1]; return out; }, {})); const index = buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8'))); const catalog = new DailyPuzzleCatalog({ root: args.store || 'runtime-catalog', wordIndex: index, policy: { timezone: args.timezone || 'America/New_York' }, clock: undefined }); const result = getTodayPublicPuzzle({ catalog, now: args.now, policy: { timezone: args.timezone || 'America/New_York' } }); console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exitCode = 1; }
if (require.main === module) main();
module.exports = { main };
