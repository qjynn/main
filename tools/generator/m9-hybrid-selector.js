const fs = require('fs');
const path = require('path');
const { generateCandidatePool, canonicalGridHash } = require('./candidate-pool.js');
const { enumerateLegalMoves } = require('../solver/grid-word-finder.js');
const { GENERATOR_VERSION, RULES_VERSION, VOCABULARY_VERSION } = require('./grid-generator.js');
const { moveSpaceMetrics } = require('../experiments/production-headroom.js');
const { hexalinkMetrics } = require('../analyzer/puzzle-analyzer.js');
const { simulatePuzzleMonteCarlo } = require('../simulator/monte-carlo.js');
const { loadFrequencyFile } = require('../simulator/familiarity-provider.js');
const { M81_FREQUENCY_MODEL, SIMULATOR_VERSION, PLAYER_MODEL_VERSION } = require('../simulator/player-models.js');
const { hashSeed } = require('./grid-generator.js');

const M9_SELECTOR_VERSION = 'm9.0';
const M9_CONFIG_VERSION = 'm9.config.0';
const DEFAULT_M9_CONFIG = Object.freeze({
  rawCandidates: 20,
  certifiedCandidateTarget: 10,
  shortlistSize: 8,
  regularRuns: 250,
  strongFinalistCount: 3,
  strongRuns: 250,
  maxAttemptsPerCandidate: 20,
  difficultyPolicy: { preferredBand: 'middle', allowAdjacentBands: true },
  accessibilityGuardrail: 'diagnostic-only',
  hexalinkPolicy: 'diagnostic-only',
  candidateGenerator: 'M6_BASELINE'
});

function resolveM9Config(config = {}) {
  const merged = { ...DEFAULT_M9_CONFIG, ...config };
  if (!Number.isInteger(merged.rawCandidates) || merged.rawCandidates < 1) throw new Error('rawCandidates must be a positive integer.');
  if (!Number.isInteger(merged.certifiedCandidateTarget) || merged.certifiedCandidateTarget < 1) throw new Error('certifiedCandidateTarget must be a positive integer.');
  if (!Number.isInteger(merged.shortlistSize) || merged.shortlistSize < 1) throw new Error('shortlistSize must be a positive integer.');
  if (merged.shortlistSize > merged.certifiedCandidateTarget) throw new Error('shortlistSize cannot exceed certifiedCandidateTarget.');
  if (!Number.isInteger(merged.regularRuns) || merged.regularRuns < 100) throw new Error('regularRuns must be at least 100.');
  if (!Number.isInteger(merged.strongRuns) || merged.strongRuns < 100) throw new Error('strongRuns must be at least 100.');
  if (!['middle', 'easier', 'harder'].includes(merged.difficultyPolicy.preferredBand)) throw new Error('Unknown preferred difficulty band.');
  return Object.freeze({ ...merged, difficultyPolicy: Object.freeze({ ...DEFAULT_M9_CONFIG.difficultyPolicy, ...(config.difficultyPolicy || {}) }) });
}

function requireRealProvider(filePath) {
  const resolved = filePath || process.env.M81_FREQUENCY_FILE || path.join(__dirname, '..', '..', 'data', 'familiarity', 'wordfreq-en-large.json');
  if (!fs.existsSync(resolved)) throw new Error(`M9 requires the real familiarity source: ${resolved}`);
  const provider = loadFrequencyFile(resolved);
  for (const word of ['house', 'water', 'money', 'plant', 'market', 'family']) if (provider.lookup(word).basis !== 'frequency') throw new Error('M9 familiarity source failed real-provider sanity checks.');
  return { provider, path: resolved };
}

function candidateId(answer, seed, gridHash) {
  return `${String(answer).toUpperCase()}-${hashSeed(`${M9_SELECTOR_VERSION}|${seed}|${gridHash}`).toString(16)}`;
}

function bandForRank(rank, count) {
  return Math.min(2, Math.floor((rank - 1) * 3 / count));
}

function addBands(candidates, metric = 'regularMeanScore') {
  const ordered = candidates.slice().sort((a, b) => Number(b[metric] ?? b.cheapMetricValue) - Number(a[metric] ?? a.cheapMetricValue) || a.candidateId.localeCompare(b.candidateId));
  const ranks = new Map(ordered.map((candidate, index) => [candidate.candidateId, { rank: index + 1, band: bandForRank(index + 1, ordered.length) }]));
  return candidates.map(candidate => ({ ...candidate, difficultyBand: ['easier', 'middle', 'harder'][ranks.get(candidate.candidateId).band], difficultyRank: ranks.get(candidate.candidateId).rank }));
}

function shortlistCertified(candidates, config) {
  const ordered = candidates.slice().sort((a, b) => a.cheapMetricValue - b.cheapMetricValue || a.candidateId.localeCompare(b.candidateId));
  const count = Math.min(config.shortlistSize, ordered.length);
  const start = Math.max(0, Math.floor((ordered.length - count) / 2));
  const selectedIds = new Set(ordered.slice(start, start + count).map(candidate => candidate.candidateId));
  return candidates.map(candidate => ({ ...candidate, shortlisted: selectedIds.has(candidate.candidateId), shortlistReason: selectedIds.has(candidate.candidateId) ? 'central opportunity-density region' : 'outside central opportunity-density region' }));
}

function profileCandidate(candidate, input, index, provider, model, runs, config, stage) {
  const result = simulatePuzzleMonteCarlo({ puzzle: candidate.puzzle, playerModel: model, runs, masterSeed: hashSeed(`${M9_SELECTOR_VERSION}|${input.answer}|${candidate.candidateId}|${model}|${stage}`) }, index, { accessibilitySystem: M81_FREQUENCY_MODEL, familiarityProvider: provider });
  return {
    ...candidate,
    [`${model.toLowerCase()}Runs`]: result.runs,
    [`${model.toLowerCase()}MeanScore`]: result.meanScore,
    [`${model.toLowerCase()}MedianScore`]: result.medianScore,
    [`${model.toLowerCase()}GoldRate`]: result.goldRate,
    [`${model.toLowerCase()}HexalinkRate`]: result.hexalinkRate,
    [`${model.toLowerCase()}RareWordDependency`]: result.goldVocabulary.byThreshold[0.5].rareWordDependencyRate,
    [`${model.toLowerCase()}PlayedFamiliarity`]: result.familiarity.mean,
    [`${model.toLowerCase()}Result`]: result,
    profileStage: stage
  };
}

function chooseFinalist(candidates, config) {
  const preferred = config.difficultyPolicy.preferredBand === 'middle' ? 1 : config.difficultyPolicy.preferredBand === 'easier' ? 0 : 2;
  const bands = new Set(candidates.filter(candidate => candidate.difficultyBand === ['easier', 'middle', 'harder'][preferred]).map(candidate => candidate.candidateId));
  if (!bands.size && config.difficultyPolicy.allowAdjacentBands) {
    for (const candidate of candidates) if (Math.abs(['easier', 'middle', 'harder'].indexOf(candidate.difficultyBand) - preferred) === 1) bands.add(candidate.candidateId);
  }
  const eligible = candidates.filter(candidate => bands.has(candidate.candidateId));
  const scores = eligible.map(candidate => Number(candidate.regularMeanScore));
  const center = scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length);
  return eligible.slice().sort((a, b) => Math.abs(a.regularMeanScore - center) - Math.abs(b.regularMeanScore - center) ||
    (Number(a.regularMedianScore) - Number(b.regularMedianScore)) ||
    (Number(a.regularRareWordDependency) - Number(b.regularRareWordDependency)) ||
    (Number(a.strongMeanScore || Infinity) - Number(b.strongMeanScore || Infinity)) ||
    a.candidateId.localeCompare(b.candidateId))[0];
}

function privateCandidate(candidate) {
  const clone = { ...candidate };
  delete clone.puzzle;
  delete clone.regularResult;
  delete clone.strongResult;
  return clone;
}

function publicPuzzle(candidate) {
  return { ...candidate.puzzle };
}

function selectDailyGridM9(options = {}) {
  const started = process.hrtime.bigint();
  if (!options.answer || String(options.answer).length !== 10) return { ok: false, status: 'INVALID_ANSWER', error: 'M9 requires a 10-letter answer.' };
  const config = resolveM9Config(options.config);
  let familiarity;
  try { familiarity = requireRealProvider(options.frequencyFile); } catch (error) { return { ok: false, status: 'REAL_FAMILIARITY_REQUIRED', error: error.message }; }
  const index = options.wordIndex;
  if (!index) throw new Error('M9 requires a prebuilt Vocabulary 1.0 index.');
  const answer = String(options.answer).toUpperCase();
  const poolStarted = process.hrtime.bigint();
  const pool = generateCandidatePool({ answer, clue: options.clue || answer, date: options.date || null, masterSeed: options.seed ?? hashSeed(`${answer}|${options.date || ''}|${M9_SELECTOR_VERSION}`) }, index, { candidatePoolSize: config.rawCandidates, maxAttemptsPerCandidate: config.maxAttemptsPerCandidate, candidateGenerator: config.candidateGenerator, selectorVersion: M9_SELECTOR_VERSION });
  const generationMs = Number(process.hrtime.bigint() - poolStarted) / 1e6;
  const candidates = [];
  const hashes = new Set();
  const cheapStarted = process.hrtime.bigint();
  for (const candidate of pool.candidates) {
    const gridHash = candidate.gridHash || canonicalGridHash(candidate.puzzle.grid);
    if (hashes.has(gridHash)) continue;
    hashes.add(gridHash);
    const cheap = moveSpaceMetrics(candidate.puzzle, index);
    const uniqueSkeletons = new Set(enumerateLegalMoves(candidate.puzzle, index).map(move => move.consonantSkeleton)).size;
    const hex = hexalinkMetrics(candidate.puzzle, index, answer);
    candidates.push({ candidateId: candidateId(answer, candidate.candidateSeed, gridHash), candidateIndex: candidate.candidateIndex, candidateSeed: candidate.candidateSeed, gridHash, puzzle: candidate.puzzle, privateCertification: candidate.privateCertification, certified: candidate.hardGateStatus === 'accepted' && Number(candidate.privateCertification?.goldScore || 0) >= 100, certificateScore: candidate.privateCertification?.goldScore || null, certificateTurns: candidate.privateCertification?.goldTurns || null, cheapMetricName: 'uniquePlayableWords', cheapMetricValue: cheap.uniquePlayableWords, rawLegalMoves: cheap.rawMoves, uniqueTileMasks: cheap.uniqueTileMasks, uniqueSkeletons, hexalinkRate: cheap.rawMoves ? cheap.hexalinkMoveParticipation / cheap.rawMoves : 0, hexalinkRowsTouched: hex.rowsTouched, hexalinkColumnsTouched: hex.columnsTouched, shortlisted: false, finalist: false, selected: false, selectionReason: '' });
  }
  const cheapMetricsMs = Number(process.hrtime.bigint() - cheapStarted) / 1e6;
  const certified = candidates.filter(candidate => candidate.certified);
  if (certified.length < config.certifiedCandidateTarget) return { ok: false, status: 'INSUFFICIENT_CANDIDATE_POOL', error: `Only ${certified.length} certified candidates; required ${config.certifiedCandidateTarget}.`, pool, candidates: candidates.map(privateCandidate), config, familiarity: familiarity.provider.metadata };
  let staged = addBands(shortlistCertified(certified, config), 'cheapMetricValue');
  const regularProfileTargets = options.profileAllCandidates ? staged : staged.filter(candidate => candidate.shortlisted);
  const regularStarted = process.hrtime.bigint();
  const shortlist = regularProfileTargets.map(candidate => profileCandidate(candidate, { answer }, index, familiarity.provider, 'REGULAR', config.regularRuns, config, options.profileAllCandidates ? 'regular-audit' : 'regular-shortlist'));
  const regularSimulationMs = Number(process.hrtime.bigint() - regularStarted) / 1e6;
  staged = staged.map(candidate => shortlist.find(item => item.candidateId === candidate.candidateId) || candidate);
  staged = addBands(staged, 'regularMeanScore');
  const regularOrdered = staged.filter(candidate => candidate.shortlisted).sort((a, b) => Math.abs(a.regularMeanScore - staged.filter(item => item.shortlisted).reduce((sum, item) => sum + item.regularMeanScore, 0) / shortlist.length) - Math.abs(b.regularMeanScore - staged.filter(item => item.shortlisted).reduce((sum, item) => sum + item.regularMeanScore, 0) / shortlist.length) || a.candidateId.localeCompare(b.candidateId));
  const finalists = regularOrdered.slice(0, Math.min(config.strongFinalistCount, regularOrdered.length));
  let withStrong = staged.map(candidate => finalists.some(item => item.candidateId === candidate.candidateId) ? { ...candidate, finalist: true } : candidate);
  const strongStarted = process.hrtime.bigint();
  withStrong = withStrong.map(candidate => finalists.some(item => item.candidateId === candidate.candidateId) ? profileCandidate(candidate, { answer }, index, familiarity.provider, 'STRONG', config.strongRuns, config, 'strong-finalist') : candidate);
  const strongSimulationMs = Number(process.hrtime.bigint() - strongStarted) / 1e6;
  const selected = chooseFinalist(withStrong.filter(candidate => candidate.finalist), config);
  if (!selected) return { ok: false, status: 'SELECTION_FAILED', error: 'No eligible finalist remained.', pool, candidates: withStrong.map(privateCandidate), config, familiarity: familiarity.provider.metadata };
  const selectedWithReason = { ...selected, selected: true, selectionReason: [`passed M6 Gold certification (${selected.certificateScore} points in ${selected.certificateTurns} turns)`, `survived central ${selected.cheapMetricName} shortlist`, `classified ${selected.difficultyBand} relative REGULAR score band`, 'selected by staged deterministic tie-breakers', config.accessibilityGuardrail] };
  withStrong = withStrong.map(candidate => candidate.candidateId === selected.candidateId ? selectedWithReason : candidate);
  const certificationMs = pool.candidates.reduce((sum, candidate) => sum + Number(candidate.generationStats?.totalSolverMs || 0), 0);
  const manifest = { selector: 'M9', selectorVersion: M9_SELECTOR_VERSION, configVersion: M9_CONFIG_VERSION, generatorVersion: GENERATOR_VERSION, rulesVersion: RULES_VERSION, vocabularyVersion: VOCABULARY_VERSION, simulatorVersion: SIMULATOR_VERSION, playerModelVersion: PLAYER_MODEL_VERSION, familiarity: familiarity.provider.metadata, answer, date: options.date || null, seed: options.seed ?? null, candidateCounts: { raw: config.rawCandidates, generated: pool.candidates.length, certified: certified.length, shortlisted: staged.filter(candidate => candidate.shortlisted).length, regularProfiled: shortlist.length, finalists: finalists.length }, selectedCandidateId: selected.candidateId, selectedGridHash: selected.gridHash, certificate: selected.privateCertification?.goldCertificate || [], selectedCandidate: privateCandidate(selectedWithReason), candidates: withStrong.map(privateCandidate), selectionExplanation: { difficultyBand: selected.difficultyBand, regularMeanScore: selected.regularMeanScore, regularMedianScore: selected.regularMedianScore, regularGoldRate: selected.regularGoldRate, strongMeanScore: selected.strongMeanScore, strongGoldRate: selected.strongGoldRate, skillGap: selected.strongMeanScore - selected.regularMeanScore, rareWordDependency: selected.regularRareWordDependency, hexalinkRate: selected.regularHexalinkRate, selectionReasons: selected.selectionReason }, timing: { generationMs, certificationMs, cheapMetricsMs, regularSimulationMs, strongSimulationMs, totalMs: Number(process.hrtime.bigint() - started) / 1e6 } };
  return { ok: true, status: 'SELECTED', publicPuzzle: publicPuzzle(selectedWithReason), privateManifest: manifest, selected: selectedWithReason, candidates: withStrong.map(privateCandidate), pool, config };
}

module.exports = { M9_SELECTOR_VERSION, M9_CONFIG_VERSION, DEFAULT_M9_CONFIG, resolveM9Config, requireRealProvider, candidateId, bandForRank, addBands, shortlistCertified, profileCandidate, chooseFinalist, selectDailyGridM9 };
