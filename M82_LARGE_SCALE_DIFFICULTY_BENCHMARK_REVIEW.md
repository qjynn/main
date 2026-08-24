# M8.2 Large-Scale Puzzle Difficulty Benchmark & Ranking Stability

## Decision

**B — M8.1 remains analysis-only.** The frozen model is useful for comparative
profiling, especially with mean/median score, but the benchmark is only 50
grids, Gold-rate ordinal rankings are weaker than score rankings, and parameter
perturbations have not been evaluated across the full population. No M9 work,
M7B changes, or production integration was started.

## Scope and Frozen Versions

M8.2 adds analysis infrastructure only. The M8.1 real-frequency configuration
was frozen:

| item | value |
|---|---|
| simulator | `m8.1` |
| player model | `m8.1.players.0` |
| familiarity provider | `wordfreq` |
| source version | upstream `v3.2` |
| package-reported version | `3.1.1` |
| source revision | `42233e6c36ce792031bcccfa17cdd0cec9af5fa7` |
| normalization | `zipf-linear-v1` |
| fallback | false |

The exact requested PyPI 3.2.0 release was unavailable; this is documented in
the M8.1 review and all M8.2 provenance fields. The six sanity words returned
`basis: "frequency"` before benchmarking.

## Files

Created:

- `tools/simulator/benchmark-m82.js`
- `tests/m82-benchmark.test.js`
- `analysis/m82-puzzle-manifest.csv`
- `analysis/m82-primary-results.csv`
- `analysis/m82-replicate-stability.csv`
- `analysis/m82-puzzle-measurement-stability.csv`
- `analysis/m82-band-stability.csv`
- `analysis/m82-parameter-robustness.csv`
- `analysis/m82-ranking-stability-matrix.csv`
- `analysis/m82-metric-correlations.csv`
- `analysis/m82-metric-redundancy.csv`
- `analysis/m82-regular-vs-strong.csv`
- `analysis/m82-hexalink-difficulty.csv`
- `analysis/m82-rare-word-dependency.csv`
- `analysis/m82-extreme-puzzles.csv`
- `analysis/m82-ranking-outliers.csv`
- `analysis/m82-convergence.csv`
- `analysis/m82-performance.csv`
- `analysis/m82-summary.json`
- `M82_LARGE_SCALE_DIFFICULTY_BENCHMARK_REVIEW.md`

No production files were modified. The existing local frequency export remains
untracked third-party analysis data.

## Benchmark Population

| property | result |
|---|---:|
| target puzzles | 100 |
| distinct grids | 50 |
| distinct answers | 50 |
| existing M7B grids | 0 |
| existing/generation M6 grids | 50 |
| primary runs/model/replicate | 500 |
| replicates | 3: A, B, C |
| primary models | REGULAR, STRONG |
| secondary models | CASUAL, EXPERT on 20 puzzles |
| total simulations | 202,500 |

The 10 existing M7A.3 grids were retained with their source metadata. Forty
additional distinct 10-letter answers were deterministically selected from
Vocabulary 1.0 and generated through the approved M6 generator, each requiring
successful Gold certification. Grid hashes were checked for uniqueness. No
duplicate simulations were counted as distinct puzzles.

## Primary Outcomes

Rates below are averages across the 50-grid population and are synthetic-model
outcomes, not human population probabilities.

| model | Gold min / P25 / median / P75 / max | median-score range | mean score | Gold | Silver | Bronze | Hexalink |
|---|---|---:|---:|---:|---:|---:|
| REGULAR | 3.5% / 6.7% / 8.1% / 11.1% / 20.1% | 77.7–87.3 | 82.95 | 8.91% | 79.90% | 11.18% | 23.44% |
| STRONG | 10.1% / 17.5% / 21.7% / 25.1% / 42.2% | 83.3–97.0 | 90.33 | 21.38% | 76.29% | 2.33% | 15.04% |

The 100-point threshold remains non-trivial under both frozen primary models.
The 20-puzzle secondary subset retained the broader skill-ordering diagnostic;
it was not used to claim population-level Casual/Expert estimates.

## Replicate Stability

Pairwise Spearman correlations across 50-puzzle rankings were:

| model/metric | mean | min | max |
|---|---:|---:|---:|
| REGULAR Gold | .856 | .827 | .884 |
| REGULAR median score | .810 | .808 | .811 |
| REGULAR mean score | .923 | .913 | .931 |
| STRONG Gold | .896 | .874 | .917 |
| STRONG median score | .901 | .861 | .921 |
| STRONG mean score | .931 | .900 | .957 |

Mean score is the most stable REGULAR measure; STRONG mean and median score
are similarly strong. Gold rate is useful but noisier. Exact rank is therefore
less defensible than broad bands: same-band rates ranged from 60% to 86%, while
same-or-adjacent-band rates were 98–100% and major band movement was 0–2%.

## Parameter Robustness

The deterministic robustness subset contains 20 puzzles. REGULAR mean-score /
Gold-rate averages were:

| setting | mean score | Gold |
|---|---:|---:|
| baseline | 84.19 | 11.65% |
| candidate cap 12 | 83.88 | 10.25% |
| candidate cap 40 | 83.71 | 10.80% |
| temperature 0.75x | 83.83 | 10.95% |
| temperature 1.25x | 83.55 | 10.15% |
| restrictive familiarity | 83.07 | 8.90% |
| permissive familiarity | 84.40 | 11.90% |

Candidate-cap behavior supports a practical plateau around the previously
observed 18–25 region. Temperature and familiarity curves change absolute
outcomes modestly; they should be treated as ranking-risk factors. The ranking
matrix includes A/B/C primary views; robustness views are represented in the
parameter artifact, but the 20-puzzle subset is too small for full-population
claims.

## REGULAR vs STRONG and Hexalink

REGULAR-vs-STRONG Gold-rate rank correlation was **.697**; median-score rank
correlation was **.824**. Strong generally agrees on broad score difficulty but
not perfectly on Gold outcomes. Strong-minus-Regular Gold and median-score gaps
are recorded per puzzle in `analysis/m82-regular-vs-strong.csv`.

Hexalink is intentionally separate from score difficulty. Primary replicate
stability for REGULAR Hexalink rate was lower than score metrics (.605–.754),
and STRONG Hexalink rate was especially unstable (.193–.359). The separate
artifact allows puzzles that are easy to score but hard to recognize as
Hexalink, or vice versa, to remain visible.

## Mathematical Predictors

Cheap M7A-style metrics were computed without reviving expensive exact
minimum-turn searches. Strongest observed correlations with synthetic outcome
were:

| metric | REGULAR Gold | STRONG Gold | interpretation |
|---|---:|---:|---|
| raw legal moves | .479 | .694 | moderate / strong |
| unique playable words | .524 | .621 | moderate / strong |
| unique tile masks | .407 | .636 | moderate / strong |
| unique skeletons | .478 | .610 | moderate / strong |
| Hexalink participation percentage | available in artifact | available in artifact | separate geometry signal |

Legal-move density is the strongest inexpensive predictor in this sample,
especially for STRONG. The redundancy artifact shows raw legal moves,
playable words, skeletons, and tile masks are highly correlated, often above
.85. M9 should not combine all of them. These are descriptive relationships,
not causal proof. No exact M7B.1 metrics were recomputed.

## Rare Words and Difficulty Mechanisms

`analysis/m82-rare-word-dependency.csv` carries the approved M8.1 threshold
methodology for REGULAR and STRONG. The benchmark supports separating vocabulary
access from geometry: known/noticed moves and rare-word dependency describe
vocabulary pressure, while legal-move density, tile masks, and Hexalink
geometry describe board opportunity. Strategic tile-consumption and
scoring-opportunity effects remain descriptive and are not causally identified
by this experiment.

The ten easiest and ten hardest REGULAR puzzles by Gold rate, plus legal-move
and mathematical metrics, are in `analysis/m82-extreme-puzzles.csv`. No
M7B-vs-M8.1 outliers were available because the population contained no M7B
grids; `analysis/m82-ranking-outliers.csv` is explicitly empty rather than
inventing comparisons.

## Convergence and Cost

Ten representative puzzles were evaluated at 100, 250, 500, and 1,000 runs.
The convergence artifact shows median score changing little between 500 and
1,000 in most rows, while Gold rate remains visibly quantized at lower runs.
For future comparative profiling, 500 remains the defensible primary setting;
100/250 can be used only as a fast approximation after checking ordering.

The full benchmark completed in 960,536 ms for 202,500 simulations, or about
4.74 ms per simulation. A hypothetical 10-candidate REGULAR evaluation would
be approximately 4.7 seconds at 100 runs, 11.9 seconds at 250 runs, or 23.7
seconds at 500 runs, excluding candidate generation and I/O. A two-stage
M7B-cheap-filter then M8.1-profile design is computationally plausible, but no
selector or production run-count recommendation was implemented.

## Holdout and Composite Signals

The benchmark has 50 puzzles, below the prompt's 70-puzzle threshold for a
meaningful 70/30 holdout. No holdout claim was made and no composite was tuned.
The only M9-facing analytical recommendation is to investigate a small,
interpretable set: REGULAR mean/median score, REGULAR Gold rate, STRONG Gold
rate, and a separate Hexalink measure. Final weights and selection logic belong
to M9.

## Required Answers

1. **Distinct puzzles:** 50.
2. **REGULAR replicate stability:** strongest for mean score (.923 mean
   Spearman), moderate for Gold (.856).
3. **STRONG replicate stability:** mean score .931 and Gold .896 mean
   Spearman; stronger than REGULAR Gold stability.
4. **Most stable measure:** mean score for REGULAR; mean/median are close for
   STRONG. Gold rate is less stable.
5. **Bands:** substantially more stable than exact ranks; 98–100% remained in
   the same or adjacent band.
6. **Candidate cap:** modest impact on the 20-puzzle subset; 12 vs 40 is not
   identical, but rank-wide claims need a larger perturbation set.
7. **Temperature:** modest absolute and ranking impact in the tested range.
8. **Familiarity curves:** the largest tested absolute sensitivity, still
   suitable for comparative analysis with caution.
9. **REGULAR/STRONG agreement:** .697 Gold and .824 median-score Spearman.
10. **Score/Hexalink:** distinct dimensions; Hexalink rates are less stable.
11. **Rare words:** dependency is available per puzzle and should be treated as
    a vocabulary-accessibility explanatory signal, not a sole difficulty score.
12. **Best predictors:** legal-move density, playable-word count, and tile-mask
    count, with strong redundancy among them.
13. **Simulation reduction:** cheap metrics may narrow candidates, but current
    correlations do not justify replacing synthetic profiling.
14. **M7B disagreements:** unavailable because no M7B grids were locally
    available; no outliers were fabricated.
15. **Gold threshold:** remains non-trivial: 8.91% REGULAR and 21.38% STRONG
    aggregate Gold in this synthetic benchmark.
16. **500 runs:** sufficient for stable mean-score ordering in this sample;
    Gold-rate estimates benefit from 1,000 runs.
17. **Ten-candidate cost:** approximately 4.7/11.9/23.7 seconds at
    100/250/500 REGULAR simulations per candidate.
18. **Two-stage selector:** computationally practical as a future design, not
    implemented here.
19. **M9 secondary signal:** provisionally yes for score-based comparative use,
    not as an absolute human predictor or sole selector.
20. **Signals for M9:** investigate REGULAR mean/median score, REGULAR Gold,
    STRONG Gold, and separate Hexalink difficulty; do not combine redundant
    move-density metrics without further validation.

## Safety, Tests, and Git

Required M8.2 infrastructure tests cover duplicate/seed/ranking/band/holdout
behavior, real-provider enforcement, frozen model versions, perturbation
isolation, and metric determinism. Final full-suite result: **207 passed, 0
failed, 0 cancelled, 0 skipped** using `node --test tests/*.test.js`.

No diffs were found in `game.js`, `qjynn-rules.js`, `qjynn-words-v1.0.txt`, M6
generation rules, M7B ranking, medal thresholds, six-turn rules, or Hexalink
rules. No commit was created.

The final Git snapshot was:

```text
git status --short
A  "Qjynn M8 Codex Prompt — Synthetic Player Modeling, Monte Carlo Simulation & Difficulty Profiling.md"
 M tools/simulator/monte-carlo.js
 M tools/simulator/move-discovery.js
 M tools/simulator/move-ranking.js
 M tools/simulator/player-models.js
 M tools/simulator/simulate-game.js
?? M81_REAL_FAMILIARITY_CALIBRATION_REVIEW.md
?? M82_LARGE_SCALE_DIFFICULTY_BENCHMARK_REVIEW.md
?? analysis/m82-*.csv
?? analysis/m82-summary.json
?? tests/m82-benchmark.test.js
?? tools/simulator/benchmark-m82.js
?? data/familiarity/wordfreq-en-large.json

git diff --stat
 tools/simulator/monte-carlo.js    | 29 ++++++++++++++++++++++-
 tools/simulator/move-discovery.js | 18 +++++++++-----
 tools/simulator/move-ranking.js   | 14 +++++++++--
 tools/simulator/player-models.js  | 49 ++++++++++++++++++++++++++++++++-------
 tools/simulator/simulate-game.js  | 15 +++++++++---
 5 files changed, 105 insertions(+), 20 deletions(-)
```

The abbreviated lines above represent the full untracked artifact/prompt list
shown by `git status --short`; project-owned M8.2 files remain separate from
the local third-party frequency export.
