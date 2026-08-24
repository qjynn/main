# M8.1 Real Frequency Export & Recalibration Review

## Status

**REAL FREQUENCY CALIBRATION COMPLETED.** M8.1 remains simulator/analysis
only. No M8.2, M9, production candidate-selection integration, or gameplay-rule
changes were started.

## Source and Provenance

The requested PyPI `wordfreq==3.2.0` was unavailable: the configured index
ended at 3.1.1, and upstream has no 3.2.0 tag. The verified upstream `v3.2`
tag was used instead; its package metadata reports 3.1.1. This discrepancy is
preserved in every artifact rather than relabeled as 3.2.0.

- source: `wordfreq` upstream repository
- source version: `v3.2`
- source revision: `42233e6c36ce792031bcccfa17cdd0cec9af5fa7`
- package-reported version: `3.1.1`
- language/list: English `large`
- normalization: `zipf-linear-v1`, Zipf 1.0..8.0 mapped linearly to 0..1
- export: `data/familiarity/wordfreq-en-large.json`, 289,023 records, 14 MB
- fallback used: `false` for the real-frequency run

The exporter and local-generation instructions remain in
`scripts/export-wordfreq.py` and `data/familiarity/README.md`. The generated
third-party data is retained locally for analysis and is not treated as a
project-owned corpus. The README preserves the upstream Apache-2.0 package
and separate source-data attribution/CC BY-SA 4.0 notes.

## Coverage

The audit covered all 41,814 M4-indexed Qjynn words:

| length | indexed | matched | missing | coverage |
|---|---:|---:|---:|---:|
| 2 | 102 | 102 | 0 | 100.00% |
| 3 | 673 | 673 | 0 | 100.00% |
| 4 | 2,797 | 2,796 | 1 | 99.96% |
| 5 | 4,987 | 4,970 | 17 | 99.66% |
| 6 | 7,251 | 7,197 | 54 | 99.26% |
| 7 | 8,479 | 8,369 | 110 | 98.70% |
| 8 | 8,005 | 7,868 | 137 | 98.29% |
| 9 | 6,137 | 6,021 | 116 | 98.11% |
| 10 | 3,383 | 3,322 | 61 | 98.20% |
| **all** | **41,814** | **41,318** | **496** | **98.81%** |

Representative unmatched words include `abrades`, `acidifies`, `agendum`,
`allograph`, `aluminize`, `ammeters`, `armilla`, `bireme`, `caladiums`,
`carjacks`, and `cayuses`. A rough inspection suggests 202 possible inflected
forms, 152 long/rare entries, 111 general corpus gaps, and 31 entries with
rare orthography. These are diagnostic labels only, not validity judgments;
all 496 remain valid Qjynn vocabulary words.

## Distribution and Sanity

Normalized familiarity percentiles for matched words were:

| population | P1 | P5 | P10 | P25 | median | P75 | P90 | P95 | P99 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| all | .036 | .099 | .140 | .207 | .281 | .367 | .460 | .520 | .620 |

The complete by-length distribution is in
`analysis/m81-familiarity-distribution.csv`; it is non-degenerate and not
reversed or constant. Sanity lookups all returned `basis: "frequency"`:

| word | Zipf | rank | normalized |
|---|---:|---:|---:|
| HOUSE | 5.71 | 174 | .673 |
| WATER | 5.52 | 266 | .646 |
| MONEY | 5.64 | 197 | .663 |
| PLANT | 4.89 | 1,334 | .556 |
| MARKET | 5.29 | 486 | .613 |
| FAMILY | 5.66 | 192 | .666 |

Several lower-frequency valid words in the source audit included `bonier`,
`achoo`, `cowslip`, `zairian`, `opaline`, `carouse`, `gaudier`, `aerostats`,
and `anorthite`. No rankings were manually adjusted.

## Calibration Method

The paired run used all 10 genuinely distinct M7A.3 production grids, not
duplicates, with identical seeds for `M8_HEURISTIC_BASELINE` and
`M81_FREQUENCY_MODEL`. Each bounded model received 500 runs per puzzle.
ORACLE is a canonical reference row, not a human calibration target. The
M6-vs-M7B file remains explicitly empty because paired source grids are not
available.

## Aggregate Player Outcomes

Values are averages across the 10 puzzles; rates are proportions.

| model/system | mean | median | Gold | Silver | Bronze | Hexalink |
|---|---:|---:|---:|---:|---:|---:|
| Casual baseline | 86.54 | 86.40 | 16.66% | 73.50% | 9.82% | 49.78% |
| Casual real | 67.71 | 68.40 | 2.28% | 44.84% | 47.92% | 42.16% |
| Regular baseline | 112.60 | 112.30 | 85.44% | 14.50% | .06% | 73.16% |
| Regular real | 82.71 | 81.80 | 8.48% | 79.36% | 12.14% | 23.94% |
| Strong baseline | 123.02 | 122.60 | 98.14% | 1.86% | 0% | 78.72% |
| Strong real | 89.51 | 88.60 | 19.50% | 78.04% | 2.46% | 13.98% |
| Expert baseline | 130.44 | 130.20 | 99.72% | .28% | 0% | 79.90% |
| Expert real | 100.87 | 99.60 | 52.34% | 47.62% | .04% | 6.56% |

Regular changed from mean 112.60 / Gold 85.44% / Hexalink 73.16% to mean
82.71 / Gold 8.48% / Hexalink 23.94%. Strong and Expert saturation was
substantially reduced, without changing their configured skill curves to force
separation.

Mean known/noticed moves for baseline versus real frequency were respectively:
Casual 5.71/6.34 vs .04/1.64; Regular 21.81/22.80 vs .24/8.24; Strong
53.12/55.25 vs 5.74/29.10; Expert 110.78/112.64 vs 47.88/86.59. Real
familiarity also reduced mean played-word familiarity for Casual, Regular, and
Strong; Expert remained .634 versus .611 baseline.

## Gold Vocabulary

At the 0.50 low-familiarity threshold, real-frequency Gold games depended on at
least one low-familiarity word at rates of 100% Casual, 100% Regular, 99.84%
Strong, and 79.24% Expert. Familiar-only Gold rates at threshold .50 were 0%,
0%, .16%, and 20.76%. Multiple-low-word dependency was 100%, 100%, 93.54%,
and 39.90%. Thresholds .25, .50, and .75 are present in the gold artifact;
these figures are comparative metrics, not a definition of normal vocabulary.

## Sensitivity and Ranking

Real Regular candidate-cap results on the representative WATERMELON grid were:

| cap | mean | Gold | Hexalink |
|---:|---:|---:|---:|
| 8 | 81.80 | 3% | 12% |
| 12 | 86.14 | 13% | 27% |
| 18 | 86.84 | 17% | 31% |
| 25 | 86.57 | 16% | 31% |
| 40 | 86.57 | 16% | 31% |
| 60 | 86.57 | 16% | 31% |

This shows a clear plateau at 18-25, making larger caps primarily a safety
cost on this board rather than a dominant behavioral parameter. Temperature
0.75x/1x/1.25x produced mean 84.28/86.84/85.20, Gold 11%/17%/15%, and
Hexalink 22%/31%/26%; sensitivity is material but not radical.

Corrected familiarity-curve sensitivity produced restrictive/baseline/
permissive mean 83.22/86.84/84.10, Gold 10%/17%/8%, and Hexalink 30%/31%/19%.
This is a meaningful robustness factor and is now correctly wired through the
discovery path.

Baseline-to-real Gold-rate rank stability across the 10 puzzles was Casual
.685, Regular .552, Strong .382, and Expert .442. This is moderate to weak,
so M8.1 should not yet be used as an unqualified ranking replacement. The
artifact currently reports paired system stability; full per-parameter
10-puzzle rank matrices are not generated by this bounded sensitivity harness.

Skill ordering held on all 10 puzzles for both systems for mean score, Gold
rate, known breadth, and noticed-move count. This is an observed result, not a
forced constraint.

## Case Studies

Real-frequency Regular results were OSCILLATED 80.09 mean / 4.6% Gold,
AFFORDABLE 86.40 / 16.2%, and WATERMELON 85.08 / 10.8%. Their real-frequency
Hexalink rates were 18.6%, 27.0%, and 26.0%; played-word familiarity was .299,
.306, and .304. OSCILLATED remains relatively difficult and AFFORDABLE remains
relatively easier in this set. WATERMELON sits between them. The ordering is
not guaranteed generally, but these results show no reversal in this sample.

## Answers to Required Questions

1. Yes, the real export loaded from the verified upstream `v3.2` tag.
2. Coverage is 41,318/41,814, or 98.81%.
3. The remaining words are valid corpus gaps, inflections, long/rare words,
   and rare orthographic forms; they are not invalidated.
4. Yes; all six sanity words matched with plausible populated values.
5. Real familiarity reduced mean score and Gold rate for every bounded model,
   most strongly for Regular and Strong.
6. Regular real-frequency mean is 82.71 and Gold rate is 8.48%.
7. No; Strong and Expert saturation was materially reduced.
8. Regular low-familiarity dependency at .50 is 100% of real-frequency Gold
   games in this simulation.
9. Regular familiar-only Gold at .50 is 0% in this run.
10. Yes; caps plateau from 18 through 60 on the sensitivity board.
11. Temperature sensitivity is noticeable but not extreme.
12. Baseline-to-real ranking stability is mixed (.382-.685); parameter-specific
    10-puzzle rank matrices remain a future analysis improvement.
13. Yes, all four tested aggregate orderings held on all 10 puzzles.
14. OSCILLATED remains harder, AFFORDABLE easier, and WATERMELON intermediate.
15. Provisionally yes for comparative profiling, with moderate ranking risk.
16. No. These are not absolute human Gold-rate predictions without human data.
17. It may be considered later as a secondary signal, but not as the sole
    selector and not before reviewing ranking stability with a larger distinct
    puzzle set.

## Tests and Safety

The focused M8.1 suite now includes the curve-override regression. The complete
command is:

```sh
node --test tests/*.test.js
```

Production safety checks found no diffs in `game.js`, `qjynn-rules.js`,
`qjynn-words-v1.0.txt`, M6 generator files, or M7B ranking files. Canonical
validity, inventory, scoring, medals, six-turn limits, Hexalink rules, and M6
hard gates remain unchanged. The final suite result must remain recorded here
after the final run: **197 passed, 0 failed, 0 cancelled, 0 skipped**. No
commit was created.

## Artifacts

All requested `analysis/m81-*.csv` files and `analysis/m81-summary.json` were
regenerated with real-source provenance columns: source, source version,
package version, source revision, normalization version, and fallback flag.
`analysis/m81-m6-vs-m7b.csv` is intentionally empty/non-blocking.

## Known Limitations

The exact requested 3.2.0 package could not be acquired because it is absent
from both the configured package index and upstream tags; the verified v3.2
source revision is the closest exact selected-source revision and is reported
without relabeling. The English frequency snapshot is not human response data.
The dataset has 10 distinct grids, not 30. The generated 14 MB corpus is local
analysis data and should be reviewed before redistribution. No conclusion here
supports absolute population probabilities or production M7B/M9 integration.
