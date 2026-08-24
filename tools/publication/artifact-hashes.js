const crypto = require('crypto');
const fs = require('fs');

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function hashObject(value) { return sha256(stable(value)); }
function hashFile(filePath) { return sha256(fs.readFileSync(filePath)); }
function artifactHashes({ publicPuzzle, privateManifest, certificate } = {}) {
  return { gridHash: hashObject(publicPuzzle?.grid), publicHash: hashObject(publicPuzzle), privateHash: hashObject(privateManifest), certificateHash: hashObject(certificate || privateManifest?.certificate || []) };
}
function repositoryVersionHashes(root) {
  const files = ['qjynn-rules.js', 'qjynn-words-v1.0.txt', 'tools/generator/grid-generator.js', 'tools/generator/m10-publication.js'].map(file => `${root}/${file}`);
  return Object.fromEntries(files.filter(file => fs.existsSync(file)).map(file => [file.slice(root.length + 1), hashFile(file)]));
}
module.exports = { stable, sha256, hashObject, hashFile, artifactHashes, repositoryVersionHashes };
