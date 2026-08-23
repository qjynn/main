# Qjynn M7A — Puzzle Analyzer & Metrics

Implement **M7A only: Qjynn Puzzle Analyzer and Metrics Framework**.

Do **not** implement M7B quality scoring, puzzle rejection thresholds, difficulty labels, or changes to the Daily Grid Generator yet.

M1–M6 are complete and approved.

Use the existing:

- canonical `qjynn-rules.js`;
- Qjynn Vocabulary 1.0;
- M4 vocabulary index and legal move enumerator;
- M5 exact `findGold` solver;
- M6 deterministic Daily Grid Generator.

Do not duplicate those components.

---

# 1. Objective

M7A is an **instrumentation and analysis milestone**.

Its purpose is to answer:

> What measurable characteristics distinguish one Qjynn grid from another?

We do not yet have enough evidence to define a “good,” “easy,” “medium,” or “hard” puzzle.

Therefore M7A must **measure**, not judge.

Given a valid generated Qjynn puzzle, produce a detailed metrics record describing:

1. vocabulary richness;
2. move/path richness;
3. scoring opportunities;
4. Hexalink characteristics;
5. Gold accessibility;
6. first-move strategic alternatives;
7. tile utilization;
8. row/column opportunity;
9. short-word density;
10. Gold-certificate characteristics;
11. solver/generator complexity.

The output will later be used to design M7B quality thresholds.

---

# 2. Architecture

Create standalone analysis modules under:

```text
tools/analyzer/
```

Suggested structure:

```text
tools/analyzer/
  puzzle-analyzer.js
  vocabulary-metrics.js
  strategy-metrics.js
  hexalink-metrics.js
  batch-analyzer.js
```

Tests:

```text
tests/puzzle-analyzer.test.js
```

Do not put analysis logic into `game.js`.

Do not modify M6 generation behavior.

---

# 3. Main Analyzer API

Expose an API conceptually similar to:

```javascript
analyzePuzzle({
  puzzle,
  privateCertification
}, wordIndex, options)
```

Return a structured object such as:

```javascript
{
  puzzleId,
  answer,
  hexalink,

  vocabulary: {...},
  paths: {...},
  scoring: {...},
  hexalinkMetrics: {...},
  gold: {...},
  strategy: {...},
  coverage: {...},
  solver: {...}
}
```

The exact internal organization may differ if there is a better design, but keep the metrics machine-readable.

---

# 4. Initial Legal-Move Metrics

Use the approved M4 move enumerator on the untouched starting board.

Report:

```text
raw legal word/path moves
unique words
unique consonant skeletons
unique paths
unique tile masks
solver-relevant/deduplicated moves
```

This distinction is important.

For example, 15,000 word/path combinations may correspond to far fewer genuinely distinct strategic tile-consumption choices.

Do not report only the raw M4 move count.

---

# 5. Word-Length Distribution

Calculate the number of playable **unique words** of each length:

```text
2 letters
3 letters
4 letters
5 letters
6 letters
7 letters
8 letters
9 letters
10 letters
```

Return both:

```text
count
percentage
```

Example structure:

```javascript
wordLengthDistribution: {
  2: { count: 43, pct: 8.2 },
  3: { count: 87, pct: 16.5 },
  ...
}
```

Also calculate grouped values:

```text
short words:   2–3
medium words:  4–6
long words:    7–10
```

Do not yet label high/low density as good or bad.

---

# 6. Consonant-Skeleton Metrics

Report:

```text
number of unique consonant skeletons
number of words per skeleton
mean words per skeleton
median words per skeleton
maximum words sharing one skeleton
```

Identify the top 10 skeletons by number of playable words.

For diagnostic/private analysis, list representative words associated with those skeletons.

This will help determine whether certain consonant patterns create excessive vocabulary branching.

---

# 7. Path and Tile-Mask Metrics

Measure:

```text
unique coordinate paths
unique tile masks
mean words per path
mean words per tile mask
maximum words per tile mask
```

Also report path lengths:

```text
1 consonant
2 consonants
3 consonants
4 consonants
5 consonants
6 consonants
```

For each length report:

```text
number of unique paths
number of unique playable words
```

This will help determine whether a grid is dominated by very short or very long chains.

---

# 8. Scoring Opportunity Metrics

Using canonical Qjynn scoring, analyze legal first moves.

Report distributions of:

```text
base word score
Hexalink bonus
immediate row bonus
immediate column bonus
total immediate move score
```

Report at minimum:

```text
maximum immediate score
mean immediate score
median immediate score
90th percentile immediate score
```

Also report counts of first moves scoring:

```text
>=10
>=20
>=30
>=40
```

Do not define these counts as quality thresholds yet.

---

# 9. Top First Moves

Return the top N strategically distinct first moves, default N=20.

Do not simply return 20 different words using the same tile mask.

Deduplicate by state transition/tile mask where appropriate.

For each include:

```javascript
{
  word,
  consonantSkeleton,
  path,
  tileMask,
  baseScore,
  hexalinkBonus,
  rowBonus,
  columnBonus,
  immediateScore
}
```

This information is private analytical output, not public puzzle data.

---

# 10. Hexalink Metrics

Analyze the designated Hexalink.

Report:

```text
Hexalink consonant skeleton
Hexalink path coordinates
Hexalink geometric span
number of diagonal steps
number of horizontal steps
number of vertical steps
number of direction changes
number of rows touched
number of columns touched
```

Also report:

```text
number of playable vocabulary words sharing the exact Hexalink consonant skeleton
```

and whether the intended 10-letter answer is:

```text
the only 10-letter word for that skeleton
one of several
```

List competing 10-letter words privately if any exist.

Do not yet classify the Hexalink as visually obvious or difficult.

---

# 11. Hexalink Strategic Importance

This is an important M7A measurement.

Run exact Gold analysis under at least two conditions:

### Condition A

Normal puzzle:

```text
Hexalink available
```

### Condition B

Gold search where the exact Hexalink move is prohibited.

Determine:

```text
Gold reachable normally?
Gold reachable without playing Hexalink?
```

If computationally practical, also determine:

```text
Gold reachable if Hexalink must be played?
```

Report:

```javascript
{
  goldReachableNormally,
  goldReachableWithoutHexalink,
  goldReachableWithHexalinkRequired
}
```

Do not convert these into quality judgments yet.

---

# 12. Gold Certificate Characteristics

Use M5 `findGold`.

For the certificate found, report:

```text
Gold score
turns used
Hexalink used?
turn on which Hexalink was used
number of 2–3 letter words
number of 4–6 letter words
number of 7–10 letter words
row bonuses earned
column bonuses earned
```

Also report the sequence privately.

The certificate must replay successfully through canonical rules.

---

# 13. Gold First-Move Accessibility

This is one of the most important M7A metrics.

We want to estimate how many strategically distinct first moves still permit eventual Gold.

For each **solver-relevant first move**, determine whether Gold remains reachable from the resulting state.

Report:

```text
number of solver-relevant first moves
number that preserve Gold attainability
percentage that preserve Gold attainability
```

Call this something neutral such as:

```text
goldViableFirstMoveCount
goldViableFirstMovePct
```

Do not call it “difficulty” yet.

If exhaustive evaluation is computationally expensive, implement a configurable analysis mode and report runtime.

Do not silently approximate an exact metric.

---

# 14. Gold First-Move Score Distribution

Among Gold-viable first moves, report:

```text
minimum first-move score
maximum first-move score
mean
median
```

Also report how many Gold-viable first moves:

```text
use the Hexalink
do not use the Hexalink
```

This will help us understand whether Gold requires an obvious high-value opening or allows different strategies.

---

# 15. Tile Opportunity Metrics

For each of the 48 board cells, determine how often it participates in legal starting moves.

Produce:

```text
minimum tile participation
maximum tile participation
mean tile participation
median tile participation
```

Also retain a private 8×6 participation matrix.

Example:

```text
21  43  57  39  18  11
34  76  91  64  32  20
...
```

Do not yet classify hotspots as desirable or undesirable.

---

# 16. Row and Column Opportunity

For each row and column report:

```text
number of legal starting moves touching it
number of unique tile masks touching it
```

Also determine whether row/column completion bonuses are theoretically reachable during a six-turn Gold certificate where practical.

At minimum report which rows and columns are completed by the M5 Gold certificate.

---

# 17. Vocabulary Familiarity — Instrumentation Only

Do **not** invent a familiarity score from the Qjynn vocabulary itself.

However, design the analyzer so that a future external/common-word-frequency dataset can be attached.

For M7A, support an optional interface such as:

```javascript
wordFamiliarity(word)
```

If no frequency/familiarity dataset is configured:

```text
familiarityMetricsAvailable: false
```

Do not classify words as common, obscure, easy, or difficult merely from word length or vocabulary membership.

This is important.

---

# 18. Multiple Gold Routes

Do not attempt to enumerate every Gold solution if this causes combinatorial explosion.

Instead implement a bounded diagnostic mode such as:

```javascript
maxGoldCertificates: 25
```

Find up to N **strategically distinct** Gold certificates where practical.

Deduplicate certificates based on their sequence of tile masks rather than merely different vocabulary words sharing identical moves.

Report:

```text
Gold certificates requested
Gold certificates found
search limit reached?
unique first moves among certificates
unique Hexalink-use patterns
```

Clearly mark this as bounded analysis rather than an exact total number of Gold routes.

---

# 19. Analyzer Performance Metrics

For every puzzle analysis report:

```text
M4 enumeration time
M5 normal Gold time
M5 no-Hexalink Gold time
Gold-first-move analysis time
bounded multi-route analysis time
total analyzer time
```

Also report:

```text
solver calls
states explored where available
memo hits where available
```

M7A itself must not hide expensive analyses.

---

# 20. Batch Analyzer

Create a batch-analysis command capable of generating and analyzing multiple M6 puzzles.

Conceptually:

```bash
node tools/analyzer/batch-analyzer.js \
  --input test-answers.csv \
  --count 100 \
  --output analysis/m7a-batch.json
```

Input records should support:

```text
answer
clue
seed
```

Use M6 to generate each puzzle and M7A to analyze it.

Do not manually create special grids for the batch except where needed for unit tests.

---

# 21. Batch Size

Start with a development batch of approximately:

```text
100 puzzles
```

If the expensive exact metrics make 100 impractical, report the bottleneck and run the largest reasonable batch without weakening correctness.

Do not introduce approximate metrics without clearly labeling them.

---

# 22. Batch Summary

Produce aggregate statistics for numerical metrics:

```text
minimum
maximum
mean
median
25th percentile
75th percentile
90th percentile
```

Examples include:

```text
unique playable words
unique tile masks
short-word count
long-word count
maximum first-move score
Gold-viable first-move percentage
tile participation variation
Gold turns
analyzer runtime
```

Do not create quality thresholds from these distributions.

---

# 23. CSV Output

In addition to detailed JSON, produce a flat CSV suitable for later spreadsheet/statistical analysis.

For example:

```text
analysis/m7a-puzzles.csv
```

One row per puzzle.

Columns should contain important scalar metrics such as:

```text
answer
hexalink
seed
unique_words
unique_masks
words_2_3
words_4_6
words_7_10
max_first_score
median_first_score
gold_score
gold_turns
gold_without_hexalink
gold_viable_first_moves
gold_viable_first_move_pct
hexalink_rows_touched
hexalink_columns_touched
hexalink_direction_changes
analysis_ms
```

Detailed path/certificate information belongs in JSON, not flattened CSV columns.

---

# 24. Reproducibility

Every analysis record must identify:

```text
generator version
rules version
vocabulary version
analyzer version
seed
```

Given the same puzzle and software versions, M7A results must be reproducible.

---

# 25. Tests

Add comprehensive tests.

At minimum:

1. analyzer accepts a valid M6 puzzle;
2. invalid puzzle is rejected;
3. raw move count matches M4;
4. unique-word count is correct on a handcrafted board;
5. word-length distribution sums correctly;
6. skeleton counts are correct;
7. path-length counts are correct;
8. tile-mask deduplication is correct;
9. scoring distribution uses canonical rules;
10. top first moves are ordered correctly;
11. same-mask word variants do not inflate strategic move count;
12. Hexalink geometry metrics are correct;
13. competing Hexalink vocabulary words are detected;
14. normal Gold search matches M5;
15. no-Hexalink Gold search truly prohibits the exact Hexalink;
16. Gold certificate replay succeeds;
17. Gold-certificate metrics are correct;
18. Gold-viable first-move count is correct on a small handcrafted board;
19. tile participation matrix is correct;
20. row/column opportunity counts are correct;
21. optional familiarity provider works when supplied;
22. analyzer reports familiarity unavailable when not supplied;
23. bounded multiple-Gold search respects its limit;
24. batch JSON output is valid;
25. CSV contains one row per analyzed puzzle;
26. deterministic repeated analysis produces identical metrics;
27. all existing M1–M6 tests continue to pass.

Where exact expected values are difficult on a full board, use small handcrafted boards with known answers.

---

# 26. Critical Restrictions

M7A must **not**:

- modify M6 candidate acceptance;
- reject generated grids based on quality;
- create a composite quality score;
- label puzzles Easy/Medium/Hard;
- assign arbitrary thresholds;
- define obscure/common words without an external dataset;
- alter Qjynn scoring;
- alter the consonant inventory;
- alter Vocabulary 1.0;
- alter Hexalink rules;
- use an LLM to judge puzzle quality;
- expose private answer or Gold-certificate data in public puzzle JSON.

M7A measures.

M7B will judge.

---

# 27. Initial Experimental Questions

The M7A batch report should specifically help us answer these questions:

### A. Is Gold too easy to preserve?

What percentage of legal first moves still permit Gold?

### B. Is Gold dependent on Hexalink?

How often can Gold be achieved without ever playing the Hexalink?

### C. Are grids flooded with words?

What are the distributions of:

```text
unique playable words
unique skeletons
unique strategic tile masks
```

### D. Are short words dominating?

What fraction of playable vocabulary consists of 2–3 letter words?

### E. Is there meaningful opening choice?

How many strategically distinct first moves exist, and how many remain Gold-viable?

### F. How important is grid geometry?

Do certain tiles, rows, or columns participate in vastly more legal moves than others?

### G. Does the current random M6 generator produce materially different puzzles?

Compare metric distributions across seeds and answers.

Do not answer these questions qualitatively without data.

---

# 28. M7A Implementation Review

Create:

```text
M7A_IMPLEMENTATION_REVIEW.md
```

Include:

1. files created/modified;
2. analyzer architecture;
3. metric definitions;
4. distinction between raw words, paths, masks and solver-relevant moves;
5. Hexalink metrics;
6. Gold accessibility methodology;
7. Gold-without-Hexalink methodology;
8. Gold-viable-first-move methodology;
9. bounded multiple-Gold methodology;
10. tile/row/column analysis;
11. familiarity-provider interface;
12. performance characteristics;
13. complete tests and results;
14. one complete example puzzle analysis;
15. batch methodology;
16. batch size actually completed;
17. aggregate batch results;
18. CSV output description;
19. unexpected findings;
20. known limitations;
21. recommendations for what metrics appear most useful for M7B — **but do not implement thresholds**;
22. `git status --short`;
23. `git diff --stat`.

---

# 29. Important Reporting Requirement

At the end of the M7A report, include a section titled:

```text
## Data Needed for M7B Decisions
```

Present a compact table showing the observed distribution of the most promising metrics.

For example:

| Metric | Min | P25 | Median | P75 | P90 | Max |
|---|---:|---:|---:|---:|---:|---:|
| Unique playable words | | | | | | |
| Unique tile masks | | | | | | |
| 2–3 letter word % | | | | | | |
| Gold-viable first moves | | | | | | |
| Gold-viable first-move % | | | | | | |
| Gold without Hexalink | binary rate | | | | | |
| Gold turns | | | | | | |
| Maximum first-move score | | | | | | |
| Hexalink direction changes | | | | | | |

Add other metrics if the implementation reveals better indicators.

This table will be used to design M7B.

---

# 30. Stop Condition

When M7A implementation, tests, and the experimental batch are complete:

1. create `M7A_IMPLEMENTATION_REVIEW.md`;
2. save the detailed batch JSON;
3. save the flat CSV;
4. report their paths;
5. **stop**.

Do not implement M7B.

Do not modify M6 generation criteria.

Wait for review.