# Qjynn M9 — Hybrid Candidate Selection & Daily Grid Generator

Implement **M9 only**.

M1–M8.2 are complete and approved.

M9 is the first milestone that may use the validated analytical findings from M8.1/M8.2 in the Daily-grid candidate-selection pipeline.

The objective is:

> Build a deterministic, explainable hybrid selector that first enforces all existing mathematical/gameplay requirements, then uses bounded synthetic-player profiling as secondary evidence when choosing among certified Daily-grid candidates.

M9 must **not** replace mathematical certification with simulation.

M9 must **not** claim that synthetic players represent actual human populations.

M9 must **not** change Qjynn gameplay.

---

# 1. Core Architecture

Implement the conceptual pipeline:

```text
10-letter Daily answer
        ↓
extract 6-letter Hexalink
        ↓
generate valid candidate grids
        ↓
M6 hard certification
        ↓
cheap mathematical candidate characterization
        ↓
shortlist
        ↓
M8.1 REGULAR synthetic profiling
        ↓
optional STRONG profiling
        ↓
separate Hexalink characterization
        ↓
deterministic final selection
        ↓
Daily Grid artifact
```

The mathematical layer remains authoritative for validity.

Synthetic profiling is secondary comparative evidence only.

---

# 2. Production Invariants

Do not change:

```text
game.js
qjynn-rules.js
qjynn-words-v1.0.txt
word validity
canonical consonant inventory
six-turn limit
canonical scoring
Gold threshold = 100
Silver/Bronze thresholds
Hexalink rules
M6 hard gates
```

Do not weaken any existing certification requirement.

---

# 3. Preserve Existing M7B

Do not silently replace M7B.

Existing M7B behavior must remain reproducible.

Introduce M9 as a separate selector/version.

Conceptually:

```text
M7B selector
M9 hybrid selector
```

must coexist.

This allows direct comparison and rollback.

---

# 4. Freeze M8.1

Use the approved M8.1 real-frequency player configuration unchanged.

Expected metadata:

```text
simulatorVersion = m8.1
playerModelVersion = m8.1.players.0
familiarityProvider = wordfreq
source = upstream v3.2
normalization = zipf-linear-v1
```

Use actual repository version constants rather than duplicating strings if available.

Do not retune:

```text
candidate cap
temperature
familiarity curves
lookahead
known probability
notice probability
move utility
```

M9 consumes the frozen simulator.

It does not recalibrate it.

---

# 5. Real Familiarity Is Required

Production-quality M9 profiling must use the approved real-frequency export.

Do not silently fall back to heuristic familiarity.

If the real familiarity source is unavailable:

```text
M9 synthetic profiling must fail closed
```

or explicitly enter a documented non-production analysis mode.

It must not quietly generate a production Daily grid using heuristic familiarity.

---

# 6. Separate Certification From Selection

Every M9 candidate must first satisfy existing hard certification.

Conceptually:

```javascript
if (!candidate.certified) {
    reject(candidate);
}
```

Synthetic results must never rescue an uncertified candidate.

Likewise:

```text
high simulated score
```

cannot compensate for:

```text
failed Gold certificate
invalid Hexalink
invalid grid
rule violation
```

---

# 7. Candidate Population

For one Daily answer, generate a sufficiently broad candidate population using existing approved generation infrastructure.

Do not hard-code a single number before measuring cost.

Support configurable values such as:

```text
rawCandidates
certifiedCandidates
shortlistSize
```

Provide conservative defaults.

A reasonable initial design target is:

```text
generate enough candidates to obtain
at least 10 certified finalists
```

when feasible.

Do not endlessly generate candidates if certification yield is poor.

Use explicit attempt/time limits.

---

# 8. Candidate Identity

Every candidate must have deterministic identity derived from relevant immutable inputs such as:

```text
answer
Hexalink
generation seed
grid
generator version
```

Record a grid hash.

Duplicate grid hashes must be removed before ranking.

---

# 9. Stage 1 — Hard Certification

Run existing M6 certification unchanged.

Record:

```text
candidateId
gridHash
certified
Gold certificate
certificate score
certificate turns
Hexalink validity
generation attempts
```

Reject all failures.

Do not rerun expensive proof work unnecessarily if valid cached certification exists.

---

# 10. Stage 2 — Cheap Mathematical Characterization

For every certified candidate compute existing inexpensive opportunity metrics.

M8.2 found useful relationships for measures including:

```text
raw legal moves
unique playable words
unique tile masks
unique skeletons
```

Use actual existing repository metric names.

Do not invent equivalent-but-different metrics unnecessarily.

---

# 11. Avoid Redundant Metric Stacking

M8.2 found the cheap opportunity metrics are highly correlated, often above .85.

Therefore do **not** create a formula such as:

```text
legalMoves
+ playableWords
+ tileMasks
+ skeletons
```

as though they were independent evidence.

Choose one representative opportunity-density metric for primary shortlist use.

---

# 12. Representative Cheap Metric Selection

Prefer an existing metric that balances:

```text
predictive relationship
computational cost
interpretability
stability
```

M8.2 suggests likely candidates include:

```text
unique playable words
raw legal moves
```

but Codex must inspect the existing implementation and M8.2 artifacts before choosing.

Document the choice.

Do not optimize the metric against the same candidate set being selected.

---

# 13. Mathematical Shortlist

Use hard certification plus the selected cheap mathematical characterization to reduce the candidate population before Monte Carlo simulation.

The shortlist logic should be simple and explainable.

Avoid an opaque weighted model.

Potential architecture:

```text
certified candidates
        ↓
remove pathological opportunity extremes
        ↓
retain diverse plausible candidates
        ↓
top K / stratified K
```

Do not assume "more legal words is always better."

---

# 14. Avoid Selecting Only the Easiest Candidate

The purpose of M9 is not:

> Find the grid producing the highest REGULAR score.

That could systematically generate overly easy Daily puzzles.

Likewise, do not always select the lowest simulated score.

The target is a **playable, challenging, Gold-capable Daily grid**, not maximization or minimization of synthetic difficulty.

---

# 15. Initial Difficulty Target

Do not invent an absolute human difficulty target.

M8.2 does not support statements such as:

```text
REGULAR Gold should be 15%
```

Instead, initially use **relative candidate difficulty within the certified candidate set**.

Prefer broad comparative position rather than absolute Gold probability.

---

# 16. Stage 3 — REGULAR Profiling

REGULAR is the primary synthetic selector model.

For every shortlisted candidate run the frozen M8.1 REGULAR model.

Use a configurable run count.

Default M9 production-quality profiling should initially use:

```text
250 or 500 simulations/candidate
```

Select the default based on measured M8.2 convergence/cost and document the decision.

Do not use fewer than 100.

---

# 17. Primary Synthetic Metric

M8.2 found REGULAR mean score had the strongest replicate stability:

```text
mean Spearman ≈ .923
```

Therefore use:

```text
REGULAR mean score
```

as the primary synthetic scoring-difficulty signal unless implementation evidence reveals a correctness problem.

Do not use Gold rate as the sole primary signal.

---

# 18. Secondary REGULAR Metrics

Record:

```text
REGULAR median score
REGULAR Gold rate
REGULAR Hexalink rate
REGULAR rare-word dependency
REGULAR mean played-word familiarity
```

These provide diagnostics and tie-breaking evidence.

Do not combine all of them automatically into one score.

---

# 19. Difficulty Bands Rather Than Exact Ranks

M8.2 showed broad bands were substantially more stable than exact ranks.

Therefore classify shortlisted candidates into relative bands.

For example:

```text
easier
middle
harder
```

derived from the current candidate population.

These are **selector-internal relative bands**, not user-facing difficulty labels.

---

# 20. Preferred Candidate Region

For initial M9 behavior, prefer candidates in the **middle comparative difficulty region** rather than either extreme.

Conceptually:

```text
avoid easiest tail
avoid hardest tail
prefer central band
```

unless insufficient candidates exist.

Do not translate this into claims about real human difficulty.

---

# 21. Configurable Band Policy

Implement policy configuration such as:

```javascript
difficultyPolicy: {
    preferredBand: "middle",
    allowAdjacentBands: true
}
```

Use repository conventions.

Do not hard-code policy deeply into simulator logic.

---

# 22. Tie-Breaking Philosophy

Within the preferred difficulty region, use deterministic staged tie-breakers.

Do not immediately create an arbitrary weighted sum.

A conceptual order may be:

```text
1. hard certification
2. preferred REGULAR difficulty band
3. stable score-difficulty evidence
4. vocabulary accessibility
5. Hexalink characteristics
6. deterministic candidate identity
```

Codex must derive the exact implementation from available metrics.

---

# 23. STRONG Confirmation

STRONG should be used as a **secondary confirmation model**, not necessarily run on every raw candidate.

Preferred design:

```text
REGULAR shortlist
        ↓
top few finalists
        ↓
STRONG profiling
```

For example:

```text
3–5 finalists
```

if practical.

Keep the count configurable.

---

# 24. Purpose of STRONG

STRONG helps identify candidates where difficulty changes unusually sharply with player capability.

Record:

```text
Strong mean score
Strong median score
Strong Gold rate

Strong - Regular mean score
Strong - Regular Gold rate
```

Do not automatically prefer the smallest or largest gap.

Use it as a diagnostic/tie-break signal.

---

# 25. Skill Gap

Define an interpretable:

```text
skillGap
```

based on REGULAR-vs-STRONG performance.

The purpose is to identify puzzles that may reward stronger vocabulary/strategy.

Keep the raw components available.

Do not build an opaque transformed metric unless necessary.

---

# 26. Vocabulary Accessibility

Use M8.1 rare-word dependency as a separate accessibility diagnostic.

A candidate whose REGULAR success overwhelmingly requires very low-frequency words may be less broadly approachable than another candidate with similar score difficulty.

However:

```text
rare words are not invalid words
```

and difficult vocabulary is a legitimate part of Qjynn.

Do not hard-reject candidates solely for rare-word dependency.

---

# 27. Accessibility Guardrail

If evidence supports it, implement only a conservative guardrail against extreme vocabulary dependence.

For example:

```text
flag extreme outlier
```

rather than:

```text
reject any candidate above arbitrary threshold
```

Any threshold must be relative to the candidate population or inherited from existing M8.1 analytical thresholds.

Do not invent a "human vocabulary" cutoff.

---

# 28. Hexalink Remains Separate

Do not combine Hexalink rate directly into the main score-difficulty value.

Maintain:

```text
scoreDifficulty
hexalinkDiscoverability
```

as separate dimensions.

M8.2 showed Hexalink simulation is materially less stable than score simulation.

---

# 29. Hexalink Use in Selection

Hexalink metrics may be used conservatively to avoid pathological finalists.

Examples:

```text
extremely obvious Hexalink
extremely hidden Hexalink
```

but do not impose aggressive thresholds without evidence.

Prefer diagnostic reporting initially.

---

# 30. Preserve Hexalink Diversity

If multiple finalists have similar scoring difficulty, prefer selection logic that does not systematically choose the same Hexalink geometry pattern every day.

Use existing geometry metrics if available.

Do not add randomness.

Deterministic diversity rules are acceptable.

---

# 31. No Opaque Weighted Score

Do not initially implement:

```text
0.37 * RegularMean
+ 0.22 * StrongGold
+ 0.19 * RareWord
+ ...
```

There is insufficient empirical evidence for such weights.

Prefer:

```text
gates
bands
ordered tie-breakers
```

This keeps M9 explainable and auditable.

---

# 32. Deterministic Selector

Given identical:

```text
answer
Hexalink
candidate-generation seed
configuration
versions
frequency source
```

M9 must select exactly the same grid.

Monte Carlo randomness must use deterministic derived seeds.

Worker scheduling must not affect results.

---

# 33. Selection Explanation

For every selected Daily grid generate a private explanation object.

Conceptually:

```json
{
  "selector": "M9",
  "selectedCandidate": "...",
  "certified": true,
  "difficultyBand": "middle",
  "regularMeanScore": 84.2,
  "regularGoldRate": 0.11,
  "strongMeanScore": 91.4,
  "skillGap": 7.2,
  "rareWordDependency": "...",
  "hexalinkRate": "...",
  "selectionReasons": [...]
}
```

Use actual measured values.

Do not expose private answer/certificate information publicly.

---

# 34. Candidate Audit Trail

For every candidate considered by M9, preserve enough private information to reconstruct why it:

```text
failed certification
failed shortlist
reached simulation
reached finalist stage
was selected
was not selected
```

This is important for debugging Daily grids.

---

# 35. M9 Selector API

Create a clean interface such as:

```javascript
selectDailyGridM9(options)
```

or repository-equivalent.

Inputs should include:

```text
answer
Hexalink
seed
configuration
```

Output should clearly separate:

```text
public puzzle artifact
private selection analysis
```

Do not couple M9 directly to UI code.

---

# 36. Configuration

Centralize M9 configuration.

Include items such as:

```text
candidate attempt limit
certified candidate target
mathematical shortlist size
REGULAR simulation runs
STRONG finalist count
STRONG simulation runs
difficulty-band policy
accessibility guardrail mode
Hexalink diagnostic policy
```

Version the configuration.

---

# 37. Recommended Initial Computational Shape

Use M8.2 performance evidence to start with something operationally reasonable.

A plausible initial architecture is:

```text
generate many
↓
obtain ~10 certified shortlist candidates
↓
REGULAR 250–500 runs each
↓
retain ~3–5 finalists
↓
STRONG 250–500 runs each
↓
select
```

These are starting design ranges, not mandatory constants.

Measure actual runtime.

---

# 38. Two-Stage REGULAR Profiling

Investigate whether M9 can safely reduce runtime with:

```text
all shortlist candidates:
100–250 REGULAR runs

finalists:
500 REGULAR runs
```

Use deterministic paired seeds.

Compare the preliminary and final candidate ordering.

If early profiling frequently eliminates eventual best candidates, do not use it.

---

# 39. Safe Shortlisting

A fast first pass must not over-prune.

If implementing two-stage profiling:

```text
retain enough candidates
```

so Monte Carlo noise cannot easily eliminate plausible finalists.

Document the retention rule.

---

# 40. M7B Comparison Mode

Implement an analysis mode that, when possible, runs:

```text
M7B selection
vs
M9 selection
```

for the same answer/seed.

Do not change M7B.

Record whether the selected grids differ.

---

# 41. Evaluation Population

Evaluate M9 on a substantial offline set.

Target:

```text
50 answers
```

Prefer the same 50-answer M8.2 benchmark where practical for continuity.

If candidate regeneration makes this prohibitively expensive, use at least:

```text
30 answers
```

and document the limitation.

---

# 42. Multiple Candidates Per Answer

Unlike M8.2, M9 must evaluate **selection among multiple candidates for the same answer**.

For each evaluation answer, target at least:

```text
5 certified candidates
```

Prefer:

```text
10
```

where generation yield permits.

This is central to M9.

---

# 43. Evaluation Questions

For each answer determine:

```text
candidate difficulty spread
selected candidate relative position
whether M9 avoids extremes
whether selection is deterministic
whether accessibility is pathological
whether Hexalink characteristics are pathological
runtime
```

---

# 44. Selected Difficulty Position

For every answer report selected candidate percentile/rank within that answer's certified candidate set for:

```text
REGULAR mean score
REGULAR Gold rate
STRONG mean score
```

The selector should generally avoid consistently choosing:

```text
absolute easiest
absolute hardest
```

unless candidate populations are narrow.

---

# 45. Selection Diversity

Across evaluation answers report how often M9 selects candidates from:

```text
easier band
middle band
harder band
```

Given the default middle-band policy, most should be middle.

Do not artificially force exact percentages.

---

# 46. M7B Comparison

Where M7B can be run or reconstructed, compare:

```text
M7B selected grid
M9 selected grid
```

on:

```text
REGULAR mean score
REGULAR Gold rate
STRONG mean score
rare-word dependency
Hexalink rate
cheap mathematical metric
```

This is analysis only.

Do not claim M9 is superior merely because it chooses a different grid.

---

# 47. Ablation Analysis

Evaluate M9 selection with components removed:

```text
math only
math + REGULAR
math + REGULAR + STRONG
full M9 diagnostics
```

Determine what each stage actually contributes.

Do not use ablation to tune arbitrary weights.

---

# 48. Important Ablation Question

Determine whether STRONG materially changes finalist selection after REGULAR profiling.

If STRONG almost never changes the result:

```text
say so
```

It may not justify production compute.

If it frequently changes selection for understandable reasons:

```text
say so
```

---

# 49. Cheap Metric Contribution

Determine whether the cheap mathematical shortlist preserves candidates that REGULAR later considers desirable.

Measure:

```text
shortlist recall
```

against a broader simulated candidate population on a manageable subset.

The mathematical pre-filter must not systematically discard the best middle-difficulty candidates.

---

# 50. Shortlist Recall Experiment

For approximately:

```text
10 answers
```

generate a broader certified population if practical.

Example:

```text
20–30 certified candidates/answer
```

Run REGULAR profiling broadly enough to identify the preferred middle region.

Then test whether the cheap shortlist retained those candidates.

This is one of M9's most important validation checks.

---

# 51. Avoid Circular Validation

Do not define the cheap shortlist based directly on the same REGULAR results used to test shortlist recall.

The cheap stage must remain independent.

---

# 52. Gold Capability Is Still Mandatory

Every selected grid must retain an existing valid six-turn ≥100-point certificate.

The simulator is not the proof.

Record:

```text
certificateScore
certificateTurns
```

privately for selected candidates.

---

# 53. Certificate Route vs Synthetic Routes

Optionally compare the mathematical Gold certificate with synthetic-play traces.

This may reveal grids where:

```text
Gold is mathematically possible
but certificate route relies on highly inaccessible play
```

Use this diagnostically.

Do not require synthetic players to reproduce the exact certificate.

---

# 54. Selected Puzzle Sanity Review

For a deterministic sample of approximately 10 M9-selected puzzles, produce concise private summaries showing:

```text
answer
Hexalink
selected grid
Gold certificate summary
cheap opportunity metric
REGULAR profile
STRONG profile
rare-word dependency
Hexalink profile
selection rationale
```

These are for human review before production use.

---

# 55. Performance Budget

Measure separately:

```text
candidate generation
M6 certification
cheap metric calculation
REGULAR simulation
STRONG simulation
total selection
```

Report median and P90 latency per Daily answer.

---

# 56. Parallelism

M9 may parallelize independent candidate simulation if the repository already has safe infrastructure or implementation is straightforward.

However:

```text
determinism must remain invariant
```

with respect to worker count.

Do not introduce complex concurrency solely for this milestone.

---

# 57. Caching

Cache deterministic candidate profiles keyed by:

```text
grid hash
simulator version
player model version
run count
master seed/config version
familiarity source version
```

Do not reuse cached results when any relevant version changes.

---

# 58. Resume Capability

If the evaluation batch is long-running, support safe resume from completed candidate profiles where practical.

Do not allow partial/corrupt profiles to masquerade as completed results.

---

# 59. Public Daily Artifact

Define or reuse a production-facing Daily-grid artifact containing only information needed by the game.

Do not expose:

```text
answer
private certificate
candidate population
synthetic scores
frequency ranks
selection rationale
private seeds
```

unless the existing game architecture explicitly requires a field.

---

# 60. Private Daily Manifest

Create a separate private artifact containing:

```text
date/id
answer
Hexalink
selected grid
selector version
generator version
candidate counts
certificate
synthetic profiles
selection rationale
```

This will be important for future puzzle QA.

---

# 61. Daily Grid Generator Interface

If the project does not already have one, create an offline CLI for generating a Daily puzzle.

Conceptually:

```bash
node tools/daily/generate-daily.js \
  --answer WATERMELON \
  --hexalink <value> \
  --seed <seed>
```

Adapt to existing repository structure.

Do not force the operator to manually assemble candidate files.

---

# 62. Batch Generation

Support an offline batch mode for multiple answer/Hexalink inputs.

Conceptually:

```bash
node tools/daily/generate-batch.js \
  --input daily-answers.csv \
  --output generated/
```

Only implement if consistent with current architecture.

Do not introduce unnecessary dependencies.

---

# 63. Failure Behavior

M9 must fail clearly when:

```text
answer invalid
Hexalink invalid
frequency source missing
insufficient certified candidates
certification failure
simulation failure
configuration invalid
```

Do not silently select a lower-quality uncertified candidate.

---

# 64. Insufficient Candidate Fallback

If the desired certified candidate count is not reached but at least one valid candidate exists:

do not silently change policy.

Return an explicit status such as:

```text
INSUFFICIENT_CANDIDATE_POOL
```

with the valid candidates preserved for operator review.

A configurable operator-approved degraded mode may be designed, but do not make it default.

---

# 65. Explainability

For every final decision record ordered reasons.

Example conceptually:

```text
1. passed M6 certification
2. survived opportunity-density shortlist
3. classified middle REGULAR difficulty
4. acceptable accessibility profile
5. STRONG profile did not indicate anomaly
6. deterministic tie-break over equivalent finalists
```

Use actual reasons from the implemented selector.

---

# 66. Deterministic Tie Break

When candidates remain equivalent under all meaningful criteria, use:

```text
grid hash
candidate ID
```

or another deterministic stable identity.

Never call `Math.random()` to select a Daily puzzle.

---

# 67. Required Tests — Certification

Add tests verifying:

1. uncertified candidate can never be selected;
2. failed Hexalink candidate can never be selected;
3. synthetic score cannot override hard failure;
4. Gold certificate remains mandatory;
5. production scoring remains unchanged.

---

# 68. Required Tests — Determinism

Add tests verifying:

6. identical input/config produces identical selected grid;
7. worker scheduling does not affect selection if parallelism is used;
8. Monte Carlo seed derivation deterministic;
9. duplicate candidates removed;
10. deterministic tie-break works.

---

# 69. Required Tests — Real Familiarity

Add tests verifying:

11. production M9 requires real frequency provider;
12. accidental heuristic fallback is rejected;
13. frequency source version enters cache/profile identity;
14. familiarity data does not affect word validity.

---

# 70. Required Tests — Shortlist

Add tests verifying:

15. shortlist size respected;
16. hard-certified candidates only;
17. representative cheap metric computed correctly;
18. redundant metrics are not accidentally summed into an undocumented composite;
19. shortlist deterministic.

---

# 71. Required Tests — Synthetic Selection

Add tests verifying:

20. REGULAR mean score is available to selector;
21. difficulty-band assignment deterministic;
22. middle-band preference behaves as documented;
23. extremes are avoided when suitable middle candidates exist;
24. Gold rate alone cannot dominate primary selection;
25. STRONG stage receives only intended finalists.

---

# 72. Required Tests — Separation

Add tests verifying:

26. score difficulty and Hexalink profile remain separate;
27. rare-word dependency is diagnostic, not word-validity logic;
28. public artifact contains no private certificate;
29. public artifact contains no synthetic-player analysis;
30. private manifest contains required audit metadata.

---

# 73. Regression Tests

All previous M1–M8.2 tests must pass.

M8.2 baseline:

```text
207 passed
0 failed
```

No gameplay regression is acceptable.

---

# 74. Evaluation Artifacts

Create at minimum:

```text
analysis/m9-evaluation-manifest.csv
analysis/m9-candidate-pools.csv
analysis/m9-selected-puzzles.csv
analysis/m9-selection-position.csv
analysis/m9-m7b-comparison.csv
analysis/m9-ablation.csv
analysis/m9-shortlist-recall.csv
analysis/m9-performance.csv
analysis/m9-summary.json
```

Where a requested comparison is impossible due to unavailable M7B data, leave it explicitly unavailable rather than fabricating results.

---

# 75. Candidate Pool CSV

One row per certified candidate.

Include:

```text
answer
candidate_id
grid_hash
generation_seed
certificate_score
certificate_turns

cheap_metric_name
cheap_metric_value

shortlisted

regular_runs
regular_mean_score
regular_median_score
regular_gold_rate
regular_hexalink_rate
regular_rare_word_dependency

finalist

strong_runs
strong_mean_score
strong_median_score
strong_gold_rate

difficulty_band
selected
selection_reason
```

Use blank/NA values for stages a candidate never reached.

---

# 76. Selected Puzzle CSV

One row per evaluation answer.

Include:

```text
answer
Hexalink
selected_candidate_id
grid_hash
certified_candidate_count
shortlist_count
finalist_count

regular_mean_score
regular_median_score
regular_gold_rate

strong_mean_score
strong_gold_rate

skill_gap
rare_word_dependency
hexalink_rate

difficulty_band
selection_reason
total_selection_ms
```

---

# 77. Selection Position CSV

For each selected puzzle report its within-answer position for:

```text
REGULAR mean score percentile
REGULAR Gold percentile
STRONG mean-score percentile
cheap mathematical metric percentile
```

This determines whether M9 systematically drifts toward an extreme.

---

# 78. Shortlist Recall CSV

For the broader-candidate subset include:

```text
answer
certified_candidates
shortlist_size
preferred_candidates_by_full_REGULAR_profile
preferred_candidates_retained
recall
```

Also report aggregate recall.

---

# 79. Performance CSV

Include per answer:

```text
generation_ms
certification_ms
cheap_metrics_ms
regular_simulation_ms
strong_simulation_ms
total_ms
candidate_count
shortlist_count
finalist_count
```

Report median/P90 in the review.

---

# 80. M9 Review Document

Create:

```text
M9_HYBRID_CANDIDATE_SELECTION_REVIEW.md
```

Include:

1. objective;
2. architecture;
3. files created/modified;
4. production invariants;
5. frozen M8.1 metadata;
6. candidate-generation policy;
7. hard certification;
8. selected cheap mathematical metric and rationale;
9. shortlist algorithm;
10. REGULAR profiling configuration;
11. difficulty-band implementation;
12. STRONG finalist policy;
13. vocabulary-accessibility treatment;
14. Hexalink treatment;
15. tie-breaking;
16. public/private artifact separation;
17. evaluation population;
18. candidate-pool sizes;
19. selection-position results;
20. M7B comparison if available;
21. ablation;
22. shortlist recall;
23. selected-puzzle sanity review;
24. performance;
25. determinism;
26. test results;
27. limitations;
28. answers to Q1–Q20 below;
29. recommendation;
30. `git status --short`;
31. `git diff --stat`.

---

# 81. Required Architecture Table

| Stage | Purpose | Hard/Soft | Metric/Method |
|---|---|---|---|
| Generation | Produce candidates | — | Existing generator |
| Certification | Guarantee valid/Gold-capable | Hard | M6 |
| Cheap shortlist | Reduce simulation cost | Soft | |
| REGULAR | Comparative score difficulty | Soft | Mean score primary |
| STRONG | Skill-sensitive confirmation | Soft | |
| Hexalink | Separate discoverability | Soft/diagnostic | |
| Final selection | Deterministic choice | — | Ordered policy |

Fill with actual implementation.

---

# 82. Required Evaluation Table

| Property | Result |
|---|---:|
| Answers evaluated | |
| Mean certified candidates/answer | |
| Mean shortlist size | |
| Mean finalists | |
| Middle-band selections | |
| Easier-band selections | |
| Harder-band selections | |
| Deterministic rerun mismatches | |
| Selection failures | |

---

# 83. Required Performance Table

| Stage | Median | P90 |
|---|---:|---:|
| Candidate generation | | |
| Certification | | |
| Cheap shortlist | | |
| REGULAR simulation | | |
| STRONG simulation | | |
| Total M9 selection | | |

---

# 84. Required Questions

Answer explicitly:

### Q1
What exact cheap mathematical metric was selected and why?

### Q2
How many raw/certified candidates are normally required to obtain a useful shortlist?

### Q3
Does the cheap shortlist retain candidates later preferred by REGULAR profiling?

### Q4
What shortlist size provides adequate recall?

### Q5
Was REGULAR mean score confirmed as the most useful primary synthetic selection signal?

### Q6
How stable is the within-answer candidate ordering?

### Q7
Does the middle-band policy avoid systematic easy/hard extremes?

### Q8
How often does STRONG profiling change the finalist preference?

### Q9
Is STRONG worth its additional runtime?

### Q10
How large are typical REGULAR-to-STRONG skill gaps?

### Q11
Does rare-word dependency identify meaningful accessibility outliers?

### Q12
Should rare-word dependency be a guardrail, tie-breaker, or diagnostic only?

### Q13
Is Hexalink simulation stable enough to influence selection, or should it remain diagnostic?

### Q14
How does M9 differ from M7B selection where paired data is available?

### Q15
What does each ablation stage contribute?

### Q16
What is median and P90 generation time per Daily puzzle?

### Q17
Can two-stage REGULAR profiling materially reduce runtime without damaging selection?

### Q18
Is the final selector fully deterministic?

### Q19
Are selected puzzles always M6-certified and Gold-capable?

### Q20
Is M9 ready to generate candidate Daily grids for **human QA testing**?

Do not answer from intuition.

---

# 85. Human QA Is the Goal

M9 does not establish that automatically generated Daily grids should immediately be published without review.

The immediate target is:

```text
automatic generation
        ↓
automatic certification
        ↓
hybrid selection
        ↓
human QA
        ↓
Daily publication
```

This is an important boundary.

---

# 86. Final Decision

At completion choose exactly one:

### A — M9 ready for human-QA Daily generation

Use if:

```text
certification is reliable
selection deterministic
shortlist recall acceptable
synthetic selection behaves sensibly
runtime practical
```

### B — M9 architecture works but selector policy needs a specific correction

State the exact correction.

### C — Hybrid selection is not supported by the evidence

State why and recommend fallback to existing selection.

Do not implement a follow-on milestone.

---

# 87. No Automatic Publishing

Do not connect M9 to:

```text
website deployment
production scheduler
automatic Daily publication
```

in this milestone.

Generation and selection only.

---

# 88. No Gameplay Modification

Do not change gameplay based on M9 results.

In particular, do not change:

```text
100-point Gold threshold
medal thresholds
six-turn limit
word validity
Hexalink rules
scoring
```

Those require separate evidence.

---

# 89. Git Handling

Do not commit automatically.

Do not use:

```bash
git add .
```

The local third-party:

```text
data/familiarity/wordfreq-en-large.json
```

must remain separate unless repository policy has explicitly changed.

At completion show:

```bash
git status --short
git diff --stat
```

Clearly distinguish:

```text
project-owned M9 changes
local third-party data
```

---

# 90. Stop Condition

When M9 is complete:

1. save all M9 analysis artifacts;
2. create `M9_HYBRID_CANDIDATE_SELECTION_REVIEW.md`;
3. run the complete test suite;
4. verify all production/gameplay invariants;
5. report evaluation answer count;
6. report candidate-pool statistics;
7. report shortlist recall;
8. report REGULAR selection behavior;
9. report STRONG contribution;
10. report selected difficulty-band distribution;
11. report rare-word/accessibility findings;
12. report Hexalink findings;
13. report M7B comparison if available;
14. report median/P90 runtime;
15. confirm deterministic reruns;
16. answer Q1–Q20;
17. give final recommendation A, B, or C;
18. show `git status --short`;
19. show `git diff --stat`;
20. stop.

Do not begin M10.

Wait for review.