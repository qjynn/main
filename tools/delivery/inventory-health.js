const { addCalendarDays } = require('./clock.js');
function inventoryHealth(catalog, options = {}) {
  const today = options.today || catalog.clock.getCurrentPuzzleDate(); const horizon = options.horizon || catalog.policy.inventoryHorizon; const dates = Array.from({ length: horizon }, (_, i) => addCalendarDays(today, i + 1));
  const rows = dates.map(date => { const entry = catalog.read(date); const ready = Boolean(entry && ['AUTO_PUBLISH_ELIGIBLE', 'ACTIVE'].includes(entry.state.status)); return { date, ready, blocked: Boolean(entry?.state.status === 'BLOCKED'), backups: entry?.state.backupHashes?.length || 0 }; });
  const futureReadyDays = rows.filter(row => row.ready).length; const futureBlockedDays = rows.filter(row => row.blocked).length; const backupCompleteDays = rows.filter(row => row.ready && row.backups >= catalog.policy.requiredBackups).length; const status = futureReadyDays >= horizon ? 'HEALTHY' : futureReadyDays >= Math.max(1, Math.floor(horizon / 2)) ? 'DEGRADED' : 'CRITICAL';
  return { today, horizon, futureReadyDays, futureBlockedDays, backupCompleteDays, health: status, replenishmentRequired: futureReadyDays < (options.replenishThreshold || catalog.policy.replenishThreshold), replenishmentStatus: futureReadyDays < (options.replenishThreshold || catalog.policy.replenishThreshold) ? (options.inputAvailable === false ? 'INPUT_CATALOG_EXHAUSTED' : 'REQUEST_REPLENISHMENT') : 'SUFFICIENT', rows };
}
module.exports = { inventoryHealth };
