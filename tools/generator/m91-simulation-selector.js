const { shortlistCertified, addBands, chooseFinalist, profileCandidate, requireRealProvider } = require('./m9-hybrid-selector.js');
const { M81_FREQUENCY_MODEL } = require('../simulator/player-models.js');
const { runIncrementalMonteCarlo } = require('../simulator/incremental-monte-carlo.js');

const M91_SELECTOR_VERSION = 'm9.1';
const M91_CONFIG_VERSION = 'm9.1.config.0';

function centralSlice(candidates, size, metric) {
  const ordered = candidates.slice().sort((a, b) => Number(a[metric]) - Number(b[metric]) || a.candidateId.localeCompare(b.candidateId));
  const count = Math.min(size, ordered.length);
  const start = Math.max(0, Math.floor((ordered.length - count) / 2));
  const ids = new Set(ordered.slice(start, start + count).map(candidate => candidate.candidateId));
  return candidates.map(candidate => ({ ...candidate, shortlisted: ids.has(candidate.candidateId) }));
}

function preferredReferenceSet(candidates, preferredBand = 'middle') {
  const banded = addBands(candidates, 'regularMeanScore');
  return banded.filter(candidate => candidate.difficultyBand === preferredBand);
}

function referenceSelection(candidates, config) {
  const banded = addBands(candidates, 'regularMeanScore');
  const preferred = preferredReferenceSet(banded, config.difficultyPolicy?.preferredBand || 'middle');
  const eligible = preferred.length ? preferred : banded;
  const center = eligible.reduce((sum, candidate) => sum + Number(candidate.regularMeanScore), 0) / eligible.length;
  const winner = eligible.slice().sort((a, b) => Math.abs(a.regularMeanScore - center) - Math.abs(b.regularMeanScore - center) || Number(b.regularMedianScore) - Number(a.regularMedianScore) || a.candidateId.localeCompare(b.candidateId))[0];
  return { candidates: banded, preferred, winner };
}

function shortlistByLowRun(candidates, size, metric, mode = 'rank') {
  if (mode === 'band-aware') {
    const banded = addBands(candidates, metric);
    const middle = banded.filter(candidate => candidate.difficultyBand === 'middle').sort((a, b) => Math.abs(a[metric] - medianValue(candidates, metric)) - Math.abs(b[metric] - medianValue(candidates, metric)) || a.candidateId.localeCompare(b.candidateId));
    const remainder = banded.filter(candidate => !middle.includes(candidate)).sort((a, b) => Math.abs(a[metric] - medianValue(candidates, metric)) - Math.abs(b[metric] - medianValue(candidates, metric)) || a.candidateId.localeCompare(b.candidateId));
    return markShortlisted(candidates, middle.concat(remainder).slice(0, size));
  }
  const center = medianValue(candidates, metric);
  const ordered = candidates.slice().sort((a, b) => Math.abs(Number(a[metric]) - center) - Math.abs(Number(b[metric]) - center) || (mode === 'hybrid' ? Number(a.cheapMetricValue) - Number(b.cheapMetricValue) : 0) || a.candidateId.localeCompare(b.candidateId));
  return markShortlisted(candidates, ordered.slice(0, Math.min(size, candidates.length)));
}

function medianValue(candidates, metric) {
  const values = candidates.map(candidate => Number(candidate[metric])).sort((a, b) => a - b);
  return values[Math.floor((values.length - 1) / 2)] || 0;
}

function markShortlisted(candidates, selected) {
  const ids = new Set(selected.map(candidate => candidate.candidateId));
  return candidates.map(candidate => ({ ...candidate, shortlisted: ids.has(candidate.candidateId) }));
}

function selectStagedCandidate(candidates, referenceConfig = { difficultyPolicy: { preferredBand: 'middle' } }) {
  if (!candidates.length) return null;
  return referenceSelection(candidates, referenceConfig).winner;
}

function selectSimulationFirst(candidates, { runs = 100, shortlistSize = 5, method = 'mean' } = {}) {
  const metric = method === 'median' ? 'regularMedianScore' : method === 'gold' ? 'regularGoldRate' : 'regularMeanScore';
  const center = candidates.reduce((sum, candidate) => sum + Number(candidate[metric]), 0) / Math.max(1, candidates.length);
  const ordered = candidates.slice().sort((a, b) => Math.abs(Number(a[metric]) - center) - Math.abs(Number(b[metric]) - center) || a.candidateId.localeCompare(b.candidateId));
  const marked = markShortlisted(candidates, ordered.slice(0, Math.min(shortlistSize, candidates.length)));
  return { runs, method, candidates: marked, retained: marked.filter(candidate => candidate.shortlisted), selected: selectStagedCandidate(marked.filter(candidate => candidate.shortlisted)) };
}

function shortlistRecall(shortlisted, preferred, winner) {
  const ids = new Set(shortlisted.filter(candidate => candidate.shortlisted).map(candidate => candidate.candidateId));
  const retained = preferred.filter(candidate => ids.has(candidate.candidateId));
  return { preferredRetained: retained.length, referencePreferredCount: preferred.length, recall: preferred.length ? retained.length / preferred.length : 1, referenceWinnerRetained: Boolean(winner && ids.has(winner.candidateId)), zeroPreferredRetained: preferred.length > 0 && retained.length === 0 };
}

function createLowRunProfiles(candidate, input, index, provider, runCounts) {
  const batch = runIncrementalMonteCarlo({ puzzle: candidate.puzzle, playerModel: 'REGULAR', masterSeed: input.masterSeed }, index, { maxRuns: Math.max(...runCounts), profileRuns: runCounts, accessibilitySystem: M81_FREQUENCY_MODEL, familiarityProvider: provider });
  return Object.fromEntries(runCounts.map(runs => {
    const profile = batch.profiles[runs];
    return [runs, { ...profile, regularMeanScore: profile.meanScore, regularMedianScore: profile.medianScore, regularGoldRate: profile.goldRate, regularHexalinkRate: profile.hexalinkRate, simulationMs: batch.simulationMs * runs / Math.max(...runCounts) }];
  }));
}

function profileHighRun(candidate, input, index, provider, runs, stage = 'reference') {
  const batch = runIncrementalMonteCarlo({ puzzle: candidate.puzzle, playerModel: 'REGULAR', masterSeed: input.masterSeed }, index, { maxRuns: runs, profileRuns: [runs], accessibilitySystem: M81_FREQUENCY_MODEL, familiarityProvider: provider });
  const profile = batch.profiles[runs];
  return { ...candidate, regularRuns: runs, regularMeanScore: profile.meanScore, regularMedianScore: profile.medianScore, regularGoldRate: profile.goldRate, regularHexalinkRate: profile.hexalinkRate, regularSimulationMs: batch.simulationMs, profileStage: stage };
}

function requireM91Provider(filePath) { return requireRealProvider(filePath); }

module.exports = { M91_SELECTOR_VERSION, M91_CONFIG_VERSION, centralSlice, preferredReferenceSet, referenceSelection, shortlistByLowRun, shortlistRecall, createLowRunProfiles, profileHighRun, requireM91Provider, markShortlisted, selectStagedCandidate, selectSimulationFirst };
