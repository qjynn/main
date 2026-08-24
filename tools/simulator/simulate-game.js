const qjynnRules = require('../../qjynn-rules.js');
const { createSolverContext, solveBoard } = require('../solver/state-search.js');
const { resolvePlayerModel, SIMULATOR_VERSION, PLAYER_MODEL_VERSION, getWordAccessibility } = require('./player-models.js');
const { discoverMoves } = require('./move-discovery.js');
const { rankMoves } = require('./move-ranking.js');
const { recognizeHexalink } = require('./hexalink-recognition.js');

function createRng(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function initialSimulationState(solverContext) {
  return { ...solverContext.initialState, hexalinkRecognized: false, hexalinkFound: false, hintClicks: 0 };
}

function oracleResult(puzzle, wordIndex, options = {}) {
  const result = solveBoard({ ...puzzle, maxTurns: qjynnRules.MAX_TURNS, goldThreshold: 100 }, wordIndex, { mode: 'maximizeScore', timeoutMs: options.oracleTimeoutMs });
  return {
    finalScore: result.maxScore,
    medal: qjynnRules.medalForScore(result.maxScore),
    turnsPlayed: result.turnsUsed,
    completed: result.turnsUsed >= qjynnRules.MAX_TURNS,
    hexalinkFound: result.bestSequence.some(move => move.isHexalink),
    hexalinkTurn: result.bestSequence.findIndex(move => move.isHexalink) + 1 || null,
    hintUsed: 0,
    wordsPlayed: result.bestSequence.length,
    invalidAttempts: 0,
    rowsCompleted: result.bestSequence.reduce((sum, move) => sum + (move.rowBonus > 0 ? 1 : 0), 0),
    columnsCompleted: result.bestSequence.reduce((sum, move) => sum + (move.columnBonus > 0 ? 1 : 0), 0),
    moveHistory: result.bestSequence,
    simulationMetadata: { simulatorVersion: SIMULATOR_VERSION, playerModelVersion: PLAYER_MODEL_VERSION, model: 'ORACLE', oracle: true, oracleStats: result.stats }
  };
}

function simulateGame(input, wordIndex, options = {}) {
  const model = resolvePlayerModel(input.playerModel || options.playerModel || 'REGULAR', options.modelOverrides || {});
  const seed = input.simulationSeed ?? options.simulationSeed ?? hashSeed(`${input.puzzle?.date || ''}|${model.name}`);
  if (model.name === 'ORACLE') return oracleResult(input.puzzle, wordIndex, options);
  const started = process.hrtime.bigint();
  const rng = createRng(seed);
  const solverContext = options.preparedContext || createSolverContext(input.puzzle, wordIndex, { moveFilter: options.moveFilter });
  let state = initialSimulationState(solverContext);
  const history = [];
  let invalidAttempts = 0;
  let hintUsed = 0;
  let hexalinkTurn = null;
  let nodesEvaluated = 0;
  const trace = options.trace ? [] : null;

  while (state.turnsUsed < qjynnRules.MAX_TURNS) {
    const hintChance = state.turnsUsed + 1 >= model.hintTurn ? model.hintProbability * 2 : model.hintProbability;
    if (rng() < hintChance) {
      hintUsed++;
      state.hintClicks++;
      const hintConsumedTurn = state.hintClicks % 6 === 0;
      if (hintConsumedTurn) {
        state = { ...state, turnsUsed: state.turnsUsed + 1, hintClicks: 0 };
        history.push({ type: 'hint', turn: state.turnsUsed, consumedTurn: true });
      } else history.push({ type: 'hint', turn: state.turnsUsed, consumedTurn: false });
      if (trace) trace.push({ turn: state.turnsUsed, type: 'hint', hintClicks: state.hintClicks });
      continue;
    }

    const discovered = discoverMoves({
      solverContext,
      state,
      playerModel: model,
      rng,
      options,
      recognizedHexalink: state.hexalinkRecognized
    });
    const recognized = recognizeHexalink({
      puzzle: input.puzzle,
      state,
      playerModel: model,
      rng,
      noticedMoves: discovered.moves,
      clueAccessibility: options.clueAccessibility ?? input.puzzle.clueAccessibility
    });
    const newlyRecognized = recognized && !state.hexalinkRecognized;
    if (newlyRecognized) state = { ...state, hexalinkRecognized: true };
    const candidates = newlyRecognized
      ? discoverMoves({ solverContext, state, playerModel: model, rng, options, recognizedHexalink: true }).moves
      : discovered.moves;
    if (!candidates.length || rng() < model.invalidAttemptProbability) {
      invalidAttempts++;
      state = { ...state, turnsUsed: state.turnsUsed + 1 };
      history.push({ type: 'invalid', turn: state.turnsUsed });
      if (trace) trace.push({ turn: state.turnsUsed, type: 'invalid', noticedMoves: candidates.length });
      continue;
    }
    const decision = rankMoves(candidates, state, solverContext, model, rng, { ...options, recognizedHexalink: state.hexalinkRecognized });
    nodesEvaluated += decision.nodes;
    if (!decision.selected) continue;
    const applied = decision.selected.applied;
    state = { ...applied.state, score: state.score + applied.scoreDelta, hexalinkRecognized: state.hexalinkRecognized, hexalinkFound: state.hexalinkFound || decision.selected.move.isHexalink, hintClicks: state.hintClicks };
    const scored = {
      ...applied.scoredMove,
      accessibility: decision.selected.accessibility.value,
      remainingLegalMoves: solverContext.compatibleMovesFor(state.usedMask).length
    };
    if (decision.selected.move.isHexalink && hexalinkTurn === null) hexalinkTurn = state.turnsUsed;
    history.push({ type: 'move', ...scored });
    if (trace) trace.push({ turn: state.turnsUsed, noticedMoves: decision.ranked.length, selected: scored.word, score: state.score, hexalinkRecognized: state.hexalinkRecognized, decisionScores: decision.ranked.map(item => ({ word: item.move.word, attractiveness: item.attractiveness })) });
  }

  const played = history.filter(item => item.type === 'move');
  const rowsCompleted = played.reduce((sum, move) => sum + (move.rowBonus > 0 ? 1 : 0), 0);
  const columnsCompleted = played.reduce((sum, move) => sum + (move.columnBonus > 0 ? 1 : 0), 0);
  return {
    finalScore: state.score,
    medal: qjynnRules.medalForScore(state.score),
    turnsPlayed: state.turnsUsed,
    completed: state.turnsUsed >= qjynnRules.MAX_TURNS,
    hexalinkFound: Boolean(state.hexalinkFound),
    hexalinkTurn,
    hintUsed,
    wordsPlayed: played.length,
    invalidAttempts,
    rowsCompleted,
    columnsCompleted,
    moveHistory: history,
    simulationMetadata: {
      simulatorVersion: SIMULATOR_VERSION,
      playerModelVersion: PLAYER_MODEL_VERSION,
      model: model.name,
      simulationSeed: seed,
      familiarityBasis: options.frequencyProvider || options.familiarityProvider ? 'provider' : 'heuristic',
      lookaheadNodes: nodesEvaluated,
      trace
    }
  };
}

module.exports = { simulateGame, createRng, hashSeed, initialSimulationState, oracleResult };
