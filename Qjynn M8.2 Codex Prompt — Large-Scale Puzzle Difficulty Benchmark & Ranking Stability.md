# Qjynn M8.2 — Large-Scale Puzzle Difficulty Benchmark & Ranking Stability

Implement **M8.2 only**.

M1–M8.1 are complete and approved.

Do **not** implement M9.

M8.1 established a real-frequency synthetic-player model using the verified `wordfreq` source with:

```text
41,814 indexed Qjynn words
41,318 frequency matches
496 unmatched
98.81% coverage
```

The real-frequency model materially reduced unrealistic solver-like performance and produced stable skill ordering.

However, M8.1 used only 10 genuinely distinct production grids, and puzzle-ranking stability was not yet strong enough to justify production ranking integration.

M8.2 must answer:

> **Is M8.1 a sufficiently stable comparative instrument for ranking Qjynn Daily Grid candidates?**

M8.2 is primarily a **large-sample benchmarking and ranking-stability milestone**.

Do not redesign the player simulator unless a genuine correctness defect is discovered.

---

# 1. Freeze the M8.1 Model

Treat the approved real-frequency M8.1 player configuration as frozen.

Record:

```text
simulatorVersion
playerModelVersion
familiarityProviderVersion
familiaritySourceVersion
normalizationVersion
```

Do not tune model parameters based on M8.2 outcomes.

In particular, do not alter parameters merely to obtain:

```text
desired Gold rates
desired puzzle spread
desired correlations
desired M7B agreement
```

M8.2 evaluates the model.

It does not fit the model.

---

# 2. Production Invariants

Do not modify:

```text
game.js
qjynn-rules.js
qjynn-words-v1.0.txt
word validity
canonical consonant inventory
six-turn limit
scoring
Gold/Silver/Bronze thresholds
Hexalink rules
M6 hard gates
M7B production ranking
```

M8.2 remains analysis-only.

---

# 3. Preserve Real Familiarity

Use the approved M8.1 frequency source/export.

Expected real-source properties are approximately:

```text
source: wordfreq upstream v3.2
package-reported version: 3.1.1
English large list
289,023 exported records
98.81% Qjynn indexed-word coverage
fallbackUsed = false for matched words
```

Do not silently revert to heuristic familiarity.

Before running the large benchmark, verify that real frequency data is active.

---

# 4. Third-Party Corpus Handling

Reuse the locally generated:

```text
data/familiarity/wordfreq-en-large.json
```

if available.

Do not automatically stage or commit it.

Preserve existing attribution/licensing documentation.

If absent, regenerate it through the existing documented M8.1 procedure.

---

# 5. Primary Benchmark Population

Target:

```text
100 genuinely distinct production-size Qjynn grids
```

Prefer:

```text
100 different 10-letter Daily answers
```

rather than multiple grids for the same answer.

Minimum acceptable benchmark:

```text
50 genuinely distinct grids
```

If fewer than 50 valid distinct answers are available locally, do not fabricate answers.

Use the maximum legitimate distinct set and report the limitation.

---

# 6. Definition of Distinct

For the primary benchmark, a puzzle counts as distinct only when its actual production grid differs.

Prefer distinct answers.

Track at minimum:

```text
puzzleId
answer
seed
grid hash
puzzle source
generator version
selector version
```

Do not count repeated simulation seeds as distinct puzzles.

Do not count duplicate grids as distinct.

---

# 7. Puzzle Source

Use existing approved generation infrastructure only.

Preferred source:

```text
M7B-selected certified grid
```

If M7B generation is too expensive at the target population, use:

```text
M6-certified grid
```

where necessary.

Record source per puzzle.

Do not require M7B.1 exact minimum-turn proof.

---

# 8. Preserve Generation Cost

M8.2 must not become another exact-solver benchmark.

If M7B candidate selection becomes the runtime bottleneck, prefer:

```text
larger legitimate M6 population
```

over:

```text
tiny M7B population
```

The primary objective is simulator ranking stability across many puzzles.

---

# 9. Benchmark Manifest

Create:

```text
analysis/m82-puzzle-manifest.csv
```

with:

```text
puzzle_id
answer
seed
grid_hash
puzzle_source
generator_version
selector_version
hexalink
generation_ms
```

Private analysis artifacts may contain the answer.

Do not expose this information through public puzzle JSON.

---

# 10. Primary Models

Run the main large-scale experiment with:

```text
REGULAR
STRONG
```

These are the primary M8.2 diagnostic models.

Reason:

```text
CASUAL = useful lower-bound diagnostic
EXPERT = useful upper-bound diagnostic
REGULAR/STRONG = likely most discriminating region
```

Do not spend equal computational effort on all models unless runtime is trivial.

---

# 11. Secondary Models

Run:

```text
CASUAL
EXPERT
```

on a representative subset.

Target:

```text
20–30 puzzles
```

selected deterministically across the observed REGULAR difficulty range.

Use them to verify that broader skill ordering still holds.

---

# 12. Primary Monte Carlo Run Count

For every primary puzzle:

```text
REGULAR: 500 runs
STRONG:  500 runs
```

using deterministic seed derivation.

If runtime is comfortably practical, increase to:

```text
1,000 runs/model/puzzle
```

for final metrics.

Do not reduce below 500 for final primary benchmark conclusions without documenting why.

---

# 13. Replicate Stability Experiment

Monte Carlo uncertainty and puzzle-ranking stability are different issues.

For every primary puzzle, run at least:

```text
3 independent master-seed replicates
```

with identical model configuration.

For example:

```text
replicate A
replicate B
replicate C
```

Each replicate should contain the configured run count.

This is essential.

We need to know whether:

```text
Puzzle A > Puzzle B
```

survives independent Monte Carlo samples.

---

# 14. Deterministic Replicate Seeds

Derive replicate seeds from:

```text
M8.2 benchmark version
puzzle identity
player model
replicate index
run index
```

Do not depend on worker scheduling.

Rerunning the same benchmark must reproduce exactly.

---

# 15. Primary Metrics

For every:

```text
puzzle × model × replicate
```

record:

```text
mean score
median score
score SD
P10
P25
P75
P90

Gold rate
Silver rate
Bronze rate
No-medal rate

Hexalink rate
mean Hexalink turn

mean known moves
mean noticed moves

mean played-word familiarity
rare-word dependency

mean turns used
completion rate
```

---

# 16. Primary Difficulty Measures

Evaluate at least these candidate difficulty measures:

```text
REGULAR Gold rate
REGULAR median score
REGULAR mean score
STRONG Gold rate
STRONG median score
```

Do not assume one is best.

Determine which provides the most stable comparative ranking.

---

# 17. Replicate Rank Stability

For each candidate difficulty measure, independently rank puzzles in replicates A/B/C.

Compute pairwise Spearman correlations:

```text
A vs B
A vs C
B vs C
```

Report:

```text
mean Spearman
minimum Spearman
maximum Spearman
```

This is a primary M8.2 acceptance metric.

---

# 18. Puzzle-Level Measurement Stability

For each puzzle report across replicates:

```text
Gold-rate range
Gold-rate SD
median-score range
mean-score range
Hexalink-rate range
```

Identify puzzles whose apparent difficulty is intrinsically noisy under the simulator.

---

# 19. Rank Confidence

Estimate how confidently puzzles can be ordered.

Do not over-engineer a formal ranking model.

At minimum identify:

```text
clearly easier
statistically overlapping
clearly harder
```

pairs or groups based on Monte Carlo uncertainty.

The purpose is to determine whether fine-grained ranks such as:

```text
#37 vs #38
```

are meaningful.

They may not be.

---

# 20. Difficulty Bands

Investigate whether the simulator supports **broad difficulty bands** more robustly than exact ordinal ranking.

For analysis only, divide the benchmark empirically into categories such as:

```text
easier third
middle third
harder third
```

or quintiles.

Do not introduce production labels yet.

Measure how often a puzzle remains in the same or adjacent band across replicates.

---

# 21. Band Stability

For each primary model/metric report:

```text
same-band %
same-or-adjacent-band %
major-band-movement %
```

across independent replicates.

This may be more important than exact rank correlation.

---

# 22. Parameter Robustness Subset

Select a deterministic subset of approximately:

```text
20 puzzles
```

covering:

```text
easy end
middle
hard end
```

according to the frozen baseline REGULAR model.

Run the approved modest parameter perturbations from M8.1.

Do not run exhaustive parameter sweeps over all 100 puzzles unless inexpensive.

---

# 23. Candidate-Cap Robustness

M8.1 found a WATERMELON plateau around:

```text
18–25 candidates
```

Test on the robustness subset:

```text
baseline cap
one modest lower cap
one modest higher cap
```

Prefer existing approved values rather than inventing a new wide sweep.

Measure puzzle-rank correlation against baseline.

---

# 24. Temperature Robustness

Use:

```text
0.75×
1.0×
1.25×
```

of frozen model temperature.

Measure:

```text
Gold-rate changes
median-score changes
puzzle-rank correlation
difficulty-band movement
```

Do not tune temperature.

---

# 25. Familiarity-Curve Robustness

Use existing:

```text
restrictive
baseline
permissive
```

M8.1 familiarity curves.

Measure:

```text
absolute outcome changes
rank correlations
band stability
```

This is especially important because human vocabulary breadth is inherently uncertain.

---

# 26. Primary Robustness Question

The important question is not:

> Do Gold rates remain numerically identical?

They will not.

The important question is:

> Do the same puzzles remain relatively easier or harder under reasonable model perturbations?

Make this distinction central to the analysis.

---

# 27. Mathematical Metrics

For every benchmark puzzle collect all already-available M7A/M7B analytical metrics that can be computed without expensive new exact search.

Examples may include:

```text
Gold headroom
number of legal moves
unique tile masks
solver-relevant moves
Hexalink participation metrics
Hexalink geometry metrics
coverage metrics
candidate-ranking components
word/move density
```

Use the actual metric names present in the repository.

Do not invent values for unavailable metrics.

---

# 28. Do Not Recompute Expensive Proofs

If an M7A/M7B metric requires expensive exact minimum-turn proof or similarly impractical search and is not already cached:

```text
skip it
```

and document why.

M8.2 is not intended to revive M7B.1.

---

# 29. Metric Correlation Analysis

Measure correlations between mathematical metrics and synthetic difficulty outcomes.

At minimum compare each available metric against:

```text
REGULAR Gold rate
REGULAR median score
STRONG Gold rate
```

Use:

```text
Spearman correlation
```

as the primary relationship measure.

Pearson may be included secondarily where useful.

---

# 30. Directionality

Clearly define difficulty direction.

For example:

```text
higher Gold rate = easier
higher median score = easier
```

Normalize direction only for analysis clarity.

Do not accidentally interpret a positive correlation with Gold rate as positive correlation with difficulty.

---

# 31. Identify Useful Existing Predictors

Identify existing M7A/M7B metrics that show:

```text
strong relationship
moderate relationship
weak/no relationship
```

with REGULAR/STRONG synthetic difficulty.

Do not set arbitrary significance thresholds without explanation.

The objective is practical ranking design.

---

# 32. Redundant Metrics

Measure correlations among the mathematical metrics themselves.

Identify metrics that are highly redundant.

M9 should not eventually combine five measures that all encode essentially the same property.

---

# 33. Composite Signals — Analysis Only

M8.2 may experimentally evaluate simple composite signals.

For example:

```text
REGULAR Gold rate
+
REGULAR median score
```

or:

```text
REGULAR difficulty
+
STRONG difficulty
```

But:

- do not modify M7B;
- do not train a complex model;
- do not optimize dozens of weights against the same 100 puzzles;
- do not create an opaque machine-learning ranker.

Keep experimental composites simple and interpretable.

---

# 34. Candidate Production Signal Evaluation

Evaluate candidate signals according to:

```text
replicate stability
parameter robustness
puzzle separation
computational cost
interpretability
```

A slightly weaker but robust and inexpensive signal may be preferable to a volatile one.

---

# 35. REGULAR vs STRONG Agreement

Measure how similarly REGULAR and STRONG rank puzzles.

Compute:

```text
Spearman rank correlation
```

between:

```text
REGULAR Gold-rate difficulty
STRONG Gold-rate difficulty

REGULAR median-score difficulty
STRONG median-score difficulty
```

Identify puzzles that are:

```text
hard for Regular but not Strong
hard for both
easy for both
```

These may represent different types of puzzle difficulty.

---

# 36. Skill-Separation Metric

For each puzzle calculate analytical differences such as:

```text
Strong Gold rate - Regular Gold rate
Strong median score - Regular median score
```

Large differences may identify puzzles that reward advanced vocabulary/strategy particularly strongly.

Treat this as an analysis metric only.

---

# 37. Hexalink Difficulty

Do not collapse Hexalink discovery into score difficulty.

Analyze separately:

```text
REGULAR Hexalink rate
STRONG Hexalink rate
```

Measure their relationship to:

```text
Gold rate
median score
M7A/M7B Hexalink metrics
```

A puzzle may be:

```text
easy to score / hard to solve Hexalink
hard to score / easy to solve Hexalink
```

Preserve this distinction.

---

# 38. Two-Dimensional Puzzle Profile

Experiment analytically with a simple profile:

```text
Score Difficulty
Hexalink Difficulty
```

Do not turn it into a production category yet.

Determine whether these dimensions are sufficiently independent to be useful.

---

# 39. Rare-Word Dependency

For every puzzle calculate using the approved M8.1 methodology:

```text
REGULAR rare-word dependency
STRONG rare-word dependency
```

at the existing thresholds.

Determine whether harder puzzles are difficult because they require:

```text
less familiar vocabulary
```

or because of:

```text
board geometry / strategic constraints
```

---

# 40. Familiar-Only Gold

Continue reporting:

```text
Gold using only broadly familiar words
```

at the existing analytical familiarity thresholds.

Do not redefine “normal vocabulary.”

Use this to characterize puzzle accessibility.

---

# 41. Difficulty Mechanism Analysis

Attempt to distinguish at least these mechanisms:

```text
vocabulary difficulty
geometric/path difficulty
strategic tile-consumption difficulty
Hexalink difficulty
scoring-opportunity scarcity
```

Use existing metrics and simulation traces.

Do not claim causal proof.

This is descriptive analysis.

---

# 42. Extreme Puzzle Inspection

Identify approximately:

```text
10 easiest puzzles
10 hardest puzzles
```

under REGULAR.

For each, summarize:

```text
Gold rate
median score
Hexalink rate
rare-word dependency
legal-move count
relevant M7A/M7B metrics
```

Look for obvious structural differences.

---

# 43. Outlier Analysis

Identify puzzles where:

```text
M7B predicts difficult
but M8.1 predicts easy
```

and:

```text
M7B predicts easy
but M8.1 predicts difficult
```

Inspect several examples.

These disagreements are particularly valuable for designing M9.

---

# 44. Trace Selected Outliers

For a small number of disagreement puzzles, use existing simulation trace mode.

Inspect:

```text
known moves
noticed moves
chosen moves
word familiarity
score progression
Hexalink recognition
```

Determine plausible reasons for disagreement.

Do not change the model based on individual examples.

---

# 45. Medal Distribution

Across the full benchmark report:

```text
Gold
Silver
Bronze
None
```

for REGULAR and STRONG.

Again:

> These are synthetic-model distributions, not human population estimates.

---

# 46. Gold Threshold

M8.2 may report whether 100 continues to appear non-trivial under the frozen models.

Do **not** modify the 100-point threshold.

Any scoring/medal redesign would require a separate milestone and stronger evidence.

---

# 47. Monte Carlo Convergence

For approximately 10 representative puzzles compare:

```text
100
250
500
1,000
```

runs.

Measure stability of:

```text
mean score
median score
Gold rate
Hexalink rate
rank position
```

Determine whether 500 remains sufficient for comparative profiling.

---

# 48. Computational Cost

Measure:

```text
single simulation latency
500-run puzzle/model latency
1,000-run latency
100-puzzle benchmark runtime
memory
```

Estimate the cost of using M8.1 during future candidate generation.

---

# 49. Production Feasibility Question

Estimate the cost of a hypothetical future selector evaluating:

```text
10 candidate grids
×
REGULAR
×
N simulations
```

for one Daily answer.

Do not implement this selector.

Estimate runtime using measured M8.2 performance.

This is important for M9 design.

---

# 50. Fast Approximation Experiment

If full 500-run profiling is too expensive for future candidate selection, evaluate whether:

```text
100 or 250 runs
```

preserve candidate ordering sufficiently well.

Measure rank correlation against 500/1,000-run reference.

This could enable a two-stage M9 design.

---

# 51. Potential Two-Stage Selection

Analyze, but do not implement, a future architecture such as:

```text
M7B cheap mathematical filtering
            ↓
top K candidates
            ↓
M8.1 synthetic profiling
            ↓
final Daily selection
```

Estimate practical K and run counts from measured costs.

Do not choose final production values unless evidence is strong.

---

# 52. Holdout Discipline

If enough puzzles are available, divide the benchmark deterministically into:

```text
analysis set
holdout set
```

For example:

```text
70 / 30
```

Use the analysis set to explore candidate composite signals.

Use the holdout set only to test whether conclusions generalize.

Do not repeatedly tune against the holdout.

---

# 53. If Fewer Than 70 Puzzles

If the final population is too small for a meaningful holdout:

```text
do not pretend to have one
```

Use the full benchmark descriptively and state the limitation.

---

# 54. No Machine-Learning Ranker

Do not train:

```text
random forest
gradient boosting
neural network
large regression model
```

for M8.2.

The sample is too small and the objective is interpretability.

Simple descriptive statistics and simple composites are sufficient.

---

# 55. Ranking Stability Matrix

Create a matrix comparing puzzle rankings across:

```text
replicate A
replicate B
replicate C
candidate-cap perturbation
temperature low
temperature high
familiarity restrictive
familiarity permissive
REGULAR
STRONG
```

Use Spearman correlations.

This should become one of the central M8.2 artifacts.

---

# 56. Stable Core Difficulty

Investigate whether a robust consensus difficulty ranking can be formed from multiple frozen/perturbed views.

For example:

```text
median normalized rank across approved views
```

This is analysis-only.

Do not integrate it into production.

Report whether such a consensus is more stable than any individual metric.

---

# 57. Do Not Hide Negative Results

If rankings are unstable:

```text
say so
```

If M7B metrics correlate poorly with synthetic difficulty:

```text
say so
```

If 100 puzzles are insufficient:

```text
say so
```

M8.2's purpose is to determine whether M9 is justified, not to justify M9 regardless of evidence.

---

# 58. Required New Tests

Add tests where necessary for M8.2 infrastructure:

1. benchmark manifest rejects duplicate grid hashes;
2. replicate seed derivation deterministic;
3. replicate seeds differ;
4. ranking calculation deterministic;
5. Spearman implementation correct;
6. difficulty direction handled correctly;
7. band assignment deterministic;
8. band-stability calculation correct;
9. holdout split deterministic;
10. no holdout leakage in any exploratory composite helper;
11. benchmark runner uses real familiarity provider;
12. benchmark runner rejects accidental heuristic fallback unless explicitly allowed for test fixtures;
13. REGULAR/STRONG model versions match frozen M8.1;
14. parameter perturbation does not mutate frozen baseline config;
15. public puzzle output unchanged;
16. all previous tests pass.

---

# 59. Test Suite

Run:

```bash
node --test tests/*.test.js
```

The M8.1 baseline was:

```text
197 passed
0 failed
```

M8.2 must not regress existing tests.

---

# 60. Output Artifacts

Create at minimum:

```text
analysis/m82-puzzle-manifest.csv
analysis/m82-primary-results.csv
analysis/m82-replicate-stability.csv
analysis/m82-puzzle-measurement-stability.csv
analysis/m82-band-stability.csv
analysis/m82-parameter-robustness.csv
analysis/m82-ranking-stability-matrix.csv
analysis/m82-metric-correlations.csv
analysis/m82-metric-redundancy.csv
analysis/m82-regular-vs-strong.csv
analysis/m82-hexalink-difficulty.csv
analysis/m82-rare-word-dependency.csv
analysis/m82-extreme-puzzles.csv
analysis/m82-ranking-outliers.csv
analysis/m82-convergence.csv
analysis/m82-performance.csv
analysis/m82-summary.json
```

If a holdout is used:

```text
analysis/m82-holdout-results.csv
```

---

# 61. Primary Results CSV

One row per:

```text
puzzle × model × replicate
```

Include:

```text
puzzle_id
answer
grid_hash
puzzle_source
model
replicate
runs

mean_score
median_score
score_sd
p10
p25
p75
p90

gold_rate
silver_rate
bronze_rate
no_medal_rate

hexalink_rate
mean_hexalink_turn

mean_known_moves
mean_noticed_moves
mean_played_familiarity
rare_word_dependency

simulator_version
player_model_version
familiarity_provider_version
source_version
normalization_version
```

---

# 62. Ranking Stability CSV

For each ranking measure include:

```text
model
metric
view_a
view_b
spearman
n_puzzles
```

Views may include:

```text
replicate A/B/C
parameter perturbations
```

---

# 63. Mathematical Metric Correlation CSV

Include:

```text
mathematical_metric
synthetic_metric
model
spearman
pearson_if_used
n
interpretation
```

Keep interpretation concise and evidence-based.

---

# 64. Performance CSV

Include enough information to estimate future selector cost:

```text
model
runs
puzzles
total_simulations
elapsed_ms
ms_per_simulation
ms_per_puzzle
```

---

# 65. Required Review Document

Create:

```text
M82_LARGE_SCALE_DIFFICULTY_BENCHMARK_REVIEW.md
```

Include:

1. scope;
2. files created/modified;
3. frozen M8.1 versions;
4. real-frequency verification;
5. benchmark population;
6. distinct-answer count;
7. distinct-grid count;
8. puzzle-source composition;
9. Monte Carlo design;
10. replicate design;
11. test results;
12. aggregate REGULAR outcomes;
13. aggregate STRONG outcomes;
14. Casual/Expert subset results;
15. puzzle difficulty spread;
16. replicate rank stability;
17. puzzle-level measurement stability;
18. band stability;
19. candidate-cap robustness;
20. temperature robustness;
21. familiarity-curve robustness;
22. REGULAR-vs-STRONG agreement;
23. Hexalink difficulty;
24. rare-word dependency;
25. mathematical-metric correlations;
26. metric redundancy;
27. extreme-puzzle analysis;
28. ranking disagreement/outliers;
29. convergence;
30. performance;
31. estimated future candidate-selection cost;
32. fast-approximation results;
33. holdout results if applicable;
34. candidate M9 signal recommendations;
35. limitations;
36. answers to required questions;
37. final M9 recommendation;
38. `git status --short`;
39. `git diff --stat`.

---

# 66. Required Summary Table — Benchmark

| Property | Result |
|---|---|
| Target puzzles | 100 |
| Actual distinct grids | |
| Actual distinct answers | |
| M7B grids | |
| M6 grids | |
| Runs/model/replicate | |
| Replicates | |
| Total simulations | |

---

# 67. Required Summary Table — Difficulty Spread

| Model | Min Gold | P25 | Median | P75 | Max | Median Score Range |
|---|---:|---:|---:|---:|---:|---:|
| Regular | | | | | | |
| Strong | | | | | | |

---

# 68. Required Summary Table — Ranking Stability

| Model/Metric | Replicate Stability | Candidate-Cap | Temperature | Familiarity Curve |
|---|---:|---:|---:|---:|
| Regular Gold | | | | |
| Regular Median | | | | |
| Strong Gold | | | | |
| Strong Median | | | | |

Use mean Spearman or another clearly identified statistic.

---

# 69. Required Summary Table — Model Agreement

| Comparison | Spearman |
|---|---:|
| Regular Gold vs Strong Gold | |
| Regular Median vs Strong Median | |
| Regular Gold vs Regular Hexalink | |
| Strong Gold vs Strong Hexalink | |

---

# 70. Required Summary Table — Candidate Predictors

List the strongest existing non-M8 mathematical predictors:

| Metric | Regular Difficulty Correlation | Strong Difficulty Correlation | Cost | Recommendation |
|---|---:|---:|---|---|

Do not force metrics into this table if correlations are weak.

---

# 71. Required Questions

Answer explicitly:

### Q1
How many genuinely distinct puzzles were benchmarked?

### Q2
Is REGULAR puzzle ranking stable across independent Monte Carlo replicates?

### Q3
Is STRONG puzzle ranking stable across independent Monte Carlo replicates?

### Q4
Which synthetic difficulty measure is most stable: Gold rate, mean score, or median score?

### Q5
Are broad difficulty bands substantially more stable than exact ordinal ranks?

### Q6
How sensitive is puzzle ranking to candidate cap?

### Q7
How sensitive is puzzle ranking to decision temperature?

### Q8
How sensitive is puzzle ranking to familiarity-curve uncertainty?

### Q9
Do REGULAR and STRONG generally agree about which puzzles are difficult?

### Q10
Are score difficulty and Hexalink difficulty distinct dimensions?

### Q11
How strongly does rare-word dependency explain puzzle difficulty?

### Q12
Which existing M7A/M7B mathematical metrics best predict synthetic difficulty?

### Q13
Are those mathematical predictors sufficiently strong to reduce future simulation cost?

### Q14
What types of puzzles produce the largest M7B-vs-M8.1 disagreement?

### Q15
Does the 100-point Gold threshold continue to look non-trivial under the frozen models?

### Q16
Are 500 simulations necessary, or can 100/250 preserve candidate ordering?

### Q17
What would it cost to synthetically evaluate 10 candidate grids for one Daily puzzle?

### Q18
Would a two-stage M7B → M8.1 selector be computationally practical?

### Q19
Is M8.1 sufficiently robust for use as a **secondary comparative signal** in M9?

### Q20
What exact signals should M9 consider, if any?

Do not answer these from assumptions.

---

# 72. M9 Signal Recommendation

If evidence supports M9, recommend a **small, interpretable set** of signals.

For example, the evidence might support something conceptually like:

```text
REGULAR median score
REGULAR Gold rate
STRONG Gold rate
Hexalink difficulty
```

or a smaller subset.

Do not assume those are correct.

Derive the recommendation from M8.2.

Prefer:

```text
2–4 robust signals
```

over a large feature set.

---

# 73. Do Not Design M9 Ranking Formula Yet

M8.2 may recommend signals.

It must not determine final production weights.

Do not modify:

```text
candidate-ranker.js
strategic-selector.js
```

for M8.1 integration.

That belongs in M9.

---

# 74. Final Decision

At the end of the review choose exactly one:

### A — Proceed to M9

Use if:

```text
comparative rankings are sufficiently stable,
difficulty separation is meaningful,
and runtime is practical.
```

State which signals M9 should investigate.

### B — M8.1 remains analysis-only

Use if:

```text
absolute values vary,
but comparative rankings are too unstable
for candidate selection.
```

### C — Specific M8.2 follow-up required

Use only if a narrow unresolved issue prevents a decision.

State exactly what it is.

Do not default to C simply because the simulator is imperfect.

---

# 75. Important Interpretation Constraint

Never describe:

```text
REGULAR Gold = X%
```

as:

```text
X% of regular human Qjynn players will get Gold.
```

Correct language:

```text
The frozen REGULAR synthetic model produced
an X% Gold rate under this benchmark.
```

M8.2 measures synthetic comparative difficulty.

It does not replace human validation.

---

# 76. Acceptance Criteria

M8.2 passes if:

1. the frozen M8.1 model remains unchanged;
2. real familiarity is verified;
3. at least 50 genuinely distinct grids are benchmarked if legitimately available;
4. target population is 100;
5. REGULAR and STRONG receive full primary profiling;
6. independent Monte Carlo replicates are run;
7. exact ranking stability is measured;
8. difficulty-band stability is measured;
9. parameter robustness is measured;
10. REGULAR-vs-STRONG agreement is measured;
11. Hexalink difficulty remains separate;
12. rare-word dependency is analyzed;
13. available M7A/M7B metrics are correlated with synthetic difficulty;
14. convergence and computational cost are measured;
15. all prior tests pass;
16. production rules/files remain unchanged;
17. M9 receives a clear A/B/C recommendation.

---

# 77. Production Safety Verification

Explicitly verify no unintended changes to:

```text
game.js
qjynn-rules.js
qjynn-words-v1.0.txt
M6 generation rules
M7B production ranking
medal thresholds
six-turn rule
Hexalink rules
```

---

# 78. Git Handling

Do not commit automatically.

Do not use:

```bash
git add .
```

The locally generated third-party `wordfreq` export may remain intentionally untracked.

At completion show:

```bash
git status --short
git diff --stat
```

Separate:

```text
project-owned M8.2 files
third-party/local analysis data
```

in the report.

---

# 79. Stop Condition

When M8.2 is complete:

1. save all analysis artifacts;
2. create `M82_LARGE_SCALE_DIFFICULTY_BENCHMARK_REVIEW.md`;
3. run the complete test suite;
4. verify production safety;
5. report distinct puzzle count;
6. report total simulation count;
7. report REGULAR ranking stability;
8. report STRONG ranking stability;
9. report parameter robustness;
10. report strongest mathematical predictors;
11. report simulation/runtime cost;
12. answer Q1–Q20;
13. give final recommendation A, B, or C;
14. show `git status --short`;
15. show `git diff --stat`;
16. stop.

Do not implement M9.

Wait for review.