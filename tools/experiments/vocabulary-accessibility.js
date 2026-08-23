const { buildVocabularyIndex } = require('../solver/word-index.js');

const VOCABULARY_TIERS = Object.freeze({
  ALL_QJYNN: 'ALL_QJYNN',
  TOP_30000: 'TOP_30000',
  TOP_20000: 'TOP_20000',
  TOP_15000: 'TOP_15000',
  TOP_10000: 'TOP_10000',
  TOP_5000: 'TOP_5000'
});

const TIER_LIMITS = Object.freeze({
  ALL_QJYNN: Infinity,
  TOP_30000: 30000,
  TOP_20000: 20000,
  TOP_15000: 15000,
  TOP_10000: 10000,
  TOP_5000: 5000
});

function createVocabularyOrderRankProvider(words) {
  const ranks = new Map();
  words.forEach((word, index) => {
    const key = String(word || '').trim().toLowerCase();
    if (key && !ranks.has(key)) ranks.set(key, index + 1);
  });
  return word => ranks.get(String(word || '').trim().toLowerCase()) || null;
}

function wordsForAccessibilityTier(wordIndex, tier, rankProvider) {
  const limit = TIER_LIMITS[tier];
  if (limit === undefined) throw new Error(`Unknown vocabulary tier: ${tier}`);
  if (tier === VOCABULARY_TIERS.ALL_QJYNN) return wordIndex.entries.map(entry => entry.word);
  return wordIndex.entries
    .filter(entry => entry.word.length === 2 || ((rankProvider(entry.word) || Infinity) <= limit))
    .map(entry => entry.word);
}

function buildAccessibilityIndex(wordIndex, tier, rankProvider) {
  return buildVocabularyIndex(wordsForAccessibilityTier(wordIndex, tier, rankProvider));
}

function tierStats(wordIndex, tier, rankProvider) {
  const words = wordsForAccessibilityTier(wordIndex, tier, rankProvider);
  return {
    tier,
    availableIndexedWords: words.length,
    pctOfFullVocabulary: wordIndex.entries.length ? (words.length / wordIndex.entries.length) * 100 : 0
  };
}

function certificateFamiliarity(certificate, rankProvider) {
  const wordRanks = (certificate || []).map(move => {
    const rank = rankProvider ? rankProvider(move.word) : null;
    return { word: move.word, rank };
  });
  const ranked = wordRanks.map(item => item.rank).filter(rank => Number.isFinite(rank));
  const sorted = ranked.slice().sort((a, b) => a - b);
  const median = sorted.length
    ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
    : null;
  const worst = wordRanks.reduce((worstItem, item) => {
    if (!item.rank) return worstItem;
    if (!worstItem || item.rank > worstItem.rank) return item;
    return worstItem;
  }, null);
  return {
    wordRanks,
    meanRank: ranked.length ? ranked.reduce((sum, rank) => sum + rank, 0) / ranked.length : null,
    medianRank: median,
    worstRankedWord: worst,
    unrankedWords: wordRanks.filter(item => !item.rank).length
  };
}

function certificateTierCoverage(certificate, wordIndex, rankProvider) {
  const words = (certificate || []).map(move => move.word);
  const result = {};
  for (const tier of Object.values(VOCABULARY_TIERS).filter(value => value !== VOCABULARY_TIERS.ALL_QJYNN)) {
    const allowed = new Set(wordsForAccessibilityTier(wordIndex, tier, rankProvider));
    const retained = words.filter(word => allowed.has(word)).length;
    result[tier] = { retained, total: words.length };
  }
  return result;
}

module.exports = {
  VOCABULARY_TIERS,
  TIER_LIMITS,
  createVocabularyOrderRankProvider,
  wordsForAccessibilityTier,
  buildAccessibilityIndex,
  tierStats,
  certificateFamiliarity,
  certificateTierCoverage
};
