#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const qjynnRules = require('../../qjynn-rules.js');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { findMinimumGoldTurns, replaySequence } = require('../solver/state-search.js');
const { hexalinkMetrics } = require('../analyzer/puzzle-analyzer.js');
const { toCsv } = require('../analyzer/batch-analyzer.js');
const { summary, mean, median, round } = require('../analyzer/metrics-utils.js');
const { solveGoldProbe, thresholdSummary, moveSpaceMetrics } = require('../experiments/production-headroom.js');
const { GENERATOR_VERSION, RULES_VERSION, VOCABULARY_VERSION } = require('./grid-generator.js');
const { SELECTOR_VERSION, generateCandidatePool, failureSummary } = require('./candidate-pool.js');
const { compareCandidates, rankCandidates } = require('./candidate-ranker.js');

const DEFAULT_M7B_CONFIG = Object.freeze({
  candidatePoolSize: 100,
  shortlistSize: 20,
  headroomThresholds: [110, 120, 130, 140, 150],
  analysisTimeoutMs: 1500,
  candidateGenerator: 'M6_BASELINE',
  maxAttemptsPerCandidate: 20,
  selectorVersion: SELECTOR_VERSION
});

const VALIDATION_ANSWERS = Object.freeze([
  ['WATERMELON', 'Large summer striped fruit'],
  ['OSCILLATED', 'Moved back and forth'],
  ['ABANDONING', 'Leaving behind'],
  ['ABSOLUTELY', 'Without qualification'],
  ['ACCESSIBLE', 'Able to be reached'],
  ['ACCOUNTING', 'Keeping financial records'],
  ['ADVENTURES', 'Exciting undertakings'],
  ['AGGRAVATED', 'Made worse'],
  ['AFTERTASTE', 'Lingering flavor'],
  ['AFFORDABLE', 'Reasonably priced'],
  ['ABSTAINING', 'Holding back voluntarily'],
  ['ACCIDENTAL', 'Happening by chance'],
  ['ADJECTIVES', 'Descriptive words'],
  ['AESTHETICS', 'Principles of beauty'],
  ['AIRFREIGHT', 'Cargo moved by air'],
  ['ALCOHOLISM', 'Addiction to alcohol'],
  ['ALLIGATORS', 'Large reptiles'],
  ['AMBULANCES', 'Emergency vehicles'],
  ['ANCHOVIES', 'Small salty fish'],
  ['APOLOGIZED', 'Said sorry']
]);

function resolveConfig(config = {}) {
  return {
    ...DEFAULT_M7B_CONFIG,
    ...config,
    headroomThresholds: config.headroomThresholds || DEFAULT_M7B_CONFIG.headroomThresholds
  };
}

function minimumGoldTurns(puzzle, wordIndex, options = {}) {
  const started = process.hrtime.bigint();
  const knownUpperTurns = Number.isInteger(options.knownUpperTurns)
    ? Math.max(1, Math.min(qjynnRules.MAX_TURNS, options.knownUpperTurns))
    : qjynnRules.MAX_TURNS;
  const result = findMinimumGoldTurns({
    ...puzzle,
    maxTurns: qjynnRules.MAX_TURNS,
    goldThreshold: 100,
    timeoutMs: options.timeoutMs
  }, wordIndex, {
    timeoutMs: options.timeoutMs,
    knownUpperTurns,
    knownCertificate: options.knownCertificate || null
  });
  if (!result.exact) {
    return {
      exact: false,
      status: result.status,
      minimumGoldTurns: null,
      elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
      result
    };
  }
  if (!result.reachable) {
    return {
      exact: true,
      status: 'unreachable',
      minimumGoldTurns: null,
      elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
      result
    };
  }
  return {
    exact: true,
    status: 'reachable',
    minimumGoldTurns: result.minimumTurns,
    elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
    result: {
      ...result,
      goldReachable: true,
      goldCertificate: result.certificate,
      turnsUsed: result.minimumTurns,
      stats: { ...result.stats, timedOut: false }
    }
  };
}

function headroomEvidence(puzzle, wordIndex, config) {
  const probes = [{
    threshold: 100,
    exact: true,
    status: 'reachable',
    goldReachable: true
  }];
  for (const threshold of config.headroomThresholds) {
    const probe = solveGoldProbe(puzzle, wordIndex, {
      goldThreshold: threshold,
      timeoutMs: config.analysisTimeoutMs
    });
    probes.push(probe);
    if (probe.exact && probe.goldReachable === false) break;
  }
  const threshold = thresholdSummary(probes);
  return {
    probes: probes.map(probe => ({
      threshold: probe.threshold,
      exact: probe.exact,
      status: probe.status,
      goldReachable: probe.goldReachable,
      minimumGoldTurns: probe.minimumGoldTurns
    })),
    highestProvenReachableThreshold: threshold.highestProvenReachableThreshold,
    firstProvenUnreachableThreshold: threshold.firstProvenUnreachableThreshold,
    unresolvedThresholds: threshold.unresolvedThresholds,
    headroomLowerBound: threshold.goldHeadroom,
    headroomUpperBound: threshold.firstProvenUnreachableThreshold === null ? null : threshold.firstProvenUnreachableThreshold - 100
  };
}

function evaluateMinimumTurns(candidates, wordIndex, config) {
  const started = process.hrtime.bigint();
  const evaluated = [];
  for (const candidate of candidates) {
    const minTurns = minimumGoldTurns(candidate.puzzle, wordIndex, {
      timeoutMs: config.analysisTimeoutMs,
      knownUpperTurns: candidate.privateCertification?.goldTurns,
      knownCertificate: candidate.privateCertification?.goldCertificate
    });
    if (!minTurns.exact || minTurns.minimumGoldTurns === null) {
      if (candidate.privateCertification?.goldTurns) {
        evaluated.push({
          ...candidate,
          minimumTurnAnalysisMs: minTurns.elapsedMs,
          canonicalGoldCertificate: candidate.privateCertification.goldCertificate,
          rankingEvidence: {
            candidateIndex: candidate.candidateIndex,
            candidateSeed: candidate.candidateSeed,
            hardGateStatus: candidate.hardGateStatus,
            canonicalMinimumGoldTurns: candidate.privateCertification.goldTurns,
            minimumTurnExact: false,
            minimumTurnStatus: minTurns.status,
            minimumGoldTurnsUpperBound: candidate.privateCertification.goldTurns
          }
        });
        continue;
      }
      evaluated.push({
        ...candidate,
        hardGateStatus: 'rejected',
        rejectionReason: `minimum-turn-${minTurns.status}`,
        rankingEvidence: {
          candidateIndex: candidate.candidateIndex,
          candidateSeed: candidate.candidateSeed,
          canonicalMinimumGoldTurns: null
        }
      });
      continue;
    }
    evaluated.push({
      ...candidate,
      minimumTurnAnalysisMs: minTurns.elapsedMs,
      canonicalGoldCertificate: minTurns.result?.goldCertificate || candidate.privateCertification?.goldCertificate,
      rankingEvidence: {
        candidateIndex: candidate.candidateIndex,
        candidateSeed: candidate.candidateSeed,
        hardGateStatus: candidate.hardGateStatus,
        canonicalMinimumGoldTurns: minTurns.minimumGoldTurns,
        minimumTurnExact: true,
        minimumTurnStatus: minTurns.status,
        minimumGoldTurnsUpperBound: null
      }
    });
  }
  return {
    candidates: evaluated,
    elapsedMs: Number(process.hrtime.bigint() - started) / 1e6
  };
}

function shortlistCandidates(candidates, config) {
  return candidates
    .filter(candidate => candidate.hardGateStatus === 'accepted' && candidate.rankingEvidence?.canonicalMinimumGoldTurns)
    .sort((a, b) => {
      const turnDelta = b.rankingEvidence.canonicalMinimumGoldTurns - a.rankingEvidence.canonicalMinimumGoldTurns;
      if (turnDelta) return turnDelta;
      const maskDelta = (a.generationStats?.solverRelevantMoveCount || Infinity) - (b.generationStats?.solverRelevantMoveCount || Infinity);
      if (maskDelta) return maskDelta;
      return a.candidateIndex - b.candidateIndex;
    })
    .slice(0, config.shortlistSize);
}

function analyzeShortlist(candidates, wordIndex, input, config) {
  const started = process.hrtime.bigint();
  return {
    candidates: candidates.map(candidate => {
      const headroom = headroomEvidence(candidate.puzzle, wordIndex, config);
      const withoutHex = solveGoldProbe(candidate.puzzle, wordIndex, {
        goldThreshold: 100,
        excludeHexalink: true,
        timeoutMs: config.analysisTimeoutMs
      });
      const metrics = moveSpaceMetrics(candidate.puzzle, wordIndex);
      const hexMetrics = hexalinkMetrics(candidate.puzzle, wordIndex, input.answer);
      const replay = replaySequence(candidate.puzzle, candidate.canonicalGoldCertificate || candidate.privateCertification.goldCertificate);
      return {
        ...candidate,
        rankingEvidence: {
          ...candidate.rankingEvidence,
          headroom,
          goldReachableWithoutHexalink: withoutHex.exact ? withoutHex.goldReachable : null,
          goldWithoutHexalinkStatus: withoutHex.status,
          hexalinkMoveParticipationPct: metrics.rawMoves ? metrics.hexalinkMoveParticipation / metrics.rawMoves * 100 : 0,
          uniqueTileMasks: metrics.uniqueTileMasks,
          solverRelevantMoves: metrics.solverRelevantMoves,
          uniquePlayableWords: metrics.uniquePlayableWords,
          tileParticipationSpread: metrics.tileParticipationSpread,
          hexalinkRowsTouched: hexMetrics.rowsTouched,
          hexalinkColumnsTouched: hexMetrics.columnsTouched,
          hexalinkDirectionChanges: hexMetrics.directionChanges,
          certificateReplayScore: replay.score
        }
      };
    }),
    elapsedMs: Number(process.hrtime.bigint() - started) / 1e6
  };
}

function selectedPublicPuzzle(candidate) {
  return candidate.puzzle;
}

function privateManifest(input, pool, ranked, selected, config, timings) {
  return {
    answer: input.answer,
    date: input.date || null,
    masterSeed: pool.masterSeed,
    candidatePoolSize: config.candidatePoolSize,
    selectedCandidateIndex: selected.candidateIndex,
    selectedCandidateSeed: selected.candidateSeed,
    selectedMetrics: {
      canonicalMinimumGoldTurns: selected.rankingEvidence.canonicalMinimumGoldTurns,
      highestProvenReachableThreshold: selected.rankingEvidence.headroom.highestProvenReachableThreshold,
      firstProvenUnreachableThreshold: selected.rankingEvidence.headroom.firstProvenUnreachableThreshold,
      headroomLowerBound: selected.rankingEvidence.headroom.headroomLowerBound,
      headroomUpperBound: selected.rankingEvidence.headroom.headroomUpperBound,
      goldReachableWithoutHexalink: selected.rankingEvidence.goldReachableWithoutHexalink,
      uniqueTileMasks: selected.rankingEvidence.uniqueTileMasks,
      tileParticipationSpread: selected.rankingEvidence.tileParticipationSpread,
      hexalinkMoveParticipationPct: selected.rankingEvidence.hexalinkMoveParticipationPct
    },
    rankingReasons: selected.rankingReasons || [],
    resolvedConfiguration: config,
    versions: {
      selectorVersion: config.selectorVersion,
      generatorVersion: GENERATOR_VERSION,
      rulesVersion: RULES_VERSION,
      vocabularyVersion: VOCABULARY_VERSION
    },
    timings,
    candidateRanking: ranked.map(candidate => ({
      rank: candidate.rank,
      candidateIndex: candidate.candidateIndex,
      candidateSeed: candidate.candidateSeed,
      rankingEvidence: candidate.rankingEvidence,
      rankingReasons: candidate.rankingReasons || []
    }))
  };
}

function selectStrategicDailyGrid(input, wordIndex, configInput = {}) {
  const totalStarted = process.hrtime.bigint();
  const config = resolveConfig(configInput);
  const pool = generateCandidatePool(input, wordIndex, config);
  if (!pool.candidates.length) {
    return {
      ok: false,
      error: {
        code: 'candidatePool.exhausted',
        message: 'No candidate passed M6 hard gates.',
        ...failureSummary(pool)
      }
    };
  }

  const minimumTurns = evaluateMinimumTurns(pool.candidates, wordIndex, config);
  const shortlist = shortlistCandidates(minimumTurns.candidates, config);
  if (!shortlist.length) {
    return {
      ok: false,
      error: {
        code: 'candidatePool.noMinimumTurnCandidate',
        message: 'No candidate completed exact minimum-turn analysis.',
        ...failureSummary(pool)
      }
    };
  }

  const shortlistAnalysis = analyzeShortlist(shortlist, wordIndex, input, config);
  const ranked = rankCandidates(shortlistAnalysis.candidates);
  const selected = ranked[0];
  const timings = {
    candidateGenerationMs: pool.generationMs,
    minimumTurnAnalysisMs: minimumTurns.elapsedMs,
    shortlistAnalysisMs: shortlistAnalysis.elapsedMs,
    totalSelectionMs: Number(process.hrtime.bigint() - totalStarted) / 1e6
  };

  return {
    ok: true,
    publicPuzzle: selectedPublicPuzzle(selected),
    privateManifest: privateManifest(input, pool, ranked, selected, config, timings),
    selectedCandidate: selected,
    rankedCandidates: ranked,
    pool: {
      masterSeed: pool.masterSeed,
      candidatePoolSize: pool.candidatePoolSize,
      uniqueCandidateCount: pool.uniqueCandidateCount,
      failures: pool.failures,
      duplicates: pool.duplicates
    },
    allCandidates: minimumTurns.candidates,
    timings
  };
}

function candidateRow(answer, selection, candidate) {
  const evidence = candidate.rankingEvidence || {};
  return {
    answer,
    candidate_index: candidate.candidateIndex,
    candidate_seed: candidate.candidateSeed,
    hard_gate_status: candidate.hardGateStatus,
    canonical_min_gold_turns: evidence.canonicalMinimumGoldTurns ?? '',
    minimum_gold_turns_exact: evidence.minimumTurnExact ?? '',
    minimum_gold_turns_upper_bound: evidence.minimumGoldTurnsUpperBound ?? '',
    shortlisted: selection.rankedCandidates.some(item => item.candidateIndex === candidate.candidateIndex),
    selected: selection.selectedCandidate.candidateIndex === candidate.candidateIndex,
    highest_proven_reachable_threshold: evidence.headroom?.highestProvenReachableThreshold ?? '',
    first_proven_unreachable_threshold: evidence.headroom?.firstProvenUnreachableThreshold ?? '',
    headroom_lower_bound: evidence.headroom?.headroomLowerBound ?? '',
    gold_without_hexalink: evidence.goldReachableWithoutHexalink ?? '',
    unique_tile_masks: evidence.uniqueTileMasks ?? '',
    tile_participation_spread: evidence.tileParticipationSpread ?? '',
    hexalink_participation_pct: evidence.hexalinkMoveParticipationPct === undefined ? '' : round(evidence.hexalinkMoveParticipationPct)
  };
}

function selectedPuzzleRow(answer, selection) {
  const manifest = selection.privateManifest;
  const metrics = manifest.selectedMetrics;
  return {
    answer,
    master_seed: manifest.masterSeed,
    candidate_pool_size: manifest.candidatePoolSize,
    valid_candidates: selection.pool.uniqueCandidateCount,
    selected_candidate_index: manifest.selectedCandidateIndex,
    selected_candidate_seed: manifest.selectedCandidateSeed,
    canonical_min_gold_turns: metrics.canonicalMinimumGoldTurns,
    minimum_gold_turns_exact: selection.selectedCandidate.rankingEvidence.minimumTurnExact,
    minimum_gold_turns_upper_bound: selection.selectedCandidate.rankingEvidence.minimumGoldTurnsUpperBound ?? '',
    highest_proven_reachable_threshold: metrics.highestProvenReachableThreshold ?? '',
    first_proven_unreachable_threshold: metrics.firstProvenUnreachableThreshold ?? '',
    headroom_lower_bound: metrics.headroomLowerBound ?? '',
    gold_without_hexalink: metrics.goldReachableWithoutHexalink ?? '',
    unique_tile_masks: metrics.uniqueTileMasks,
    tile_participation_spread: metrics.tileParticipationSpread,
    hexalink_participation_pct: round(metrics.hexalinkMoveParticipationPct),
    generation_ms: round(selection.timings.candidateGenerationMs)
  };
}

function compareM6VsM7B(answer, selection) {
  const rawFirst = selection.allCandidates.find(candidate => candidate.hardGateStatus === 'accepted');
  const first = selection.rankedCandidates.find(candidate => candidate.candidateIndex === rawFirst?.candidateIndex) || rawFirst;
  const selected = selection.selectedCandidate;
  return {
    answer,
    m6_candidate_index: first?.candidateIndex ?? '',
    m7b_candidate_index: selected.candidateIndex,
    m6_turns: first?.rankingEvidence?.canonicalMinimumGoldTurns ?? '',
    m7b_turns: selected.rankingEvidence.canonicalMinimumGoldTurns,
    m6_headroom: first?.rankingEvidence?.headroom?.headroomLowerBound ?? '',
    m7b_headroom: selected.rankingEvidence.headroom.headroomLowerBound ?? '',
    m6_gold_without_hexalink: first?.rankingEvidence?.goldReachableWithoutHexalink ?? '',
    m7b_gold_without_hexalink: selected.rankingEvidence.goldReachableWithoutHexalink ?? '',
    m6_unique_tile_masks: first?.rankingEvidence?.uniqueTileMasks ?? '',
    m7b_unique_tile_masks: selected.rankingEvidence.uniqueTileMasks,
    m6_tile_participation_spread: first?.rankingEvidence?.tileParticipationSpread ?? '',
    m7b_tile_participation_spread: selected.rankingEvidence.tileParticipationSpread,
    m6_hexalink_participation_pct: first?.rankingEvidence?.hexalinkMoveParticipationPct ?? '',
    m7b_hexalink_participation_pct: round(selected.rankingEvidence.hexalinkMoveParticipationPct)
  };
}

function sixTurnAnalysisRow(answer, selection) {
  const valid = selection.allCandidates.filter(candidate => candidate.hardGateStatus === 'accepted' && candidate.rankingEvidence?.canonicalMinimumGoldTurns);
  const six = valid.filter(candidate => candidate.rankingEvidence.canonicalMinimumGoldTurns === 6);
  return {
    answer,
    valid_candidates: valid.length,
    six_turn_candidates: six.length,
    rate: valid.length ? six.length / valid.length : 0,
    first_found_at_candidate: six.length ? Math.min(...six.map(candidate => candidate.candidateIndex)) : ''
  };
}

function ablationSelections(selection) {
  const candidates = selection.rankedCandidates;
  const minOnly = candidates.slice().sort((a, b) =>
    b.rankingEvidence.canonicalMinimumGoldTurns - a.rankingEvidence.canonicalMinimumGoldTurns ||
    a.candidateIndex - b.candidateIndex)[0];
  const minHeadroom = candidates.slice().sort((a, b) =>
    b.rankingEvidence.canonicalMinimumGoldTurns - a.rankingEvidence.canonicalMinimumGoldTurns ||
    (a.rankingEvidence.headroom.headroomLowerBound ?? Infinity) - (b.rankingEvidence.headroom.headroomLowerBound ?? Infinity) ||
    a.candidateIndex - b.candidateIndex)[0];
  const full = candidates.slice().sort(compareCandidates)[0];
  return { minOnly, minHeadroom, full };
}

function ablationRow(answer, selection) {
  const ablation = ablationSelections(selection);
  return {
    answer,
    min_turns_only_candidate: ablation.minOnly.candidateIndex,
    min_turns_headroom_candidate: ablation.minHeadroom.candidateIndex,
    full_ranking_candidate: ablation.full.candidateIndex,
    secondary_changed_selection: ablation.minHeadroom.candidateIndex !== ablation.full.candidateIndex,
    headroom_changed_selection: ablation.minOnly.candidateIndex !== ablation.minHeadroom.candidateIndex
  };
}

function aggregateValidation(selections, config) {
  const validCandidates = selections.flatMap(selection => selection.allCandidates)
    .filter(candidate => candidate.hardGateStatus === 'accepted' && candidate.rankingEvidence?.canonicalMinimumGoldTurns);
  const selected = selections.map(selection => selection.selectedCandidate);
  const turnCounts = {};
  for (let turn = 1; turn <= 6; turn++) {
    turnCounts[turn] = validCandidates.filter(candidate => candidate.rankingEvidence.canonicalMinimumGoldTurns === turn).length;
  }
  const sixRows = selections.map(selection => sixTurnAnalysisRow(selection.privateManifest.answer, selection));
  return {
    config,
    answersAnalyzed: selections.length,
    totalCandidatesGenerated: selections.reduce((sum, selection) => sum + selection.pool.candidatePoolSize, 0),
    uniqueCandidates: selections.reduce((sum, selection) => sum + selection.pool.uniqueCandidateCount, 0),
    m6ValidCandidates: validCandidates.length,
    goldCertifiedCandidates: validCandidates.length,
    minimumGoldTurnDistribution: turnCounts,
    fourOrFewerTurnCount: validCandidates.filter(candidate => candidate.rankingEvidence.canonicalMinimumGoldTurns <= 4).length,
    fiveTurnCount: turnCounts[5],
    sixTurnCount: turnCounts[6],
    sixTurnAnswers: sixRows.filter(row => row.six_turn_candidates > 0).map(row => row.answer),
    goldWithoutHexalinkRate: mean(selected.map(candidate => candidate.rankingEvidence.goldReachableWithoutHexalink ? 1 : 0)),
    selectedMinimumGoldTurns: summary(selected.map(candidate => candidate.rankingEvidence.canonicalMinimumGoldTurns)),
    selectedHeadroomLowerBound: summary(selected.map(candidate => candidate.rankingEvidence.headroom.headroomLowerBound).filter(Number.isFinite)),
    medianTotalSelectionMs: median(selections.map(selection => selection.timings.totalSelectionMs))
  };
}

function validationRecords(count = 20) {
  return VALIDATION_ANSWERS.slice(0, count).map(([answer, clue], index) => ({
    answer,
    clue,
    date: `2027-03-${String(index + 1).padStart(2, '0')}`,
    masterSeed: 900000 + index
  }));
}

function runM7BValidation(records, wordIndex, configInput = {}) {
  const config = resolveConfig(configInput);
  const selections = [];
  const failures = [];
  for (const record of records) {
    const selection = selectStrategicDailyGrid(record, wordIndex, config);
    if (selection.ok) selections.push(selection);
    else failures.push({ record, error: selection.error });
  }
  return {
    config,
    selections,
    failures,
    summary: aggregateValidation(selections, config)
  };
}

function poolSensitivity(records, wordIndex, configInput = {}, sizes = [25, 50, 100, 250]) {
  const subset = records.slice(0, Math.min(3, records.length));
  const rows = [];
  for (const size of sizes) {
    for (const record of subset) {
      const selection = selectStrategicDailyGrid(record, wordIndex, {
        ...configInput,
        candidatePoolSize: size,
        shortlistSize: Math.min(configInput.shortlistSize || DEFAULT_M7B_CONFIG.shortlistSize, size)
      });
      if (!selection.ok) continue;
      rows.push({
        answer: record.answer,
        candidate_pool_size: size,
        selected_candidate_index: selection.selectedCandidate.candidateIndex,
        selected_min_gold_turns: selection.selectedCandidate.rankingEvidence.canonicalMinimumGoldTurns,
        selected_headroom_lower_bound: selection.selectedCandidate.rankingEvidence.headroom.headroomLowerBound,
        runtime_ms: round(selection.timings.totalSelectionMs)
      });
    }
  }
  return rows;
}

function writeM7BOutputs(result, baseDir = 'analysis', sensitivityRows = []) {
  fs.mkdirSync(baseDir, { recursive: true });
  const candidateRows = result.selections.flatMap(selection => {
    const analyzed = new Map(selection.rankedCandidates.map(candidate => [candidate.candidateIndex, candidate]));
    return selection.allCandidates.map(candidate =>
      candidateRow(selection.privateManifest.answer, selection, analyzed.get(candidate.candidateIndex) || candidate));
  });
  const selectedRows = result.selections.map(selection => selectedPuzzleRow(selection.privateManifest.answer, selection));
  const comparisonRows = result.selections.map(selection => compareM6VsM7B(selection.privateManifest.answer, selection));
  const sixRows = result.selections.map(selection => sixTurnAnalysisRow(selection.privateManifest.answer, selection));
  const ablationRows = result.selections.map(selection => ablationRow(selection.privateManifest.answer, selection));
  fs.writeFileSync(path.join(baseDir, 'm7b-candidates.csv'), toCsv(candidateRows));
  fs.writeFileSync(path.join(baseDir, 'm7b-selected-puzzles.csv'), toCsv(selectedRows));
  fs.writeFileSync(path.join(baseDir, 'm7b-selection-comparison.csv'), toCsv(comparisonRows));
  fs.writeFileSync(path.join(baseDir, 'm7b-six-turn-analysis.csv'), toCsv(sixRows));
  fs.writeFileSync(path.join(baseDir, 'm7b-ranking-ablation.csv'), toCsv(ablationRows));
  fs.writeFileSync(path.join(baseDir, 'm7b-pool-sensitivity.csv'), toCsv(sensitivityRows));
  fs.writeFileSync(path.join(baseDir, 'm7b-summary.json'), `${JSON.stringify({
    summary: result.summary,
    failures: result.failures,
    selectedManifests: result.selections.map(selection => selection.privateManifest),
    poolSensitivity: sensitivityRows
  }, null, 2)}\n`);
}

function loadDefaultWordIndex() {
  return buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
}

function main() {
  const wordIndex = loadDefaultWordIndex();
  const count = Number(process.env.M7B_ANSWERS || 20);
  const poolSize = Number(process.env.M7B_POOL_SIZE || 25);
  const records = validationRecords(count);
  const config = {
    candidatePoolSize: poolSize,
    shortlistSize: Number(process.env.M7B_SHORTLIST_SIZE || Math.min(10, poolSize)),
    analysisTimeoutMs: process.env.M7B_TIMEOUT_MS === 'none' ? null : Number(process.env.M7B_TIMEOUT_MS || 750)
  };
  const result = runM7BValidation(records, wordIndex, config);
  const sensitivitySizes = (process.env.M7B_SENSITIVITY_SIZES || '3,5')
    .split(',')
    .map(value => Number(value.trim()))
    .filter(Number.isFinite);
  const sensitivityRows = poolSensitivity(records.slice(0, 1), wordIndex, config, sensitivitySizes);
  writeM7BOutputs(result, 'analysis', sensitivityRows);
  console.log(`Analyzed ${result.selections.length} answers`);
  console.log(`Failures ${result.failures.length}`);
  console.log(`Total candidates ${result.summary.totalCandidatesGenerated}`);
}

if (require.main === module) main();

module.exports = {
  DEFAULT_M7B_CONFIG,
  VALIDATION_ANSWERS,
  resolveConfig,
  minimumGoldTurns,
  headroomEvidence,
  evaluateMinimumTurns,
  shortlistCandidates,
  analyzeShortlist,
  selectedPublicPuzzle,
  privateManifest,
  selectStrategicDailyGrid,
  candidateRow,
  selectedPuzzleRow,
  compareM6VsM7B,
  sixTurnAnalysisRow,
  ablationSelections,
  ablationRow,
  aggregateValidation,
  validationRecords,
  runM7BValidation,
  poolSensitivity,
  writeM7BOutputs
};
