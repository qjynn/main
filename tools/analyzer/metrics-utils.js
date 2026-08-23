function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values) {
  return values.length ? sum(values) / values.length : 0;
}

function sortedNumbers(values) {
  return values.slice().sort((a, b) => a - b);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = sortedNumbers(values);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = sortedNumbers(values);
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function summary(values) {
  return {
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
    mean: mean(values),
    median: median(values),
    p25: percentile(values, 25),
    p75: percentile(values, 75),
    p90: percentile(values, 90)
  };
}

function countBy(values, keyFn) {
  const counts = new Map();
  for (const value of values) {
    const key = keyFn(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function percentage(count, total) {
  return total ? (count / total) * 100 : 0;
}

function round(value, places = 3) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

module.exports = {
  sum,
  mean,
  median,
  percentile,
  summary,
  countBy,
  percentage,
  round
};
