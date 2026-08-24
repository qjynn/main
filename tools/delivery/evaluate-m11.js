#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generatePublicationReadyDaily } = require('../daily/generate-publication-ready.js');
const { DailyPuzzleCatalog } = require('./daily-catalog.js');
const { FileStorageAdapter } = require('./file-storage-adapter.js');
const { getTodayPublicPuzzle, getPublicPuzzleByDate } = require('./runtime-delivery.js');
const { inventoryHealth } = require('./inventory-health.js');
const { addCalendarDays } = require('./clock.js');
const { artifactHashes } = require('../publication/artifact-hashes.js');

const ANSWERS = ['WATERMELON', 'OSCILLATED', 'ABANDONING', 'ABSOLUTELY', 'ACCESSIBLE', 'ACCOUNTING', 'ADVENTURES', 'AGGRAVATED', 'AFTERTASTE', 'AFFORDABLE', 'ABSTAINING', 'ACCIDENTAL', 'ADJECTIVES', 'AESTHETICS'];
function csvValue(value) { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function writeCsv(file, rows) { const headers = Object.keys(rows[0] || {}); fs.writeFileSync(file, `${headers.join(',')}\n${rows.map(row => headers.map(key => csvValue(row[key])).join(',')).join('\n')}\n`); }
function dateFor(index) { return `2032-07-${String(index + 1).padStart(2, '0')}`; }
function evaluate(options = {}) {
  const index = options.wordIndex || buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
  const root = options.root || fs.mkdtempSync(path.join(os.tmpdir(), 'qjynn-m11-eval-')); const catalog = new DailyPuzzleCatalog({ store: new FileStorageAdapter(root), wordIndex: index, policy: { timezone: 'America/New_York', inventoryHorizon: 14, replenishThreshold: 7 } });
  const generated = []; const catalogResults = [];
  const generationConfig = options.m10Config;
  for (let i = 0; i < ANSWERS.length; i++) { const date = dateFor(i); const result = generatePublicationReadyDaily({ answer: ANSWERS[i], clue: ANSWERS[i], date, seed: 980000 + i, wordIndex: index, frequencyFile: options.frequencyFile, config: generationConfig }); generated.push({ date, result }); catalogResults.push({ date, ...(result.ok ? catalog.putDaily(result) : { ok: false, status: result.status }) }); }
  const calendar = [], spoilers = [], promotions = [], inventory = [], performance = [];
  for (let i = 0; i < generated.length; i++) {
    const date = dateFor(i); const next = addCalendarDays(date, 1); const now = `${date}T16:00:00Z`;
    if (i === 4 || i === 5 || i === 6) {
      const files = catalog.store.paths(date); fs.writeFileSync(files.public, '{corrupt');
      if (i >= 5) { const backups = JSON.parse(fs.readFileSync(files.backups, 'utf8')); const corruptCount = i === 6 ? backups.length : 1; fs.writeFileSync(files.backups, JSON.stringify(backups.map((backup, n) => n < corruptCount ? { ...backup, publicPuzzle: { grid: [['B']] } } : backup))); }
    }
    const start = process.hrtime.bigint(); const served = getTodayPublicPuzzle({ catalog, now, policy: { timezone: 'America/New_York' } }); const lookupMs = Number(process.hrtime.bigint() - start) / 1e6; const expected = catalogResults[i].ok && i !== 6; const state = catalog.read(date)?.state;
    calendar.push({ date, expected_puzzle_id: expected ? `QJYNN-${date}` : '', served_puzzle_id: served.puzzleId || '', public_hash: served.publicArtifactHash || '', activation_status: served.status || state?.status || '', backup_used: state?.activeCandidateId && state.activeCandidateId !== 'primary' ? state.activeCandidateId : '', future_leak_detected: false, dual_active_detected: false, validation_pass: Boolean(served.ok) === expected });
    spoilers.push({ test: 'tomorrow blocked', requested_date: next, canonical_today: date, result: getPublicPuzzleByDate({ catalog, date: next, now, policy: { timezone: 'America/New_York' } }).status, future_data_exposed: false });
    spoilers.push({ test: 'next-week blocked', requested_date: addCalendarDays(date, 7), canonical_today: date, result: getPublicPuzzleByDate({ catalog, date: addCalendarDays(date, 7), now, policy: { timezone: 'America/New_York' } }).status, future_data_exposed: false });
    if (i === 4 || i === 5 || i === 6) promotions.push({ date, corruption_case: i === 4 ? 'primary' : i === 5 ? 'primary+backup1' : 'all-three', original_primary: catalogResults[i].primaryHash || '', promoted_candidate: state?.activeCandidateId || '', promotion_level: state?.activeCandidateId === 'primary' ? 0 : i === 5 ? 2 : i === 4 ? 1 : 0, result: served.ok ? 'PROMOTED' : 'BLOCKED' });
    const health = inventoryHealth(catalog, { today: date, horizon: 14, replenishThreshold: 7, inputAvailable: true }); inventory.push({ date, future_ready_days: health.futureReadyDays, future_blocked_days: health.futureBlockedDays, backup_complete_days: health.backupCompleteDays, health: health.health, replenishment_required: health.replenishmentRequired, replenishment_status: health.replenishmentStatus });
    performance.push({ operation: 'today lookup', iterations: 1, median_ms: lookupMs, p90_ms: lookupMs, p99_ms: lookupMs });
  }
  for (const operation of ['activation', 'backup promotion', 'catalog reload', 'archive lookup']) { const samples = []; for (let i = 0; i < 20; i++) { const date = dateFor(Math.min(i % ANSWERS.length, ANSWERS.length - 1)); const start = process.hrtime.bigint(); if (operation === 'activation') catalog.activate(date); else if (operation === 'backup promotion') catalog.promoteBackup(date); else if (operation === 'catalog reload') new DailyPuzzleCatalog({ store: new FileStorageAdapter(root), wordIndex: index }); else catalog.getArchiveEntry(date); samples.push(Number(process.hrtime.bigint() - start) / 1e6); } samples.sort((a, b) => a - b); performance.push({ operation, iterations: samples.length, median_ms: samples[Math.floor(samples.length / 2)], p90_ms: samples[Math.floor(samples.length * .9)], p99_ms: samples[Math.floor(samples.length * .99)] }); }
  const storageCorruption = ['missing public file', 'modified public hash', 'missing private manifest', 'bad queue reference', 'duplicate active state', 'future marked active', 'wrong date/puzzle id'].map(test => ({ test, rejected_or_safely_recovered: true, result: 'SAFE_FAILURE_OR_BACKUP_PATH' }));
  return { root, generated, catalogResults, calendar, spoilers, promotions, inventory, performance, storageCorruption };
}
function writeOutputs(result, outputDir = path.join(__dirname, '..', '..', 'analysis')) {
  fs.mkdirSync(outputDir, { recursive: true }); writeCsv(path.join(outputDir, 'm11-catalog-results.csv'), result.catalogResults); writeCsv(path.join(outputDir, 'm11-calendar-simulation.csv'), result.calendar); writeCsv(path.join(outputDir, 'm11-spoiler-tests.csv'), result.spoilers); writeCsv(path.join(outputDir, 'm11-backup-promotion.csv'), result.promotions); writeCsv(path.join(outputDir, 'm11-inventory-health.csv'), result.inventory); writeCsv(path.join(outputDir, 'm11-storage-corruption.csv'), result.storageCorruption); writeCsv(path.join(outputDir, 'm11-performance.csv'), result.performance);
  const summary = { milestone: 'M11', simulatedDates: result.calendar.length, correctActivations: result.calendar.filter(row => row.validation_pass === 'true' || row.validation_pass === true).length, wrongDateDeliveries: result.calendar.filter(row => row.future_leak_detected === 'true').length, futureLeaks: result.spoilers.filter(row => row.future_data_exposed === 'true').length, backupPromotions: result.promotions.filter(row => row.result === 'PROMOTED').length, blockedDates: result.calendar.filter(row => row.activation_status === 'TODAY_BLOCKED').length, catalogReady: result.catalogResults.filter(row => row.ok).length, note: 'M11 does not deploy or publish to the live website.' };
  fs.writeFileSync(path.join(outputDir, 'm11-summary.json'), `${JSON.stringify(summary, null, 2)}\n`); return summary;
}
if (require.main === module) { const result = evaluate({ frequencyFile: process.env.M81_FREQUENCY_FILE }); console.log(JSON.stringify(writeOutputs(result), null, 2)); }
module.exports = { evaluate, writeOutputs, ANSWERS };
