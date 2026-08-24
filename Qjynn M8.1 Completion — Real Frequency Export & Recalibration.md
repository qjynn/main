# Qjynn M8.1 Completion — Real Frequency Export & Recalibration

Complete the existing **M8.1 milestone**.

Do **not** begin M8.2 or M9.

The M8.1 architecture and tests are already complete. The remaining issue is that the previous calibration ran without the actual third-party `wordfreq` export, resulting in:

```text
41,814 Qjynn indexed words
0 frequency-source matches
41,814 fallback records
0.00% real-source coverage
```

Therefore the previous M8.1 numerical results are pipeline/fallback results only and must not be treated as real-frequency calibration.

The objective of this task is to acquire the already-selected real frequency source, rerun M8.1 with it, update the analysis artifacts and review document, and stop.

---

# 1. Preserve Existing Architecture

Do not redesign M8.1.

Use the existing:

```text
tools/simulator/familiarity-provider.js
tools/simulator/player-models.js
tools/simulator/move-discovery.js
tools/simulator/move-ranking.js
tools/simulator/simulate-game.js
tools/simulator/monte-carlo.js
tools/simulator/calibrate-m81.js
scripts/export-wordfreq.py
```

and existing M8.1 tests.

Only make code changes if required to fix a genuine problem discovered while running the real source.

Document any such change.

---

# 2. Production Invariants

Do not modify:

```text
game.js
Qjynn Vocabulary 1.0
word validity
canonical consonant inventory
scoring
Gold/Silver/Bronze thresholds
six-turn limit
Hexalink rules
M6 hard gates
M7B ranking
```

Do not integrate M8.1 into production candidate selection.

---

# 3. Acquire the Pinned Familiarity Source

Use the source already selected in M8.1:

```text
wordfreq == 3.2.0
English large word list
```

Install it in an appropriate isolated/local Python environment if practical.

Do not unnecessarily modify the project's JavaScript dependency environment.

Run the equivalent of:

```bash
python3 -m pip install wordfreq==3.2.0
```

If direct installation into system Python is inappropriate, create a temporary/local virtual environment instead.

Do not change the pinned version unless installation is genuinely impossible.

---

# 4. Generate the Frequency Export

Use the existing exporter:

```text
scripts/export-wordfreq.py
```

Generate:

```text
data/familiarity/wordfreq-en-large.json
```

using the equivalent of:

```bash
python3 scripts/export-wordfreq.py \
  data/familiarity/wordfreq-en-large.json
```

Verify that:

```text
the file exists
the file is non-empty
the expected metadata exists
frequency values are populated
the provider can load it
```

Do not fabricate or synthesize frequency values.

---

# 5. Licensing Check

Before committing the generated third-party data file, inspect:

```text
data/familiarity/README.md
```

and the existing source/licensing documentation.

The M8.1 report states that:

```text
wordfreq package code: Apache-2.0
bundled source data: separate attribution / CC BY-SA 4.0 requirements
```

Preserve appropriate attribution.

Do not automatically commit the generated frequency export if the existing repository policy or licensing analysis says it should remain locally generated.

If the export should not be committed, keep the reproducible generation script and document that decision.

Do not make new legal conclusions beyond the available license information.

---

# 6. Verify Real Provider Activation

Before running the expensive calibration, run a small provider sanity check.

The provider must report:

```text
basis = "frequency"
```

for ordinary matched words.

Check at minimum:

```text
HOUSE
WATER
MONEY
PLANT
MARKET
FAMILY
```

These must no longer all report fallback records.

If they do, stop and diagnose the provider/export configuration before running Monte Carlo calibration.

---

# 7. Run the Full Vocabulary Coverage Audit

Audit all:

```text
41,814 M4-indexed Qjynn words
```

against the real source.

Report:

```text
total indexed words
matched words
missing words
coverage %
```

and coverage by word length.

Update:

```text
analysis/m81-familiarity-coverage.csv
analysis/m81-familiarity-distribution.csv
```

Do not proceed as though real-frequency calibration succeeded if coverage remains zero or unexpectedly tiny.

Investigate first.

---

# 8. Inspect Missing Words

For unmatched Qjynn words, provide representative samples.

Where reasonably inferable from the data, characterize likely categories such as:

```text
rare words
inflections
technical vocabulary
word-game vocabulary
spelling variants
corpus coverage gaps
```

Do not automatically label unmatched words as invalid or obscure.

They remain valid according to Qjynn Vocabulary 1.0.

---

# 9. Verify Familiarity Distribution

Confirm that the real-source normalized familiarity distribution is non-degenerate.

Report:

```text
P1
P5
P10
P25
median
P75
P90
P95
P99
```

overall and by word length as already supported.

Check that familiarity is not accidentally:

```text
all 0
all 1
nearly constant
reversed
```

---

# 10. Manual Sanity Check

Report familiarity/rank for:

```text
HOUSE
WATER
MONEY
PLANT
MARKET
FAMILY
```

and several valid low-frequency Qjynn words discovered from the actual vocabulary.

Do not manually adjust rankings to satisfy expectations.

The purpose is to inspect whether the source behaves sensibly.

---

# 11. Run Real-Frequency M8.1 Calibration

Use:

```bash
M81_FREQUENCY_FILE=data/familiarity/wordfreq-en-large.json \
M81_RUNS=500 \
node tools/simulator/calibrate-m81.js
```

or the repository-equivalent command.

Use **500 runs per bounded model per puzzle** as the minimum.

If runtime is reasonable, rerun the principal final comparison at:

```text
1,000 runs/model/puzzle
```

Otherwise retain 500 and report runtime.

---

# 12. Use the Existing Distinct Puzzle Set

The current checkout contains:

```text
10 genuinely distinct M7A.3 production grids
```

Use all 10.

Do not duplicate them to claim a 30-puzzle dataset.

Clearly report:

```text
distinct puzzles = 10
```

The lack of 30 distinct puzzles is non-blocking for completing M8.1.

---

# 13. Paired Baseline Comparison

Run identical puzzle/run seeds for:

```text
M8_HEURISTIC_BASELINE
vs
M81_FREQUENCY_MODEL
```

for:

```text
CASUAL
REGULAR
STRONG
EXPERT
```

This must remain a paired comparison.

Report differences in:

```text
mean score
median score
Gold rate
Silver rate
Bronze rate
Hexalink rate
mean known moves
mean noticed moves
played-word familiarity
rare-word dependency
```

---

# 14. Primary Question — REGULAR

Give special analytical attention to REGULAR.

The previous heuristic M8 model produced very high Regular Gold rates.

Determine what happens after real familiarity data is introduced.

Report:

```text
M8 baseline Regular mean score
M8.1 real-frequency Regular mean score

M8 baseline Regular Gold rate
M8.1 real-frequency Regular Gold rate

M8 baseline Regular Hexalink rate
M8.1 real-frequency Regular Hexalink rate
```

Do not interpret the M8.1 rate as an actual human population probability.

---

# 15. Strong/Expert Saturation

M8 previously showed near-saturation for Strong and Expert.

Determine whether real familiarity reduces that naturally.

Report:

```text
STRONG Gold %
EXPERT Gold %
```

for both baseline and real-frequency systems.

Do not artificially weaken these models simply to produce separation.

---

# 16. Gold Vocabulary Analysis

Rerun the existing Gold-vocabulary analysis using real familiarity.

For each model report:

```text
Gold games
mean familiarity of words used in Gold games
median familiarity
least-familiar Gold word distribution
Gold games containing low-familiarity words
Gold games containing multiple low-familiarity words
```

Use the existing percentile/threshold methodology.

Update:

```text
analysis/m81-gold-vocabulary.csv
analysis/m81-rare-word-dependency.csv
```

---

# 17. Familiar-Only Gold

Using the real frequency source, report how frequently Gold occurs without relying on low-familiarity vocabulary.

Use the existing multiple familiarity thresholds.

Do not select a single threshold and declare it the definition of a "normal human vocabulary."

The objective is comparative analysis.

---

# 18. Candidate-Cap Sensitivity

Rerun:

```text
8
12
18
25
40
60
```

candidate caps using real frequency data.

The previous fallback run suggested much better behavior than M8's original extreme sensitivity.

Determine whether this remains true with real data.

Report:

```text
mean score
Gold rate
Hexalink rate
mean known moves
mean noticed moves
```

for each cap.

---

# 19. Key Candidate-Cap Question

Determine whether results begin to plateau as candidate cap increases.

We want to know whether:

```text
maxCandidateMoves
```

has become primarily a computational safety cap rather than the dominant behavioral parameter.

Do not require perfect invariance.

Look for diminishing sensitivity.

---

# 20. Temperature Sensitivity

Rerun:

```text
0.75×
1.0×
1.25×
```

temperature perturbations using real familiarity.

Report:

```text
mean score
Gold rate
Hexalink rate
```

Determine whether small temperature changes still radically alter results.

---

# 21. Familiarity-Curve Sensitivity

Rerun:

```text
restrictive
baseline
permissive
```

familiarity curves.

Measure:

```text
mean score
Gold rate
played-word familiarity
puzzle ranking stability
```

This is one of the most important robustness checks.

---

# 22. Puzzle Ranking Stability

For each relevant parameter perturbation rank the 10 puzzles by:

```text
REGULAR Gold rate
REGULAR median score
STRONG Gold rate
```

Compute Spearman rank correlations.

The key question is:

> Even if absolute simulated scores change, does relative puzzle difficulty remain reasonably stable?

This is central to deciding whether M8.1 can later be used for comparative candidate selection.

---

# 23. Skill Ordering

Recheck:

```text
CASUAL < REGULAR < STRONG < EXPERT
```

across puzzle-level aggregate:

```text
mean score
Gold rate
known vocabulary breadth
noticed move count
```

Report the percentage of puzzles maintaining the expected ordering.

Do not force the result.

---

# 24. Case Studies

Update the existing case studies for:

```text
OSCILLATED
AFFORDABLE
WATERMELON
```

using real familiarity.

For each report:

```text
CASUAL / REGULAR / STRONG / EXPERT score behavior
Gold rates
Hexalink rates
played-word familiarity
rare-word dependency
```

Compare with the previous heuristic behavior.

---

# 25. Important Comparative Question

Determine whether:

```text
OSCILLATED
```

still appears relatively difficult and:

```text
AFFORDABLE
```

still appears relatively easy.

Also determine where:

```text
WATERMELON
```

falls under real familiarity.

Do not force preservation of the previous ordering.

If the ordering changes, explain which familiarity effects appear responsible.

---

# 26. M6-vs-M7B

The previous M8.1 report states that paired M6-vs-M7B grids are unavailable.

Do not spend substantial time reconstructing them during this completion task.

Leave:

```text
analysis/m81-m6-vs-m7b.csv
```

explicitly empty/non-blocking if paired source grids remain unavailable.

This is not required for M8.1 completion.

---

# 27. Tests

Run:

```bash
node --test tests/*.test.js
```

All existing tests must pass.

The previous result was:

```text
196 passed
0 failed
```

The new result must not regress.

If any code changes are required, add targeted tests.

---

# 28. Production Safety Check

Explicitly verify:

```text
game.js unchanged
Vocabulary 1.0 unchanged
canonical inventory unchanged
canonical scoring unchanged
medal thresholds unchanged
six-turn limit unchanged
M6 gates unchanged
M7B ranking unchanged
```

---

# 29. Update Analysis Artifacts

Regenerate the existing M8.1 artifacts using the real frequency source:

```text
analysis/m81-familiarity-coverage.csv
analysis/m81-familiarity-distribution.csv
analysis/m81-model-comparison.csv
analysis/m81-puzzle-profiles.csv
analysis/m81-gold-vocabulary.csv
analysis/m81-rare-word-dependency.csv
analysis/m81-candidate-cap-sensitivity.csv
analysis/m81-temperature-sensitivity.csv
analysis/m81-familiarity-sensitivity.csv
analysis/m81-puzzle-ranking-stability.csv
analysis/m81-summary.json
```

Do not leave old fallback results masquerading as real-frequency output.

Each relevant artifact must record:

```text
familiarity source
source version
normalization version
provider version
whether fallback was used
```

---

# 30. Preserve Fallback Information

Do not delete evidence from the earlier fallback run if it is useful for comparison.

If necessary, distinguish:

```text
heuristic baseline
fallback M8.1
real-frequency M8.1
```

clearly in artifacts/review.

The final primary M8.1 conclusions must use the real-frequency run.

---

# 31. Update the Review Document

Update:

```text
M81_REAL_FAMILIARITY_CALIBRATION_REVIEW.md
```

Do not create a new milestone review unless necessary.

Replace the current status stating that real-frequency calibration is incomplete.

The updated review must clearly identify:

```text
REAL FREQUENCY CALIBRATION COMPLETED
```

only if the provider actually loaded real frequency records.

---

# 32. Required Updated Review Results

The review must prominently report:

### Data

```text
Qjynn indexed words
frequency-source matches
missing words
coverage %
```

### Player outcomes

For each:

```text
CASUAL
REGULAR
STRONG
EXPERT
```

report:

```text
mean score
median score
Gold %
Silver %
Bronze %
Hexalink %
```

### Robustness

Report:

```text
candidate-cap sensitivity
temperature sensitivity
familiarity-curve sensitivity
puzzle-ranking stability
skill-ordering stability
```

### Vocabulary

Report:

```text
Gold rare-word dependency
familiar-only Gold behavior
```

---

# 33. Questions the Updated Review Must Answer

### Q1
Did the `wordfreq` export load successfully?

### Q2
What percentage of Qjynn Vocabulary 1.0 is covered?

### Q3
What kinds of Qjynn words remain unmatched?

### Q4
Do the sanity words receive plausible familiarity values?

### Q5
How much did real familiarity change each synthetic player model?

### Q6
What is REGULAR's new mean score and Gold rate?

### Q7
Does Strong/Expert saturation remain?

### Q8
How frequently does REGULAR Gold depend on low-familiarity words?

### Q9
How frequently does REGULAR reach Gold using only broadly familiar words?

### Q10
Has candidate-cap sensitivity materially decreased compared with original M8?

### Q11
Is temperature sensitivity acceptable?

### Q12
Are puzzle rankings stable under plausible parameter perturbations?

### Q13
Does skill ordering remain stable?

### Q14
Do OSCILLATED, AFFORDABLE, and WATERMELON retain their previous relative characteristics?

### Q15
Is M8.1 now useful as a **comparative puzzle-difficulty instrument**?

### Q16
Is M8.1 credible for **absolute human Gold-rate prediction**?

### Q17
Should M8.1 be considered for integration as a secondary candidate-selection signal in M9?

---

# 34. Decision Standard

Distinguish carefully between:

```text
comparative validity:
Puzzle A appears harder than Puzzle B
```

and:

```text
absolute validity:
A real Regular human has X% probability of Gold
```

M8.1 may pass the first standard without passing the second.

Do not claim absolute human calibration without human data.

---

# 35. M9 Decision

At the end of the review give exactly one recommendation:

```text
A. Proceed to M9 with M8.1 as a comparative ranking signal
```

or:

```text
B. Preserve M8.1 as analysis-only; do not integrate into ranking yet
```

or:

```text
C. M8.1 still requires a specific additional correction before a decision
```

Explain the evidence supporting the recommendation.

Do not implement M9.

---

# 36. Git Status

Do not commit automatically.

At completion report:

```bash
git status --short
git diff --stat
```

Also identify whether:

```text
data/familiarity/wordfreq-en-large.json
```

should or should not be committed based on the documented source-data licensing/repository policy.

Do not stage or commit files.

---

# 37. Stop Condition

When the real-frequency M8.1 recalibration is complete:

1. regenerate all applicable M8.1 artifacts;
2. update `M81_REAL_FAMILIARITY_CALIBRATION_REVIEW.md`;
3. run the full test suite;
4. report the test result;
5. report the real frequency coverage;
6. report the primary REGULAR results;
7. report the robustness conclusion;
8. give recommendation A, B, or C;
9. show `git status --short`;
10. show `git diff --stat`;
11. stop.

Do not begin M9.

Wait for review.