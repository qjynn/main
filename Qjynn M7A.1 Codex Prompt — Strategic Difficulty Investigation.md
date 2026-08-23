# Qjynn M7A.1 — Strategic Difficulty Investigation

Implement **M7A.1 only: Strategic Difficulty Investigation and Experimental Grid Analysis**.

Do **not** implement M7B quality thresholds, production rejection rules, difficulty labels, or changes to the live M6 generator yet.

M1–M7A are complete and approved.

Use the existing:

- `qjynn-rules.js`;
- Qjynn Vocabulary 1.0;
- M4 vocabulary index and legal move enumerator;
- M5 exact `findGold` solver;
- M6 deterministic Daily Grid Generator;
- M7A analyzer and batch-analysis framework.

Do not duplicate those components.

## 1. Objective

The purpose of M7A.1 is to determine:

> **Which measurable properties of consonant placement make a Qjynn grid more or less strategically permissive while preserving exact Gold attainability?**

M7A showed that the current random-grid generator produces highly permissive puzzles:

- Gold was reachable without Hexalink in all sampled puzzles;
- the bounded sample of first moves was 100% Gold-viable;
- Gold occurred in five turns in all sampled puzzles.

M7A.1 must investigate the cause.

This is an **experimental milestone**, not a production-quality decision milestone.

Do not yet define what “good,” “easy,” “medium,” or “hard” means.

---

## 2. Correct M7A Metric Naming

Before further experimentation, eliminate ambiguous naming.

Rename or alias any metric equivalent to:

```text
Hexalink required Gold
```

to:

```text
goldReachableWithHexalinkRequired
```

Retain:

```text
goldReachableWithoutHexalink
```

These mean:

```text
goldReachableWithoutHexalink
    = Gold exists when exact Hexalink moves are prohibited.

goldReachableWithHexalinkRequired
    = Gold exists under the constraint that a Gold route must include
      the exact Hexalink.
```

Do not interpret `goldReachableWithHexalinkRequired` as meaning Gold is impossible without Hexalink.

Update tests and documentation accordingly.

---

## 3. Experimental Architecture

Create a new experimental area:

```text
tools/experiments/
```

Suggested files:

```text
tools/experiments/
  placement-strategies.js
  strategic-experiment.js
  experiment-batch.js
```

Tests:

```text
tests/strategic-experiment.test.js
```

Do not modify M6 production generation logic.

Experimental placement strategies must be invoked only through M7A.1 tooling.

---

## 4. Experimental Grid Families

Generate candidate grids using the exact canonical 48-tile consonant inventory and the exact required Hexalink.

Create several deterministic placement families.

At minimum implement:

### A. RANDOM_BASELINE

Equivalent to current M6 random fill behavior.

Purpose:

```text
baseline comparison
```

### B. COMMON_CONSONANT_CLUSTERED

Deliberately place high-frequency Qjynn consonants near one another.

Use the canonical high-count letters:

```text
N R T L S D
```

and, where reasonable:

```text
C H
```

to create locally dense adjacency.

Do not change letter counts.

### C. COMMON_CONSONANT_DISPERSED

Deliberately spread the high-frequency consonants across the board to reduce dense adjacency among them.

Keep the same canonical inventory.

### D. RARE_LETTER_SEPARATED

Attempt to prevent rare consonants:

```text
J K Q X Z
```

from becoming strongly connected to one another or to dense high-opportunity clusters.

### E. HEXALINK_CENTRIC

Arrange nearby letters so the designated Hexalink corridor participates in comparatively useful word-building opportunities.

Do not guarantee Gold through the Hexalink; simply bias geometry toward Hexalink relevance.

### F. HEXALINK_ISOLATED

Place the Hexalink legally, but attempt to reduce high-connectivity neighborhoods around some or all Hexalink tiles.

Purpose:

```text
contrast against HEXALINK_CENTRIC
```

### G. DEGREE_BALANCED

Attempt to make tile participation/connectivity more uniform across the board.

Use geometric placement heuristics, not vocabulary deletion.

### H. HIGH_VALUE_PATH_SUPPRESSED

Use M7A/M4 feedback during experimental generation to reduce excessive concentrations of high-scoring starting paths.

This may be iterative:

```text
generate candidate
analyze
mutate/swap letters
reanalyze
```

Do not change scoring rules or vocabulary.

---

## 5. Important Experimental Rule

Every experimental grid must still satisfy all M6 structural requirements:

- 8×6 board;
- canonical consonant inventory exactly;
- exact six-letter Hexalink;
- legal Hexalink path;
- reproducibility from seed;
- Vocabulary 1.0 answer validity;
- M5 exact Gold certification;
- certificate replay.

If an experimental placement strategy cannot produce a Gold-capable board within its configured attempt limit, record that result.

Do not silently relax Gold certification.

---

## 6. Experimental API

Expose an API conceptually similar to:

```javascript
generateExperimentalPuzzle({
  answer,
  clue,
  date,
  seed,
  strategy,
  maxAttempts
}, wordIndex, options)
```

Return:

```javascript
{
  ok,
  strategy,
  puzzle,
  privateCertification,
  generationStats
}
```

The same answer + seed + strategy + versions must reproduce the same result.

---

## 7. Strategy Metadata

Every generated experimental puzzle must record:

```text
strategy name
strategy version
seed
generator version
rules version
vocabulary version
attempt number
```

This metadata is private.

---

## 8. Improve Analysis Efficiency

M7A found Gold-viable first-move evaluation to be the dominant analyzer cost.

Profile that path and improve performance without changing exactness.

Investigate at minimum:

- reuse of M5 prepared moves;
- reuse of compatibility caches across first-move evaluations;
- state memoization across sibling first-move searches;
- avoiding repeated vocabulary enumeration;
- moving Hexalink/no-Hexalink constraints into M5 through a safe move-filter interface if that reduces duplicate analyzer-local DFS logic.

If modifying M5 to expose a generic exact move filter is the cleanest architecture, you may do so **only if**:

- existing M5 behavior is unchanged by default;
- all existing tests pass;
- exactness is preserved;
- the change is documented.

Do not weaken exact search into approximation.

---

## 9. Full Gold-Viable First-Move Evaluation

For a representative subset of experimental grids, attempt exact evaluation of **all solver-relevant first moves**, not only the first 25.

Report:

```text
solverRelevantFirstMoves
evaluatedFirstMoves
exact
goldViableFirstMoveCount
goldViableFirstMovePct
```

If exact full-board evaluation remains too expensive, report:

- why;
- measured runtime;
- the largest exact subset completed;
- any optimization opportunity.

Do not present bounded percentages as exact.

---

## 10. First-Move Regret Metric

Add a neutral metric that measures how much a poor opening can hurt.

Conceptually:

```text
bestGoldPreservingFirstMoveScore
vs
worstGoldPreservingFirstMoveScore
vs
firstMovesThatDestroyGold
```

More importantly, report:

```text
number of first moves after which Gold becomes impossible
percentage of first moves after which Gold becomes impossible
```

Name it neutrally, e.g.:

```text
goldDestroyingFirstMoveCount
goldDestroyingFirstMovePct
```

Do not label high or low values as good/bad yet.

---

## 11. Hexalink Dependency Metrics

For each grid report:

```text
goldReachableNormally
goldReachableWithoutHexalink
goldReachableWithHexalinkRequired
```

Also report, where exact evaluation is practical:

```text
goldViableFirstMovesUsingHexalink
goldViableFirstMovesNotUsingHexalink
```

and:

```text
earliestGoldTurnWithHexalink
earliestGoldTurnWithoutHexalink
```

Do not approximate silently.

---

## 12. Gold Turn Depth

Measure:

```text
minimum turns required to reach Gold
```

This must be exact where reported.

Possible values:

```text
1..6
unreachable
```

The M7A sample showed Gold in five turns consistently. M7A.1 should determine whether placement strategy changes this distribution.

---

## 13. Move-Space Contraction

For selected exact Gold certificates and selected alternative first moves, measure how the legal move space changes after each turn.

For example:

```text
turn 0 legal masks: 1800
turn 1 legal masks: 620
turn 2 legal masks: 240
...
```

Report:

```text
legalSolverMovesByTurn
```

for:

- the M5 Gold certificate;
- at least one non-Hexalink Gold route if available;
- at least one Gold-destroying opening if available.

This may help distinguish strategically constraining boards from permissive ones.

---

## 14. Connectivity Metrics

Add purely geometric board metrics independent of vocabulary.

For every cell report or aggregate:

```text
neighbor degree
same/high-frequency-letter neighborhood density
```

At board level calculate:

```text
mean geometric degree
degree variance
high-frequency consonant adjacency count
rare-letter adjacency count
```

Define high-frequency letters from the canonical inventory counts, not external language statistics unless separately supplied.

Also compute:

```text
N/R/T/L/S pair adjacency count
```

as an explicit experimental metric.

---

## 15. Letter-Dispersion Metrics

For each canonical consonant that appears multiple times, calculate spatial dispersion.

At minimum:

```text
mean pairwise distance between identical letters
minimum pairwise distance
```

Aggregate separately for:

```text
N R T L S
D
two-copy letters
```

Use a clearly documented distance metric, e.g. Chebyshev distance because Qjynn allows 8-direction movement.

Do not decide optimal dispersion yet.

---

## 16. Hexalink Neighborhood Metrics

For the six Hexalink cells measure:

```text
average neighbor degree
number of adjacent canonical high-frequency consonants
number of legal starting moves touching any Hexalink tile
number of unique masks touching any Hexalink tile
```

Also report the same normalized relative to the full board.

Example:

```text
hexalinkMoveParticipationPct
```

This may reveal whether Hexalink-centric placement affects strategic relevance.

---

## 17. Experimental Dataset Design

Use a controlled factorial-style dataset rather than unrelated random puzzles.

Select at least:

```text
10 valid Qjynn 10-letter/four-vowel answers
```

For each answer, generate each placement strategy using multiple seeds.

Preferred initial design:

```text
10 answers
× 8 strategies
× 5 seeds
= 400 experimental puzzles
```

If full exact analysis of 400 is impractical:

1. generate all 400;
2. run inexpensive M7A metrics on all;
3. run expensive exact Gold-first-move analysis on a stratified subset;
4. clearly report which metrics are exact for which subset.

Do not reduce the experiment to only 10 grids.

---

## 18. Paired Comparison Requirement

For each:

```text
answer + seed
```

generate all strategies using the same answer and seed.

This enables paired comparison where only placement strategy changes.

Do not compare unrelated seeds when a paired comparison is possible.

---

## 19. Required Core Metrics

For every experimental puzzle collect at minimum:

```text
strategy
answer
seed

unique playable words
unique skeletons
unique paths
unique tile masks
solver-relevant moves

2-3 letter words
4-6 letter words
7-10 letter words

max first-move score
median first-move score

gold reachable normally
gold reachable without Hexalink
gold reachable with Hexalink required
minimum Gold turns

gold-viable first-move count
gold-viable first-move pct
gold-destroying first-move count
gold-destroying first-move pct
exactness flag

Hexalink direction changes
Hexalink rows touched
Hexalink columns touched
Hexalink move participation pct

tile participation min
tile participation max
tile participation mean
tile participation coefficient of variation

N/R/T/L/S adjacency count
high-frequency consonant adjacency count
identical-letter dispersion metrics

generation time
analysis time
```

---

## 20. Statistical Comparison

For each strategy calculate:

```text
count
mean
median
P25
P75
P90
min
max
standard deviation
```

for major scalar metrics.

Also produce paired differences against RANDOM_BASELINE for the same answer/seed.

For example:

```text
COMMON_CONSONANT_DISPERSED
minus
RANDOM_BASELINE
```

for:

```text
unique masks
Gold-viable first-move %
Gold-without-Hexalink rate
minimum Gold turns
tile participation variation
```

Do not perform significance claims unless a sound test is implemented and sample size supports it.

Descriptive statistics are sufficient.

---

## 21. Correlation Exploration

Across all experimental puzzles, calculate simple correlations between candidate explanatory metrics and:

```text
Gold-viable first-move %
Gold-destroying first-move %
Gold without Hexalink
minimum Gold turns
unique tile masks
```

Candidate explanatory metrics include:

```text
high-frequency adjacency
N/R/T/L/S adjacency
tile participation variation
identical-letter dispersion
Hexalink participation
unique words
unique masks
short-word fraction
```

Use Pearson and/or Spearman as appropriate and document which.

This is exploratory only.

Do not convert correlations directly into production thresholds.

---

## 22. Search for Counterexamples

Explicitly find and report examples of:

### Type A
Gold reachable but only a small fraction of first moves preserve Gold.

### Type B
Gold reachable and almost every first move preserves Gold.

### Type C
Gold impossible without Hexalink but possible with it.

### Type D
Gold possible without Hexalink.

### Type E
Gold requires all 6 turns.

### Type F
Gold reachable in 4 or fewer turns, if such examples exist.

### Type G
Low unique-word count but high Gold permissiveness.

### Type H
High unique-word count but low Gold permissiveness.

These counterexamples are valuable for determining whether simple metrics are misleading.

---

## 23. Experimental Output Files

Save:

```text
analysis/m7a1-experiments.json
analysis/m7a1-experiments.csv
analysis/m7a1-summary.json
analysis/m7a1-paired-comparisons.csv
```

If exact expensive analysis is run on a subset, also save:

```text
analysis/m7a1-exact-subset.csv
```

---

## 24. CSV Requirements

One row per experimental puzzle.

Include all important scalar metrics and explicit flags such as:

```text
gold_first_move_exact
gold_without_hexalink
gold_with_hexalink_required
```

Do not flatten full certificates or path arrays into CSV.

Those belong in JSON.

---

## 25. Tests

Add comprehensive tests for M7A.1.

At minimum:

1. strategy generation preserves canonical inventory;
2. strategy generation preserves exact Hexalink;
3. strategy generation is deterministic;
4. paired strategies with same answer/seed differ where intended;
5. production M6 generator remains unchanged;
6. renamed Hexalink metrics have correct semantics;
7. full exact Gold-first-move count matches brute force on small boards;
8. Gold-destroying count is correct on a handcrafted board;
9. minimum Gold turn count is correct;
10. Gold-without-Hexalink is correct;
11. Gold-with-Hexalink-required is correct;
12. geometric degree metrics are correct;
13. N/R/T/L/S adjacency count is correct;
14. identical-letter dispersion is correct;
15. Hexalink neighborhood metrics are correct;
16. paired comparison calculations are correct;
17. correlation implementation is correct on synthetic data;
18. JSON/CSV outputs are deterministic;
19. existing M1–M7A tests continue to pass.

---

## 26. Critical Restrictions

M7A.1 must not:

- alter production M6 acceptance criteria;
- alter canonical consonant counts;
- alter Vocabulary 1.0;
- alter scoring;
- alter medal thresholds;
- alter Hexalink rules;
- define final quality thresholds;
- assign Easy/Medium/Hard labels;
- produce a composite quality score;
- use an LLM to judge grids;
- modify `game.js`;
- expose private certificates publicly.

This is an investigation.

---

## 27. Key Questions the Report Must Answer

At the end of the experiment, answer using data:

### Q1
Does consonant placement strategy materially change the number of solver-relevant moves?

### Q2
Can placement strategy reduce Gold-viable first-move percentage below the 100% behavior seen in M7A?

### Q3
Can we produce Gold-capable grids where some plausible first moves make Gold impossible?

### Q4
Can we produce grids where Gold is impossible without using the Hexalink?

### Q5
Which geometric metrics correlate most strongly with Gold permissiveness?

### Q6
Does dispersing N/R/T/L/S reduce strategic permissiveness?

### Q7
Does clustering common consonants increase word richness and Gold permissiveness?

### Q8
Does increasing Hexalink neighborhood participation make Hexalink strategically more important?

### Q9
Can we generate Gold-capable grids that require all six turns?

### Q10
Which metrics appear redundant or uninformative?

Do not answer these questions from intuition; use experiment results.

---

## 28. Required Review Document

Create:

```text
M7A1_STRATEGIC_DIFFICULTY_REVIEW.md
```

Include:

1. files created/modified;
2. experimental architecture;
3. placement strategies;
4. exact definitions of each new metric;
5. M7A naming correction;
6. analyzer performance optimizations;
7. experimental dataset design;
8. number of puzzles generated;
9. number receiving full exact analysis;
10. test results;
11. aggregate results by strategy;
12. paired baseline comparisons;
13. correlation findings;
14. counterexamples;
15. answers to Q1–Q10;
16. unexpected findings;
17. known limitations;
18. which 3–6 metrics appear most promising for future M7B;
19. metrics that appear weak/redundant;
20. recommendations for M7B design — but no thresholds;
21. `git status --short`;
22. `git diff --stat`.

---

## 29. Data Needed for M7B

End the report with:

```text
## Data Needed for M7B
```

Include a table comparing strategies.

At minimum:

| Strategy | Unique Masks Median | Gold-Viable First Move % | Gold-Destroying % | Gold Without Hexalink Rate | Median Gold Turns | Hexalink Participation | NRTLS Adjacency |
|---|---:|---:|---:|---:|---:|---:|---:|

Also include distribution tables for the 3–6 metrics judged most promising.

---

## 30. Stop Condition

When M7A.1 is complete:

1. save the experiment JSON/CSV files;
2. create `M7A1_STRATEGIC_DIFFICULTY_REVIEW.md`;
3. report paths;
4. stop.

Do not implement M7B.

Do not change production M6 behavior.

Wait for review.