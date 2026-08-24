const { getWordAccessibility } = require('./player-models.js');

function randomIndex(rng, limit) {
  return Math.floor(rng() * limit);
}

function discoverMoves({ solverContext, state, playerModel, rng, options = {}, recognizedHexalink = false }) {
  const model = playerModel;
  const accessibilityOptions = { ...options, ...(options.modelOverrides || {}) };
  const allMoves = solverContext.allMoves;
  const available = solverContext.compatibleMovesFor(state.usedMask);
  if (!available.length) return { moves: [], considered: 0, sampledMoves: 0, estimatedKnownMoves: 0, noticedMoves: 0, availableCount: 0 };
  const maxCandidates = options.maxCandidateMoves ?? model.discovery.maxCandidateMoves;
  const sampleSize = Math.min(available.length, options.sampleSize ?? model.discovery.sampleSize);
  const selected = new Map();
  for (let attempt = 0; attempt < sampleSize * 3 && selected.size < sampleSize; attempt++) {
    const move = available[randomIndex(rng, available.length)];
    if (!selected.has(move.mask.toString())) selected.set(move.mask.toString(), move);
  }
  const noticed = [];
  for (const move of selected.values()) {
    const accessibility = getWordAccessibility(move.word, model, accessibilityOptions);
    const pathNotice = Math.max(0.25, 1 - Math.max(0, move.path.length - 3) * 0.08);
    const noticeProbability = Math.min(1, model.discovery.noticeProbability * pathNotice * (0.72 + model.vocabularyAccess * 0.28));
    if (rng() <= accessibility.knownProbability && rng() <= noticeProbability) {
      noticed.push({ move, accessibility, knownProbability: accessibility.knownProbability, noticeProbability });
    }
  }
  if (recognizedHexalink) {
    for (const move of allMoves) {
      if (move.isHexalink && (move.mask & state.usedMask) === 0n &&
        !noticed.some(item => item.move.mask === move.mask)) {
        noticed.push({ move, accessibility: getWordAccessibility(move.word, model, accessibilityOptions), hexalinkDiscovered: true });
      }
    }
  }
  noticed.sort((a, b) => a.move.word.localeCompare(b.move.word));
  return {
    moves: noticed.slice(0, maxCandidates),
    considered: selected.size,
    sampledMoves: selected.size,
    estimatedKnownMoves: selected.size ? noticed.filter(item => item.knownProbability >= 0.5).length : 0,
    noticedMoves: noticed.length,
    availableCount: available.length
  };
}

module.exports = { discoverMoves };
