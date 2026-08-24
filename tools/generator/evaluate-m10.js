#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildVocabularyIndex, parseWordList } = require('../solver/word-index.js');
const { generatePublicationReadyDaily } = require('../daily/generate-publication-ready.js');
const { validatePublicationArtifacts } = require('../publication/publication-validator.js');
const { promoteBackup } = require('../publication/queue-manager.js');
const { artifactHashes } = require('../publication/artifact-hashes.js');

function csvRows(file) { const rows = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(line => line.split(',')); const headers = rows.shift(); return rows.map(row => Object.fromEntries(headers.map((key, i) => [key, row[i]]))); }
function csvValue(value) { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function writeCsv(file, rows) { const headers = Object.keys(rows[0] || {}); fs.writeFileSync(file, `${headers.join(',')}\n${rows.map(row => headers.map(key => csvValue(row[key])).join(',')).join('\n')}\n`); }
function answersFromFile(limit = Number(process.env.M10_ANSWERS || 30)) { return csvRows(path.join(__dirname, '..', '..', 'analysis', 'm82-puzzle-manifest.csv')).map(row => row.answer).filter((answer, i, all) => all.indexOf(answer) === i).slice(0, limit); }
function mutationRows(result, wordIndex) {
  if (!result.ok) return [];
  const base = result.privateManifest;
  const mutations = [
    ['grid', { ...result.primary.publicPuzzle, grid: result.primary.publicPuzzle.grid.map(row => row.slice()) }],
    ['hexalink', { ...result.primary.publicPuzzle, hexalink: 'BCDFGH' }],
    ['certificate-score', { ...base, certificate: base.certificate.map((move, i) => i === 0 ? { ...move, baseScore: (move.baseScore || 0) + 1 } : move) }],
    ['privacy-answer', { ...base, answer: undefined }],
    ['hash', { ...base, hashes: { ...base.hashes, publicHash: 'bad' } }],
    ['version', { ...base, metadata: { ...base.metadata, rulesVersion: 'changed' } }]
  ];
  return mutations.map(([mutation, privateManifest], index) => {
    const publicPuzzle = { ...result.primary.publicPuzzle };
    if (mutation === 'grid') publicPuzzle.grid = publicPuzzle.grid.map(row => row.slice());
    if (mutation === 'grid') publicPuzzle.grid[0][0] = publicPuzzle.grid[0][0] === 'B' ? 'C' : 'B';
    if (mutation === 'privacy-answer') publicPuzzle.answer = 'WATERMELON';
    const validation = validatePublicationArtifacts({ publicPuzzle, privateManifest, wordIndex });
    return { mutation, rejected: !validation.ok, error_count: validation.errors.length, codes: validation.errors.map(error => error.code).join('|') };
  });
}
function evaluate(options = {}) {
  const index = options.wordIndex || buildVocabularyIndex(parseWordList(fs.readFileSync(path.join(__dirname, '..', '..', 'qjynn-words-v1.0.txt'), 'utf8')));
  const answers = options.answers || answersFromFile();
  const frequencyFile = options.frequencyFile || process.env.M81_FREQUENCY_FILE;
  const evaluation = [], gates = [], confidence = [], reserve = [], regeneration = [], performance = [], queue = [], mutations = [];
  for (let indexNo = 0; indexNo < answers.length; indexNo++) {
    const answer = answers[indexNo];
    const result = generatePublicationReadyDaily({ answer, clue: answer, date: `2032-04-${String(indexNo + 1).padStart(2, '0')}`, seed: 950000 + indexNo, wordIndex: index, frequencyFile, config: options.config });
    evaluation.push({ answer, status: result.status, ok: result.ok, candidate_count: result.candidates?.length || 0, primary: result.primary?.candidateId || '', backups: result.backups?.length || 0, regeneration_rounds: result.round ?? Math.max(0, (result.failures?.length || 1) - 1) });
    if (result.gateRows) gates.push(...result.gateRows.map(row => ({ answer, candidate_id: row.candidateId, gate_id: row.gateId, gate_version: row.gateVersion, severity: row.severity, result: row.result, observed_value: JSON.stringify(row.observedValue), envelope: JSON.stringify(row.expectedEnvelope), reason: row.reason })));
    if (result.privateManifest) {
      const summary = result.privateManifest.gateResults.reduce((out, row) => { out[row.result] = (out[row.result] || 0) + 1; return out; }, {});
      confidence.push({ answer, confidence: result.privateManifest.confidence, primary: true, ...summary });
      reserve.push({ answer, primary_available: true, backup1_available: Boolean(result.backups?.[0]), backup2_available: Boolean(result.backups?.[1]), eligible_candidate_count: 1 + (result.backups?.length || 0), regeneration_rounds: result.round, final_status: result.status });
      performance.push({ answer, candidate_generation_ms: result.timings.generationMs, certification_ms: result.timings.certificationMs, regular_ms: result.timings.regularMs, strong_ms: result.timings.strongMs, quality_gates_ms: 0, validator_ms: result.timings.validatorMs, reserve_ms: 0, total_ms: result.timings.totalMs });
      queue.push({ date: result.queueEntry.date, primary_hash: result.queueEntry.primaryHash, backup1_hash: result.queueEntry.backupHashes[0] || '', backup2_hash: result.queueEntry.backupHashes[1] || '', status: result.queueEntry.status, validator_pass: result.queueEntry.validatorPass, frozen: result.queueEntry.frozen, policy_version: result.queueEntry.policyVersion });
      mutations.push(...mutationRows(result, index).map(row => ({ answer, ...row })));
    } else {
      reserve.push({ answer, primary_available: false, backup1_available: false, backup2_available: false, eligible_candidate_count: 0, regeneration_rounds: result.failures?.length || 0, final_status: result.status });
      regeneration.push({ answer, rounds: result.failures?.length || 0, success_round: '', status: result.status });
    }
  }
  return { answers, evaluation, gates, confidence, reserve, regeneration, performance, queue, mutations };
}
function writeOutputs(result, outputDir = path.join(__dirname, '..', '..', 'analysis')) {
  fs.mkdirSync(outputDir, { recursive: true });
  writeCsv(path.join(outputDir, 'm10-evaluation-manifest.csv'), result.evaluation);
  writeCsv(path.join(outputDir, 'm10-gate-results.csv'), result.gates);
  writeCsv(path.join(outputDir, 'm10-confidence-results.csv'), result.confidence);
  writeCsv(path.join(outputDir, 'm10-reserve-results.csv'), result.reserve);
  writeCsv(path.join(outputDir, 'm10-regeneration-results.csv'), result.regeneration);
  writeCsv(path.join(outputDir, 'm10-performance.csv'), result.performance);
  writeCsv(path.join(outputDir, 'm10-validator-mutations.csv'), result.mutations);
  writeCsv(path.join(outputDir, 'm10-queue-results.csv'), result.queue);
  const successful = result.evaluation.filter(row => row.ok);
  const summary = { milestone: 'M10', answersEvaluated: result.answers.length, primaryOnlySuccess: successful.length / Math.max(1, result.answers.length), primaryPlusOneBackup: result.reserve.filter(row => row.backup1_available).length / Math.max(1, result.answers.length), primaryPlusTwoBackups: result.reserve.filter(row => row.backup2_available).length / Math.max(1, result.answers.length), blockedRate: result.evaluation.filter(row => row.status === 'BLOCKED').length / Math.max(1, result.evaluation.length), confidenceDistribution: result.confidence.reduce((out, row) => { out[row.confidence] = (out[row.confidence] || 0) + 1; return out; }, {}), gateDistribution: result.gates.reduce((out, row) => { const key = `${row.gate_id}:${row.result}`; out[key] = (out[key] || 0) + 1; return out; }, {}), validatorMutationRejectionRate: result.mutations.length ? result.mutations.filter(row => row.rejected).length / result.mutations.length : null, regenerationRounds: result.regeneration.map(row => row.rounds), note: 'M10 does not publish to the live website.' };
  fs.writeFileSync(path.join(outputDir, 'm10-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}
if (require.main === module) { const result = evaluate({ frequencyFile: process.env.M81_FREQUENCY_FILE }); console.log(JSON.stringify(writeOutputs(result), null, 2)); }
module.exports = { evaluate, writeOutputs, mutationRows, answersFromFile };
