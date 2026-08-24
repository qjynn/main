const qjynnRules = require('../../qjynn-rules.js');
const { validatePuzzle } = require('../generator/puzzle-validator.js');
const { replaySequence } = require('../solver/state-search.js');
const { artifactHashes, hashObject } = require('./artifact-hashes.js');

const PUBLICATION_VALIDATOR_VERSION = 'm10.validator.0';
const PUBLIC_SCHEMA_VERSION = 1;
const PRIVATE_SCHEMA_VERSION = 1;

function error(code, message, observed = null) { return { code, message, observed }; }
function validatePublicationArtifacts(input = {}) {
  const { publicPuzzle, privateManifest, queueEntry, wordIndex } = input;
  const errors = [];
  if (!publicPuzzle || publicPuzzle.schema_version !== PUBLIC_SCHEMA_VERSION) errors.push(error('public.schema', 'Public schema version is invalid.'));
  if (!privateManifest || privateManifest.schemaVersion !== PRIVATE_SCHEMA_VERSION) errors.push(error('private.schema', 'Private manifest schema version is invalid.'));
  if (!privateManifest?.answer) errors.push(error('private.answer', 'Private answer is required.'));
  if (privateManifest?.metadata?.rulesVersion && privateManifest.metadata.rulesVersion !== 'qjynn-rules-local') errors.push(error('version.rules', 'Private manifest rules version is not the active canonical version.', privateManifest.metadata.rulesVersion));
  if (privateManifest?.metadata?.vocabularyVersion && privateManifest.metadata.vocabularyVersion !== '1.0') errors.push(error('version.vocabulary', 'Private manifest vocabulary version is not Vocabulary 1.0.', privateManifest.metadata.vocabularyVersion));
  if (privateManifest?.metadata?.selectorVersion && (!privateManifest.metadata.generatorVersion || !privateManifest.metadata.simulatorVersion || !privateManifest.metadata.playerModelVersion)) errors.push(error('version.metadata', 'Private manifest version metadata is incomplete.'));
  if (publicPuzzle && Object.keys(publicPuzzle).some(key => ['answer', 'certificate', 'goldCertificate', 'privateMetadata', 'regularProfile', 'candidatePool', 'selectionExplanation'].includes(key))) errors.push(error('privacy.leakage', 'Public artifact contains private data.'));
  if (publicPuzzle && privateManifest?.answer && privateManifest.answer === publicPuzzle.answer) errors.push(error('privacy.answer', 'Answer is present in the public artifact.'));
  const structural = publicPuzzle && privateManifest ? validatePuzzle(publicPuzzle, { answer: privateManifest.answer, wordIndex }) : { ok: false, errors: [] };
  for (const item of structural.errors || []) errors.push(error(item.code, item.message));
  const certificate = privateManifest?.certificate || privateManifest?.m6?.goldCertificate || [];
  if (!certificate.length) errors.push(error('certificate.missing', 'Gold certificate is missing.'));
  let replay = null;
  if (publicPuzzle && certificate.length) {
    try { replay = replaySequence(publicPuzzle, certificate); } catch (cause) { errors.push(error('certificate.replay', cause.message)); }
    if (replay && (replay.score < 100 || replay.turnsUsed > qjynnRules.MAX_TURNS)) errors.push(error('certificate.threshold', 'Certificate does not meet Gold or turn limits.', replay));
  }
  const hashes = artifactHashes({ publicPuzzle, privateManifest, certificate });
  const recorded = privateManifest?.hashes || {};
  for (const key of ['gridHash', 'publicHash', 'certificateHash']) if (recorded[key] && recorded[key] !== hashes[key]) errors.push(error(`hash.${key}`, `${key} does not match independent recomputation.`, { recorded: recorded[key], actual: hashes[key] }));
  if (queueEntry && queueEntry.primaryHash && queueEntry.primaryHash !== hashes.gridHash) errors.push(error('queue.primaryHash', 'Queue primary hash does not match public grid.', queueEntry.primaryHash));
  return { ok: errors.length === 0, validatorVersion: PUBLICATION_VALIDATOR_VERSION, errors, hashes, replay, checks: { publicSchema: !errors.some(item => item.code.startsWith('public.')), privateSchema: !errors.some(item => item.code.startsWith('private.')), puzzleStructure: structural.ok, certificateReplay: Boolean(replay && replay.score >= 100), privacy: !errors.some(item => item.code.startsWith('privacy.')), hashes: !errors.some(item => item.code.startsWith('hash.')) } };
}
module.exports = { PUBLICATION_VALIDATOR_VERSION, PUBLIC_SCHEMA_VERSION, PRIVATE_SCHEMA_VERSION, validatePublicationArtifacts };
