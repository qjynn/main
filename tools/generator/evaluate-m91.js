#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generateCandidatePool, canonicalGridHash } = require('./candidate-pool.js');
const { moveSpaceMetrics } = require('../experiments/production-headroom.js');
const { hashSeed } = require('./grid-generator.js');
const { M81_FREQUENCY_MODEL } = require('../simulator/player-models.js');
const { runIncrementalMonteCarlo } = require('../simulator/incremental-monte-carlo.js');
const { requireM91Provider, referenceSelection, shortlistByLowRun, shortlistRecall } = require('./m91-simulation-selector.js');
const { shortlistCertified } = require('./m9-hybrid-selector.js');

const LOW_RUNS = [25, 50, 75, 100, 150, 250];
const SHORTLIST_SIZES = [4, 5, 6, 7, 8];
const METHODS = ['low_mean', 'low_median', 'low_gold', 'band_aware', 'confidence_aware', 'hybrid_regular_cheap', 'M9_math_only'];

function csvRows(file) {
  const rows = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(line => line.split(','));
  const headers = rows.shift();
  return rows.map(row => Object.fromEntries(headers.map((key, i) => [key, row[i]])));
}
function loadAnswers(limit = Number(process.env.M91_ANSWERS || 30)) {
  return csvRows(path.join(__dirname, '..', '..', 'analysis', 'm82-puzzle-manifest.csv')).map(row => row.answer).filter((answer, i, all) => all.indexOf(answer) === i).slice(0, limit);
}
function csvValue(value) { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function writeCsv(file, rows) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  fs.writeFileSync(file, `${headers.join(',')}\n${rows.map(row => headers.map(key => csvValue(row[key])).join(',')).join('\n')}\n`);
}
function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function percentile(values, p) { const a = values.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))] : 0; }
function spearman(a, b) {
  const rank = values => { const sorted = values.map((value, index) => ({ value, index })).sort((x, y) => x.value - y.value || x.index - y.index); const out = Array(values.length); sorted.forEach((item, index) => { out[item.index] = index + 1; }); return out; };
  const x = rank(a); const y = rank(b); const n = x.length;
  if (n < 2) return 1;
  const d2 = x.reduce((sum, value, i) => sum + (value - y[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}
function bandName(candidate) { return candidate?.difficultyBand || ''; }
function adjacentBand(a, b) { const bands = ['easier', 'middle', 'harder']; return Math.abs(bands.indexOf(a) - bands.indexOf(b)) <= 1; }

function candidateForPool(candidate, index) {
  const cheap = moveSpaceMetrics(candidate.puzzle, index);
  return { candidateId: candidate.candidateSeed.toString(16), candidateSeed: candidate.candidateSeed, gridHash: candidate.gridHash || canonicalGridHash(candidate.puzzle.grid), puzzle: candidate.puzzle, certified: candidate.hardGateStatus === 'accepted' && Number(candidate.privateCertification?.goldScore || 0) >= 100, certificateScore: candidate.privateCertification?.goldScore || null, cheapMetricValue: cheap.uniquePlayableWords, rawLegalMoves: cheap.rawMoves, uniqueTileMasks: cheap.uniqueTileMasks };
}

function profileCandidate(candidate, wordIndex, provider, answer, seed, maxRuns) {
  const batch = runIncrementalMonteCarlo({ puzzle: candidate.puzzle, playerModel: 'REGULAR', masterSeed: hashSeed(`M91|${answer}|${candidate.candidateId}|${seed}`) }, wordIndex, { maxRuns, profileRuns: [...new Set(LOW_RUNS.concat([500, maxRuns]))], accessibilitySystem: M81_FREQUENCY_MODEL, familiarityProvider: provider });
  const profiles = Object.fromEntries(Object.entries(batch.profiles).map(([runs, profile]) => [runs, { ...profile, regularMeanScore: profile.meanScore, regularMedianScore: profile.medianScore, regularGoldRate: profile.goldRate, regularHexalinkRate: profile.hexalinkRate }]));
  return { profiles, simulationMs: batch.simulationMs, masterSeed: batch.masterSeed };
}

function profileStrong(candidate, wordIndex, provider, answer, seed, runs) {
  const batch = runIncrementalMonteCarlo({ puzzle: candidate.puzzle, playerModel: 'STRONG', masterSeed: hashSeed(`M91|${answer}|${candidate.candidateId}|${seed}|STRONG`) }, wordIndex, { maxRuns: runs, profileRuns: [runs], accessibilitySystem: M81_FREQUENCY_MODEL, familiarityProvider: provider });
  return { ...batch.profiles[runs], strongMeanScore: batch.profiles[runs].meanScore, strongGoldRate: batch.profiles[runs].goldRate, simulationMs: batch.simulationMs };
}

function methodShortlist(candidates, method, runs, size) {
  if (method === 'M9_math_only') return shortlistCertified(candidates, { shortlistSize: size });
  const metric = method === 'low_median' ? 'regularMedianScore' : method === 'low_gold' ? 'regularGoldRate' : 'regularMeanScore';
  if (method === 'band_aware') return shortlistByLowRun(candidates, size, 'regularMeanScore', 'band-aware');
  if (method === 'confidence_aware') {
    const center = mean(candidates.map(candidate => Number(candidate.regularMeanScore)));
    const ordered = candidates.slice().sort((a, b) => (Math.abs(a.regularMeanScore - center) - Number(a.scoreStdDev || 0) / Math.sqrt(Math.max(1, runs))) - (Math.abs(b.regularMeanScore - center) - Number(b.scoreStdDev || 0) / Math.sqrt(Math.max(1, runs))) || a.candidateId.localeCompare(b.candidateId));
    return shortlistByLowRun(ordered, size, 'regularMeanScore');
  }
  return shortlistByLowRun(candidates, size, metric, method === 'hybrid_regular_cheap' ? 'hybrid' : 'rank');
}

function selectFromStaged(staged, referenceConfig) {
  const reference = referenceSelection(staged, referenceConfig);
  return reference.winner;
}

function evaluate(options = {}) {
  const providerInfo = requireM91Provider(options.frequencyFile);
  const index = options.wordIndex || buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
  const answers = options.answers || loadAnswers();
  const recallRows = [], winnerRows = [], zeroRows = [], bandRows = [], methodRows = [], strongRows = [], runtimeRows = [], selectionRows = [], poolRows = [];
  const summaries = [];
  for (let answerIndex = 0; answerIndex < answers.length; answerIndex++) {
    const answer = answers[answerIndex];
    const date = `2032-01-${String(answerIndex + 1).padStart(2, '0')}`;
    const masterSeed = 930000 + answerIndex;
    const poolStarted = process.hrtime.bigint();
    const pool = generateCandidatePool({ answer, clue: answer, date, masterSeed }, index, { candidatePoolSize: 10, maxAttemptsPerCandidate: 20, candidateGenerator: 'M6_BASELINE', selectorVersion: 'm9.1' });
    const generationMs = Number(process.hrtime.bigint() - poolStarted) / 1e6;
    const candidates = pool.candidates.map(candidate => candidateForPool(candidate, index)).filter(candidate => candidate.certified);
    if (candidates.length < 10) continue;
    const referenceRunMax = answerIndex < 10 ? 1000 : 500;
    const profileStarted = process.hrtime.bigint();
    const profiled = candidates.map(candidate => ({ ...candidate, ...profileCandidate(candidate, index, providerInfo.provider, answer, masterSeed, referenceRunMax) }));
    const profileMs = Number(process.hrtime.bigint() - profileStarted) / 1e6;
    const referenceCandidates = profiled.map(candidate => ({ ...candidate, regularMeanScore: candidate.profiles[500].regularMeanScore, regularMedianScore: candidate.profiles[500].regularMedianScore, regularGoldRate: candidate.profiles[500].regularGoldRate, scoreStdDev: candidate.profiles[500].scoreStdDev }));
    const reference = referenceSelection(referenceCandidates, { difficultyPolicy: { preferredBand: 'middle' } });
    const referenceBanded = reference.candidates;
    const referenceIds = new Set(reference.preferred.map(candidate => candidate.candidateId));
    const runMetrics = {};
    for (const runs of LOW_RUNS) {
      runMetrics[runs] = referenceCandidates.map(candidate => ({ ...candidate, regularMeanScore: candidate.profiles[runs].regularMeanScore, regularMedianScore: candidate.profiles[runs].regularMedianScore, regularGoldRate: candidate.profiles[runs].regularGoldRate, lowCenter: mean(referenceCandidates.map(item => item.profiles[runs].regularMeanScore)) }));
      for (const method of METHODS.filter(name => name !== 'M9_math_only')) {
        for (const size of SHORTLIST_SIZES) {
          const marked = methodShortlist(runMetrics[runs], method, runs, size);
          const recall = shortlistRecall(marked, reference.preferred, reference.winner);
          const estimatedMs = profileMs * runs / 500;
          recallRows.push({ answer, method, low_runs: runs, shortlist_size: size, certified_candidates: candidates.length, reference_preferred_count: recall.referencePreferredCount, preferred_retained: recall.preferredRetained, recall: recall.recall, reference_winner_retained: recall.referenceWinnerRetained, zero_preferred_retained: recall.zeroPreferredRetained, runtime_ms: estimatedMs });
        }
      }
    }
    const mathMarked = methodShortlist(referenceCandidates.map(candidate => ({ ...candidate, cheapMetricValue: candidate.cheapMetricValue })), 'M9_math_only', 0, 5);
    const mathRecall = shortlistRecall(mathMarked, reference.preferred, reference.winner);
    methodRows.push({ answer, method: 'M9_math_only', low_runs: '', shortlist_size: 5, recall: mathRecall.recall, zero_recall: mathRecall.zeroPreferredRetained, winner_recall: mathRecall.referenceWinnerRetained, runtime_ms: generationMs });
    const chosenRuns = 100, chosenSize = 5;
    for (const method of ['low_mean', 'low_median', 'low_gold', 'band_aware', 'confidence_aware', 'hybrid_regular_cheap']) {
      const marked = methodShortlist(runMetrics[chosenRuns], method, chosenRuns, chosenSize);
      const methodRecall = shortlistRecall(marked, reference.preferred, reference.winner);
      methodRows.push({ answer, method, low_runs: chosenRuns, shortlist_size: chosenSize, recall: methodRecall.recall, zero_recall: methodRecall.zeroPreferredRetained, winner_recall: methodRecall.referenceWinnerRetained, runtime_ms: profileMs * chosenRuns / 500 });
      const retained = marked.filter(candidate => candidate.shortlisted);
      const staged = retained.map(candidate => ({ ...candidate, regularMeanScore: candidate.profiles[500].regularMeanScore, regularMedianScore: candidate.profiles[500].regularMedianScore, regularGoldRate: candidate.profiles[500].regularGoldRate }));
      const stagedWinner = selectFromStaged(staged, { difficultyPolicy: { preferredBand: 'middle' } });
      const stagedBand = stagedWinner ? referenceBanded.find(candidate => candidate.candidateId === stagedWinner.candidateId)?.difficultyBand || '' : '';
      const referenceBand = reference.winner?.difficultyBand || '';
      selectionRows.push({ answer, method, reference_winner: reference.winner?.candidateId || '', staged_winner: stagedWinner?.candidateId || '', same_candidate: Boolean(stagedWinner && stagedWinner.candidateId === reference.winner?.candidateId), reference_band: referenceBand, staged_band: stagedBand, same_band: stagedBand === referenceBand, adjacent_band: adjacentBand(stagedBand, referenceBand), reference_regular_mean: reference.winner?.regularMeanScore || '', staged_regular_mean: stagedWinner?.regularMeanScore || '', mean_delta: stagedWinner ? stagedWinner.regularMeanScore - reference.winner.regularMeanScore : '', selection_regret_percentile: stagedWinner ? Math.abs((referenceCandidates.indexOf(stagedWinner) - referenceCandidates.indexOf(reference.winner)) / candidates.length) : '' });
      if (method === 'low_mean') {
        const strongCandidates = staged.slice(0, 3);
        const strongStarted = process.hrtime.bigint();
        const strongProfiles = strongCandidates.map(candidate => ({ ...candidate, ...profileStrong(candidate, index, providerInfo.provider, answer, masterSeed, 250) }));
        const strongWinner = strongProfiles.slice().sort((a, b) => Number(b.strongMeanScore) - Number(a.strongMeanScore) || a.candidateId.localeCompare(b.candidateId))[0];
        strongRows.push({ answer, regular_only_candidate: stagedWinner?.candidateId || '', strong_final_candidate: strongWinner?.candidateId || '', changed: Boolean(strongWinner && stagedWinner && strongWinner.candidateId !== stagedWinner.candidateId), regular_mean_before: stagedWinner?.regularMeanScore || '', regular_mean_after: strongWinner?.regularMeanScore || '', strong_mean_before: strongWinner?.regularMeanScore || '', strong_mean_after: strongWinner?.strongMeanScore || '', skill_gap_before: strongWinner ? strongWinner.strongMeanScore - strongWinner.regularMeanScore : '', skill_gap_after: strongWinner ? strongWinner.strongMeanScore - strongWinner.regularMeanScore : '', strong_runtime_ms: Number(process.hrtime.bigint() - strongStarted) / 1e6 });
      }
    }
    const preferred = reference.preferred;
    for (const runs of LOW_RUNS) {
      const marked = methodShortlist(runMetrics[runs], 'low_mean', runs, 5);
      const recall = shortlistRecall(marked, preferred, reference.winner);
      recallRows.push({ answer, method: 'low_mean_frontier', low_runs: runs, shortlist_size: 5, certified_candidates: candidates.length, reference_preferred_count: recall.referencePreferredCount, preferred_retained: recall.preferredRetained, recall: recall.recall, reference_winner_retained: recall.referenceWinnerRetained, zero_preferred_retained: recall.zeroPreferredRetained, runtime_ms: profileMs * runs / 500 });
      winnerRows.push({ answer, low_runs: runs, shortlist_size: 5, winner_retained: recall.referenceWinnerRetained, method: 'low_mean' });
      zeroRows.push({ answer, low_runs: runs, shortlist_size: 5, zero_recall: recall.zeroPreferredRetained, method: 'low_mean' });
      const staged = marked.filter(candidate => candidate.shortlisted).map(candidate => ({ ...candidate, regularMeanScore: candidate.profiles[500].regularMeanScore }));
      const stagedWinner = selectFromStaged(staged, { difficultyPolicy: { preferredBand: 'middle' } });
      const refBand = reference.winner?.difficultyBand || ''; const stageBand = stagedWinner ? referenceBanded.find(candidate => candidate.candidateId === stagedWinner.candidateId)?.difficultyBand || '' : '';
      bandRows.push({ answer, low_runs: runs, shortlist_size: 5, reference_selected_band: refBand, staged_selected_band: stageBand, same_band: stageBand === refBand, adjacent_band: adjacentBand(stageBand, refBand), reference_regular_mean: reference.winner?.regularMeanScore || '', staged_regular_mean: stagedWinner?.regularMeanScore || '', mean_delta: stagedWinner ? stagedWinner.regularMeanScore - reference.winner.regularMeanScore : '' });
    }
    const reference1000 = answerIndex < 10 ? referenceSelection(referenceCandidates.map(candidate => ({ ...candidate, regularMeanScore: candidate.profiles[1000].regularMeanScore })), { difficultyPolicy: { preferredBand: 'middle' } }) : null;
    if (reference1000) {
      const band1000 = reference1000.candidates;
      summaries.push({ answer, spearman_500_vs_1000: spearman(referenceCandidates.map(candidate => candidate.profiles[500].regularMeanScore), referenceCandidates.map(candidate => candidate.profiles[1000].regularMeanScore)), preferred_band_agreement: referenceBanded.filter(candidate => band1000.find(other => other.candidateId === candidate.candidateId)?.difficultyBand === candidate.difficultyBand).length / candidates.length, winner_500: reference.winner?.candidateId, winner_1000: reference1000.winner?.candidateId });
    }
    runtimeRows.push({ answer, generation_ms: generationMs, certification_ms: mean(pool.candidates.map(candidate => Number(candidate.generationStats?.totalSolverMs || 0))), low_run_regular_ms: profileMs * 100 / 500, high_run_regular_ms: profileMs * 400 / 500, strong_ms: strongRows.at(-1)?.strong_runtime_ms || 0, total_staged_ms: generationMs + profileMs * 100 / 500 + profileMs * 400 / 500 + (strongRows.at(-1)?.strong_runtime_ms || 0) });
    for (const candidate of referenceCandidates) {
      poolRows.push({ answer, pool_size: 10, candidate_id: candidate.candidateId, reference_mean_score: candidate.regularMeanScore, reference_band: referenceBanded.find(item => item.candidateId === candidate.candidateId)?.difficultyBand || '', cheap_metric: candidate.cheapMetricValue });
    }
  }
  return { answers, recallRows, winnerRows, zeroRows, bandRows, methodRows, strongRows, runtimeRows, selectionRows, poolRows, summaries, provider: providerInfo.provider.metadata };
}

function writeOutputs(result, outputDir = path.join(__dirname, '..', '..', 'analysis')) {
  fs.mkdirSync(outputDir, { recursive: true });
  writeCsv(path.join(outputDir, 'm91-evaluation-manifest.csv'), result.answers.map(answer => ({ answer, status: 'evaluated' })));
  writeCsv(path.join(outputDir, 'm91-reference-profiles.csv'), result.poolRows);
  writeCsv(path.join(outputDir, 'm91-shortlist-recall.csv'), result.recallRows);
  writeCsv(path.join(outputDir, 'm91-winner-recall.csv'), result.winnerRows);
  writeCsv(path.join(outputDir, 'm91-zero-recall.csv'), result.zeroRows);
  writeCsv(path.join(outputDir, 'm91-band-preservation.csv'), result.bandRows);
  writeCsv(path.join(outputDir, 'm91-method-comparison.csv'), result.methodRows);
  writeCsv(path.join(outputDir, 'm91-strong-contribution.csv'), result.strongRows);
  writeCsv(path.join(outputDir, 'm91-runtime-frontier.csv'), result.runtimeRows);
  writeCsv(path.join(outputDir, 'm91-pool-sensitivity.csv'), result.poolRows);
  writeCsv(path.join(outputDir, 'm91-selection-comparison.csv'), result.selectionRows);
  const frontier = result.recallRows.filter(row => row.method === 'low_mean').map(row => Number(row.recall));
  const summary = { selector: 'M9.1', answersEvaluated: result.answers.length, provider: result.provider, referenceRuns: 500, tenAnswerReferenceStability: result.summaries, bestLowMeanRecall: frontier.length ? Math.max(...frontier) : null, zeroRecallRateLowMean: result.zeroRows.length ? result.zeroRows.filter(row => row.zero_recall === 'true').length / result.zeroRows.length : null, strongChangeRate: result.strongRows.length ? result.strongRows.filter(row => row.changed).length / result.strongRows.length : null, note: 'M9 math shortlist remains available; M9.1 validation is simulation-first and does not modify M9.' };
  fs.writeFileSync(path.join(outputDir, 'm91-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (require.main === module) { const result = evaluate({ frequencyFile: process.env.M81_FREQUENCY_FILE }); console.log(JSON.stringify(writeOutputs(result), null, 2)); }
module.exports = { evaluate, writeOutputs, shortlistRecall, spearman, methodShortlist, candidateForPool, profileCandidate };
