const fs = require('fs');
const { requireRealProvider } = require('../generator/m9-hybrid-selector.js');
function healthCheck(options = {}) {
  const reasons = [];
  if (options.expectedRulesHash && options.actualRulesHash && options.expectedRulesHash !== options.actualRulesHash) reasons.push('RULES_HASH_MISMATCH');
  if (options.expectedVocabularyHash && options.actualVocabularyHash && options.expectedVocabularyHash !== options.actualVocabularyHash) reasons.push('VOCABULARY_HASH_MISMATCH');
  if (options.frequencyFile) {
    try { requireRealProvider(options.frequencyFile); } catch (error) { reasons.push('REAL_FAMILIARITY_UNAVAILABLE'); }
  } else reasons.push('REAL_FAMILIARITY_UNAVAILABLE');
  if (options.validatorOk === false) reasons.push('VALIDATOR_REGRESSION');
  if (options.certificateReplayOk === false) reasons.push('CERTIFICATE_REPLAY_FAILURE');
  return { status: reasons.length ? 'BLOCKED' : 'HEALTHY', reasons, checkedAt: new Date().toISOString() };
}
if (require.main === module) { const frequencyFile = process.env.M81_FREQUENCY_FILE; console.log(JSON.stringify(healthCheck({ frequencyFile }), null, 2)); }
module.exports = { healthCheck };
