#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { selectDailyGridM9, chooseFinalist, resolveM9Config } = require('./m9-hybrid-selector.js');
const { toCsv } = require('../analyzer/batch-analyzer.js');

function csvRows(file) { const rows = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(line => line.split(',')); const headers = rows.shift(); return rows.map(row => Object.fromEntries(headers.map((key, i) => [key, row[i]]))); }
function percentileRank(values, value, higherIsBetter = true) { const ordered = values.slice().sort((a, b) => higherIsBetter ? b - a : a - b); const index = ordered.findIndex(item => item === value); return ordered.length < 2 ? 50 : (index < 0 ? 50 : 100 * (ordered.length - 1 - index) / (ordered.length - 1)); }
function loadAnswers() {
  const file = path.join(__dirname, '..', '..', 'analysis', 'm82-puzzle-manifest.csv');
  return csvRows(file).map(row => row.answer).filter((answer, index, all) => all.indexOf(answer) === index).slice(0, Number(process.env.M9_ANSWERS || 30));
}
function candidateRow(answer, candidate, selectedId) {
  return { answer, candidate_id: candidate.candidateId, grid_hash: candidate.gridHash, generation_seed: candidate.candidateSeed, certificate_score: candidate.certificateScore, certificate_turns: candidate.certificateTurns, cheap_metric_name: candidate.cheapMetricName, cheap_metric_value: candidate.cheapMetricValue, shortlisted: candidate.shortlisted, regular_runs: candidate.regularRuns || '', regular_mean_score: candidate.regularMeanScore || '', regular_median_score: candidate.regularMedianScore || '', regular_gold_rate: candidate.regularGoldRate || '', regular_hexalink_rate: candidate.regularHexalinkRate || '', regular_rare_word_dependency: candidate.regularRareWordDependency || '', finalist: candidate.finalist, strong_runs: candidate.strongRuns || '', strong_mean_score: candidate.strongMeanScore || '', strong_median_score: candidate.strongMedianScore || '', strong_gold_rate: candidate.strongGoldRate || '', difficulty_band: candidate.difficultyBand || '', selected: candidate.candidateId === selectedId, selection_reason: candidate.selectionReason || '' };
}
function evaluate(options = {}) {
  const index = options.wordIndex || buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
  const answers = options.answers || loadAnswers();
  const config = resolveM9Config({ rawCandidates: options.rawCandidates || 10, certifiedCandidateTarget: options.certifiedCandidateTarget || 5, shortlistSize: options.shortlistSize || 5, regularRuns: options.regularRuns || 250, strongFinalistCount: options.strongFinalistCount || 3, strongRuns: options.strongRuns || 250 });
  const evaluations = [];
  const candidates = [];
  const positions = [];
  const performance = [];
  const ablations = [];
  const recall = [];
  const rerunMismatches = [];
  for (let i = 0; i < answers.length; i++) {
    const answer = answers[i];
    const result = selectDailyGridM9({ answer, date: `2031-01-${String(i + 1).padStart(2, '0')}`, seed: 920000 + i, wordIndex: index, frequencyFile: options.frequencyFile, profileAllCandidates: true, config });
    if (!result.ok) { evaluations.push({ answer, status: result.status, error: result.error }); continue; }
    evaluations.push({ answer, status: result.status, selected: result.privateManifest.selectedCandidateId, band: result.privateManifest.selectionExplanation.difficultyBand, certified: result.privateManifest.candidateCounts.certified, shortlist: result.privateManifest.candidateCounts.shortlisted, finalists: result.privateManifest.candidateCounts.finalists });
    candidates.push(...result.privateManifest.candidates.map(candidate => candidateRow(answer, candidate, result.privateManifest.selectedCandidateId)));
    const pool = result.privateManifest.candidates.filter(candidate => candidate.certified);
    const selected = result.privateManifest.selectedCandidate;
    positions.push({ answer, selected_candidate_id: selected.candidateId, regular_mean_percentile: percentileRank(pool.map(c => Number(c.regularMeanScore)).filter(Number.isFinite), Number(selected.regularMeanScore)), regular_gold_percentile: percentileRank(pool.map(c => Number(c.regularGoldRate)).filter(Number.isFinite), Number(selected.regularGoldRate)), strong_mean_percentile: percentileRank(pool.map(c => Number(c.strongMeanScore)).filter(Number.isFinite), Number(selected.strongMeanScore)), cheap_metric_percentile: percentileRank(pool.map(c => Number(c.cheapMetricValue)), Number(selected.cheapMetricValue)), difficulty_band: selected.difficultyBand });
    performance.push({ answer, generation_ms: result.privateManifest.timing.generationMs, certification_ms: result.privateManifest.timing.certificationMs, cheap_metrics_ms: result.privateManifest.timing.cheapMetricsMs, regular_simulation_ms: result.privateManifest.timing.regularSimulationMs, strong_simulation_ms: result.privateManifest.timing.strongSimulationMs, total_ms: result.privateManifest.timing.totalMs, candidate_count: result.privateManifest.candidateCounts.certified, shortlist_count: result.privateManifest.candidateCounts.shortlisted, finalist_count: result.privateManifest.candidateCounts.finalists });
    const mathCandidate = pool.slice().sort((a, b) => Number(a.cheapMetricValue) - Number(b.cheapMetricValue) || a.candidateId.localeCompare(b.candidateId))[Math.floor(pool.length / 2)];
    const regularCandidate = chooseFinalist(pool.filter(c => c.regularMeanScore !== undefined).map(c => ({ ...c, difficultyBand: c.difficultyBand || 'middle' })), config);
    ablations.push({ answer, math_only_candidate: mathCandidate?.candidateId || '', regular_candidate: regularCandidate?.candidateId || '', full_m9_candidate: result.privateManifest.selectedCandidateId, strong_changed_regular: Boolean(regularCandidate && regularCandidate.candidateId !== result.privateManifest.selectedCandidateId) });
    const preferred = pool.filter(c => c.regularMeanScore !== undefined).sort((a, b) => Number(b.regularMeanScore) - Number(a.regularMeanScore));
    const retained = preferred.filter(c => c.shortlisted && c.difficultyBand === 'middle');
    recall.push({ answer, certified_candidates: pool.length, shortlist_size: result.privateManifest.candidateCounts.shortlisted, preferred_candidates_by_full_REGULAR_profile: preferred.slice(Math.floor(preferred.length * 0.33), Math.ceil(preferred.length * 0.67)).length, preferred_candidates_retained: retained.length, recall: preferred.length ? retained.length / Math.max(1, preferred.slice(Math.floor(preferred.length * 0.33), Math.ceil(preferred.length * 0.67)).length) : '' });
    if (i < 5) {
      const rerun = selectDailyGridM9({ answer, date: `2031-01-${String(i + 1).padStart(2, '0')}`, seed: 920000 + i, wordIndex: index, frequencyFile: options.frequencyFile, profileAllCandidates: true, config });
      if (!rerun.ok || rerun.privateManifest.selectedGridHash !== result.privateManifest.selectedGridHash) rerunMismatches.push(answer);
    }
  }
  return { answers, config, evaluations, candidates, positions, performance, ablations, recall, rerunMismatches };
}
function writeOutputs(result, outputDir = path.join(__dirname, '..', '..', 'analysis')) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'm9-evaluation-manifest.csv'), toCsv(result.evaluations));
  fs.writeFileSync(path.join(outputDir, 'm9-candidate-pools.csv'), toCsv(result.candidates));
  fs.writeFileSync(path.join(outputDir, 'm9-selected-puzzles.csv'), toCsv(result.evaluations));
  fs.writeFileSync(path.join(outputDir, 'm9-selection-position.csv'), toCsv(result.positions));
  fs.writeFileSync(path.join(outputDir, 'm9-m7b-comparison.csv'), 'answer,m7b_status,m9_candidate_id,comparison_status\n');
  fs.writeFileSync(path.join(outputDir, 'm9-ablation.csv'), toCsv(result.ablations));
  fs.writeFileSync(path.join(outputDir, 'm9-shortlist-recall.csv'), toCsv(result.recall));
  fs.writeFileSync(path.join(outputDir, 'm9-performance.csv'), toCsv(result.performance));
  const bands = {}; for (const row of result.evaluations) if (row.band) bands[row.band] = (bands[row.band] || 0) + 1;
  const summary = { selector: 'M9', answersEvaluated: result.answers.length, successfulSelections: result.evaluations.filter(row => row.status === 'SELECTED').length, selectionFailures: result.evaluations.filter(row => row.status !== 'SELECTED').length, config: result.config, bandSelections: bands, deterministicRerunMismatches: result.rerunMismatches, meanCertifiedCandidates: result.evaluations.reduce((s, row) => s + Number(row.certified || 0), 0) / Math.max(1, result.evaluations.length), meanShortlistSize: result.evaluations.reduce((s, row) => s + Number(row.shortlist || 0), 0) / Math.max(1, result.evaluations.length), meanFinalists: result.evaluations.reduce((s, row) => s + Number(row.finalists || 0), 0) / Math.max(1, result.evaluations.length), note: 'M7B paired grids were unavailable; comparison remains explicitly unavailable.' };
  fs.writeFileSync(path.join(outputDir, 'm9-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}
if (require.main === module) { const result = evaluate({ frequencyFile: process.env.M81_FREQUENCY_FILE }); const summary = writeOutputs(result); console.log(JSON.stringify(summary, null, 2)); }
module.exports = { evaluate, writeOutputs, percentileRank, loadAnswers };
