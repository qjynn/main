#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generateCandidatePool, canonicalGridHash } = require('../generator/candidate-pool.js');
const { moveSpaceMetrics } = require('../experiments/production-headroom.js');
const { hexalinkMetrics } = require('../analyzer/puzzle-analyzer.js');
const { addBands, requireRealProvider } = require('../generator/m9-hybrid-selector.js');
const { runIncrementalMonteCarlo } = require('../simulator/incremental-monte-carlo.js');
const { M81_FREQUENCY_MODEL } = require('../simulator/player-models.js');
const { GENERATOR_VERSION, RULES_VERSION, VOCABULARY_VERSION, hashSeed } = require('../generator/grid-generator.js');
const { validateEditorialInput } = require('../generator/puzzle-validator.js');
const { resolveM10Config, M10_POLICY_VERSION, M10_GATE_VERSION } = require('../quality/gate-registry.js');
const { createHistoricalEnvelope } = require('../quality/historical-envelope.js');
const { evaluateCandidateGates, classifyConfidence, gateSummary } = require('../quality/quality-evaluator.js');
const { artifactHashes } = require('../publication/artifact-hashes.js');
const { validatePublicationArtifacts, PUBLICATION_VALIDATOR_VERSION } = require('../publication/publication-validator.js');
const { createQueueEntry } = require('../publication/queue-manager.js');
const { healthCheck } = require('../publication/health-check.js');

const M10_SELECTOR_VERSION = 'm10.0';
const PRIVATE_SCHEMA_VERSION = 1;

function m10CandidateId(answer, seed, gridHash) { return `${String(answer).toUpperCase()}-${hashSeed(`M10|${answer}|${seed}|${gridHash}`).toString(16)}`; }
function publicPrivateOk(publicPuzzle) { return !Object.keys(publicPuzzle || {}).some(key => ['answer', 'certificate', 'goldCertificate', 'privateMetadata', 'regularProfile', 'candidatePool', 'selectionExplanation', 'frequency'].includes(key)); }
function profile(candidate, wordIndex, provider, answer, seed, model, runs) {
  const batch = runIncrementalMonteCarlo({ puzzle: candidate.puzzle, playerModel: model, masterSeed: hashSeed(`M10|${answer}|${candidate.candidateId}|${seed}|${model}`) }, wordIndex, { maxRuns: runs, profileRuns: [runs], accessibilitySystem: M81_FREQUENCY_MODEL, familiarityProvider: provider });
  const summary = batch.profiles[runs];
  return { ...summary, simulationMs: batch.simulationMs, [`${model.toLowerCase()}MeanScore`]: summary.meanScore, [`${model.toLowerCase()}MedianScore`]: summary.medianScore, [`${model.toLowerCase()}GoldRate`]: summary.goldRate, [`${model.toLowerCase()}SilverRate`]: summary.silverRate, [`${model.toLowerCase()}BronzeRate`]: summary.bronzeRate, [`${model.toLowerCase()}HexalinkRate`]: summary.hexalinkRate, [`${model.toLowerCase()}RareWordDependency`]: summary.rareWordDependency, [`${model.toLowerCase()}PlayedFamiliarity`]: summary.meanFamiliarity, [`${model.toLowerCase()}Runs`]: runs };
}
function candidateRecord(candidate, index, answer, wordIndex) {
  const gridHash = candidate.gridHash || canonicalGridHash(candidate.puzzle.grid);
  const cheap = moveSpaceMetrics(candidate.puzzle, wordIndex);
  const hex = hexalinkMetrics(candidate.puzzle, wordIndex, answer);
  return { candidateId: m10CandidateId(answer, candidate.candidateSeed, gridHash), candidateIndex: candidate.candidateIndex, candidateSeed: candidate.candidateSeed, gridHash, puzzle: candidate.puzzle, privateCertification: candidate.privateCertification, certified: candidate.hardGateStatus === 'accepted' && Number(candidate.privateCertification?.goldScore || 0) >= 100, certificateScore: candidate.privateCertification?.goldScore || null, certificateTurns: candidate.privateCertification?.goldTurns || null, uniquePlayableWords: cheap.uniquePlayableWords, cheapMetricValue: cheap.uniquePlayableWords, rawLegalMoves: cheap.rawMoves, uniqueTileMasks: cheap.uniqueTileMasks, tileParticipationSpread: cheap.tileParticipationSpread, hexalinkRowsTouched: hex.rowsTouched, hexalinkColumnsTouched: hex.columnsTouched, shortlisted: false, finalist: false };
}
function metadata(providerMetadata) { return { policyVersion: M10_POLICY_VERSION, gateVersion: M10_GATE_VERSION, selectorVersion: M10_SELECTOR_VERSION, generatorVersion: GENERATOR_VERSION, rulesVersion: RULES_VERSION, vocabularyVersion: VOCABULARY_VERSION, simulatorVersion: 'm8.1', playerModelVersion: 'm8.1.players.0', familiarity: providerMetadata, publicationValidatorVersion: PUBLICATION_VALIDATOR_VERSION } }
function sortFinalists(candidates, requiredCount = 1) {
  const middle = candidates.filter(candidate => candidate.difficultyBand === 'middle');
  const eligible = middle.length >= requiredCount ? middle : candidates;
  const center = eligible.reduce((sum, candidate) => sum + candidate.regularMeanScore, 0) / eligible.length;
  return eligible.slice().sort((a, b) => Math.abs(a.regularMeanScore - center) - Math.abs(b.regularMeanScore - center) || Number(b.strongMeanScore || 0) - Number(a.strongMeanScore || 0) || a.candidateId.localeCompare(b.candidateId));
}
function privateCandidate(candidate) {
  const clone = { ...candidate };
  delete clone.puzzle; delete clone.regularResult; delete clone.strongResult;
  return clone;
}

function generateRound(input, wordIndex, config, providerInfo, round, history) {
  const started = process.hrtime.bigint();
  const masterSeed = hashSeed(`${input.seed}|${input.date}|${M10_SELECTOR_VERSION}|round:${round}`);
  const pool = generateCandidatePool({ answer: input.answer, clue: input.clue, date: input.date, masterSeed }, wordIndex, { candidatePoolSize: config.candidatePoolSize, maxAttemptsPerCandidate: config.maxAttemptsPerCandidate || 20, candidateGenerator: 'M6_BASELINE', selectorVersion: M10_SELECTOR_VERSION });
  const candidates = pool.candidates.map((candidate, index) => candidateRecord(candidate, index, input.answer, wordIndex)).filter(candidate => candidate.certified);
  if (candidates.length < config.minimumCertifiedCandidates) return { ok: false, status: candidates.length ? 'INSUFFICIENT_POOL' : 'REGENERATE', round, candidates, pool, timings: { generationMs: pool.generationMs, totalMs: Number(process.hrtime.bigint() - started) / 1e6 } };
  const profileStarted = process.hrtime.bigint();
  const profiled = candidates.map(candidate => ({ ...candidate, ...profile(candidate, wordIndex, providerInfo.provider, input.answer, masterSeed, 'REGULAR', config.regularRuns) }));
  const regularMs = Number(process.hrtime.bigint() - profileStarted) / 1e6;
  const banded = addBands(profiled.map(candidate => ({ ...candidate, regularMeanScore: candidate.regularMeanScore })), 'regularMeanScore');
  const preferred = banded.filter(candidate => candidate.difficultyBand === config.difficultyPolicy.preferredBand);
  const finalistInput = (preferred.length >= config.strongFinalistCount ? preferred : banded).slice().sort((a, b) => a.difficultyRank - b.difficultyRank).slice(0, config.strongFinalistCount);
  const strongStarted = process.hrtime.bigint();
  const finalistProfiles = finalistInput.map(candidate => ({ ...candidate, finalist: true, ...profile(candidate, wordIndex, providerInfo.provider, input.answer, masterSeed, 'STRONG', config.strongRuns) }));
  const strongMs = Number(process.hrtime.bigint() - strongStarted) / 1e6;
  const byId = new Map(finalistProfiles.map(candidate => [candidate.candidateId, candidate]));
  const complete = banded.map(candidate => byId.get(candidate.candidateId) || candidate);
  const publicationCandidates = [];
  const gateRows = [];
  const reproducibleIds = new Set(pool.candidates.map(candidate => m10CandidateId(input.answer, candidate.candidateSeed, candidate.gridHash || canonicalGridHash(candidate.puzzle.grid))));
  const baseMeta = metadata(providerInfo.provider.metadata);
  for (const candidate of sortFinalists(complete, config.strongFinalistCount)) {
    const temporaryManifest = { schemaVersion: PRIVATE_SCHEMA_VERSION, answer: input.answer, clue: input.clue, date: input.date, certificate: candidate.privateCertification?.goldCertificate || [], hashes: {}, metadata: baseMeta };
    const validator = validatePublicationArtifacts({ publicPuzzle: candidate.puzzle, privateManifest: temporaryManifest, wordIndex });
    const gates = evaluateCandidateGates(candidate, { pool: complete, metadata: baseMeta, historical: createHistoricalEnvelope(history || []), allowAdjacentBands: config.difficultyPolicy.allowAdjacentBands, publicPrivateOk: publicPrivateOk(candidate.puzzle), schemaOk: validator.ok, reproducible: reproducibleIds.has(candidate.candidateId) });
    gateRows.push(...gates.map(gate => ({ ...gate, candidateId: candidate.candidateId })));
    const confidence = classifyConfidence(gates, config);
    if (validator.ok && confidence !== 'REJECT' && confidence !== 'REVIEW_RECOMMENDED') publicationCandidates.push({ ...candidate, gates, confidence, validator });
  }
  const orderedEligible = publicationCandidates.sort((a, b) => (a.difficultyRank || 99) - (b.difficultyRank || 99) || a.candidateId.localeCompare(b.candidateId));
  if (!orderedEligible.length) return { ok: false, status: 'REGENERATE', round, candidates: complete, gateRows, pool, timings: { generationMs: pool.generationMs, certificationMs: pool.candidates.reduce((sum, c) => sum + Number(c.generationStats?.totalSolverMs || 0), 0), regularMs, strongMs, qualityGatesMs: 0, validatorMs: 0, totalMs: Number(process.hrtime.bigint() - started) / 1e6 } };
  const primary = orderedEligible[0];
  const backups = orderedEligible.slice(1, 1 + config.requiredBackups);
  if (backups.length < config.requiredBackups && !config.allowDegradedReserve) return { ok: false, status: 'REGENERATE', round, candidates: complete, gateRows, pool, timings: { generationMs: pool.generationMs, certificationMs: 0, regularMs, strongMs, totalMs: Number(process.hrtime.bigint() - started) / 1e6 } };
  const provisionalPrivate = { schemaVersion: PRIVATE_SCHEMA_VERSION, selector: 'M10', policyVersion: M10_POLICY_VERSION, answer: input.answer, clue: input.clue, date: input.date, hexalink: primary.puzzle.hexalink, primaryCandidateId: primary.candidateId, backupCandidateIds: backups.map(candidate => candidate.candidateId), certificate: primary.privateCertification.goldCertificate, metadata: baseMeta, candidates: complete.map(privateCandidate), gateResults: gateRows, confidence: primary.confidence, selectionRationale: ['M6 Gold certified', 'full REGULAR profile on all certified candidates', `preferred ${primary.difficultyBand} comparative band`, 'STRONG finalist confirmation'], validator: primary.validator };
  const hashes = artifactHashes({ publicPuzzle: primary.puzzle, privateManifest: provisionalPrivate, certificate: provisionalPrivate.certificate });
  const privateManifest = { ...provisionalPrivate, hashes, createdAt: new Date().toISOString(), immutable: true };
  const finalValidator = validatePublicationArtifacts({ publicPuzzle: primary.puzzle, privateManifest, wordIndex });
  if (!finalValidator.ok) return { ok: false, status: 'REGENERATE', round, candidates: complete, gateRows, pool, timings: { generationMs: pool.generationMs, regularMs, strongMs, validatorMs: 0, totalMs: Number(process.hrtime.bigint() - started) / 1e6 } };
  const queueEntry = createQueueEntry({ date: input.date, publicArtifactRef: `${input.date}/public.json`, privateManifestRef: `${input.date}/private.json`, primaryHash: hashes.gridHash, backupHashes: backups.map(candidate => canonicalGridHash(candidate.puzzle.grid)), policyVersion: M10_POLICY_VERSION, validatorPass: true });
  return { ok: true, status: backups.length >= config.requiredBackups ? 'AUTO_PUBLISH_ELIGIBLE' : 'RESERVE_ELIGIBLE', round, primary: { candidateId: primary.candidateId, publicPuzzle: primary.puzzle, confidence: primary.confidence, hashes, gates: primary.gates }, backups: backups.map(candidate => ({ candidateId: candidate.candidateId, publicPuzzle: candidate.puzzle, confidence: candidate.confidence, gridHash: candidate.gridHash })), privateManifest: { ...privateManifest, validator: finalValidator, backupCertificates: backups.map(candidate => ({ candidateId: candidate.candidateId, certificate: candidate.privateCertification.goldCertificate })) }, queueEntry, health: healthCheck({ frequencyFile: providerInfo.path, validatorOk: true, certificateReplayOk: true }), gateRows, candidates: complete.map(privateCandidate), pool, timings: { generationMs: pool.generationMs, certificationMs: pool.candidates.reduce((sum, c) => sum + Number(c.generationStats?.totalSolverMs || 0), 0), regularMs, strongMs, validatorMs: Number(process.hrtime.bigint() - started) / 1e6 - regularMs - strongMs - pool.generationMs, totalMs: Number(process.hrtime.bigint() - started) / 1e6 } };
}

function generatePublicationReadyDaily(options = {}) {
  const config = resolveM10Config(options.config);
  const index = options.wordIndex;
  if (!index) throw new Error('M10 requires a prebuilt Vocabulary 1.0 index.');
  const editorial = validateEditorialInput(options, index);
  if (!editorial.ok) return { ok: false, status: 'BLOCKED', reason: 'INVALID_INPUT', errors: editorial.errors };
  if (!options.seed && options.seed !== 0) return { ok: false, status: 'BLOCKED', reason: 'SEED_REQUIRED' };
  let providerInfo;
  try { providerInfo = requireRealProvider(options.frequencyFile); } catch (error) { return { ok: false, status: 'BLOCKED', reason: 'REAL_FAMILIARITY_REQUIRED', error: error.message }; }
  const history = options.history || [];
  const failures = [];
  for (let round = 0; round <= config.maxRegenerationRounds; round++) {
    const result = generateRound({ answer: editorial.answer, clue: editorial.clue, date: options.date, seed: options.seed }, index, config, providerInfo, round, history);
    if (result.ok) return { ...result, failures, config };
    failures.push({ round, status: result.status, gateFailures: result.gateRows || [], candidateCount: result.candidates?.length || 0 });
  }
  return { ok: false, status: 'BLOCKED', reason: 'MAX_REGENERATION_ROUNDS_EXHAUSTED', failures, config, health: healthCheck({ frequencyFile: providerInfo.path, validatorOk: true }) };
}

function writePublicationReady(result, outputDir) {
  if (!result.ok) throw new Error('Cannot write a blocked publication result.');
  const root = path.resolve(outputDir);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'public.json'), `${JSON.stringify(result.primary.publicPuzzle, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'private.json'), `${JSON.stringify(result.privateManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'queue.json'), `${JSON.stringify(result.queueEntry, null, 2)}\n`);
  return { publicPath: path.join(root, 'public.json'), privatePath: path.join(root, 'private.json'), queuePath: path.join(root, 'queue.json') };
}

if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((out, token, i, all) => { if (token.startsWith('--')) out[token.slice(2)] = all[i + 1]; return out; }, {}));
  const index = buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
  const result = generatePublicationReadyDaily({ answer: args.answer, clue: args.clue, date: args.date, seed: Number(args.seed), frequencyFile: args.frequencyFile, wordIndex: index });
  if (!result.ok) { console.error(JSON.stringify(result, null, 2)); process.exitCode = 1; } else console.log(JSON.stringify({ status: result.status, paths: writePublicationReady(result, args.output || path.join(process.cwd(), 'publication-ready')), queueEntry: result.queueEntry }, null, 2));
}

module.exports = { M10_SELECTOR_VERSION, PRIVATE_SCHEMA_VERSION, generatePublicationReadyDaily, writePublicationReady, candidateRecord, profile };
