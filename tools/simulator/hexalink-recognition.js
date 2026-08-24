function clueAccessibilityValue(value) {
  if (Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  if (value === 'easy') return 0.85;
  if (value === 'hard') return 0.2;
  return 0.5;
}

function recognizeHexalink({ puzzle, state, playerModel, rng, noticedMoves = [], clueAccessibility }) {
  if (!puzzle.hexalink || state.hexalinkRecognized) return Boolean(state.hexalinkRecognized);
  const model = playerModel;
  const clue = clueAccessibilityValue(clueAccessibility ?? puzzle.clueAccessibility);
  const overlap = noticedMoves.reduce((count, item) => count + (item.move.path.some(([r, c]) =>
    (puzzle.hexarowcol || []).some(([hr, hc]) => r === hr && c === hc)) ? 1 : 0), 0);
  const probability = Math.min(1, model.hexalink.baseRecognitionProbability +
    clue * 0.18 + state.turnsUsed * model.hexalink.turnAdjustment +
    Math.min(1, overlap / 3) * model.hexalink.overlapAdjustment);
  return rng() < probability;
}

module.exports = { recognizeHexalink, clueAccessibilityValue };
