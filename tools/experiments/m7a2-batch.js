#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { toCsv } = require('../analyzer/batch-analyzer.js');
const { summary } = require('../analyzer/metrics-utils.js');
const { generateExperimentalPuzzle } = require('./strategic-experiment.js');
const { STRATEGIES } = require('./placement-strategies.js');
const {
  scenarioMatrix,
  analyzeScenario,
  highestTestedGoldThresholdReachable,
  makeScenario
} = require('./rule-sensitivity.js');
const {
  VOCABULARY_TIERS,
  createVocabularyOrderRankProvider,
  buildAccessibilityIndex,
  tierStats,
  certificateFamiliarity,
  certificateTierCoverage
} = require('./vocabulary-accessibility.js');

function scalarScenarioRow(record) {
  const result = record.result;
  return {
    answer: record.answer,
    seed: record.seed,
    strategy: record.strategy,
    scenario: result.scenario.name,
    gold_threshold: result.scenario.goldThreshold,
    long_word_scoring_policy: `${result.scenario.scoring.score7to8 ?? 'canonical'}/${result.scenario.scoring.score9to10 ?? 'canonical'}`,
    hexalink_bonus: result.scenario.scoring.hexalinkBonus,
    row_bonus: result.scenario.scoring.rowBonus,
    column_bonus: result.scenario.scoring.columnBonus,
    require_hexalink: result.scenario.constraints.requireHexalinkForGold,
    require_exactly_six_turns: result.scenario.constraints.requireExactlySixTurns,
    vocabulary_tier: result.scenario.vocabularyAccessibility.mode,
    available_words: record.availableWords,
    gold_reachable: result.goldReachable,
    gold_without_hexalink: result.goldReachableWithoutHexalink,
    gold_with_hexalink_required: result.goldReachableWithHexalinkRequired,
    minimum_gold_turns: result.minimumGoldTurns ?? '',
    solver_relevant_moves: result.solverRelevantMoves,
    legal_words: result.legalStartingWords,
    analysis_ms: Math.round(result.analysisMs * 1000) / 1000,
    exact: result.exact
  };
}

function aggregateScenarioRows(rows) {
  const byScenario = new Map();
  for (const row of rows) {
    if (!byScenario.has(row.scenario)) byScenario.set(row.scenario, []);
    byScenario.get(row.scenario).push(row);
  }
  const result = {};
  const numeric = (items, key) => items.map(item => Number(item[key])).filter(value => Number.isFinite(value));
  for (const [scenario, items] of byScenario.entries()) {
    result[scenario] = {
      puzzlesAnalyzed: items.length,
      goldCapableCount: items.filter(item => item.gold_reachable).length,
      goldCapablePct: items.filter(item => item.gold_reachable).length / items.length * 100,
      goldWithoutHexalinkPct: items.filter(item => item.gold_without_hexalink).length / items.length * 100,
      goldWithHexalinkRequiredPct: items.filter(item => item.gold_with_hexalink_required).length / items.length * 100,
      minGoldTurns: summary(numeric(items, 'minimum_gold_turns')),
      medianSolverRelevantMoves: summary(numeric(items, 'solver_relevant_moves')).median,
      medianLegalWords: summary(numeric(items, 'legal_words')).median
    };
  }
  return result;
}

function buildCurves(summaryByScenario) {
  const threshold = Object.entries(summaryByScenario)
    .filter(([name]) => /^GOLD_\d+$/.test(name))
    .map(([name, value]) => ({
      threshold: Number(name.replace('GOLD_', '')),
      goldCapablePct: value.goldCapablePct,
      goldWithoutHexalinkPct: value.goldWithoutHexalinkPct,
      medianMinimumGoldTurns: value.minGoldTurns.median
    }))
    .sort((a, b) => a.threshold - b.threshold);
  const hexalinkBonus = Object.entries(summaryByScenario)
    .filter(([name]) => /^HEX_BONUS_\d+$/.test(name))
    .map(([name, value]) => ({
      bonus: Number(name.replace('HEX_BONUS_', '')),
      goldCapablePct: value.goldCapablePct,
      goldWithoutHexalinkPct: value.goldWithoutHexalinkPct,
      medianMinimumGoldTurns: value.minGoldTurns.median
    }))
    .sort((a, b) => a.bonus - b.bonus);
  const vocabulary = Object.entries(summaryByScenario)
    .filter(([name]) => /^VOCAB_/.test(name))
    .map(([name, value]) => ({
      tier: name.replace('VOCAB_', ''),
      goldCapablePct: value.goldCapablePct,
      goldWithoutHexalinkPct: value.goldWithoutHexalinkPct,
      medianMinimumGoldTurns: value.minGoldTurns.median
    }));
  return { threshold, hexalinkBonus, vocabulary };
}

function findCounterexamples(rows) {
  const byPuzzle = new Map();
  for (const row of rows) {
    const key = `${row.answer}|${row.seed}|${row.strategy}`;
    if (!byPuzzle.has(key)) byPuzzle.set(key, []);
    byPuzzle.get(key).push(row);
  }
  const examples = {
    canonicalGoldButTop10000Impossible: null,
    goldEasyWithTop5000: null,
    gold130WithoutHexalink: null,
    gold110NeedsHexalink: null,
    longWordReductionChangesGold: null,
    lineBonusesDecisive: null,
    ruleChangesIrrelevant: null
  };
  for (const [key, items] of byPuzzle.entries()) {
    const byScenario = new Map(items.map(item => [item.scenario, item]));
    if (!examples.canonicalGoldButTop10000Impossible && byScenario.get('CANONICAL_BASELINE')?.gold_reachable && byScenario.get('VOCAB_TOP_10000')?.gold_reachable === false) examples.canonicalGoldButTop10000Impossible = key;
    if (!examples.goldEasyWithTop5000 && byScenario.get('VOCAB_TOP_5000')?.gold_reachable) examples.goldEasyWithTop5000 = key;
    if (!examples.gold130WithoutHexalink && byScenario.get('GOLD_130')?.gold_without_hexalink) examples.gold130WithoutHexalink = key;
    if (!examples.gold110NeedsHexalink && byScenario.get('GOLD_110')?.gold_reachable && !byScenario.get('GOLD_110')?.gold_without_hexalink) examples.gold110NeedsHexalink = key;
    if (!examples.longWordReductionChangesGold && byScenario.get('LONG_A_CANONICAL')?.gold_reachable !== byScenario.get('LONG_D_12_ALL_LONG')?.gold_reachable) examples.longWordReductionChangesGold = key;
    if (!examples.lineBonusesDecisive && byScenario.get('LINE_CANONICAL')?.gold_reachable !== byScenario.get('LINE_NONE')?.gold_reachable) examples.lineBonusesDecisive = key;
    if (!examples.ruleChangesIrrelevant && byScenario.get('GOLD_150')?.gold_reachable && byScenario.get('LINE_NONE')?.gold_reachable && byScenario.get('LONG_D_12_ALL_LONG')?.gold_reachable) examples.ruleChangesIrrelevant = key;
  }
  return examples;
}

function runM7A2Batch(records, fullWordIndex, rawWords, options = {}) {
  const rankProvider = createVocabularyOrderRankProvider(rawWords);
  const scenarios = scenarioMatrix();
  const vocabularyScenarios = Object.values(VOCABULARY_TIERS).map(tier => makeScenario({
    name: `VOCAB_${tier.replace('ALL_QJYNN', 'ALL')}`,
    vocabularyAccessibility: { mode: tier }
  }));
  const allScenarios = [...scenarios, ...vocabularyScenarios];
  const count = Math.min(records.length, options.count || records.length);
  const rows = [];
  const detailed = [];

  for (let i = 0; i < count; i++) {
    const record = records[i];
    let generated = null;
    if (record.puzzle) {
      generated = {
        ok: true,
        puzzle: record.puzzle,
        privateCertification: {
          answer: record.answer,
          seed: Number(record.seed || 2000 + i),
          strategy: record.strategy || 'PREBUILT',
          hexalink: record.puzzle.hexalink,
          hexarowcol: record.puzzle.hexarowcol
        }
      };
    } else {
      generated = generateExperimentalPuzzle({
        answer: record.answer,
        clue: record.clue || `M7A2 clue ${i + 1}`,
        date: record.date || `2026-12-${String(i + 1).padStart(2, '0')}`,
        seed: Number(record.seed || 2000 + i),
        strategy: record.strategy || STRATEGIES.RANDOM_BASELINE,
        maxAttempts: options.maxAttempts || 5
      }, fullWordIndex, options.generationOptions || {});
      if (!generated.ok) continue;
    }

    for (const scenario of allScenarios) {
      const tier = scenario.vocabularyAccessibility.mode;
      const activeIndex = tier === VOCABULARY_TIERS.ALL_QJYNN
        ? fullWordIndex
        : buildAccessibilityIndex(fullWordIndex, tier, rankProvider);
      const result = analyzeScenario(generated.puzzle, activeIndex, scenario);
      const row = scalarScenarioRow({
        answer: generated.privateCertification.answer,
        seed: generated.privateCertification.seed,
        strategy: generated.privateCertification.strategy,
        availableWords: activeIndex.entries.length,
        result
      });
      rows.push(row);
      detailed.push({ generated: generated.privateCertification, result, row });
    }
  }

  const summaryByScenario = aggregateScenarioRows(rows);
  const thresholdRows = rows.filter(row => /^GOLD_\d+$/.test(row.scenario));
  const ceilingByPuzzle = {};
  for (const row of thresholdRows) {
    const key = `${row.answer}|${row.seed}|${row.strategy}`;
    if (!ceilingByPuzzle[key]) ceilingByPuzzle[key] = [];
    ceilingByPuzzle[key].push({ scenario: { name: row.scenario, goldThreshold: row.gold_threshold }, goldReachable: row.gold_reachable });
  }
  const highestTestedThresholds = Object.fromEntries(Object.entries(ceilingByPuzzle).map(([key, results]) => [key, highestTestedGoldThresholdReachable(results)]));

  const baseline = summaryByScenario.CANONICAL_BASELINE;
  const leverage = Object.fromEntries(Object.entries(summaryByScenario).map(([name, value]) => [name, {
    deltaGoldCapablePct: value.goldCapablePct - baseline.goldCapablePct,
    deltaGoldWithoutHexalinkPct: value.goldWithoutHexalinkPct - baseline.goldWithoutHexalinkPct,
    deltaMedianMinTurns: value.minGoldTurns.median - baseline.minGoldTurns.median
  }]));

  const vocabTierStats = Object.values(VOCABULARY_TIERS).map(tier => tierStats(fullWordIndex, tier, rankProvider));
  const canonicalDetail = detailed.find(item => item.row.scenario === 'CANONICAL_BASELINE');
  const certificate = canonicalDetail?.result.goldCertificate || [];

  return {
    rows,
    detailed,
    summaryByScenario,
    curves: buildCurves(summaryByScenario),
    highestTestedThresholds,
    leverage,
    counterexamples: findCounterexamples(rows),
    vocabulary: {
      provenance: 'Deterministic Qjynn Vocabulary 1.0 order rank provider for analysis only; not a production familiarity dataset.',
      tiers: vocabTierStats,
      certificateFamiliarity: certificateFamiliarity(certificate, rankProvider),
      certificateTierCoverage: certificateTierCoverage(certificate, fullWordIndex, rankProvider)
    }
  };
}

function writeM7A2Outputs(result, baseDir = 'analysis') {
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(path.join(baseDir, 'm7a2-scenarios.json'), `${JSON.stringify({ rows: result.rows, detailed: result.detailed }, null, 2)}\n`);
  fs.writeFileSync(path.join(baseDir, 'm7a2-scenarios.csv'), toCsv(result.rows));
  fs.writeFileSync(path.join(baseDir, 'm7a2-sensitivity-summary.json'), `${JSON.stringify({
    summaryByScenario: result.summaryByScenario,
    curves: result.curves,
    highestTestedThresholds: result.highestTestedThresholds,
    leverage: result.leverage,
    vocabulary: result.vocabulary
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(baseDir, 'm7a2-vocabulary-accessibility.csv'), toCsv(result.vocabulary.tiers.map(tier => ({
    tier: tier.tier,
    available_words: tier.availableIndexedWords,
    pct_full_vocabulary: Math.round(tier.pctOfFullVocabulary * 1000) / 1000
  }))));
  fs.writeFileSync(path.join(baseDir, 'm7a2-counterexamples.json'), `${JSON.stringify(result.counterexamples, null, 2)}\n`);
  const curveRows = [
    ...result.curves.threshold.map(row => ({ curve: 'threshold', x: row.threshold, gold_capable_pct: row.goldCapablePct, gold_without_hexalink_pct: row.goldWithoutHexalinkPct, median_turns: row.medianMinimumGoldTurns })),
    ...result.curves.hexalinkBonus.map(row => ({ curve: 'hexalink_bonus', x: row.bonus, gold_capable_pct: row.goldCapablePct, gold_without_hexalink_pct: row.goldWithoutHexalinkPct, median_turns: row.medianMinimumGoldTurns })),
    ...result.curves.vocabulary.map(row => ({ curve: 'vocabulary', x: row.tier, gold_capable_pct: row.goldCapablePct, gold_without_hexalink_pct: row.goldWithoutHexalinkPct, median_turns: row.medianMinimumGoldTurns }))
  ];
  fs.writeFileSync(path.join(baseDir, 'm7a2-curves.csv'), toCsv(curveRows));
}

module.exports = {
  scalarScenarioRow,
  aggregateScenarioRows,
  buildCurves,
  findCounterexamples,
  runM7A2Batch,
  writeM7A2Outputs
};
