const fs = require('fs');
const path = require('path');
const { artifactHashes, stable } = require('../publication/artifact-hashes.js');

function atomicWrite(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); const temp = `${filePath}.tmp-${process.pid}-${Date.now()}`; fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`); fs.renameSync(temp, filePath); }
function readJson(filePath) { if (!fs.existsSync(filePath)) return null; try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (error) { return { __corrupt: true, __error: error.message }; } }
function safeDate(date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error('Invalid catalog date.'); return date; }
class FileStorageAdapter {
  constructor(root) { this.root = path.resolve(root); this.publicRoot = path.join(this.root, 'public'); this.privateRoot = path.join(this.root, 'private'); this.statePath = path.join(this.root, 'state.json'); fs.mkdirSync(this.root, { recursive: true }); }
  state() { return readJson(this.statePath) || { schemaVersion: 1, dates: {} }; }
  writeState(state) { atomicWrite(this.statePath, state); }
  paths(date) { safeDate(date); return { public: path.join(this.publicRoot, `${date}.json`), private: path.join(this.privateRoot, `${date}.json`), backups: path.join(this.privateRoot, `${date}.backups.json`) }; }
  writeEntry(date, publicPuzzle, privateManifest, backupEntries, state) { const files = this.paths(date); atomicWrite(files.public, publicPuzzle); atomicWrite(files.private, privateManifest); atomicWrite(files.backups, backupEntries || []); const next = this.state(); next.dates[date] = state; this.writeState(next); return state; }
  readEntry(date) { const files = this.paths(date); const state = this.state().dates[date]; if (!state) return null; return { date, state, publicPuzzle: readJson(files.public), privateManifest: readJson(files.private), backups: readJson(files.backups) || [] }; }
  listDates() { return Object.keys(this.state().dates).sort(); }
  updateState(date, state) { const next = this.state(); next.dates[safeDate(date)] = state; this.writeState(next); return state; }
  hasPublic(date) { return Boolean(this.readEntry(date)?.publicPuzzle); }
}
module.exports = { FileStorageAdapter, atomicWrite, readJson };
