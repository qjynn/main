const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../tools/solver/word-index.js');
const { generatePuzzle } = require('../tools/generator/grid-generator.js');
const { M10_POLICY_VERSION, resolveM10Config } = require('../tools/quality/gate-registry.js');
const { evaluateCandidateGates, classifyConfidence } = require('../tools/quality/quality-evaluator.js');
const { artifactHashes } = require('../tools/publication/artifact-hashes.js');
const { validatePublicationArtifacts } = require('../tools/publication/publication-validator.js');
const { createQueueEntry, freezeQueueEntry, promoteBackup, transitionQueueEntry } = require('../tools/publication/queue-manager.js');
const { generatePublicationReadyDaily } = require('../tools/daily/generate-publication-ready.js');
const { healthCheck } = require('../tools/publication/health-check.js');

const index = buildVocabularyIndex(parseWordList(fs.readFileSync('qjynn-words-v1.0.txt', 'utf8')));
const frequencyFile = 'data/familiarity/wordfreq-en-large.json';

test('M10 policy is versioned and supports explicit degraded backup tests', () => {
  const config = resolveM10Config({ candidatePoolSize: 1, certifiedCandidateTarget: 1, minimumCertifiedCandidates: 1, requiredBackups: 0, regularRuns: 100, strongRuns: 100 });
  assert.equal(M10_POLICY_VERSION, 'm10.0');
  assert.equal(config.requiredBackups, 0);
});

test('M10 fails closed when real familiarity is unavailable', () => {
  const result = generatePublicationReadyDaily({ answer: 'WATERMELON', clue: 'Fruit', date: '2032-03-01', seed: 1, wordIndex: index, frequencyFile: '/tmp/m10-missing-frequency.json', config: { candidatePoolSize: 1, certifiedCandidateTarget: 1, minimumCertifiedCandidates: 1, requiredBackups: 0, regularRuns: 100, strongRuns: 100 } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'REAL_FAMILIARITY_REQUIRED');
});

test('independent publication validator accepts a valid certificate and rejects mutations', () => {
  const generated = generatePuzzle({ answer: 'WATERMELON', clue: 'Fruit', date: '2032-03-02', seed: 123456, maxAttempts: 5 }, index);
  assert.equal(generated.ok, true);
  const privateManifest = { schemaVersion: 1, answer: 'WATERMELON', certificate: generated.privateCertification.goldCertificate, hashes: {}, metadata: { rulesVersion: 'qjynn-rules-local', vocabularyVersion: '1.0' } };
  privateManifest.hashes = artifactHashes({ publicPuzzle: generated.puzzle, privateManifest, certificate: privateManifest.certificate });
  const valid = validatePublicationArtifacts({ publicPuzzle: generated.puzzle, privateManifest, wordIndex: index });
  assert.equal(valid.ok, true);
  const corrupted = { ...generated.puzzle, grid: generated.puzzle.grid.map(row => row.slice()) };
  corrupted.grid[0][0] = corrupted.grid[0][0] === 'B' ? 'C' : 'B';
  assert.equal(validatePublicationArtifacts({ publicPuzzle: corrupted, privateManifest, wordIndex: index }).ok, false);
});

test('quality gate severity and confidence classification are explicit', () => {
  const metadata = { generatorVersion: 'm6.0', rulesVersion: 'qjynn-rules-local', vocabularyVersion: '1.0', selectorVersion: 'm10.0', simulatorVersion: 'm8.1', playerModelVersion: 'm8.1.players.0', familiarity: { provider: 'wordfreq', sourceVersion: 'v3.2', normalizationVersion: 'zipf-linear-v1' } };
  const candidate = { certified: true, gridHash: 'hash', privateCertification: { goldCertificate: [{}], certificateReplayResult: { score: 110 } }, difficultyBand: 'middle', difficultyRank: 2, regularRuns: 500, regularMeanScore: 82, regularGoldRate: .1, regularSilverRate: .2, regularBronzeRate: .3, regularRareWordDependency: .2, regularPlayedFamiliarity: .7, uniquePlayableWords: 10, regularHexalinkRate: .2 };
  const gates = evaluateCandidateGates(candidate, { metadata, pool: [candidate], historical: { mode: 'WARMUP', envelope: {} }, publicPrivateOk: true, schemaOk: true, reproducible: true, allowAdjacentBands: true });
  assert.equal(classifyConfidence(gates), 'HIGH_CONFIDENCE');
  assert.ok(gates.every(gate => ['PASS', 'WARN', 'FAIL', 'NOT_AVAILABLE'].includes(gate.result)));
});

test('queue freeze and deterministic backup promotion are enforced', () => {
  const entry = createQueueEntry({ date: '2032-03-03', publicArtifactRef: 'public.json', privateManifestRef: 'private.json', primaryHash: 'a', backupHashes: ['b', 'c'], policyVersion: 'm10.0', validatorPass: true });
  assert.equal(entry.status, 'AUTO_PUBLISH_ELIGIBLE');
  const promoted = promoteBackup(entry, 0);
  assert.equal(promoted.entry.primaryHash, 'b');
  assert.deepEqual(promoted.entry.backupHashes, ['a', 'c']);
  const frozen = freezeQueueEntry(entry);
  assert.throws(() => transitionQueueEntry(frozen, 'BLOCKED'), /Frozen/);
  assert.equal(promoteBackup({ ...entry, backupHashes: [] }).status, 'BLOCKED');
});

test('M10 health check kill switch blocks missing providers and version mismatches', () => {
  const result = healthCheck({ frequencyFile: '/tmp/missing-m10-frequency.json', expectedRulesHash: 'a', actualRulesHash: 'b' });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.reasons.includes('REAL_FAMILIARITY_UNAVAILABLE'));
  assert.ok(result.reasons.includes('RULES_HASH_MISMATCH'));
});

test('M10 publication-ready generation produces a validated minimal artifact', { timeout: 120000 }, () => {
  const result = generatePublicationReadyDaily({ answer: 'WATERMELON', clue: 'Fruit', date: '2032-03-04', seed: 123456, wordIndex: index, frequencyFile, config: { candidatePoolSize: 2, certifiedCandidateTarget: 2, minimumCertifiedCandidates: 2, requiredBackups: 0, regularRuns: 100, strongFinalistCount: 1, strongRuns: 100, maxRegenerationRounds: 0 } });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'AUTO_PUBLISH_ELIGIBLE');
  assert.equal(result.privateManifest.validator.ok, true);
  assert.equal(result.primary.publicPuzzle.answer, undefined);
});
