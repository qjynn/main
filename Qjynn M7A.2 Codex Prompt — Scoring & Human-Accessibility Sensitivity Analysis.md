# Qjynn M7A.2 — Scoring & Human-Accessibility Sensitivity Analysis

Implement **M7A.2 only**.

Do **not** change production Qjynn rules, M6 generation criteria, Vocabulary 1.0, medal thresholds, scoring constants in `game.js`, or the live Daily Grid Generator.

M1–M7A.1 are complete and approved.

Use the existing:

- `qjynn-rules.js`;
- Qjynn Vocabulary 1.0;
- M4 vocabulary index / move enumerator;
- M5 exact `findGold` solver;
- M6 deterministic generator;
- M7A analyzer;
- M7A.1 experimental framework.

This milestone is **analysis only**.

---

# 1. Objective

M7A.1 showed that consonant placement changes the size of the Qjynn move space, but all tested experimental boards still showed very high Gold permissiveness.

M7A.2 must answer:

> **Which game variables actually control Gold accessibility, and how much of the solver's apparent ease is caused by perfect vocabulary knowledge rather than realistic human play?**

Investigate two separate dimensions:

1. **scoring/rule sensitivity**;
2. **human vocabulary accessibility**.

Do not make product-rule changes yet.

---

# 2. Core Principle

The production rules remain unchanged.

All alternative scoring/rule settings in M7A.2 are hypothetical analytical scenarios.

Implement scenario-specific scoring/configuration outside production rule constants.

Do not overwrite or mutate canonical values in `qjynn-rules.js`.

The analyzer should be able to ask:

```text
What would happen if...
```

without changing what Qjynn actually does.

---

# 3. Experimental Architecture

Create:

```text
tools/experiments/rule-sensitivity.js
tools/experiments/vocabulary-accessibility.js
tools/experiments/m7a2-batch.js
```

Tests:

```text
tests/m7a2-sensitivity.test.js
```

Do not modify production M6 behavior.

---

# 4. Scenario Configuration Model

Create an explicit analytical scenario object.

Conceptually:

```javascript
{
  name: "gold120",
  goldThreshold: 120,

  scoring: {
    score2to3: "canonical",
    score4to6: "canonical",
    score7to8: "canonical",
    score9to10: "canonical",
    hexalinkBonus: "canonical",
    rowBonus: "canonical",
    columnBonus: "canonical"
  },

  constraints: {
    requireHexalinkForGold: false,
    requireExactlySixTurns: false
  },

  vocabularyAccessibility: {
    mode: "all"
  }
}
```

Do not infer hidden defaults. Store resolved values in results.

---

# 5. Canonical Baseline Scenario

Every puzzle must first be analyzed under the exact current production rules:

```text
Gold threshold: 100
canonical word scoring
Hexalink bonus: 10
row bonus: 10
column bonus: 20
Hexalink not required
Gold may be achieved in <=6 turns
all Qjynn Vocabulary 1.0 words available
```

Call this:

```text
CANONICAL_BASELINE
```

Every scenario must be compared against this baseline.

---

# 6. Gold Threshold Sensitivity

Analyze at minimum:

```text
Gold >= 100
Gold >= 110
Gold >= 120
Gold >= 130
Gold >= 140
Gold >= 150
```

Do not assume all are sensible product thresholds.

For each threshold report:

```text
Gold reachable?
minimum Gold turns
Gold reachable without Hexalink?
Gold reachable with Hexalink required?
Gold-viable first-move count/pct where exact
Gold-destroying first-move count/pct where exact
```

Also report the percentage of sampled puzzles that remain Gold-capable.

---

# 7. Long-Word Scoring Sensitivity

Current rules strongly reward longer words.

Create analytical scenarios where 7–10 letter word scoring is altered while everything else stays canonical.

At minimum test:

### Scenario A

```text
7–8 letters: 15
9–10 letters: 20
```

Canonical baseline.

### Scenario B

```text
7–8 letters: 12
9–10 letters: 15
```

### Scenario C

```text
7–10 letters: 15
```

### Scenario D

```text
7–10 letters: 12
```

Do not implement these in production.

Report the same Gold-accessibility metrics.

---

# 8. Hexalink Bonus Sensitivity

Test:

```text
Hexalink bonus:
0
10
15
20
25
30
```

Keep all other rules canonical.

Measure:

```text
Gold reachability
Gold without Hexalink rate
minimum Gold turns
Gold-viable opening %
```

The purpose is to determine whether increasing the Hexalink reward actually makes it strategically important.

---

# 9. Require-Hexalink Scenario

Add an analytical constraint:

```text
requireHexalinkForGold = true
```

This does not mean the Hexalink must be played first.

It means a certificate is valid only if:

```text
final score >= threshold
AND
at least one move in the sequence is the exact Hexalink
```

Test this at thresholds:

```text
100
110
120
130
```

Report:

```text
puzzles where Gold remains attainable
minimum turns
Gold-viable first moves
```

---

# 10. Exactly-Six-Turn Scenario

Current solver may reach Gold in fewer than six turns.

Add analytical scenarios where a qualifying Gold route must use exactly six successful turns.

Test thresholds:

```text
100
110
120
130
```

Important:

```text
Gold can be crossed earlier,
but the final evaluated six-turn sequence must remain legal.
```

Do not interpret this as a production recommendation.

---

# 11. Row/Column Bonus Sensitivity

Evaluate:

### Canonical

```text
row = 10
column = 20
```

### No line bonuses

```text
row = 0
column = 0
```

### Reduced

```text
row = 5
column = 10
```

### Increased

```text
row = 15
column = 30
```

Report how much Gold accessibility depends on line completion versus word scoring.

---

# 12. Combined Scenarios

After individual sensitivity analysis, test a small number of combinations.

At minimum:

### COMBO_1

```text
Gold threshold = 120
Hexalink bonus = 20
canonical word scoring
```

### COMBO_2

```text
Gold threshold = 120
7–10 letter score = 15
Hexalink bonus = 20
```

### COMBO_3

```text
Gold threshold = 120
require Hexalink = true
```

### COMBO_4

```text
Gold threshold = 130
require Hexalink = true
Hexalink bonus = 20
```

### COMBO_5

```text
Gold threshold = 120
row bonus = 5
column bonus = 10
```

The purpose is interaction analysis, not production selection.

---

# 13. Exactness Requirement

Where M7A.2 reports:

```text
Gold reachable
Gold unreachable
minimum Gold turns
```

the result must be exact.

Do not infer these from sampled Gold certificates.

If a scenario cannot be solved exactly within practical bounds, report:

```text
exact: false
status: not completed
```

Do not silently classify it.

---

# 14. Solver Reuse

Do not create a separate solver implementation if M5 can be safely generalized.

Prefer extending M5 with an optional **analysis-only scoring/configuration interface**, such as:

```javascript
solveBoard(boardState, wordIndex, {
  mode,
  scoringPolicy,
  goldThreshold,
  moveFilter,
  certificateConstraint
})
```

Requirements:

- default invocation remains canonical;
- all existing M5 tests must still pass;
- no production behavior changes;
- analytical scoring must be explicit;
- exact search semantics remain correct.

Document any M5 API extension carefully.

---

# 15. Human Vocabulary Accessibility — Purpose

The M5 solver has perfect access to 41,814 indexable Qjynn words.

Human players do not.

M7A.2 must measure:

> **How does Gold accessibility change when the solver is restricted to progressively more familiar vocabulary?**

This restriction is for analysis only.

Qjynn Vocabulary 1.0 remains the official word-validity set.

---

# 16. Familiarity Data

Use an external/common-English frequency dataset only for **analysis ranking**.

Do not redistribute or embed a dataset with problematic licensing into production artifacts.

If an existing freely usable frequency resource already exists in the repository from QC work, reuse it if licensing permits analysis.

Otherwise create a clean provider interface:

```javascript
getWordFrequencyRank(word)
```

The provider should return:

```text
rank
or
unranked
```

Record provenance and licensing notes in the review.

---

# 17. Vocabulary Accessibility Tiers

Create analysis vocabularies approximately based on frequency rank:

```text
ALL_QJYNN
TOP_30000
TOP_20000
TOP_15000
TOP_10000
TOP_5000
```

Only include words that are also valid Qjynn Vocabulary 1.0 words.

Do not replace Qjynn vocabulary.

For each tier report:

```text
available indexed words
percentage of full solver vocabulary
```

---

# 18. Short-Word Exception

Because word-game players know many unusual two-letter words, do not automatically remove the curated Qjynn two-letter list from restricted familiarity tiers.

For all familiarity scenarios:

```text
retain all canonical Qjynn two-letter words
```

For three-letter words, report both:

### STRICT_FREQUENCY

frequency restriction applies normally.

### WORD_GAME_SHORTS

allow a configurable curated short-word set if one exists.

Do not invent a new curated 3-letter list unless already available.

---

# 19. Familiarity Scenario Metrics

For each vocabulary tier determine:

```text
Gold reachable?
minimum Gold turns
Gold reachable without Hexalink?
Gold reachable with Hexalink required?
Gold-viable first-move pct where exact
number of legal starting words
number of solver-relevant moves
```

Also record the words in the first Gold certificate found.

This will reveal whether Gold depends on vocabulary unlikely to be known by ordinary players.

---

# 20. Certificate Familiarity Metrics

For every Gold certificate compute:

```text
mean word frequency rank
median word frequency rank
worst-ranked word
number of unranked words
```

Also report ranks for each certificate word.

Do not turn these into “easy/hard” labels yet.

---

# 21. Familiarity Coverage Metric

For each canonical Gold certificate report how many of its words survive in:

```text
TOP_30000
TOP_20000
TOP_15000
TOP_10000
TOP_5000
```

Example:

```text
certificate words: 5

TOP_30000: 5/5
TOP_20000: 5/5
TOP_15000: 4/5
TOP_10000: 3/5
TOP_5000: 1/5
```

This is diagnostic only.

---

# 22. Dataset

Use at least the existing M7A.1 experimental puzzles.

Preferred:

```text
24 M7A.1 experimental grids
```

If practical, expand to:

```text
50–100 generated puzzles
```

across different answers and strategies.

Do not require full Gold-first-move exhaustive analysis for every scenario if that becomes computationally prohibitive.

Prioritize exact Gold reachability and minimum Gold turns.

---

# 23. Paired Analysis

Every hypothetical rule/vocabulary scenario must be applied to the **same underlying puzzle**.

Do not regenerate the grid when changing:

```text
Gold threshold
scoring
Hexalink bonus
line bonus
vocabulary-accessibility tier
```

This isolates rule effects from grid effects.

---

# 24. Required Scenario Matrix

At minimum run:

```text
canonical baseline
6 Gold thresholds
4 long-word scoring settings
6 Hexalink bonus settings
4 require-Hexalink settings
4 exactly-six-turn settings
4 line-bonus settings
5 combined scenarios
6 vocabulary tiers
```

You may reduce redundant combinations if profiling shows excessive runtime, but document exactly what was run.

---

# 25. Aggregate Statistics

For every scenario report:

```text
puzzles analyzed
Gold-capable count
Gold-capable %
Gold without Hexalink %
Gold with Hexalink-required %
minimum Gold-turn distribution
median solver-relevant starting moves
median legal words
```

Where Gold-first-move exact analysis is available:

```text
median Gold-viable first-move %
median Gold-destroying first-move %
```

---

# 26. Sensitivity Curves

Create machine-readable data suitable for plots.

At minimum output curves for:

### Gold threshold

```text
threshold -> % puzzles Gold-capable
threshold -> % Gold without Hexalink
threshold -> median minimum-Gold turns
```

### Vocabulary tier

```text
vocabulary size -> % Gold-capable
vocabulary size -> median minimum-Gold turns
```

### Hexalink bonus

```text
bonus -> % Gold-capable
bonus -> % Gold routes requiring Hexalink
```

Do not create production decisions from the curves.

---

# 27. Identify Transition Points

For each puzzle where possible, determine:

```text
highest threshold at which Gold remains reachable
```

Call it:

```text
goldCeiling
```

Example:

```text
Gold reachable at 120
Gold reachable at 130
Gold unreachable at 140

goldCeiling in tested grid = 130
```

If exact binary search or exact threshold search is practical, compute the exact reachable score ceiling up to a configured cap.

Do not confuse this with proven maximum score unless the solver has proven it.

Name it carefully, e.g.:

```text
highestTestedGoldThresholdReachable
```

---

# 28. Rule-Leverage Metrics

For each hypothetical variable quantify sensitivity relative to canonical baseline.

Examples:

```text
delta Gold-capable %
delta Gold-without-Hexalink %
delta median minimum-Gold turns
```

Rank variables by how strongly they alter Gold accessibility.

This is exploratory leverage analysis.

---

# 29. Interaction Analysis

Specifically determine whether:

```text
higher Gold threshold
+
larger Hexalink bonus
```

makes the Hexalink more strategically meaningful without making Gold broadly unreachable.

Also examine:

```text
higher threshold
+
reduced long-word score
```

and:

```text
require Hexalink
+
familiarity-restricted vocabulary
```

Do not optimize a final setting.

---

# 30. Counterexamples

Find and report examples of:

### A
Canonical Gold easy, but Gold impossible with TOP_10000 vocabulary.

### B
Gold remains easy even with TOP_5000 vocabulary.

### C
Gold possible at 130 without Hexalink.

### D
Gold impossible at 110 without Hexalink but possible with Hexalink.

### E
Reducing long-word scores materially changes Gold accessibility.

### F
Row/column bonuses are decisive.

### G
Rule changes appear irrelevant because the grid remains extremely permissive.

These cases are important for M7B design.

---

# 31. Do Not Conflate Player Knowledge With Word Validity

The analysis report must state clearly:

```text
Vocabulary 1.0 defines whether a submitted word is valid.

Frequency tiers model hypothetical human discoverability only.
```

Do not recommend rejecting low-frequency but valid words based solely on M7A.2.

---

# 32. Output Files

Save at minimum:

```text
analysis/m7a2-scenarios.json
analysis/m7a2-scenarios.csv
analysis/m7a2-sensitivity-summary.json
analysis/m7a2-vocabulary-accessibility.csv
analysis/m7a2-counterexamples.json
```

If useful:

```text
analysis/m7a2-curves.csv
```

---

# 33. CSV Design

One row per:

```text
puzzle × scenario
```

Include:

```text
answer
seed
strategy
scenario
gold_threshold
long_word_scoring_policy
hexalink_bonus
row_bonus
column_bonus
require_hexalink
require_exactly_six_turns
vocabulary_tier
available_words
gold_reachable
gold_without_hexalink
gold_with_hexalink_required
minimum_gold_turns
solver_relevant_moves
analysis_ms
exact
```

Add other useful scalar metrics.

---

# 34. Tests

Add tests for at least:

1. production canonical rules remain unchanged;
2. canonical analytical scenario matches M5 canonical result;
3. custom Gold threshold works;
4. custom long-word scoring works;
5. custom Hexalink bonus works;
6. require-Hexalink constraint is enforced;
7. exactly-six-turn constraint is enforced;
8. custom row/column bonuses work;
9. combined scenario uses all requested settings;
10. default M5 behavior is unchanged;
11. familiarity tier filters only analysis vocabulary;
12. Vocabulary 1.0 source remains unchanged;
13. all canonical two-letter words survive accessibility tiers;
14. frequency ranks are deterministic;
15. certificate familiarity metrics are correct;
16. Gold results differ appropriately on handcrafted sensitivity boards;
17. highest tested reachable threshold is calculated correctly;
18. scenario CSV rows are deterministic;
19. paired scenarios use the identical grid;
20. all existing M1–M7A.1 tests continue to pass.

Use small handcrafted boards for exact expected sensitivity results.

---

# 35. Critical Restrictions

M7A.2 must not:

- change `game.js`;
- change production Gold threshold;
- change production scoring;
- change production Hexalink bonus;
- change production row/column bonuses;
- change M6 acceptance;
- remove words from Vocabulary 1.0;
- create final difficulty labels;
- implement M7B;
- create a production composite quality score;
- automatically choose new game rules;
- use an LLM to classify puzzle quality.

Analysis only.

---

# 36. Questions the Report Must Answer

Use measured data to answer:

### Q1
Is the canonical Gold threshold of 100 the primary reason Gold is so permissive?

### Q2
At what tested thresholds does Gold accessibility begin to change materially?

### Q3
Does increasing the Hexalink bonus materially increase Hexalink importance?

### Q4
Does requiring Hexalink for Gold create a much more selective game?

### Q5
How much do 7–10-letter scoring values contribute to Gold accessibility?

### Q6
How important are row/column bonuses?

### Q7
How often is canonical Gold dependent on words outside TOP_10000 / TOP_20000 familiar vocabulary?

### Q8
Does Gold remain broadly achievable using only familiar vocabulary?

### Q9
Which variable has the strongest leverage on Gold accessibility?

### Q10
Which variables appear surprisingly weak?

### Q11
Is solver-perceived ease primarily a scoring issue, a vocabulary-knowledge issue, or both?

### Q12
Do results differ materially across M7A.1 placement strategies?

Do not answer from intuition.

---

# 37. Required Review Document

Create:

```text
M7A2_SCORING_HUMAN_ACCESSIBILITY_REVIEW.md
```

Include:

1. files created/modified;
2. analytical architecture;
3. scenario model;
4. any M5 extensions;
5. proof production defaults are unchanged;
6. scenario matrix actually executed;
7. dataset size;
8. familiarity dataset/provider and licensing/provenance;
9. vocabulary-tier sizes;
10. test results;
11. Gold-threshold sensitivity;
12. long-word scoring sensitivity;
13. Hexalink-bonus sensitivity;
14. require-Hexalink findings;
15. exactly-six-turn findings;
16. row/column-bonus findings;
17. combined-scenario findings;
18. vocabulary accessibility findings;
19. certificate familiarity findings;
20. interaction findings;
21. counterexamples;
22. answers to Q1–Q12;
23. unexpected findings;
24. known limitations;
25. which variables appear strongest for future M7B;
26. which variables should probably not be used;
27. **no production recommendation yet unless evidence is exceptionally clear;**
28. `git status --short`;
29. `git diff --stat`.

---

# 38. Data Needed for M7B

End with:

```text
## Data Needed for M7B
```

Include compact tables.

### Gold threshold

| Threshold | Gold-capable % | Gold w/o Hexalink % | Median Min Turns |
|---|---:|---:|---:|

### Vocabulary accessibility

| Tier | Indexed Words | Gold-capable % | Gold w/o Hexalink % | Median Min Turns |
|---|---:|---:|---:|---:|

### Hexalink bonus

| Bonus | Gold-capable % | Gold w/o Hexalink % | Median Min Turns |
|---|---:|---:|---:|

### Major rule sensitivity

| Variable | Scenario | Δ Gold-capable % | Δ Gold w/o Hexalink % | Δ Min Turns |
|---|---|---:|---:|---:|

Also identify the **3–5 variables with the strongest measured leverage**.

---

# 39. Stop Condition

When M7A.2 is complete:

1. save all scenario outputs;
2. create `M7A2_SCORING_HUMAN_ACCESSIBILITY_REVIEW.md`;
3. report artifact paths;
4. stop.

Do not implement M7B.

Do not alter production rules.

Wait for review.