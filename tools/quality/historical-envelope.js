function percentile(values, fraction) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  return ordered.length ? ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * fraction))] : null;
}
function createHistoricalEnvelope(records = [], options = {}) {
  const fields = options.fields || ['regularMeanScore', 'regularGoldRate', 'strongMeanScore', 'rareWordDependency', 'uniquePlayableWords', 'hexalinkRate'];
  const warmupMinimum = options.warmupMinimum ?? 10;
  const envelope = Object.fromEntries(fields.map(field => {
    const values = records.map(record => Number(record[field])).filter(Number.isFinite);
    return [field, { p10: percentile(values, .1), p90: percentile(values, .9), median: percentile(values, .5), count: values.length }];
  }));
  return { mode: records.length >= warmupMinimum ? 'ACTIVE' : 'WARMUP', historyCount: records.length, warmupMinimum, envelope };
}
function outsideEnvelope(value, band, tolerance = 0) { return Number.isFinite(value) && band?.p10 !== null && (value < band.p10 - tolerance || value > band.p90 + tolerance); }
module.exports = { percentile, createHistoricalEnvelope, outsideEnvelope };
