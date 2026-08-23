const { GENERATOR_VERSION, RULES_VERSION, VOCABULARY_VERSION, generatePuzzle, hashSeed } = require('./grid-generator.js');

const SELECTOR_VERSION = 'm7b.0';
const DEFAULT_CANDIDATE_GENERATOR = 'M6_BASELINE';

function deriveCandidateSeed(masterSeed, candidateIndex, selectorVersion = SELECTOR_VERSION) {
  return hashSeed(`${masterSeed}|${candidateIndex}|${GENERATOR_VERSION}|${selectorVersion}`);
}

function canonicalGridHash(grid) {
  return grid.map(row => row.join('')).join('/');
}

function generationFailureCategory(failure) {
  return failure?.reason || failure?.details?.code || 'unknown';
}

function generateCandidatePool(input, wordIndex, config = {}) {
  const candidatePoolSize = config.candidatePoolSize ?? 100;
  const selectorVersion = config.selectorVersion || SELECTOR_VERSION;
  const masterSeed = input.masterSeed ?? input.seed ?? hashSeed(`${input.answer}|${input.date || ''}|${selectorVersion}`);
  const seenGrids = new Map();
  const candidates = [];
  const failures = [];
  const duplicates = [];
  const started = process.hrtime.bigint();

  if (Array.isArray(config.prebuiltCandidates)) {
    for (let candidateIndex = 0; candidateIndex < Math.min(candidatePoolSize, config.prebuiltCandidates.length); candidateIndex++) {
      const candidate = config.prebuiltCandidates[candidateIndex];
      const candidateSeed = candidate.candidateSeed ?? deriveCandidateSeed(masterSeed, candidateIndex, selectorVersion);
      const gridHash = canonicalGridHash(candidate.puzzle.grid);
      if (seenGrids.has(gridHash)) {
        duplicates.push({ candidateIndex, candidateSeed, duplicateOfCandidateIndex: seenGrids.get(gridHash) });
        continue;
      }
      seenGrids.set(gridHash, candidateIndex);
      candidates.push({
        candidateIndex,
        candidateSeed,
        gridHash,
        hardGateStatus: candidate.hardGateStatus || 'accepted',
        candidateGenerator: 'PREBUILT',
        puzzle: candidate.puzzle,
        privateCertification: candidate.privateCertification || {},
        generationStats: candidate.generationStats || {}
      });
    }
    return {
      masterSeed,
      selectorVersion,
      generatorVersion: GENERATOR_VERSION,
      rulesVersion: RULES_VERSION,
      vocabularyVersion: VOCABULARY_VERSION,
      candidatePoolSize,
      uniqueCandidateCount: candidates.length,
      candidates,
      failures,
      duplicates,
      generationMs: Number(process.hrtime.bigint() - started) / 1e6
    };
  }

  for (let candidateIndex = 0; candidateIndex < candidatePoolSize; candidateIndex++) {
    const candidateSeed = deriveCandidateSeed(masterSeed, candidateIndex, selectorVersion);
    const generated = generatePuzzle({
      answer: input.answer,
      clue: input.clue,
      date: input.date,
      seed: candidateSeed,
      maxAttempts: config.maxAttemptsPerCandidate || 20
    }, wordIndex, config.generatorOptions || {});

    if (!generated.ok) {
      failures.push({
        candidateIndex,
        candidateSeed,
        hardGateStatus: 'rejected',
        reason: generationFailureCategory(generated.failure),
        failure: generated.failure
      });
      continue;
    }

    const gridHash = canonicalGridHash(generated.puzzle.grid);
    if (seenGrids.has(gridHash)) {
      duplicates.push({
        candidateIndex,
        candidateSeed,
        duplicateOfCandidateIndex: seenGrids.get(gridHash)
      });
      continue;
    }

    seenGrids.set(gridHash, candidateIndex);
    candidates.push({
      candidateIndex,
      candidateSeed,
      gridHash,
      hardGateStatus: 'accepted',
      candidateGenerator: config.candidateGenerator || DEFAULT_CANDIDATE_GENERATOR,
      puzzle: generated.puzzle,
      privateCertification: generated.privateCertification,
      generationStats: generated.stats
    });
  }

  return {
    masterSeed,
    selectorVersion,
    generatorVersion: GENERATOR_VERSION,
    rulesVersion: RULES_VERSION,
    vocabularyVersion: VOCABULARY_VERSION,
    candidatePoolSize,
    uniqueCandidateCount: candidates.length,
    candidates,
    failures,
    duplicates,
    generationMs: Number(process.hrtime.bigint() - started) / 1e6
  };
}

function failureSummary(poolResult) {
  const categories = {};
  for (const failure of poolResult.failures || []) {
    categories[failure.reason] = (categories[failure.reason] || 0) + 1;
  }
  return {
    candidateCount: poolResult.candidatePoolSize,
    uniqueCandidateCount: poolResult.uniqueCandidateCount,
    duplicateCount: poolResult.duplicates?.length || 0,
    failureCategories: categories,
    seed: poolResult.masterSeed,
    versions: {
      selectorVersion: poolResult.selectorVersion,
      generatorVersion: poolResult.generatorVersion,
      rulesVersion: poolResult.rulesVersion,
      vocabularyVersion: poolResult.vocabularyVersion
    }
  };
}

module.exports = {
  SELECTOR_VERSION,
  DEFAULT_CANDIDATE_GENERATOR,
  deriveCandidateSeed,
  canonicalGridHash,
  generateCandidatePool,
  failureSummary
};
