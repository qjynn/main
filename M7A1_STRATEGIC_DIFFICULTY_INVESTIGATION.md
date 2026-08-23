# M7A.1 Strategic Difficulty Investigation

## Summary

M7A.1 adds experimental consonant-placement tooling to investigate which measurable grid properties make Qjynn puzzles more or less strategically permissive. It does not implement M7B quality thresholds, production rejection rules, difficulty labels, or changes to the M6 generator.

## Files Created/Modified

Created:

- `tools/experiments/placement-strategies.js`
- `tools/experiments/strategic-experiment.js`
- `tools/experiments/experiment-batch.js`
- `tests/strategic-experiment.test.js`
- `analysis/m7a1-input.csv`
- `analysis/m7a1-strategy-experiment.json`
- `analysis/m7a1-strategy-experiment.csv`
- `M7A1_STRATEGIC_DIFFICULTY_INVESTIGATION.md`

Modified:

- `M7A_IMPLEMENTATION_REVIEW.md`: replaced ambiguous “Hexalink required Gold” wording with `goldReachableWithHexalinkRequired`.

## Metric Naming Correction

The analyzer already exposes:

```js
goldReachableWithoutHexalink
goldReachableWithHexalinkRequired
```

M7A.1 keeps those exact names. Tests verify that the ambiguous `hexalinkRequiredGold` field is not present.

## Experimental API

```js
const { generateExperimentalPuzzle } = require('./tools/experiments/strategic-experiment');

const result = generateExperimentalPuzzle({
  answer,
  clue,
  date,
  seed,
  strategy,
  maxAttempts
}, wordIndex, options);
```

Return shape:

```js
{
  ok,
  strategy,
  puzzle,
  privateCertification,
  generationStats,
  strategyMetadata
}
```

Each generated puzzle is structurally validated, Gold-certified with M5 exact `findGold`, and replay-verified.

## Strategy Families

Implemented experimental strategies:

- `RANDOM_BASELINE`: M6-like random fill behavior.
- `COMMON_CONSONANT_CLUSTERED`: clusters `N/R/T/L/S/D` plus `C/H`.
- `COMMON_CONSONANT_DISPERSED`: spreads common consonants across lower-degree/varied cells.
- `RARE_LETTER_SEPARATED`: places `J/K/Q/X/Z` into lower-connectivity positions first.
- `HEXALINK_CENTRIC`: places common letters near the Hexalink corridor.
- `HEXALINK_ISOLATED`: places rare letters near the Hexalink corridor.
- `DEGREE_BALANCED`: maps high-count letters across high-degree cells.
- `HIGH_VALUE_PATH_SUPPRESSED`: samples random candidates and chooses the one with fewer high-value first moves.

All strategies preserve the canonical 48-tile inventory from `qjynn-rules.js` and the exact required Hexalink.

## Batch Methodology

Batch input:

```text
WATERMELON, OSCILLATED, ABANDONING
```

Each answer was generated under all eight strategies:

```text
3 answers x 8 strategies = 24 experimental grids
```

Analysis options:

```js
{
  goldViableFirstMoveLimit: 15,
  maxGoldCertificates: 5,
  hexalinkAnalysisMaxStates: 7500
}
```

The Gold-viable first-move metric is bounded and reports only the first 15 solver-relevant first moves per puzzle.

## Batch Results

Saved artifacts:

- `analysis/m7a1-strategy-experiment.json`
- `analysis/m7a1-strategy-experiment.csv`
- `analysis/m7a1-input.csv`

Run result:

```text
results: 24
successes: 24
failures: 0
```

Strategy summary:

| Strategy | Mean Unique Words | Mean Unique Masks | Mean High-Value First Moves | Mean Tile Spread | Gold Without Hexalink Rate | Bounded Gold-Viable First-Move % |
|---|---:|---:|---:|---:|---:|---:|
| RANDOM_BASELINE | 5838.0 | 2021.3 | 388.7 | 2303.7 | 100% | 100% |
| COMMON_CONSONANT_CLUSTERED | 6665.0 | 3166.7 | 950.7 | 3188.7 | 100% | 100% |
| COMMON_CONSONANT_DISPERSED | 5889.3 | 2093.3 | 411.3 | 2085.7 | 100% | 100% |
| RARE_LETTER_SEPARATED | 6546.3 | 2412.7 | 505.0 | 2380.7 | 100% | 100% |
| HEXALINK_CENTRIC | 6431.7 | 2933.0 | 807.0 | 3134.3 | 100% | 100% |
| HEXALINK_ISOLATED | 6271.7 | 2086.0 | 421.3 | 2440.7 | 100% | 100% |
| DEGREE_BALANCED | 7370.3 | 3838.7 | 1174.3 | 4217.0 | 100% | 100% |
| HIGH_VALUE_PATH_SUPPRESSED | 5267.7 | 1768.3 | 274.3 | 1819.0 | 100% | 100% |

## Findings

Common-consonant clustering and degree-balanced placement significantly increased strategic permissiveness metrics: unique words, unique masks, high-value first moves, and tile participation spread all rose.

`HIGH_VALUE_PATH_SUPPRESSED` reduced the measured first-move opportunity surface relative to baseline:

```text
mean high-value first moves: 274.3 vs 388.7 baseline
mean unique words: 5267.7 vs 5838.0 baseline
mean unique masks: 1768.3 vs 2021.3 baseline
```

However, every tested strategy still had:

```text
goldReachableWithoutHexalink: true
bounded Gold-viable first-move percentage: 100%
```

This suggests that simply rearranging consonants with the current inventory and vocabulary still leaves many exact Gold routes. More targeted constraints or deeper exact first-move analysis may be needed before M7B thresholds are defensible.

## Tests

Command:

```bash
node --test tests/*.test.js
```

Result:

```text
tests 109
pass 109
fail 0
duration_ms 5741.907778
```

M7A.1 tests cover:

- required strategy exports;
- canonical inventory preservation for every strategy;
- Hexalink placement preservation;
- structural validity and Gold certification;
- deterministic strategy generation;
- strategy metadata;
- structured unknown-strategy failure;
- explicit `goldReachableWithHexalinkRequired` naming;
- batch execution and artifact writing.

## Known Limitations

- Gold-viable first-move analysis in the experiment batch is bounded to 15 openings, not exhaustive.
- The placement heuristics are intentionally simple and experimental.
- `HIGH_VALUE_PATH_SUPPRESSED` samples candidate grids rather than performing an exhaustive optimization.
- All 24 experimental grids still certified Gold, so this milestone identifies metric movement more than it produces scarce-Gold puzzles.
- No production generator criteria were changed.

## Next Data Questions

For M7B planning, the most useful follow-up measurements appear to be:

- exhaustive Gold-viable first-move percentage on smaller or optimized samples;
- whether suppressing high-value first moves below a stronger target can still certify Gold;
- whether unique mask count or high-value first-move count best predicts strategic permissiveness;
- whether `goldReachableWithoutHexalink` can be made false by placement alone without damaging Gold certification.

## Git Diff Summary

`git status --short` at report time:

```text
 M M7A_IMPLEMENTATION_REVIEW.md
A  "Qjynn M7A Codex Prompt \342\200\224 Puzzle Analysis & Metrics.md"
?? "Qjynn M7A.1 Codex Prompt \342\200\224 Strategic Difficulty Investigation.md"
?? M7A1_STRATEGIC_DIFFICULTY_INVESTIGATION.md
?? analysis/m7a1-input.csv
?? analysis/m7a1-strategy-experiment.csv
?? analysis/m7a1-strategy-experiment.json
?? tests/strategic-experiment.test.js
?? tools/experiments/
```

`git diff --stat` at report time:

```text
 M7A_IMPLEMENTATION_REVIEW.md | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```

The diff stat only includes tracked files. New M7A.1 files are currently untracked and have not been staged.
