const { createClock } = require('./clock.js');
const { resolveDeliveryPolicy } = require('./delivery-policy.js');
function getTodayPublicPuzzle(options = {}) {
  const policy = resolveDeliveryPolicy(options.policy); const clock = options.clock || createClock({ now: options.now, timezone: policy.timezone });
  if (!options.catalog) return { ok: false, status: 'STORE_ERROR' };
  const date = clock.getCurrentPuzzleDate(); const result = options.catalog.getPublicPuzzleByDate(date, { today: date });
  if (!result.ok) return { ok: false, status: result.status };
  const expiresAt = clock.nextBoundary().toISOString();
  return { ok: true, schemaVersion: 'm11.public.1', puzzleId: result.puzzleId, date: result.date, puzzle: result.puzzle, publicArtifactHash: result.publicHash, etag: `"${result.publicHash}"`, expiresAt, archived: false };
}
function getPublicPuzzleByDate(options = {}) { const policy = resolveDeliveryPolicy(options.policy); const clock = options.clock || createClock({ now: options.now, timezone: policy.timezone }); return options.catalog?.getPublicPuzzleByDate(options.date, { today: clock.getCurrentPuzzleDate(), allowFuture: options.allowFuture === true }); }
module.exports = { getTodayPublicPuzzle, getPublicPuzzleByDate };
