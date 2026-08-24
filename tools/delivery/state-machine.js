const M11_QUEUE_STATES = Object.freeze(['GENERATED', 'CERTIFIED', 'AUTO_PUBLISH_ELIGIBLE', 'ACTIVE', 'EXPIRED', 'BLOCKED', 'SUPERSEDED']);
const ALLOWED_TRANSITIONS = Object.freeze({ GENERATED: ['CERTIFIED', 'BLOCKED'], CERTIFIED: ['AUTO_PUBLISH_ELIGIBLE', 'BLOCKED'], AUTO_PUBLISH_ELIGIBLE: ['ACTIVE', 'BLOCKED', 'SUPERSEDED'], ACTIVE: ['EXPIRED', 'SUPERSEDED', 'BLOCKED'], EXPIRED: ['SUPERSEDED'], BLOCKED: ['SUPERSEDED'], SUPERSEDED: [] });
function canTransition(from, to) { return M11_QUEUE_STATES.includes(from) && ALLOWED_TRANSITIONS[from].includes(to); }
function transition(state, to) { if (!canTransition(state.status, to)) throw new Error(`Invalid M11 transition ${state.status} -> ${to}.`); return { ...state, status: to, updatedAt: new Date().toISOString() }; }
module.exports = { M11_QUEUE_STATES, ALLOWED_TRANSITIONS, canTransition, transition };
