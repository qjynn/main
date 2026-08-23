# M7A.3 Production-Grid Gold Headroom Review

## Files Created/Modified

Created:
- `tools/experiments/production-headroom.js`
- `tests/m7a3-production-headroom.test.js`
- `analysis/m7a3-production-grids.json`
- `analysis/m7a3-production-grids.csv`
- `analysis/m7a3-threshold-probes.csv`
- `analysis/m7a3-scenario-summary.json`
- `analysis/m7a3-counterexamples.json`
- `M7A3_PRODUCTION_GRID_GOLD_HEADROOM_REVIEW.md`

Modified:
- `tools/solver/state-search.js`

No production rules, M6 acceptance criteria, difficulty labels, production rejection rules, or `game.js` behavior were changed. M7B was not implemented.

## Production Dataset

Analyzed 10 full 8x6 M6 baseline grids. All generated grids satisfy canonical inventory, include the intended exact Hexalink, pass M6 validation, are canonical Gold-certified, and replay successfully.

| Answer | Seed | Strategy |
|---|---:|---|
| WATERMELON | 810001 | M6_BASELINE |
| OSCILLATED | 810002 | M6_BASELINE |
| ABANDONING | 810003 | M6_BASELINE |
| ABSOLUTELY | 810004 | M6_BASELINE |
| ACCESSIBLE | 810005 | M6_BASELINE |
| ACCOUNTING | 810006 | M6_BASELINE |
| ADVENTURES | 810007 | M6_BASELINE |
| AGGRAVATED | 810008 | M6_BASELINE |
| AFTERTASTE | 810009 | M6_BASELINE |
| AFFORDABLE | 810010 | M6_BASELINE |

## Solver Reuse and Timeout Policy

M7A.3 reuses M4 enumeration, M5 `findGold`, M6 generation, M7A move-space metrics, and M7A.2 scoring hooks. `state-search.js` now supports an optional analysis-only `timeoutMs`; default calls remain canonical. If timeout is reached, probes return `exact: false` and `status: timeout`. Timeout is not counted as unreachable.

Production run command:

```sh
M7A3_COUNT=10 M7A3_TIMEOUT_MS=1500 node tools/experiments/production-headroom.js
```

Threshold probes: 100, 110, 120, 130, 140, 150, 160, 170, 180, 200.

## Gold Headroom Definition

`goldHeadroom = highestProvenReachableThreshold - 100`.

This is not a proven maximum score. Because upper probes timed out on several grids, `highestProvenReachableThreshold` is a lower bound when unresolved thresholds remain.

## Test Results

Command:

```sh
node --test tests/*.test.js
```

Result: 143 passed, 0 failed, 0 skipped, duration 5796.23721 ms.

## Canonical Results

All 10 production grids reached canonical Gold. Canonical minimum Gold turns were exactly 5 for every grid. Canonical Gold without Hexalink was reachable on all 10 grids.

## Gold Headroom Distribution

| Metric | Min | P25 | Median | P75 | P90 | Max |
|---|---:|---:|---:|---:|---:|---:|
| Highest proven reachable threshold | 130 | 140 | 140 | 150 | 160 | 160 |
| Gold headroom | 30 | 40 | 40 | 50 | 60 | 60 |
| Canonical min Gold turns | 5 | 5 | 5 | 5 | 5 | 5 |

Mean headroom: 44. Standard deviation: 9.165.

No first proven unreachable threshold was established; high probes timed out rather than proving unreachable. Probe statuses: 100-130 were reachable for all 10 grids; 140 was reachable for 9 and timed out for 1; 150 was reachable for 3 and timed out for 7; 160 was reachable for 2 and timed out for 8; 170/180/200 timed out for all 10.

## Narrow Scenario Summary

| Scenario | Exact Puzzles | Gold-Capable % | Median Min Turns | Median Solver Time |
|---|---:|---:|---:|---:|
| CANONICAL | 10 | 100 | 5 | 100.264 ms |
| GOLD_110 | 10 | 100 | 5 | 109.310 ms |
| GOLD_120 | 10 | 100 | 6 | 105.884 ms |
| GOLD_130 | 10 | 100 | 6 | 107.491 ms |
| REDUCED_LINES | 10 | 100 | 5 | 97.249 ms |
| REDUCED_LINES_GOLD_120 | 10 | 100 | 6 | 102.797 ms |
| HEXALINK_REQUIRED | 10 | 100 | 5 | 99.734 ms |
| HEXALINK_REQUIRED_GOLD_120 | 10 | 100 | 6 | 102.443 ms |

## Hexalink Importance

| Metric | Result |
|---|---:|
| Gold @100 without Hexalink | 100% |
| Gold @120 without Hexalink | 100% |
| Gold @100 with Hexalink required | 100% |
| Gold @120 with Hexalink required | 100% |
| Median Hexalink turn delta @100 | 0 |
| Median Hexalink turn delta @120 | 0 |

In this dataset, requiring the Hexalink did not increase the minimum turn count at 100 or 120.

## Line Bonus Sensitivity

| Scenario | Gold-Capable % | Median Min Turns |
|---|---:|---:|
| Canonical @100 | 100 | 5 |
| Reduced lines @100 | 100 | 5 |
| Canonical @120 | 100 | 6 |
| Reduced lines @120 | 100 | 6 |

Reduced line bonuses did not change reachability or median minimum turns on this dataset.

## Certificate Score Composition

Canonical certificates were dominated by base word points: base points were 95-100, Hexalink bonus was 10, and line bonuses were 0 for all canonical certificates.

Highest-threshold certificates showed where headroom comes from: base points 110-120, Hexalink bonus 10, and line bonuses from 10 to 40. Headroom above 140 often required at least one row or column bonus, but the 100-point Gold certificate did not.

## Move-Space Correlations

Measured Pearson correlations against `goldHeadroom`:

| Metric | Correlation |
|---|---:|
| uniqueTileMasks | 0.378 |
| highValueFirstMoves | n/a |
| tileParticipationSpread | 0.419 |

`highValueFirstMoves` was constant at 1 across the sample, so no correlation could be computed. Unique tile masks and tile participation spread showed weak-to-moderate positive correlation, not enough for a production rule by itself.

## Counterexamples

Found:
- Headroom >= 50: `ABANDONING`
- Similar mask counts but different headroom: `ABSOLUTELY` and `ACCESSIBLE`
- Similar headroom but different move-space metrics: `OSCILLATED` and `ABANDONING`

Not found:
- Headroom <= 10
- Gold @100 without Hexalink but Gold @120 impossible without Hexalink
- Gold @100 requiring Hexalink
- Reduced line bonuses making canonical Gold impossible
- Reduced line bonuses preserving Gold but increasing turns

## Answers to Q1-Q10

Q1: Proven headroom ranged from 30 to 60, median 40.

Q2: Yes, threshold 100 appears below what these generated grids can support; all grids reached at least 130.

Q3: Gold @100 without Hexalink was reachable on 100% of exact cases.

Q4: Gold @120 without Hexalink was reachable on 100% of exact cases.

Q5: Requiring Hexalink did not increase median minimum turns at 100 or 120.

Q6: Reduced row/column bonuses did not affect reachability or median turns at 100/120 in this sample.

Q7: Unique tile-mask count had weak-to-moderate positive correlation with headroom, about 0.378.

Q8: High-value first-move count could not be evaluated as a predictor here because it was constant.

Q9: No low-headroom production grid was found; the lowest proven headroom was 30.

Q10: Evidence is sufficient to proceed to M7B design, with caution: M7B should use these as lower-bound headroom findings and should continue collecting larger 8x6 samples with longer caps.

## Runtime and Limitations

The 10-grid run completed with a 1.5s per-probe cap. Total per-grid analysis was about 8.6s to 13.1s. High thresholds commonly timed out, so the exact maximum threshold was not proven. The current M7A.3 evidence is production-size and representative enough for M7B direction, but not a final statistical sample.

## Data Quality Assessment

This is stronger than M7A.2 because it uses real 8x6 M6 grids only. It is still limited by dataset size and unresolved high-threshold probes. The primary robust result is that all 10 generated grids have at least 30 points of proven Gold headroom and do not require Hexalink for Gold at 100 or 120.

## Git Status

```text
A  "Qjynn M7A.2 Codex Prompt \342\200\224 Scoring & Human-Accessibility Sensitivity Analysis.md"
 M tools/solver/state-search.js
?? M7A2_SCORING_HUMAN_ACCESSIBILITY_REVIEW.md
?? M7A3_PRODUCTION_GRID_GOLD_HEADROOM_REVIEW.md
?? "Qjynn M7A.3 Codex Prompt \342\200\224 Production-Grid Gold Headroom Analysis.md"
?? analysis/m7a2-counterexamples.json
?? analysis/m7a2-curves.csv
?? analysis/m7a2-scenarios.csv
?? analysis/m7a2-scenarios.json
?? analysis/m7a2-sensitivity-summary.json
?? analysis/m7a2-vocabulary-accessibility.csv
?? analysis/m7a3-counterexamples.json
?? analysis/m7a3-production-grids.csv
?? analysis/m7a3-production-grids.json
?? analysis/m7a3-scenario-summary.json
?? analysis/m7a3-threshold-probes.csv
?? tests/m7a2-sensitivity.test.js
?? tests/m7a3-production-headroom.test.js
?? tools/experiments/m7a2-batch.js
?? tools/experiments/production-headroom.js
?? tools/experiments/rule-sensitivity.js
?? tools/experiments/vocabulary-accessibility.js
```

## Git Diff Stat

```text
 tools/solver/state-search.js | 96 +++++++++++++++++++++++++++++++++++---------
 1 file changed, 76 insertions(+), 20 deletions(-)
```

Untracked M7A.2/M7A.3 files are listed in status and are not included by `git diff --stat`.

## Stop

M7B was not implemented. No production recommendation is made here.
