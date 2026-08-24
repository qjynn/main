const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePlayerModel, getWordAccessibility } = require('../tools/simulator/player-models.js');

test('M8 resolves five versioned player models with explicit bounded limits', () => {
  for (const name of ['CASUAL', 'REGULAR', 'STRONG', 'EXPERT', 'ORACLE']) {
    const model = resolvePlayerModel(name);
    assert.equal(model.name, name);
    assert.ok(model.discovery.maxCandidateMoves >= 1);
    assert.ok(model.planning.nodeCap >= 0);
  }
  assert.ok(resolvePlayerModel('CASUAL').discovery.maxCandidateMoves < resolvePlayerModel('EXPERT').discovery.maxCandidateMoves);
});

test('M8 accessibility uses a provider when available and heuristic fallback otherwise', () => {
  const model = resolvePlayerModel('REGULAR');
  assert.equal(getWordAccessibility('watermelon', model).basis, 'heuristic');
  assert.equal(getWordAccessibility('watermelon', model, { familiarityProvider: () => 0.91 }).value, 0.91);
  assert.equal(getWordAccessibility('qi', model).value, model.twoLetterRecognition);
});

test('M8 accessibility overrides are explicit and bounded', () => {
  const result = getWordAccessibility('rareword', 'CASUAL', { familiarityOverrides: { rareword: 4 } });
  assert.equal(result.value, 1);
});
