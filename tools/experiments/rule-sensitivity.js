const qjynnRules = require('../../qjynn-rules.js');
const {
  solveBoard,
  MODE_FIND_GOLD,
  resolveScoringPolicy,
  CANONICAL_SCORING_POLICY
} = require('../solver/state-search.js');
const { legalMoveContext } = require('../analyzer/puzzle-analyzer.js');

const CANONICAL_BASELINE = Object.freeze({
  name: 'CANONICAL_BASELINE',
  goldThreshold: 100,
  scoring: {},
  constraints: {
    requireHexalinkForGold: false,
    requireExactlySixTurns: false
  },
  vocabularyAccessibility: {
    mode: 'ALL_QJYNN'
  }
});

function makeScenario(overrides = {}) {
  return {
    name: overrides.name || CANONICAL_BASELINE.name,
    goldThreshold: overrides.goldThreshold ?? CANONICAL_BASELINE.goldThreshold,
    scoring: { ...(CANONICAL_BASELINE.scoring || {}), ...(overrides.scoring || {}) },
    constraints: { ...CANONICAL_BASELINE.constraints, ...(overrides.constraints || {}) },
    vocabularyAccessibility: { ...CANONICAL_BASELINE.vocabularyAccessibility, ...(overrides.vocabularyAccessibility || {}) }
  };
}

function resolvedScenario(scenario) {
  return {
    ...scenario,
    scoring: resolveScoringPolicy(scenario.scoring)
  };
}

function certificateConstraintFor(scenario, turns) {
  return sequence => {
    if (scenario.constraints.requireHexalinkForGold && !sequence.some(move => move.isHexalink)) return false;
    if (scenario.constraints.requireExactlySixTurns && sequence.length !== turns) return false;
    return true;
  };
}

function solveScenario(puzzle, wordIndex, scenarioInput = CANONICAL_BASELINE, options = {}) {
  const started = process.hrtime.bigint();
  const scenario = resolvedScenario(makeScenario(scenarioInput));
  const moveFilter = options.moveFilter || null;
  let best = null;
  const maxTurns = qjynnRules.MAX_TURNS;
  const minTurnStart = scenario.constraints.requireExactlySixTurns ? maxTurns : 1;

  for (let turns = minTurnStart; turns <= maxTurns; turns++) {
    const result = solveBoard({
      ...puzzle,
      maxTurns: turns,
      goldThreshold: scenario.goldThreshold,
      scoringPolicy: scenario.scoring
    }, wordIndex, {
      mode: MODE_FIND_GOLD,
      scoringPolicy: scenario.scoring,
      moveFilter,
      certificateConstraint: certificateConstraintFor(scenario, turns)
    });
    if (result.goldReachable) {
      best = result;
      break;
    }
  }

  const moveContext = legalMoveContext(puzzle, wordIndex);
  return {
    scenario,
    exact: true,
    status: best ? 'gold-reachable' : 'gold-unreachable',
    goldReachable: Boolean(best),
    minimumGoldTurns: best ? best.turnsUsed : null,
    goldScore: best ? best.maxScore : null,
    goldCertificate: best ? best.goldCertificate : null,
    solverStats: best ? best.stats : null,
    legalStartingWords: new Set(moveContext.rawMoves.map(move => move.word)).size,
    solverRelevantMoves: moveContext.prepared.stats.solverRelevantMoveCount,
    analysisMs: Number(process.hrtime.bigint() - started) / 1e6
  };
}

function analyzeScenario(puzzle, wordIndex, scenarioInput, options = {}) {
  const normal = solveScenario(puzzle, wordIndex, scenarioInput, options);
  const withoutHexalink = solveScenario(puzzle, wordIndex, scenarioInput, {
    ...options,
    moveFilter: move => !move.isHexalink
  });
  const withHexalinkRequired = solveScenario(puzzle, wordIndex, {
    ...scenarioInput,
    constraints: {
      ...(scenarioInput.constraints || {}),
      requireHexalinkForGold: true
    }
  }, options);
  return {
    ...normal,
    goldReachableWithoutHexalink: withoutHexalink.goldReachable,
    goldReachableWithHexalinkRequired: withHexalinkRequired.goldReachable,
    withoutHexalinkMinimumTurns: withoutHexalink.minimumGoldTurns,
    withHexalinkRequiredMinimumTurns: withHexalinkRequired.minimumGoldTurns
  };
}

function scenarioMatrix() {
  const scenarios = [CANONICAL_BASELINE];
  for (const threshold of [100, 110, 120, 130, 140, 150]) {
    scenarios.push(makeScenario({ name: `GOLD_${threshold}`, goldThreshold: threshold }));
  }
  scenarios.push(
    makeScenario({ name: 'LONG_A_CANONICAL', scoring: {} }),
    makeScenario({ name: 'LONG_B_12_15', scoring: { score7to8: 12, score9to10: 15 } }),
    makeScenario({ name: 'LONG_C_15_ALL_LONG', scoring: { score7to8: 15, score9to10: 15 } }),
    makeScenario({ name: 'LONG_D_12_ALL_LONG', scoring: { score7to8: 12, score9to10: 12 } })
  );
  for (const bonus of [0, 10, 15, 20, 25, 30]) {
    scenarios.push(makeScenario({ name: `HEX_BONUS_${bonus}`, scoring: { hexalinkBonus: bonus } }));
  }
  for (const threshold of [100, 110, 120, 130]) {
    scenarios.push(makeScenario({
      name: `REQUIRE_HEX_${threshold}`,
      goldThreshold: threshold,
      constraints: { requireHexalinkForGold: true }
    }));
  }
  for (const threshold of [100, 110, 120, 130]) {
    scenarios.push(makeScenario({
      name: `EXACTLY_SIX_${threshold}`,
      goldThreshold: threshold,
      constraints: { requireExactlySixTurns: true }
    }));
  }
  scenarios.push(
    makeScenario({ name: 'LINE_CANONICAL', scoring: {} }),
    makeScenario({ name: 'LINE_NONE', scoring: { rowBonus: 0, columnBonus: 0 } }),
    makeScenario({ name: 'LINE_REDUCED', scoring: { rowBonus: 5, columnBonus: 10 } }),
    makeScenario({ name: 'LINE_INCREASED', scoring: { rowBonus: 15, columnBonus: 30 } }),
    makeScenario({ name: 'COMBO_1_T120_HEX20', goldThreshold: 120, scoring: { hexalinkBonus: 20 } }),
    makeScenario({ name: 'COMBO_2_T120_LONG15_HEX20', goldThreshold: 120, scoring: { score7to8: 15, score9to10: 15, hexalinkBonus: 20 } }),
    makeScenario({ name: 'COMBO_3_T120_REQUIRE_HEX', goldThreshold: 120, constraints: { requireHexalinkForGold: true } }),
    makeScenario({ name: 'COMBO_4_T130_REQUIRE_HEX_HEX20', goldThreshold: 130, scoring: { hexalinkBonus: 20 }, constraints: { requireHexalinkForGold: true } }),
    makeScenario({ name: 'COMBO_5_T120_LINE_REDUCED', goldThreshold: 120, scoring: { rowBonus: 5, columnBonus: 10 } })
  );
  return scenarios;
}

function highestTestedGoldThresholdReachable(results) {
  return Math.max(0, ...results
    .filter(result => /^GOLD_\d+$/.test(result.scenario.name) && result.goldReachable)
    .map(result => result.scenario.goldThreshold));
}

module.exports = {
  CANONICAL_BASELINE,
  CANONICAL_SCORING_POLICY,
  makeScenario,
  resolvedScenario,
  solveScenario,
  analyzeScenario,
  scenarioMatrix,
  highestTestedGoldThresholdReachable
};
