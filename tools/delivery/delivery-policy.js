const M11_DELIVERY_POLICY_VERSION = 'm11.0';
const DEFAULT_DELIVERY_POLICY = Object.freeze({ timezone: 'America/New_York', archiveEnabled: true, futureLookup: 'BLOCK', requiredBackups: 2, inventoryHorizon: 14, replenishThreshold: 7, staleFallback: 'UNAVAILABLE' });
function resolveDeliveryPolicy(policy = {}) { return Object.freeze({ ...DEFAULT_DELIVERY_POLICY, ...policy }); }
function puzzleId(date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error('Invalid puzzle date.'); return `QJYNN-${date}`; }
module.exports = { M11_DELIVERY_POLICY_VERSION, DEFAULT_DELIVERY_POLICY, resolveDeliveryPolicy, puzzleId };
