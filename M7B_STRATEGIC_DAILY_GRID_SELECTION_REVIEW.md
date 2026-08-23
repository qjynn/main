# M7B Strategic Daily Grid Selection Review

## Files Created/Modified

Created:
- `tools/generator/candidate-pool.js`
- `tools/generator/candidate-ranker.js`
- `tools/generator/strategic-selector.js`
- `tests/generator-candidate-ranker.test.js`
- `tests/generator-strategic-selector.test.js`
- `analysis/m7b-candidates.csv`
- `analysis/m7b-selected-puzzles.csv`
- `analysis/m7b-selection-comparison.csv`
- `analysis/m7b-six-turn-analysis.csv`
- `analysis/m7b-ranking-ablation.csv`
- `analysis/m7b-pool-sensitivity.csv`
- `analysis/m7b-summary.json`
- `M7B_STRATEGIC_DAILY_GRID_SELECTION_REVIEW.md`

Modified:
- `tools/experiments/production-headroom.js`: fixed `null` timeout handling so `null` means no timeout.

No gameplay rules, `game.js`, Vocabulary 1.0, scoring constants, medal thresholds, consonant inventory, turn count, or Hexalink legality were changed.

## Architecture

M7B adds a deterministic selection layer above M6:

1. Generate candidate pool with M6-compatible generation.
2. Reject candidates failing M6 hard gates.
3. Deduplicate by canonical grid hash.
4. Determine or bound canonical Gold turns.
5. Shortlist by Gold-turn signal.
6. Run headroom, no-Hexalink, and M7A move-space analysis on the shortlist.
7. Rank with an auditable lexicographic comparator.
8. Return public puzzle plus private generation manifest.

M6 `generatePuzzle()` remains independently usable.

## Determinism and Versioning

Candidate seeds are derived from:

```text
masterSeed | candidateIndex | generatorVersion | selectorVersion
```

Selector version: `m7b.0`. Candidate generator: `M6_BASELINE`.

## Hard Gates

Only established M6 gates are hard gates: valid answer, valid 8x6 board, canonical inventory, exact Hexalink, canonical Gold certification, and certificate replay. Strategic properties are ranking signals, not rejection rules.

## Ranking Semantics

Ranking is lexicographic:

1. Higher canonical Gold turns.
2. Lower proven headroom evidence.
3. Fewer unresolved headroom probes.
4. Hexalink dependency or relevance.
5. Move-space sanity.
6. Tile participation balance.
7. Hexalink geometry.
8. Candidate index.

`compareCandidates()` and `comparisonReasons()` preserve audit reasons such as “both require 5 turns; candidate 1 has headroom 30 vs candidate 0 headroom 40.”

## Uncertainty Handling

Headroom probe statuses remain distinct: `reachable`, `unreachable`, `timeout`, and not tested. A timeout is never treated as unreachable.

In the validation run, exact minimum-turn proof was too expensive for most candidates. M7B now preserves M6 certificate turns as a non-exact upper-bound signal when shorter-turn proof times out. This keeps generation usable but means the six-turn feasibility result is inconclusive for this bounded run.

## Validation Dataset

Attempted 20 Daily answers with 3 candidates each. Eighteen answers succeeded; `ANCHOVIES` and `APOLOGIZED` failed M6 input gates in this run.

Configuration:

```text
candidatePoolSize = 3
shortlistSize = 3
headroomThresholds = 110,120,130,140,150
analysisTimeoutMs = 500
```

Total candidates generated: 54. Unique candidates: 54. M6-valid and Gold-certified candidates: 54.

The requested 20 answers x 250 candidates experiment was attempted at smaller scales but was not practical in-session. A 20 x 10 run exceeded the useful runtime window; the completed evidence set is therefore smaller than the target.

## Six-Turn Gold Findings

Candidate turn-signal distribution:

| Turns | Candidates |
|---:|---:|
| 1 | 0 |
| 2 | 0 |
| 3 | 1 |
| 4 | 7 |
| 5 | 46 |
| 6 | 0 |

Important caveat: only 1 of 54 ranked candidate minimum-turn values was exactly proven within the bounded validation; most are M6 certificate upper bounds after shorter-turn proof timed out. No six-turn candidate was observed, but this should not be treated as proof that six-turn grids are rare.

## Headroom Findings

Selected-candidate headroom lower bound:

| Metric | Value |
|---|---:|
| Min | 30 |
| Median | 40 |
| Mean | 38.333 |
| P75 | 40 |
| Max | 50 |

Candidate pooling selected lower-headroom candidates for several answers, for example `OSCILLATED` moved from headroom 40 to 30.

## Hexalink Dependency

Selected Gold without Hexalink rate: 100%. No candidate in this bounded run demonstrated canonical Gold requiring the Hexalink. This is consistent with M7A.3 and suggests Hexalink dependency should not become a hard gate yet.

## M6 vs M7B

| Answer | M6 Turns | M7B Turns | M6 Headroom | M7B Headroom | M6 Gold w/o Hex | M7B Gold w/o Hex |
|---|---:|---:|---:|---:|---|---|
| WATERMELON | 5 | 5 | 40 | 40 | true | true |
| OSCILLATED | 5 | 5 | 40 | 30 | true | true |
| ABANDONING | 5 | 5 | 30 | 30 | true | true |
| ABSOLUTELY | 5 | 5 | 50 | 50 | true | true |
| ACCESSIBLE | 5 | 5 | 40 | 30 | true | true |
| ACCOUNTING | 5 | 5 | 40 | 40 | true | true |
| ADVENTURES | 4 | 5 | 50 | 40 | true | true |

Full comparison is in `analysis/m7b-selection-comparison.csv`.

## Ranking Ablation

Across 18 selected answers:
- Headroom changed the selected candidate for multiple answers.
- Secondary full-ranking signals changed selection in 12 rows in the bounded artifact.
- This indicates secondary signals do affect selection, but the small pool size and non-exact turn evidence limit conclusions.

## Pool Sensitivity

For `WATERMELON`:

| Pool | Selected Turns | Headroom Lower Bound | Runtime |
|---:|---:|---:|---:|
| 3 | 5 | 40 | 4770.916 ms |
| 5 | 5 | 50 | 5485.845 ms |

This small sample does not prove that larger pools improve quality; it shows runtime grows quickly and larger pools may select differently.

## Performance

Validation median total selection time: 5073.402 ms per answer for a 3-candidate pool. Larger attempted pools were too slow for this session:
- 20 answers x 25 candidates was not run to completion.
- 20 answers x 10 candidates was still impractical before adding non-exact fallback.

Recommended provisional defaults for offline generation:
- `candidatePoolSize`: 25 for near-term use, 100 only for overnight/offline batch jobs.
- `shortlistSize`: 10-20.
- `headroomThresholds`: 110, 120, 130, 140, 150.
- `analysisTimeoutMs`: 500-1500, with timeout uncertainty preserved.

## Tests

Command:

```sh
node --test tests/*.test.js
```

Result: 168 passed, 0 failed, 0 skipped, duration 6956.878902 ms.

New tests cover deterministic seed derivation, deterministic pool generation, duplicate-grid detection, canonical inventory preservation, exact Hexalink preservation, unchanged M6 gates, invalid-candidate rejection, shortlist sizing, expensive-analysis staging, winner membership, deterministic selection, fallback, structured failure, public/private privacy, private manifest evidence, production safety hashes, and ranker semantics.

## Answers to Q1-Q10

Q1: Six-turn grids were not observed in the bounded run.

Q2: Observed six-turn rate was 0/54, but most minimum-turn values were not exactly proven, so this is not definitive.

Q3: Candidate pooling improved selected turn signal for `ADVENTURES` from 4 to 5; most selected candidates remained 5-turn signals.

Q4: Yes, candidate pooling found lower headroom for some answers, including `OSCILLATED` and `ACCESSIBLE`.

Q5: No, no selected candidate required Hexalink for Gold.

Q6: Headroom and secondary metrics affected winner selection; exact turn ranking was constrained by timeout uncertainty.

Q7: Move-space and geometry signals are useful tie-breakers, but evidence is insufficient for hard gates.

Q8: Current evidence supports small pools for interactive use and larger pools only offline. A 25-candidate default is conservative.

Q9: M7B selected measurably stronger candidates in some cases, but not consistently enough to claim broad superiority from this small run.

Q10: No ranking criterion should become a hard gate yet.

## Known Limitations

The validation experiment is smaller than requested. Minimum-turn exactness remains the main bottleneck. Two validation answers failed M6 hard gates. Human familiarity is intentionally not used. No difficulty labels are produced.

## Git Status

```text
 M tools/experiments/production-headroom.js
?? M7B_STRATEGIC_DAILY_GRID_SELECTION_REVIEW.md
?? "Qjynn M7B Codex Prompt \342\200\224 Strategic Daily Grid Candidate Generation, Ranking & Selection.md"
?? analysis/m7b-candidates.csv
?? analysis/m7b-pool-sensitivity.csv
?? analysis/m7b-ranking-ablation.csv
?? analysis/m7b-selected-puzzles.csv
?? analysis/m7b-selection-comparison.csv
?? analysis/m7b-six-turn-analysis.csv
?? analysis/m7b-summary.json
?? tests/generator-candidate-ranker.test.js
?? tests/generator-strategic-selector.test.js
?? tools/generator/candidate-pool.js
?? tools/generator/candidate-ranker.js
?? tools/generator/strategic-selector.js
```

## Git Diff Stat

```text
 tools/experiments/production-headroom.js | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Untracked M7B files are listed in status and are not included by `git diff --stat`.

## Stop

M7B implementation and bounded validation artifacts are complete. No subsequent milestone was started.
