const QUEUE_SCHEMA_VERSION = 1;
const QUEUE_STATUSES = Object.freeze(['GENERATED', 'CERTIFIED', 'AUTO_PUBLISH_ELIGIBLE', 'BLOCKED', 'EXPIRED', 'SUPERSEDED']);
function createQueueEntry({ date, publicArtifactRef, privateManifestRef, primaryHash, backupHashes = [], policyVersion, validatorPass = false, createdAt = new Date().toISOString() }) {
  if (!date || !primaryHash) throw new Error('Queue entry requires date and primaryHash.');
  return { schemaVersion: QUEUE_SCHEMA_VERSION, date, publicArtifactRef, privateManifestRef, status: validatorPass ? 'AUTO_PUBLISH_ELIGIBLE' : 'CERTIFIED', primaryHash, backupHashes: backupHashes.slice(), createdAt, policyVersion, validatorPass, frozen: false };
}
function transitionQueueEntry(entry, status) {
  if (!QUEUE_STATUSES.includes(status)) throw new Error(`Unknown queue status: ${status}`);
  if (entry.frozen && status !== 'SUPERSEDED') throw new Error('Frozen queue entry cannot be changed.');
  return { ...entry, status };
}
function freezeQueueEntry(entry) { return { ...entry, frozen: true }; }
function supersedeQueueEntry(entry, replacementId) { return { ...entry, status: 'SUPERSEDED', supersededBy: replacementId, frozen: false }; }
function promoteBackup(entry, index = 0) {
  if (!entry.backupHashes?.[index]) return { ok: false, status: 'BLOCKED', reason: 'No valid backup is available.' };
  const backups = entry.backupHashes.slice(); const primaryHash = backups.splice(index, 1)[0];
  return { ok: true, entry: { ...entry, primaryHash, backupHashes: [entry.primaryHash, ...backups] } };
}
module.exports = { QUEUE_SCHEMA_VERSION, QUEUE_STATUSES, createQueueEntry, transitionQueueEntry, freezeQueueEntry, supersedeQueueEntry, promoteBackup };
