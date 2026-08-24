const { getWordAccessibility } = require('./player-models.js');

function randomIndex(rng, limit) {
  return Math.floor(rng() * limit);
}

function discoverMoves({ solverContext, state, playerModel, rng, options = {}, recognizedHexalink = false }) {
  const model = playerModel;
  const allMoves = solverContext.allMoves;
  const available = solverContext.compatibleMovesFor(state.usedMask);
  if (!available.length) return { moves: [], considered: 0, availableCount: 0 };
  const maxCandidates = options.maxCandidateMoves ?? model.discovery.maxCandidateMoves;
  const sampleSize = Math.min(available.length, options.sampleSize ?? model.discovery.sampleSize);
  const selected = new Map();
  for (let attempt = 0; attempt < sampleSize * 3 && selected.size < sampleSize; attempt++) {
    const move = available[randomIndex(rng, available.length)];
    if (!selected.has(move.mask.toString())) selected.set(move.mask.toString(), move);
  }
  const noticed = [];
  for (const move of selected.values()) {
    const accessibility = getWordAccessibility(move.word, model, options);
    const noticeProbability = Math.min(1, model.discovery.noticeProbability *
      (0.45 + accessibility.value * 0.75));
    if (rng() <= noticeProbability) noticed.push({ move, accessibility });
  }
  if (recognizedHexalink) {
    for (const move of allMoves) {
      if (move.isHexalink && (move.mask & state.usedMask) === 0n &&
        !noticed.some(item => item.move.mask === move.mask)) {
        noticed.push({ move, accessibility: getWordAccessibility(move.word, model, options), hexalinkDiscovered: true });
      }
    }
  }
  noticed.sort((a, b) => a.move.word.localeCompare(b.move.word));
  return {
    moves: noticed.slice(0, maxCandidates),
    considered: selected.size,
    availableCount: available.length
  };
}

module.exports = { discoverMoves };
