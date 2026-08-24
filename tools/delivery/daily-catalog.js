const { validatePublicationArtifacts } = require('../publication/publication-validator.js');
const { artifactHashes } = require('../publication/artifact-hashes.js');
const { FileStorageAdapter } = require('./file-storage-adapter.js');
const { createClock } = require('./clock.js');
const { resolveDeliveryPolicy, puzzleId, M11_DELIVERY_POLICY_VERSION } = require('./delivery-policy.js');
const { transition } = require('./state-machine.js');

const M11_CATALOG_SCHEMA_VERSION = 1;
function backupPrivateManifest(primaryManifest, backup, candidate) {
  const certificate = candidate.certificate || [];
  return { schemaVersion: 1, answer: primaryManifest.answer, clue: primaryManifest.clue, date: primaryManifest.date, certificate, metadata: primaryManifest.metadata, hashes: artifactHashes({ publicPuzzle: backup, privateManifest: primaryManifest, certificate }) };
}
class DailyPuzzleCatalog {
  constructor(options = {}) { this.store = options.store || new FileStorageAdapter(options.root); this.wordIndex = options.wordIndex; this.policy = resolveDeliveryPolicy(options.policy); this.clock = options.clock || createClock({ timezone: this.policy.timezone }); }
  putDaily(result) {
    if (!result?.ok || !result.primary?.publicPuzzle || !result.privateManifest) throw new Error('Only an M10 publication-ready result can enter the catalog.');
    const date = result.privateManifest.date || result.primary.publicPuzzle.date; const validation = validatePublicationArtifacts({ publicPuzzle: result.primary.publicPuzzle, privateManifest: result.privateManifest, wordIndex: this.wordIndex });
    if (!validation.ok) return { ok: false, status: 'VALIDATION_FAILED', errors: validation.errors };
    const backups = (result.backups || []).map(backup => ({ candidateId: backup.candidateId, publicPuzzle: backup.publicPuzzle, privateManifest: backupPrivateManifest(result.privateManifest, backup.publicPuzzle, result.privateManifest.backupCertificates?.find(item => item.candidateId === backup.candidateId) || backup) }));
    const existing = this.store.readEntry(date); if (existing?.state?.frozen) return { ok: false, status: 'FROZEN' };
    const state = { schemaVersion: M11_CATALOG_SCHEMA_VERSION, status: 'AUTO_PUBLISH_ELIGIBLE', date, puzzleId: puzzleId(date), primaryHash: validation.hashes.gridHash, backupHashes: backups.map(backup => artifactHashes({ publicPuzzle: backup.publicPuzzle }).gridHash), activeCandidateId: null, frozen: true, deliveryPolicyVersion: M11_DELIVERY_POLICY_VERSION, m10PolicyVersion: result.privateManifest.policyVersion || null, createdAt: existing?.state?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), history: existing?.state?.history || [] };
    this.store.writeEntry(date, result.primary.publicPuzzle, result.privateManifest, backups, state);
    return { ok: true, status: state.status, date, puzzleId: state.puzzleId, primaryHash: state.primaryHash, backupHashes: state.backupHashes };
  }
  read(date) { return this.store.readEntry(date); }
  activeView(entry) {
    if (!entry || !entry.state.activeCandidateId || entry.state.activeCandidateId === 'primary') return entry;
    const backup = entry.backups.find(item => item.candidateId === entry.state.activeCandidateId);
    return backup ? { ...entry, publicPuzzle: backup.publicPuzzle, privateManifest: backup.privateManifest } : entry;
  }
  listDaily(range = {}) { return this.store.listDates().filter(date => (!range.from || date >= range.from) && (!range.to || date <= range.to)).map(date => this.read(date)); }
  getArchiveEntry(date) { const entry = this.activeView(this.read(date)); return entry && entry.state.status !== 'BLOCKED' ? { puzzleId: entry.state.puzzleId, date, puzzle: entry.publicPuzzle, publicHash: entry.state.primaryHash } : null; }
  activate(date, options = {}) {
    const entry = this.read(date); if (!entry) return { ok: false, status: 'TODAY_NOT_FOUND' };
    const current = entry.state; if (current.status === 'ACTIVE' && current.activeCandidateId === 'primary') return { ok: true, entry, activated: false };
    const validation = validatePublicationArtifacts({ publicPuzzle: entry.publicPuzzle, privateManifest: entry.privateManifest, queueEntry: { primaryHash: current.primaryHash }, wordIndex: this.wordIndex });
    if (validation.ok) { const next = { ...current, status: 'ACTIVE', activeCandidateId: 'primary', activatedAt: current.activatedAt || new Date().toISOString(), updatedAt: new Date().toISOString(), history: [...(current.history || []), ...(current.status === 'ACTIVE' ? [] : [{ event: 'ACTIVATED', candidate: 'primary', at: new Date().toISOString() }])] }; this.store.updateState(date, next); return { ok: true, entry: { ...entry, state: next }, activated: current.status !== 'ACTIVE' }; }
    return this.promoteBackup(date, validation.errors);
  }
  promoteBackup(date, reason = []) {
    const entry = this.read(date); if (!entry) return { ok: false, status: 'TODAY_BLOCKED', reason: 'missing-entry' };
    for (let index = 0; index < entry.backups.length; index++) {
      const backup = entry.backups[index]; const validation = validatePublicationArtifacts({ publicPuzzle: backup.publicPuzzle, privateManifest: backup.privateManifest, wordIndex: this.wordIndex });
      if (!validation.ok) continue;
      const next = { ...entry.state, status: 'ACTIVE', activeCandidateId: backup.candidateId, primaryHash: validation.hashes.gridHash, updatedAt: new Date().toISOString(), history: [...(entry.state.history || []), { event: 'BACKUP_PROMOTED', oldPrimary: entry.state.activeCandidateId || 'primary', newPrimary: backup.candidateId, reason, at: new Date().toISOString() }] };
      this.store.updateState(date, next); return { ok: true, entry: { ...entry, publicPuzzle: backup.publicPuzzle, privateManifest: backup.privateManifest, state: next }, promoted: backup.candidateId, level: index + 1 };
    }
    const blocked = { ...entry.state, status: 'BLOCKED', updatedAt: new Date().toISOString(), history: [...(entry.state.history || []), { event: 'BLOCKED', reason, at: new Date().toISOString() }] }; this.store.updateState(date, blocked); return { ok: false, status: 'TODAY_BLOCKED', reason: 'all-candidates-invalid' };
  }
  getPublicPuzzleByDate(date, options = {}) {
    const today = options.today || this.clock.getCurrentPuzzleDate(); if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { ok: false, status: 'INVALID_DATE' };
    if (date > today && options.allowFuture !== true) return { ok: false, status: 'NOT_YET_AVAILABLE' };
    const entry = this.activeView(this.read(date)); if (!entry) return { ok: false, status: date === today ? 'TODAY_NOT_FOUND' : 'NOT_FOUND' };
    if (entry.state.status === 'BLOCKED') return { ok: false, status: date === today ? 'TODAY_BLOCKED' : 'BLOCKED' };
    if (date === today && entry.state.status !== 'ACTIVE') {
      const activated = this.activate(date);
      if (!activated.ok) return activated;
      return { ok: true, puzzleId: activated.entry.state.puzzleId, date, puzzle: activated.entry.publicPuzzle, publicHash: activated.entry.state.primaryHash };
    }
    if (date < today && this.policy.archiveEnabled) return { ok: true, puzzleId: entry.state.puzzleId, date, puzzle: entry.publicPuzzle, publicHash: entry.state.primaryHash, archived: true };
    return { ok: true, puzzleId: entry.state.puzzleId, date, puzzle: entry.publicPuzzle, publicHash: entry.state.primaryHash };
  }
  getToday() { return this.getPublicPuzzleByDate(this.clock.getCurrentPuzzleDate()); }
}
module.exports = { M11_CATALOG_SCHEMA_VERSION, DailyPuzzleCatalog, backupPrivateManifest };
