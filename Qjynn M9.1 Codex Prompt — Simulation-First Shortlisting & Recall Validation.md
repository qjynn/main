# Qjynn M9.1 — Simulation-First Shortlisting & Recall Validation

Implement **M9.1 only**.

M1–M9 are complete and approved.

Do not begin M10.

M9 established a deterministic hybrid candidate selector, but the initial cheap mathematical shortlist is not sufficiently reliable for unattended production use.

The principal finding was:

```text
average shortlist recall ≈ 0.408
minimum shortlist recall = 0
```

when using the current cheap mathematical prefilter.

M9.1 must answer:

> Can a low-cost REGULAR synthetic-player pass replace or augment the weak mathematical prefilter while preserving nearly all candidates that would be preferred by a higher-quality final simulation?

This milestone is about **shortlist recall, simulation staging, and runtime**.

Do not redesign M8.1.

Do not change gameplay.

---

# 1. Core Objective

Build and validate a **simulation-first shortlisting pipeline**.

Conceptually:

```text
certified candidates
        ↓
low-run REGULAR simulation
        ↓
shortlist
        ↓
high-run REGULAR simulation
        ↓
small finalist set
        ↓
STRONG confirmation
        ↓
final selection
```

The exact production configuration must be derived from measured recall/runtime tradeoffs.

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
canonical scoring
Gold/Silver/Bronze thresholds
Hexalink rules
M6 hard certification
M8.1 player models
M8.1 familiarity curves
M8.1 real-frequency provider
```

Do not alter Qjynn gameplay.

---

# 3. Preserve Existing M9

Do not delete or overwrite the current M9 cheap-metric shortlist.

Keep it available as:

```text
M9_MATH_SHORTLIST
```

or repository-equivalent.

Implement M9.1 as a new policy/version so the two approaches can be compared directly.

M9 must remain reproducible.

---

# 4. Freeze the M8.1 REGULAR Model

Use the approved real-frequency REGULAR configuration exactly as implemented.

Do not retune:

```text
known-word curves
notice model
candidate cap
temperature
lookahead
move utility
frequency normalization
```

M9.1 compares run counts and shortlist policies.

It does not recalibrate synthetic behavior.

---

# 5. Real Familiarity Required

Production-quality M9.1 evaluation must use the real `wordfreq` provider.

Fail closed if the real provider is unavailable.

Do not silently fall back to heuristic familiarity.

Test fixtures may explicitly use mocks/fallback where appropriate.

---

# 6. Candidate Population

For each evaluation answer, generate:

```text
10 certified candidates
```

as the initial standard population.

If practical, also test:

```text
15
20
```

for a smaller subset.

Every candidate must pass M6 certification before simulation.

Duplicate grids must be removed.

---

# 7. Evaluation Population

Target:

```text
50 distinct answers
```

Preferred.

Minimum acceptable:

```text
30 distinct answers
```

Use deterministic seeds.

Prefer continuity with prior M8.2/M9 answer sets where possible.

Do not duplicate one answer to inflate sample size.

---

# 8. Reference Evaluation

For every certified candidate in the main evaluation population, run a **high-quality reference REGULAR profile**.

Use:

```text
REGULAR 500 runs
```

as the default reference.

If runtime is practical, validate a subset with:

```text
1,000 runs
```

to confirm 500-run ordering is adequate.

The 500-run profile defines the reference comparative candidate ordering for M9.1.

---

# 9. Reference Preferred Region

Do not define one exact “best” candidate solely by lowest or highest score.

Use the same relative middle-difficulty philosophy as M9.

For each answer:

```text
rank candidates by reference REGULAR mean score
assign easier / middle / harder bands
identify the reference preferred middle region
```

Use the current documented M9 band logic unless a correctness defect exists.

---

# 10. Reference Candidate Set

For recall analysis, define a small set of desirable candidates rather than one exact winner.

Conceptually:

```text
referencePreferredCandidates
```

could include all candidates in the preferred middle band or the top N candidates under the full M9 selection policy.

Use a clearly documented definition.

Do not tune the definition to improve recall numbers.

---

# 11. Low-Run REGULAR Shortlisting

Evaluate low-run REGULAR profiles at:

```text
25
50
75
100
150
250
```

runs per candidate.

If 25 is obviously too noisy, retain it as a diagnostic but do not recommend it.

Use deterministic paired seeds.

---

# 12. Shortlist Sizes

For a 10-candidate certified population, evaluate retaining:

```text
4
5
6
7
8
```

candidates.

Do not evaluate only one shortlist size.

This must determine the recall/runtime frontier.

---

# 13. Primary Recall Metric

For each:

```text
low-run count × shortlist size
```

calculate:

```text
shortlistRecall =
reference preferred candidates retained
/
reference preferred candidates
```

Report:

```text
mean
median
P10
minimum
percentage of answers with recall = 1.0
percentage with recall >= .8
percentage with recall = 0
```

This is the central M9.1 metric.

---

# 14. Most Important Safety Metric

Report:

```text
preferredCandidateMissRate
```

meaning:

> Percentage of answers where the low-run shortlist eliminates **all** reference-preferred candidates.

For production use, this should be very low.

Do not hide low-tail failures behind good average recall.

---

# 15. Exact Winner Recall

Separately measure:

```text
referenceWinnerRetained
```

for the final reference M9-style winner.

This is secondary to preferred-region recall but still useful.

Report:

```text
winner recall %
```

for every run-count / shortlist-size configuration.

---

# 16. Compare Against M9 Math Shortlist

For identical candidate populations, compare:

```text
M9 cheap mathematical shortlist
vs
M9.1 low-run REGULAR shortlist
```

Report:

```text
preferred-region recall
winner recall
zero-recall rate
runtime
```

This comparison is mandatory.

---

# 17. Hybrid Shortlist Variant

Also test one simple hybrid approach:

```text
low-run REGULAR
+
cheap mathematical metric only as tie-breaker
```

Do not use an opaque weighted sum.

The cheap metric must not override a clearly better low-run REGULAR position.

Test whether this improves stability or has negligible value.

---

# 18. Do Not Overfit the Shortlist

Do not build a learned model.

Do not fit weights to the evaluation population.

Do not train:

```text
regression
random forest
boosted model
neural network
```

M9.1 must remain simple and interpretable.

---

# 19. Low-Run Metric Choice

For the low-run pass, compare at minimum:

```text
REGULAR mean score
REGULAR median score
REGULAR Gold rate
```

M8.2 suggested mean score is the most stable.

Confirm that this remains true in within-answer candidate shortlisting.

---

# 20. Primary Low-Run Signal

If results support it, use:

```text
REGULAR mean score
```

as the primary shortlisting signal.

Do not assume beforehand that it must win.

Report comparative recall for mean/median/Gold.

---

# 21. Broad-Band Shortlisting

Because exact ranks are noisy, test a band-aware shortlist.

For example:

```text
estimate easier/middle/harder from low-run profile
retain middle
plus nearest candidates around band boundaries
```

Compare this with simply taking exact low-run ordinal ranks.

Broad-band selection may improve recall.

---

# 22. Conservative Boundary Retention

Monte Carlo noise is greatest near band boundaries.

If a candidate lies near a middle-band cutoff, consider retaining candidates on both sides.

Implement only if deterministic and documented.

Measure whether this improves recall efficiently.

---

# 23. Confidence-Aware Shortlisting

Optionally use low-run Monte Carlo uncertainty.

For example:

```text
candidate mean score ± standard error
```

If two candidates' intervals overlap substantially, avoid eliminating one solely from noisy ordering.

Keep the method simple.

Do not introduce complex Bayesian ranking.

---

# 24. Confidence-Aware Test

Compare:

```text
plain low-run rank shortlist
vs
confidence-aware shortlist
```

on recall and shortlist size.

If confidence-aware logic adds little value, keep the simpler policy.

---

# 25. Two-Stage REGULAR Profiling

Test the intended M9.1 architecture:

### Stage A

```text
all 10 candidates
low-run REGULAR
```

### Stage B

```text
retained shortlist
500-run REGULAR
```

### Stage C

```text
3 finalists
STRONG 250 or 500
```

Measure total runtime.

---

# 26. Reference Final Selection

For validation purposes, create a more expensive reference selection:

```text
all 10 candidates
REGULAR 500
then appropriate STRONG finalist analysis
```

Compare the staged M9.1 selected candidate against this reference.

Report:

```text
same selected candidate %
same preferred band %
selected REGULAR mean-score delta
selected REGULAR Gold-rate delta
```

---

# 27. Selection Regret

Define a simple comparative metric:

```text
selectionRegret =
distance between staged selected candidate
and reference preferred region
```

Possible implementations:

```text
difference in reference REGULAR mean score percentile
```

or another transparent measure.

Do not turn it into a weighted opaque score.

---

# 28. Difficulty-Band Preservation

Measure whether staged M9.1 selects a candidate from the same reference difficulty band as the full reference selector.

Report:

```text
same-band %
same-or-adjacent-band %
extreme mismatch %
```

This may be more meaningful than exact-winner identity.

---

# 29. STRONG Stage

Keep STRONG as a finalist confirmation stage.

M9 found STRONG changed REGULAR-only choice for 19/30 answers.

Therefore do not remove it prematurely.

Test:

```text
STRONG 100
250
500
```

runs on finalists for a representative subset.

Determine whether 250 is sufficient for stable finalist decisions.

---

# 30. STRONG Contribution

Report:

```text
fraction of answers where STRONG changes final selection
```

under the improved M9.1 shortlist.

Also report:

```text
why
```

using interpretable diagnostics such as:

```text
skill gap
Strong mean score
Strong Gold rate
```

Do not simply state that it changed.

---

# 31. STRONG Necessity Decision

At the end, recommend one of:

```text
retain STRONG in routine production path
use STRONG only for QA/outliers
remove STRONG from routine selection
```

based on measured effect vs runtime.

Do not assume it is necessary merely because M9 found 19/30 changes.

---

# 32. Runtime Measurement

Measure separately:

```text
candidate generation
M6 certification
low-run REGULAR pass
high-run REGULAR shortlist
STRONG finalists
total selection
```

Report:

```text
median
P90
```

per answer.

---

# 33. Runtime Frontier

Create a table for promising configurations:

| Low-run REGULAR | Shortlist | Recall | Zero-recall | Winner Recall | Median Runtime |
|---:|---:|---:|---:|---:|---:|

This should make the production tradeoff explicit.

---

# 34. Production Target Philosophy

Do not optimize solely for minimum runtime.

Prefer:

```text
high recall
low catastrophic miss rate
reasonable runtime
```

in that order.

This is an offline Daily generator.

---

# 35. Candidate Population Sensitivity

For a smaller subset, compare:

```text
10 candidates
15 candidates
20 candidates
```

Determine whether a larger candidate population materially improves the eventual selected grid enough to justify additional simulation cost.

Do not require large populations if quality gains plateau.

---

# 36. Pool-Size Questions

Report:

```text
Does 15 outperform 10 meaningfully?
Does 20 outperform 15 meaningfully?
Does shortlist recall degrade as pool size increases?
```

Use comparative synthetic evidence only.

---

# 37. Cheap Metric Role After M9.1

Determine the appropriate future role for:

```text
uniquePlayableWords
```

Choose one:

```text
A. remove from shortlisting
B. use only as tie-breaker
C. retain as secondary shortlist signal
D. keep only as diagnostic
```

Support the choice with recall data.

---

# 38. Hexalink Remains Separate

Do not use Hexalink rate to drive low-run shortlisting.

Keep it:

```text
diagnostic / finalist evidence
```

unless clear evidence supports otherwise.

M8.2 showed Hexalink simulation is less stable than score metrics.

---

# 39. Rare-Word Dependency

Do not use rare-word dependency for initial low-run filtering.

Calculate it only on the high-run shortlist/finalists unless inexpensive.

Use it as:

```text
diagnostic
outlier flag
possible tie-breaker
```

not a validity gate.

---

# 40. Determinism

Every evaluation must be reproducible from:

```text
answer
candidate seeds
simulator versions
familiarity versions
run-count configuration
benchmark seed
```

Changing worker count must not change results.

---

# 41. Cache Design

Reuse candidate profiles where:

```text
grid hash
model
run count
seed/config
simulator version
frequency version
```

all match.

Do not reuse low-run results as though they were high-run results.

---

# 42. Incremental Monte Carlo Reuse

Investigate whether:

```text
100-run profile
```

can be extended deterministically to:

```text
500-run profile
```

by running only simulations 101–500 and aggregating.

This could materially reduce M9.1 cost.

If implemented, add strong deterministic tests.

---

# 43. Incremental Profile Integrity

If incremental accumulation is implemented:

```text
100 + additional 400
```

must produce the same aggregate result as:

```text
fresh 500
```

using the same deterministic run-seed sequence.

This is mandatory.

---

# 44. Resume Capability

If the 30–50 answer benchmark is lengthy, allow cached/incremental profiles to resume safely.

Partial data must be explicitly marked.

Do not accept corrupted or incomplete candidate profiles.

---

# 45. Evaluation Artifacts

Create:

```text
analysis/m91-evaluation-manifest.csv
analysis/m91-reference-profiles.csv
analysis/m91-shortlist-recall.csv
analysis/m91-winner-recall.csv
analysis/m91-zero-recall.csv
analysis/m91-band-preservation.csv
analysis/m91-method-comparison.csv
analysis/m91-strong-contribution.csv
analysis/m91-runtime-frontier.csv
analysis/m91-pool-sensitivity.csv
analysis/m91-selection-comparison.csv
analysis/m91-summary.json
```

---

# 46. Shortlist Recall CSV

One row per:

```text
answer × method × low-run count × shortlist size
```

Include:

```text
certified_candidates
reference_preferred_count
preferred_retained
recall
reference_winner_retained
zero_preferred_retained
runtime_ms
```

---

# 47. Method Comparison CSV

Compare:

```text
M9 math-only shortlist
low-run mean-score shortlist
low-run median-score shortlist
low-run Gold-rate shortlist
band-aware shortlist
confidence-aware shortlist if implemented
hybrid REGULAR + cheap tie-break
```

Do not require every experimental method to become production code.

---

# 48. Band Preservation CSV

Include:

```text
answer
reference_selected_band
staged_selected_band
same_band
adjacent_band
reference_regular_mean
staged_regular_mean
mean_delta
```

---

# 49. STRONG Contribution CSV

Include:

```text
answer
regular_only_candidate
strong_final_candidate
changed
regular_mean_before
regular_mean_after
strong_mean_before
strong_mean_after
skill_gap_before
skill_gap_after
strong_runtime_ms
```

---

# 50. Required Tests — Recall Infrastructure

Add tests for:

1. reference preferred set deterministic;
2. shortlist recall calculation correct;
3. winner recall correct;
4. zero-recall detection correct;
5. band preservation correct;
6. selection-regret calculation correct.

---

# 51. Required Tests — Simulation Shortlist

Add tests for:

7. low-run REGULAR uses frozen M8.1 model;
8. real frequency required;
9. low-run result deterministic;
10. mean/median/Gold shortlist modes deterministic;
11. shortlist size respected;
12. uncertified candidates never enter simulation shortlist;
13. duplicate grids removed.

---

# 52. Required Tests — Incremental Monte Carlo

If implemented:

14. 100+400 equals fresh 500;
15. resume preserves seed sequence;
16. version mismatch invalidates cache;
17. partial profile cannot be mistaken for complete.

---

# 53. Required Tests — Final Selection

Add tests for:

18. staged selector cannot select outside retained candidates;
19. full reference and staged selection comparison deterministic;
20. STRONG only sees intended finalists;
21. public/private separation unchanged;
22. no gameplay rule changes;
23. M9 remains separately callable;
24. all previous tests pass.

---

# 54. Full Regression

Run:

```bash
node --test tests/*.test.js
```

M9 baseline:

```text
213 passed
0 failed
```

M9.1 must not regress prior behavior.

---

# 55. Evaluation Size

Target:

```text
50 answers × 10 certified candidates
```

for the main recall study.

Minimum acceptable:

```text
30 answers × 10
```

if runtime prevents 50.

Do not reduce candidate count below 10 for the main recall conclusion.

---

# 56. Reference Simulation Cost

This milestone intentionally performs expensive reference profiling for validation.

That is acceptable.

Reference profiling is not necessarily the eventual production path.

Do not weaken the reference to make the benchmark faster.

---

# 57. 500 vs 1,000 Reference Check

For a deterministic subset of at least:

```text
10 answers
```

compare candidate ordering at:

```text
500 REGULAR runs
1,000 REGULAR runs
```

Report Spearman and preferred-band agreement.

If 500 is inadequate, say so.

---

# 58. Required Summary Table — Recall Frontier

| Low Runs | Shortlist Size | Mean Recall | Median Recall | Zero-Recall % | Winner Recall % | Runtime |
|---:|---:|---:|---:|---:|---:|---:|

Highlight the Pareto-efficient configurations.

---

# 59. Required Summary Table — Method Comparison

| Method | Mean Recall | Zero-Recall % | Winner Recall % | Runtime | Recommendation |
|---|---:|---:|---:|---:|---|

---

# 60. Required Summary Table — Final Pipeline

| Stage | Configuration | Median Time | P90 |
|---|---|---:|---:|
| Generation/certification | | | |
| Low-run REGULAR | | | |
| High-run REGULAR | | | |
| STRONG | | | |
| Total | | | |

---

# 61. Required Questions

Answer explicitly:

### Q1
How much better is low-run REGULAR shortlisting than M9's cheap mathematical shortlist?

### Q2
Which low-run count gives the best recall/runtime tradeoff?

### Q3
Which shortlist size gives the best recall/runtime tradeoff?

### Q4
Can catastrophic zero-recall cases be reduced to an acceptably low level?

### Q5
Is REGULAR mean score still the best low-run shortlisting metric?

### Q6
Does band-aware shortlisting outperform exact-rank shortlisting?

### Q7
Does confidence-aware shortlisting help?

### Q8
Does the cheap mathematical metric add value as a tie-breaker?

### Q9
What shortlist recall can be achieved with approximately 5–10 seconds of prefilter compute?

### Q10
How often does the staged selector choose the same candidate as the full reference selector?

### Q11
How often does it at least preserve the same difficulty band?

### Q12
What is the typical selection regret?

### Q13
Does STRONG still change many decisions?

### Q14
Is STRONG worth the runtime?

### Q15
Can incremental Monte Carlo materially reduce runtime?

### Q16
Is 500-run REGULAR reference ordering stable relative to 1,000?

### Q17
Do candidate populations larger than 10 improve the final result enough to justify their cost?

### Q18
What future role should `uniquePlayableWords` have?

### Q19
Is the revised M9.1 pipeline deterministic and operationally practical?

### Q20
Is M9.1 ready for automated generation followed by human QA?

---

# 62. Production Recommendation

At completion choose exactly one:

### A — Ready for automated generation + human QA

Use if:

```text
shortlist recall is high
zero-recall rate is very low
band preservation is strong
runtime is practical
determinism holds
```

This does not mean automatic publishing.

### B — Architecture sound, one specific shortlist issue remains

State exactly what remains.

### C — Simulation-first shortlisting is not reliable enough

Recommend the safer alternative, including profiling all certified candidates if runtime is acceptable.

---

# 63. Important Fallback Option

If no low-run shortlist configuration achieves satisfactory recall:

do not force a prefilter.

The valid conclusion may be:

```text
profile all 10 certified candidates with REGULAR
```

Given M9's measured ~16-second total runtime, this may be an entirely acceptable production-quality tradeoff.

Explicitly evaluate this option.

---

# 64. Do Not Optimize Away Quality

Remember:

```text
offline Daily generation
```

does not require interactive latency.

A 15–30 second generation process may be preferable to a 5-second process that frequently discards better candidates.

Reflect this in the final recommendation.

---

# 65. Review Document

Create:

```text
M91_SIMULATION_FIRST_SHORTLIST_REVIEW.md
```

Include:

1. scope;
2. files created/modified;
3. frozen invariants;
4. reference methodology;
5. candidate population;
6. reference preferred-set definition;
7. low-run configurations;
8. shortlist-size configurations;
9. M9 math baseline;
10. simulation-first methods;
11. recall frontier;
12. zero-recall analysis;
13. winner recall;
14. band preservation;
15. selection regret;
16. hybrid metric result;
17. 500-vs-1,000 stability;
18. STRONG contribution;
19. incremental simulation result;
20. candidate-pool-size result;
21. runtime;
22. tests;
23. production safety;
24. answers Q1–Q20;
25. recommendation A/B/C;
26. `git status --short`;
27. `git diff --stat`.

---

# 66. Production Safety Verification

Explicitly verify no unintended changes to:

```text
game.js
qjynn-rules.js
qjynn-words-v1.0.txt
M6 certification
M8.1 frozen player parameters
M7B
canonical scoring
medal thresholds
six-turn limit
Hexalink rules
```

M9 changes must remain isolated/versioned.

---

# 67. Git Handling

Do not commit automatically.

Do not use:

```bash
git add .
```

Keep the local third-party frequency export separate unless repository policy has changed.

At completion report:

```bash
git status --short
git diff --stat
```

Separate:

```text
project-owned M9.1 changes
third-party/local analysis data
```

---

# 68. Stop Condition

When M9.1 is complete:

1. save all M9.1 artifacts;
2. create `M91_SIMULATION_FIRST_SHORTLIST_REVIEW.md`;
3. run the complete test suite;
4. report reference population size;
5. report best recall configuration;
6. report zero-recall rate;
7. report winner recall;
8. report band preservation;
9. report runtime frontier;
10. report STRONG contribution;
11. report 500-vs-1,000 stability;
12. answer Q1–Q20;
13. choose A, B, or C;
14. show `git status --short`;
15. show `git diff --stat`;
16. stop.

Do not begin M10.

Wait for review.