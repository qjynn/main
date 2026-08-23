# M7A Implementation Review

## Summary

M7A adds a puzzle analysis and metrics framework. It measures generated Qjynn puzzles without judging quality, assigning difficulty labels, changing M6 acceptance, or implementing M7B thresholds.

## Files Created/Modified

Created:

- `tools/analyzer/metrics-utils.js`
- `tools/analyzer/puzzle-analyzer.js`
- `tools/analyzer/batch-analyzer.js`
- `tests/puzzle-analyzer.test.js`
- `analysis/m7a-input.csv`
- `analysis/m7a-batch.json`
- `analysis/m7a-puzzles.csv`
- `M7A_IMPLEMENTATION_REVIEW.md`

Modified:

- None to M6 generation criteria.

## Analyzer Architecture

`analyzePuzzle({ puzzle, privateCertification }, wordIndex, options)` is the main API. It validates the public puzzle, enumerates legal starting moves with M4, uses M5 transition/scoring helpers for immediate scores, runs M5 `findGold`, and computes vocabulary, path, scoring, Hexalink, Gold, strategy, coverage, familiarity, solver, and performance metrics.

Batch analysis lives in `tools/analyzer/batch-analyzer.js`. It reads answer/clue/seed records, uses M6 to generate puzzles, analyzes each puzzle, and writes detailed JSON plus flat CSV.

## Metric Definitions

Raw legal moves are M4 word/path combinations. Unique paths deduplicate by ordered coordinates. Unique tile masks deduplicate by consumed tile set. Solver-relevant moves use M5 same-mask dominance, preserving the best scoring representative for state search.

Vocabulary metrics include unique words, word-length buckets, grouped 2-3/4-6/7-10 counts, unique consonant skeletons, words per skeleton, and top skeletons.

Path metrics include unique coordinate paths, unique tile masks, words per path/mask, max words per mask, and path-length buckets.

Scoring metrics measure first-move base score, Hexalink bonus, immediate row/column bonuses, total immediate score, and counts at `>=10`, `>=20`, `>=30`, `>=40`.

## Hexalink Metrics

The analyzer reports Hexalink skeleton, path, span, diagonal/horizontal/vertical steps, direction changes, rows touched, columns touched, vocabulary words sharing the skeleton, and competing 10-letter words.

## Gold Accessibility

Normal Gold uses M5 exact `findGold`. No-Hexalink Gold uses an analyzer DFS over M4/M5 prepared moves with exact Hexalink moves filtered out. Hexalink-required Gold tracks whether a Gold route includes an exact Hexalink move.

Gold-viable first-move analysis evaluates solver-relevant first moves, then calls exact M5 `findGold` from the resulting inter-turn state. This can be bounded by `goldViableFirstMoveLimit`; reports include `exact: false` when not every first move was evaluated.

Bounded multiple-Gold analysis finds up to `maxGoldCertificates` strategically distinct certificates, deduped by tile-mask sequence. It is diagnostic, not an exact count of all Gold routes.

## Tile, Row, And Column Analysis

Tile opportunity counts how often each cell participates in legal starting moves and stores an 8x6 matrix. Row/column opportunity counts legal moves and unique masks touching each row/column. It also records rows/columns completed by the M5 Gold certificate.

## Familiarity Interface

`wordFamiliarity(word)` can be supplied through analyzer options. Without it, the report returns `familiarityMetricsAvailable: false`. M7A does not infer commonness or obscurity from the Qjynn vocabulary.

## Tests

Command:

```bash
node --test tests/*.test.js
```

Result:

```text
tests 101
pass 101
fail 0
duration_ms 5375.988383
```

M7A tests cover valid/invalid puzzle analysis, M4 raw count matching, handcrafted vocabulary counts, word-length sums, skeleton counts, path counts, mask deduplication, canonical scoring, top move ordering, Hexalink geometry, competing answers, normal/no-Hexalink Gold, replay, certificate metrics, Gold-viable first moves on a small exact board, tile/row/column metrics, familiarity provider behavior, bounded route limits, batch JSON, CSV output, deterministic repeated analysis, and file writing.

## Example Analysis

For generated `WATERMELON`, seed `123456`:

```text
raw legal word/path moves: 8663
unique words: 5478
unique skeletons: 1865
unique paths: 2727
unique tile masks: 1713
solver-relevant moves: 1713
short words 2-3: 545 (9.949%)
medium words 4-6: 3545 (64.713%)
long words 7-10: 1388 (25.338%)
max first-move score: 30
median first-move score: 15
Gold score: 110
Gold turns: 5
Gold without Hexalink: true
Hexalink required Gold: true
Hexalink rows touched: 4
Hexalink columns touched: 3
Hexalink direction changes: 3
tile participation min/max: 51 / 1404
```

Top first move:

```text
watermelon [[2,4],[1,3],[0,4],[1,4],[2,3],[3,2]]
base 20 + Hexalink 10 = 30
```

Gold-viable first-move analysis in the batch was bounded to 25 moves:

```text
solver-relevant first moves: 1713
evaluated first moves: 25
exact: false
Gold-viable among evaluated: 25
Gold-viable percentage among evaluated: 100
```

## Batch Outputs

Saved:

- `analysis/m7a-batch.json`
- `analysis/m7a-puzzles.csv`
- `analysis/m7a-input.csv`

Batch size completed: 10 generated M6 puzzles.

```text
success count: 10
failure count: 0
mean analyzer runtime: 2099.365 ms
```

CSV columns include:

```text
answer, hexalink, seed, unique_words, unique_masks, words_2_3,
words_4_6, words_7_10, max_first_score, median_first_score,
gold_score, gold_turns, gold_without_hexalink,
gold_viable_first_moves, gold_viable_first_move_pct,
hexalink_rows_touched, hexalink_columns_touched,
hexalink_direction_changes, analysis_ms
```

## Performance Characteristics

For the WATERMELON analysis:

```text
M4 enumeration: 51.438 ms
M5 normal Gold: 169.117 ms
M5 no-Hexalink Gold: 108.060 ms
Gold first-move analysis: 1903.951 ms
bounded multi-route analysis: 0.493 ms
total analyzer time: 2506.545 ms
```

The dominant cost is Gold-viable first-move analysis because it invokes exact M5 `findGold` repeatedly from post-first-move states. M7A exposes the evaluation count and exactness flag.

## Unexpected Findings

In the 10-puzzle development batch, Gold was reachable without playing the Hexalink for every sampled puzzle. The bounded first-move sample also found 100% Gold viability among the first 25 scored solver-relevant openings for each puzzle. These are measurements only, not quality judgments.

## Known Limitations

- Full exact Gold-viable first-move evaluation for every solver-relevant opening can be expensive; bounded mode is reported explicitly.
- No-Hexalink and Hexalink-required analyses use analyzer-local DFS because M5 does not yet expose a move-filter hook.
- Bounded multiple-Gold route counts are not exact totals.
- Batch size was 10, not 100, to keep exact M5-backed diagnostics practical in this environment.
- Familiarity metrics require an external provider and are unavailable by default.

## M7B Recommendations

Metrics that appear most useful for future threshold design are unique words, unique tile masks, short-word percentage, Gold without Hexalink rate, Gold-viable first-move percentage, tile participation spread, and Hexalink geometry. M7A does not implement thresholds.

## Data Needed for M7B Decisions

| Metric | Min | P25 | Median | P75 | P90 | Max |
|---|---:|---:|---:|---:|---:|---:|
| Unique playable words | 4402 | 5370 | 5568 | 5897 | 5921 | 6811 |
| Unique tile masks | 1499 | 1593 | 1771.5 | 1903 | 1948 | 2032 |
| 2-3 letter word count | 491 | 523 | 539.5 | 553 | 555 | 568 |
| 7-10 letter word count | 993 | 1249 | 1424.5 | 1601 | 1663 | 1949 |
| Gold-viable first-move % bounded | 100 | 100 | 100 | 100 | 100 | 100 |
| Gold without Hexalink rate | 100% |  |  |  |  |  |
| Gold turns | 5 | 5 | 5 | 5 | 5 | 5 |
| Maximum first-move score | 30 | 30 | 30 | 30 | 30 | 30 |
| Analyzer runtime ms | 1848.768 | 1920.509 | 2083.6895 | 2233.066 | 2315.313 | 2506.545 |

## Git Diff Summary

`git status --short` at report time:

```text
?? "Qjynn M7A Codex Prompt \342\200\224 Puzzle Analysis & Metrics.md"
?? M7A_IMPLEMENTATION_REVIEW.md
?? analysis/
?? tests/puzzle-analyzer.test.js
?? tools/analyzer/
```

`git diff --stat` at report time:

```text

```

The diff stat is empty because M7A files are currently untracked and have not been staged.
