#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generateCandidatePool } = require('./candidate-pool.js');
const { hashSeed } = require('./grid-generator.js');
const { requireM91Provider, referenceSelection } = require('./m91-simulation-selector.js');
const { candidateForPool, profileCandidate } = require('./evaluate-m91.js');

function csvRows(file) { const rows = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(line => line.split(',')); const headers = rows.shift(); return rows.map(row => Object.fromEntries(headers.map((key, i) => [key, row[i]]))); }
function csvValue(value) { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function write(file, rows) { const headers = Object.keys(rows[0] || {}); fs.writeFileSync(file, `${headers.join(',')}\n${rows.map(row => headers.map(key => csvValue(row[key])).join(',')).join('\n')}\n`); }
function run(options = {}) {
  const index = options.wordIndex || buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
  const provider = requireM91Provider(options.frequencyFile).provider;
  const answers = (options.answers || csvRows(path.join(__dirname, '..', '..', 'analysis', 'm82-puzzle-manifest.csv')).map(row => row.answer).filter((a, i, all) => all.indexOf(a) === i)).slice(0, options.answerCount || 5);
  const rows = [];
  for (let answerIndex = 0; answerIndex < answers.length; answerIndex++) {
    for (const poolSize of [10, 15, 20]) {
      const pool = generateCandidatePool({ answer: answers[answerIndex], clue: answers[answerIndex], date: `2032-02-${String(answerIndex + 1).padStart(2, '0')}`, masterSeed: 940000 + answerIndex }, index, { candidatePoolSize: poolSize, maxAttemptsPerCandidate: 20, candidateGenerator: 'M6_BASELINE', selectorVersion: 'm9.1-pool' });
      const candidates = pool.candidates.map(candidate => candidateForPool(candidate, index)).filter(candidate => candidate.certified);
      const profiled = candidates.map(candidate => ({ ...candidate, ...profileCandidate(candidate, index, provider, answers[answerIndex], 940000 + answerIndex, 250) }));
      const high = profiled.map(candidate => ({ ...candidate, regularMeanScore: candidate.profiles[250].regularMeanScore, regularMedianScore: candidate.profiles[250].regularMedianScore, regularGoldRate: candidate.profiles[250].regularGoldRate }));
      const reference = referenceSelection(high, { difficultyPolicy: { preferredBand: 'middle' } });
      rows.push({ answer: answers[answerIndex], pool_size: poolSize, generated: pool.candidates.length, certified: candidates.length, preferred_count: reference.preferred.length, reference_winner: reference.winner?.candidateId || '', preferred_mean_score: reference.preferred.length ? reference.preferred.reduce((sum, c) => sum + c.regularMeanScore, 0) / reference.preferred.length : '', winner_score: reference.winner?.regularMeanScore || '', generation_ms: pool.generationMs, simulation_ms: profiled.reduce((sum, c) => sum + c.simulationMs, 0) });
    }
  }
  return rows;
}
if (require.main === module) { const rows = run({ frequencyFile: process.env.M81_FREQUENCY_FILE }); write(path.join(__dirname, '..', '..', 'analysis', 'm91-pool-sensitivity.csv'), rows); console.log(JSON.stringify({ rows: rows.length, answers: new Set(rows.map(row => row.answer)).size }, null, 2)); }
module.exports = { run };
