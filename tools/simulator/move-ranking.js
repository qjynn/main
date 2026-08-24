const { applyMove } = require('../solver/state-search.js');
const { getWordAccessibility } = require('./player-models.js');

function scoreCandidate(item, state, solverContext, model, options = {}) {
  const applied = applyMove(state, item.move, solverContext.context);
  const remaining = solverContext.compatibleMovesFor(applied.state.usedMask).length;
  const lineProgress = (applied.scoredMove.rowBonus + applied.scoredMove.columnBonus) / 20;
  const flexibility = Math.min(1, remaining / 100);
  const hexalink = item.move.isHexalink ? (options.recognizedHexalink ? 1 : 0) : 0;
  return {
    ...item,
    applied,
    attractiveness: model.decision.scoreWeight * applied.scoreDelta +
      model.decision.familiarityWeight * item.accessibility.value * 10 +
      model.decision.coverageWeight * lineProgress * 10 +
      model.decision.flexibilityWeight * flexibility * 10 + hexalink * 10
  };
}

function rankMoves(items, state, solverContext, model, rng, options = {}) {
  const ranked = items.map(item => scoreCandidate(item, state, solverContext, model, options));
  const depth = Math.min(model.planning.lookaheadDepth, options.maxLookaheadDepth ?? 2);
  let nodes = ranked.length;
  if (depth > 0 && ranked.length) {
    const beam = ranked.slice().sort((a, b) => b.attractiveness - a.attractiveness).slice(0, model.planning.beamWidth);
    for (const item of beam) {
      const next = solverContext.compatibleMovesFor(item.applied.state.usedMask).slice(0, model.planning.nodeCap);
      const bestNext = next.reduce((best, move) => Math.max(best, move.staticScore), 0);
      item.attractiveness += bestNext * 0.45;
      nodes += next.length;
      if (depth > 1) item.attractiveness += Math.min(5, next.length / 20);
    }
  }
  ranked.sort((a, b) => b.attractiveness - a.attractiveness || a.move.word.localeCompare(b.move.word));
  const temperature = model.decision.temperature;
  if (!ranked.length) return { selected: null, ranked, nodes };
  if (!temperature) return { selected: ranked[0], ranked, nodes };
  const weights = ranked.map(item => Math.exp((item.attractiveness - ranked[0].attractiveness) / temperature));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let target = rng() * total;
  for (let index = 0; index < ranked.length; index++) {
    target -= weights[index];
    if (target <= 0) return { selected: ranked[index], ranked, nodes };
  }
  return { selected: ranked[ranked.length - 1], ranked, nodes };
}

module.exports = { rankMoves, scoreCandidate };
