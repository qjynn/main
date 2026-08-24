const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const { generatePublicationReadyDaily } = require('../tools/daily/generate-publication-ready.js');
const { DailyPuzzleCatalog } = require('../tools/delivery/daily-catalog.js');
const { FileStorageAdapter } = require('../tools/delivery/file-storage-adapter.js');
const { createClock, getQjynnDate, nextQjynnBoundary } = require('../tools/delivery/clock.js');
const { getTodayPublicPuzzle, getPublicPuzzleByDate } = require('../tools/delivery/runtime-delivery.js');
const { inventoryHealth } = require('../tools/delivery/inventory-health.js');
const { puzzleId } = require('../tools/delivery/delivery-policy.js');
const { canTransition, transition } = require('../tools/delivery/state-machine.js');
const { buildDeliveryCatalog } = require('../tools/daily/build-delivery-catalog.js');

const index = buildVocabularyIndex(parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8')));
const frequencyFile = 'data/familiarity/wordfreq-en-large.json';
let fixture;
function getFixture() {
  if (!fixture) fixture = generatePublicationReadyDaily({ answer: 'WATERMELON', clue: 'Fruit', date: '2032-06-01', seed: 970001, wordIndex: index, frequencyFile, config: { candidatePoolSize: 10, certifiedCandidateTarget: 10, minimumCertifiedCandidates: 10, regularRuns: 100, strongFinalistCount: 3, strongRuns: 100, requiredBackups: 2, maxRegenerationRounds: 0 } });
  assert.equal(fixture.ok, true);
  return fixture;
}
function getCatalog(date = '2032-06-01') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qjynn-m11-'));
  const catalog = new DailyPuzzleCatalog({ store: new FileStorageAdapter(root), wordIndex: index, policy: { timezone: 'America/New_York', inventoryHorizon: 14, replenishThreshold: 7 } });
  const result = { ...getFixture(), privateManifest: { ...getFixture().privateManifest, date }, primary: { ...getFixture().primary, publicPuzzle: { ...getFixture().primary.publicPuzzle, date } } };
  assert.equal(catalog.putDaily(result).ok, true);
  return { catalog, root };
}

test('M11 canonical timezone and date boundary are deterministic', () => {
  assert.equal(getQjynnDate('2032-06-01T03:59:59Z', 'America/New_York'), '2032-05-31');
  assert.equal(getQjynnDate('2032-06-01T04:00:00Z', 'America/New_York'), '2032-06-01');
  assert.equal(puzzleId('2032-06-01'), 'QJYNN-2032-06-01');
  assert.equal(nextQjynnBoundary('2032-06-01T03:59:59Z', 'America/New_York').toISOString(), '2032-06-01T04:00:00.000Z');
});

test('M11 handles DST calendar dates without assuming 24 hours', () => {
  assert.equal(getQjynnDate('2032-03-15T03:59:59Z', 'America/New_York'), '2032-03-14');
  assert.equal(getQjynnDate('2032-03-15T04:00:00Z', 'America/New_York'), '2032-03-15');
  assert.equal(getQjynnDate('2032-11-08T04:59:59Z', 'America/New_York'), '2032-11-07');
  assert.equal(getQjynnDate('2032-11-08T05:00:00Z', 'America/New_York'), '2032-11-08');
});

test('M11 stores, reloads, and identifies one catalog entry per date', () => {
  const { catalog } = getCatalog();
  const entry = catalog.read('2032-06-01');
  assert.equal(entry.state.puzzleId, 'QJYNN-2032-06-01');
  assert.equal(entry.state.status, 'AUTO_PUBLISH_ELIGIBLE');
  assert.equal(catalog.store.listDates().length, 1);
  assert.equal(catalog.getArchiveEntry('2032-06-01').puzzleId, entry.state.puzzleId);
});

test('M11 today delivery is public-only and cache-stable', () => {
  const { catalog } = getCatalog();
  const first = getTodayPublicPuzzle({ catalog, now: '2032-06-01T16:00:00Z', policy: { timezone: 'America/New_York' } });
  const second = getTodayPublicPuzzle({ catalog, now: '2032-06-01T18:00:00Z', policy: { timezone: 'America/New_York' } });
  assert.equal(first.ok, true);
  assert.equal(first.puzzleId, 'QJYNN-2032-06-01');
  assert.equal(first.etag, second.etag);
  assert.equal(first.expiresAt, '2032-06-02T04:00:00.000Z');
  for (const key of ['answer', 'certificate', 'goldCertificate', 'privateMetadata', 'candidatePool', 'selectionExplanation']) assert.equal(Object.prototype.hasOwnProperty.call(first, key) || Object.prototype.hasOwnProperty.call(first.puzzle, key), false);
});

test('M11 blocks future lookup and ignores client date manipulation', () => {
  const { catalog } = getCatalog();
  assert.equal(getPublicPuzzleByDate({ catalog, date: '2032-06-02', now: '2032-06-01T12:00:00Z', policy: { timezone: 'America/New_York' } }).status, 'NOT_YET_AVAILABLE');
  assert.equal(getTodayPublicPuzzle({ catalog, now: '2032-06-01T12:00:00Z', clientDate: '2032-06-02', policy: { timezone: 'America/New_York' } }).date, '2032-06-01');
});

test('M11 activates at midnight and preserves past archive', () => {
  const { catalog } = getCatalog();
  assert.equal(getTodayPublicPuzzle({ catalog, now: '2032-06-01T03:59:59Z', policy: { timezone: 'America/New_York' } }).status, 'TODAY_NOT_FOUND');
  assert.equal(getTodayPublicPuzzle({ catalog, now: '2032-06-01T04:00:00Z', policy: { timezone: 'America/New_York' } }).ok, true);
  assert.equal(getPublicPuzzleByDate({ catalog, date: '2032-05-31', now: '2032-06-01T12:00:00Z', policy: { timezone: 'America/New_York' } }).status, 'NOT_FOUND');
});

test('M11 corrupt primary promotes backup1 and records audit state', () => {
  const { catalog } = getCatalog();
  const files = catalog.store.paths('2032-06-01'); fs.writeFileSync(files.public, '{bad');
  const result = getTodayPublicPuzzle({ catalog, now: '2032-06-01T12:00:00Z', policy: { timezone: 'America/New_York' } });
  assert.equal(result.ok, true);
  assert.notEqual(catalog.read('2032-06-01').state.activeCandidateId, null);
  assert.equal(catalog.read('2032-06-01').state.history.at(-1).event, 'BACKUP_PROMOTED');
});

test('M11 primary and backup1 corruption promotes backup2; all corruption blocks', () => {
  const first = getCatalog(); const files = first.catalog.store.paths('2032-06-01'); fs.writeFileSync(files.public, '{bad'); const backups = JSON.parse(fs.readFileSync(files.backups, 'utf8')); fs.writeFileSync(files.backups, JSON.stringify([{ ...backups[0], publicPuzzle: { ...backups[0].publicPuzzle, grid: [['B']] } }, backups[1]]));
  assert.equal(getTodayPublicPuzzle({ catalog: first.catalog, now: '2032-06-01T12:00:00Z', policy: { timezone: 'America/New_York' } }).ok, true);
  const second = getCatalog(); const secondFiles = second.catalog.store.paths('2032-06-01'); fs.writeFileSync(secondFiles.public, '{bad'); const allBad = JSON.parse(fs.readFileSync(secondFiles.backups, 'utf8')).map(backup => ({ ...backup, publicPuzzle: { grid: [['B']] } })); fs.writeFileSync(secondFiles.backups, JSON.stringify(allBad));
  assert.equal(getTodayPublicPuzzle({ catalog: second.catalog, now: '2032-06-01T12:00:00Z', policy: { timezone: 'America/New_York' } }).status, 'TODAY_BLOCKED');
});

test('M11 reload preserves active state and inventory health is explicit', () => {
  const { catalog, root } = getCatalog();
  assert.equal(getTodayPublicPuzzle({ catalog, now: '2032-06-01T12:00:00Z', policy: { timezone: 'America/New_York' } }).ok, true);
  const reloaded = new DailyPuzzleCatalog({ store: new FileStorageAdapter(root), wordIndex: index, policy: catalog.policy });
  assert.equal(reloaded.read('2032-06-01').state.status, 'ACTIVE');
  const health = inventoryHealth(reloaded, { today: '2032-06-01', horizon: 14, replenishThreshold: 7, inputAvailable: false });
  assert.equal(health.health, 'CRITICAL');
  assert.equal(health.replenishmentStatus, 'INPUT_CATALOG_EXHAUSTED');
});

test('M11 input catalog rejects duplicate dates and never fabricates inputs', () => {
  assert.throws(() => buildDeliveryCatalog({ inputs: [{ date: '2032-06-01', answer: 'WATERMELON', clue: 'Fruit', seed: 1 }, { date: '2032-06-01', answer: 'OSCILLATED', clue: 'Move', seed: 2 }], wordIndex: index, frequencyFile, output: fs.mkdtempSync(path.join(os.tmpdir(), 'qjynn-m11-input-')) }), /Duplicate input date/);
});

test('M11 queue state machine permits only publish-safe transitions', () => {
  assert.equal(canTransition('GENERATED', 'CERTIFIED'), true);
  assert.equal(canTransition('AUTO_PUBLISH_ELIGIBLE', 'ACTIVE'), true);
  assert.equal(canTransition('ACTIVE', 'GENERATED'), false);
  const next = transition({ status: 'CERTIFIED' }, 'AUTO_PUBLISH_ELIGIBLE');
  assert.equal(next.status, 'AUTO_PUBLISH_ELIGIBLE');
  assert.throws(() => transition(next, 'GENERATED'), /Invalid M11 transition/);
});
