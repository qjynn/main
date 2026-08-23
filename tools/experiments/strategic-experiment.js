const qjynnRules = require('../../qjynn-rules.js');
const { consonantSkeleton } = require('../solver/word-index.js');
const { validateEditorialInput, validatePuzzle } = require('../generator/puzzle-validator.js');
const {
  GENERATOR_VERSION,
  RULES_VERSION,
  VOCABULARY_VERSION,
  normalizeSeed,
  publicPuzzleFor
} = require('../generator/grid-generator.js');
const { solveBoard, replaySequence, MODE_FIND_GOLD } = require('../solver/state-search.js');
const {
  STRATEGY_VERSION,
  STRATEGIES,
  placeExperimentalGrid,
  generateStrategyPath
} = require('./placement-strategies.js');

const EXPERIMENT_VERSION = 'm7a.1';
const DEFAULT_MAX_ATTEMPTS = 20;

function failureResult({ input, strategy, seed, attempts, reason, details }) {
  return {
    ok: false,
    strategy,
    failure: {
      answer: input?.answer,
      hexalink: input?.answer ? consonantSkeleton(input.answer) : '',
      seed,
      attempts,
      reason,
      details
    },
    generationStats: {
      attempts,
      structurallyValidCandidates: 0,
      goldCertifiedCandidates: 0
    }
  };
}

function certifyPuzzle(puzzle, wordIndex, goldThreshold = 100) {
  const solution = solveBoard({ ...puzzle, maxTurns: qjynnRules.MAX_TURNS, goldThreshold }, wordIndex, { mode: MODE_FIND_GOLD });
  if (!solution.goldReachable) return { ok: false, solution };
  const replay = replaySequence(puzzle, solution.goldCertificate);
  if (replay.score !== solution.maxScore || replay.score < goldThreshold || replay.turnsUsed > qjynnRules.MAX_TURNS) {
    return { ok: false, solution, replay, internalError: 'certificate-replay-failed' };
  }
  return { ok: true, solution, replay };
}

function generateExperimentalPuzzle(input, wordIndex, options = {}) {
  const started = process.hrtime.bigint();
  const strategy = input.strategy || options.strategy || STRATEGIES.RANDOM_BASELINE;
  const editorial = validateEditorialInput(input, wordIndex);
  const seed = normalizeSeed(input.seed, input);
  const maxAttempts = input.maxAttempts || options.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const stats = {
    attempts: 0,
    structurallyValidCandidates: 0,
    goldCertifiedCandidates: 0,
    solverCalls: 0,
    totalSolverMs: 0,
    averageSolverMs: 0,
    generationMs: 0
  };

  if (!editorial.ok) {
    return failureResult({ input, strategy, seed, attempts: 0, reason: 'invalid-input', details: editorial.errors });
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    stats.attempts = attempt;
    const attemptSeed = (seed + attempt * 2654435761) >>> 0;
    const hexarowcol = generateStrategyPath(attemptSeed, strategy, options);
    const placed = placeExperimentalGrid({
      strategy,
      hexalink: editorial.hexalink,
      hexarowcol,
      seed: attemptSeed,
      wordIndex,
      options
    });
    if (!placed.ok) {
      stats.generationMs = Number(process.hrtime.bigint() - started) / 1e6;
      return failureResult({ input, strategy, seed, attempts: attempt, reason: placed.error.code, details: placed.error });
    }

    const puzzle = publicPuzzleFor({
      date: input.date || null,
      clue: editorial.clue,
      grid: placed.grid,
      hexalink: editorial.hexalink,
      hexarowcol
    });
    const validation = validatePuzzle(puzzle, { answer: editorial.answer, wordIndex });
    if (!validation.ok) continue;
    stats.structurallyValidCandidates++;

    const solverStarted = process.hrtime.bigint();
    const certified = certifyPuzzle(puzzle, wordIndex, options.goldThreshold || 100);
    const solverMs = Number(process.hrtime.bigint() - solverStarted) / 1e6;
    stats.solverCalls++;
    stats.totalSolverMs += solverMs;
    stats.averageSolverMs = stats.totalSolverMs / stats.solverCalls;
    if (!certified.ok) continue;

    stats.goldCertifiedCandidates++;
    stats.generationMs = Number(process.hrtime.bigint() - started) / 1e6;
    stats.rawM4MoveCount = certified.solution.stats.rawStartingMoveCount;
    stats.solverRelevantMoveCount = certified.solution.stats.solverRelevantMoveCount;
    stats.goldScore = certified.solution.maxScore;
    stats.goldTurns = certified.solution.turnsUsed;

    const privateCertification = {
      schemaVersion: 1,
      generatorVersion: GENERATOR_VERSION,
      rulesVersion: RULES_VERSION,
      vocabularyVersion: VOCABULARY_VERSION,
      experimentVersion: EXPERIMENT_VERSION,
      strategy,
      strategyVersion: STRATEGY_VERSION,
      answer: editorial.answer,
      clue: editorial.clue,
      date: input.date || null,
      seed,
      attemptNumber: attempt,
      hexalink: editorial.hexalink,
      hexarowcol,
      goldScore: certified.solution.maxScore,
      goldTurns: certified.solution.turnsUsed,
      goldCertificate: certified.solution.goldCertificate,
      certificateReplayResult: certified.replay,
      generationStats: { ...stats },
      strategyDiagnostics: placed.diagnostics || null
    };

    return {
      ok: true,
      strategy,
      puzzle,
      privateCertification,
      generationStats: stats,
      strategyMetadata: {
        strategy,
        strategyVersion: STRATEGY_VERSION,
        seed,
        generatorVersion: GENERATOR_VERSION,
        rulesVersion: RULES_VERSION,
        vocabularyVersion: VOCABULARY_VERSION,
        experimentVersion: EXPERIMENT_VERSION
      }
    };
  }

  stats.generationMs = Number(process.hrtime.bigint() - started) / 1e6;
  return {
    ok: false,
    strategy,
    failure: {
      answer: editorial.answer,
      hexalink: editorial.hexalink,
      seed,
      attempts: stats.attempts,
      reason: 'max-attempts-exhausted'
    },
    generationStats: stats
  };
}

module.exports = {
  EXPERIMENT_VERSION,
  generateExperimentalPuzzle,
  certifyPuzzle
};
