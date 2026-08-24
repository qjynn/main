# Qjynn M8.1 — Real Word Familiarity Integration & Synthetic-Player Calibration

Implement **M8.1 only**.

M1–M8 are complete and approved.

M8 successfully established:

- bounded synthetic player models;
- deterministic Monte Carlo simulation;
- skill differentiation;
- bounded move discovery;
- probabilistic decision making;
- Hexalink recognition modeling;
- canonical game-state transitions;
- separation between human-like agents and Oracle solving.

However, M8 also established two major limitations:

1. word familiarity currently uses heuristic fallback rather than a validated frequency/familiarity dataset;
2. simulated outcomes are materially sensitive to behavioral parameters, especially move consideration and decision temperature.

M8.1 must address those limitations.

Do **not** change Qjynn gameplay rules.

Do **not** add simulator metrics to production M7B ranking yet.

---

# 1. Objective

Build a defensible analysis-only word familiarity layer and use it to calibrate and stress-test the M8 synthetic player models.

The principal questions are:

> How much of simulated Qjynn performance depends on realistic human vocabulary accessibility?

and:

> Can we identify stable synthetic-player configurations that remain meaningfully differentiated without depending excessively on arbitrary parameter choices?

M8.1 should improve the credibility of M8.

It must not fabricate human realism.

---

# 2. Production Invariants

M8.1 must not modify:

```text
game.js
Qjynn Vocabulary 1.0
word validity
Gold threshold
Silver threshold
Bronze threshold
six-turn limit
canonical scoring
Hexalink bonus
row bonuses
column bonuses
canonical consonant inventory
M6 hard gates
M7B production ranking
```

Word familiarity affects **synthetic-player discovery probability only**.

It never affects whether Qjynn accepts a submitted word.

---

# 3. Preserve the Fundamental Separation

Maintain two independent concepts:

```text
Qjynn Vocabulary 1.0
        │
        ▼
Is this word valid?
```

versus:

```text
Familiarity / frequency data
        │
        ▼
How likely is a synthetic player to know or notice it?
```

Never filter Vocabulary 1.0 itself based on frequency.

---

# 4. Primary Requirement — Real Familiarity Data

Identify and integrate at least one defensible, freely usable English word-frequency/familiarity source.

Strongly prefer:

- open or permissively licensed data;
- reproducible acquisition;
- documented provenance;
- word-level frequency/rank information;
- broad English vocabulary coverage;
- suitability for redistribution or documented download during setup.

Do not silently scrape proprietary dictionaries or copyrighted word-game databases.

---

# 5. Candidate Data Sources

Investigate suitable sources before choosing one.

Potential categories include:

```text
open word-frequency lists
subtitle-based frequency corpora
web-frequency corpora
open NLP frequency resources
public-domain frequency lists
```

Do not assume a named source is legally or technically suitable merely because it is publicly downloadable.

For each serious candidate record:

```text
name
source URL
license
version/date
coverage
frequency metric
redistribution constraints
known biases
```

Choose the best practical source for M8.1.

---

# 6. Internet/Acquisition Handling

If Codex has network access, acquisition may be automated.

If network access is unavailable:

1. implement the provider and import pipeline;
2. document the exact source/file required;
3. stop short of fabricating frequency values;
4. retain the M8 heuristic provider as explicit fallback;
5. clearly mark any results that still use fallback mode.

Do not invent frequency ranks.

---

# 7. Raw Data Handling

Prefer keeping externally acquired raw familiarity data separate from production Qjynn source files.

Suggested structure:

```text
data/familiarity/
```

or repository-equivalent.

If licensing permits redistribution:

```text
data/familiarity/<source-file>
```

If redistribution is inappropriate:

```text
scripts/fetch-familiarity-data.*
```

plus documented local cache behavior.

Do not commit data contrary to its license.

---

# 8. Provider Interface

Formalize the M8 familiarity interface.

Conceptually:

```javascript
getWordFamiliarity(word)
```

return:

```javascript
{
  word,
  found: true,
  frequency: ...,
  rank: ...,
  normalizedFrequency: ...,
  familiarityScore: ...,
  source: "...",
  sourceVersion: "...",
  basis: "frequency"
}
```

For missing words:

```javascript
{
  word,
  found: false,
  familiarityScore: ...,
  basis: "fallback"
}
```

Do not use zero familiarity automatically for missing words.

---

# 9. Normalization

Raw corpus frequencies can be extremely skewed.

Convert source values into a stable normalized familiarity measure.

Consider transformations such as:

```text
log frequency
frequency rank
percentile
Zipf-like scale
```

Choose and document one.

The final simulator-facing quantity should be bounded and interpretable, e.g.:

```text
0.0 = extremely inaccessible
1.0 = extremely familiar
```

Do not tune normalization merely to manufacture desired Gold rates.

---

# 10. Frequency Is Not Identical to Word Knowledge

Explicitly acknowledge:

```text
corpus frequency != human word familiarity
```

For example, some short word-game words may have low general-corpus frequency but be familiar to Scrabble-style players.

Therefore frequency should be the main evidence source but not the only possible accessibility signal.

---

# 11. Word-Game Short-Word Handling

Preserve special treatment for canonical two-letter words.

Create explicit skill-dependent recognition behavior.

Conceptually:

```text
CASUAL   -> limited subset/probability
REGULAR  -> substantial familiarity
STRONG   -> high familiarity
EXPERT   -> near-complete familiarity
```

Do not change their Qjynn validity.

If an approved curated list already exists in the repository, reuse it.

Do not copy a proprietary Scrabble lexicon.

---

# 12. Morphological Adjustment

Consider whether frequency lookup should safely recognize common morphological relationships:

```text
plural
past tense
-ing
-er
-est
```

Example:

```text
OSCILLATE
OSCILLATED
OSCILLATING
```

Do not invent a full linguistic model.

If implemented, keep the corpus value for the exact form when available and use morphology only for missing/low-coverage cases.

Document adjustments.

---

# 13. Proper-Noun and Noise Protection

Frequency corpora may contain:

```text
proper nouns
URLs
abbreviations
OCR artifacts
non-English tokens
```

The familiarity provider must only annotate words already accepted by Qjynn Vocabulary 1.0.

Therefore corpus noise must never create new valid Qjynn words.

---

# 14. Vocabulary Coverage Audit

Run the familiarity provider against all indexable Qjynn Vocabulary 1.0 words.

Report:

```text
total Qjynn indexed words
found in familiarity source
not found
coverage %
```

Break coverage down by word length:

```text
2
3
4
5
6
7
8
9
10
```

and, where useful, longer words if Vocabulary 1.0 contains them.

---

# 15. Missing-Word Analysis

For unmatched Qjynn words, sample and classify examples.

Determine whether missing words tend to be:

```text
rare English words
inflections
technical words
word-game words
spelling variants
possible corpus limitations
```

Do not automatically classify every unmatched word as obscure.

---

# 16. Familiarity Distribution

Report the distribution of familiarity across Vocabulary 1.0:

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

Also report by word length.

This will help verify that normalization is sensible.

---

# 17. Manual Sanity Set

Create a small manually reviewed sanity set.

Include obviously familiar words such as:

```text
HOUSE
WATER
MONEY
PLANT
MARKET
FAMILY
```

and a set of clearly less-common valid words already present in Vocabulary 1.0.

Do not fabricate obscure examples if validity is uncertain.

Verify that the familiarity provider generally orders obvious cases sensibly.

This is a sanity test, not human validation.

---

# 18. Familiarity Provider Versioning

Introduce explicit metadata:

```text
familiarityProvider
familiaritySourceVersion
familiarityNormalizationVersion
```

Example:

```text
providerVersion = "m8.1.frequency.1"
```

Simulation artifacts must record these.

---

# 19. Replace Heuristic-Only Accessibility

Update M8 player models so that when real familiarity data is available:

```text
real frequency/familiarity
        +
player skill transform
        +
bounded stochastic discovery
```

determines accessibility.

Heuristic features may remain secondary.

They must not dominate real frequency evidence without justification.

---

# 20. Skill-Specific Familiarity Mapping

The same word-frequency value should not imply identical recognition probability across all player models.

Create configurable mappings.

Conceptually:

```text
                low-frequency word
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
    Casual          Regular          Expert
  very unlikely      possible          likely
```

Do not manually list thousands of model-specific words.

Use systematic transforms.

---

# 21. Familiarity Curves

Implement explicit familiarity curves per model.

For example:

```javascript
recognitionProbability =
    mapFamiliarityToRecognition(
        familiarityScore,
        playerModel
    )
```

Plot/export curve data for:

```text
CASUAL
REGULAR
STRONG
EXPERT
```

The curves should be monotonic:

```text
for same word familiarity:
Expert >= Strong >= Regular >= Casual
```

subject only to explicitly documented short-word exceptions.

---

# 22. Separate KNOWING From NOTICING

This distinction is important.

Model:

```text
P(word considered)
=
P(word known)
×
P(path noticed | word known, board state)
```

Do not treat word familiarity as the entire move-discovery model.

A player can know a word but fail to notice its path.

This separation should help reduce parameter confusion.

---

# 23. Known-Word Probability

Create a skill-specific:

```text
knownProbability
```

derived primarily from familiarity.

---

# 24. Path-Notice Probability

Create a separate:

```text
noticeProbability
```

based on factors such as:

```text
path length
tile geometry
current board state
move score salience
word length
player skill
sampling budget
```

Keep the model simple and explicit.

---

# 25. Revisit maxCandidateMoves

M8 showed extreme sensitivity to:

```text
maxCandidateMoves
```

For REGULAR:

```text
8 candidates  -> mean score 88.43
40 candidates -> mean score 125.37
```

This parameter currently has too much leverage.

Investigate whether the new:

```text
known probability
×
notice probability
```

pipeline allows `maxCandidateMoves` to function mainly as a computational safety cap rather than the dominant behavioral control.

This is a primary M8.1 goal.

---

# 26. Revisit Decision Temperature

M8 also showed material temperature sensitivity.

Investigate whether:

```text
temperature
```

can be defined on normalized move utility so that reasonable changes produce gradual rather than dramatic outcome shifts.

Do not remove probabilistic choice.

Do not simply set temperature to a value that produces desired medal rates.

---

# 27. Normalize Move Utility

If current move-attractiveness values have arbitrary scale, normalize components before applying softmax.

Potentially:

```text
score utility
coverage utility
future-flexibility utility
familiarity utility
Hexalink utility
```

into comparable bounded ranges.

This may make decision temperature more interpretable.

Document any change carefully.

---

# 28. Preserve Bounded Human Behavior

Even with real familiarity data, CASUAL through EXPERT must not:

```text
enumerate all moves and optimize
call M5 exact search
know the private certificate
automatically know the Hexalink
```

M8's Oracle-vs-human guard remains mandatory.

---

# 29. Calibration Does Not Mean Fitting to Humans

There is no sufficient human dataset.

Therefore M8.1 calibration means:

```text
internal consistency
parameter robustness
skill ordering
plausible familiarity behavior
stable puzzle comparisons
```

It does NOT mean:

```text
statistically fitted human model
```

Use the term carefully in the review.

---

# 30. Baseline Comparison

Preserve the original M8 model configuration as:

```text
M8_HEURISTIC_BASELINE
```

Create the new configuration as something like:

```text
M81_FREQUENCY_MODEL
```

Run both against identical puzzles/seeds.

This allows direct comparison.

---

# 31. Independent Puzzle Dataset

The M8 batch used 10 distinct grids repeated three times.

M8.1 should improve this.

Target:

```text
30 genuinely distinct production-size grids
```

Prefer:

```text
30 different Daily answers
```

If 30 valid answers are not locally available, use the maximum distinct set and state the limitation.

Do not pretend repeated seed identities are independent puzzles.

---

# 32. Puzzle Generation for M8.1

Use existing M6/M7B generation only.

Do not change generator rules.

Do not require exact M7B.1 minimum-turn proof.

Prefer M7B-selected grids where computationally practical.

Otherwise use M6-certified grids.

Record:

```text
puzzleSource
answer
seed
generatorVersion
selectorVersion
```

---

# 33. Monte Carlo Run Count

M8 convergence suggested:

```text
500 runs = useful
1,000 runs = preferable
```

Use:

```text
500 runs/model/puzzle
```

as minimum for the main M8.1 experiment.

Prefer:

```text
1,000
```

if runtime remains practical.

Do not use 100-run results for final M8.1 conclusions unless explicitly identified as exploratory.

---

# 34. Main Experimental Matrix

For every distinct puzzle run:

```text
CASUAL
REGULAR
STRONG
EXPERT
```

under:

```text
M8_HEURISTIC_BASELINE
M81_FREQUENCY_MODEL
```

using paired deterministic seed identities.

This permits direct before/after comparisons.

---

# 35. Main Outcome Comparison

For each:

```text
puzzle × player model
```

compare:

```text
mean score
median score
Gold rate
Silver rate
Bronze rate
Hexalink rate
mean word familiarity
mean word length
```

between M8 and M8.1.

---

# 36. Gold-Route Vocabulary Analysis

This is a high-priority M8.1 analysis.

For every simulated game reaching Gold, characterize the words that contributed.

Report per player model:

```text
mean familiarity of Gold-play words
least-familiar word used
fraction of Gold games containing at least one low-familiarity word
fraction containing multiple low-familiarity words
```

Define low-familiarity thresholds transparently from corpus percentiles rather than arbitrary word lists.

---

# 37. Familiar-Only Gold Analysis

For each puzzle/model estimate:

> How often does the synthetic player reach Gold using only broadly familiar words?

Define several analytical cutoffs, for example:

```text
top 5,000
top 10,000
top 20,000
```

or equivalent corpus percentiles.

These are analysis categories only.

Do not modify word validity.

---

# 38. Rare-Word Dependency Metric

Create an analytical metric such as:

```text
rareWordDependencyRate
```

Meaning:

```text
fraction of Gold simulations containing
at least one played word below the chosen
familiarity threshold
```

Report at multiple thresholds rather than choosing one production cutoff.

---

# 39. Move-Discovery Diagnostics

For each model report per turn:

```text
legal moves available
estimated known moves
sampled moves
noticed moves
ranked moves
```

aggregated across simulations.

This will tell us whether the model is behaving like:

```text
human-like bounded discovery
```

or merely:

```text
artificial move-budget truncation
```

---

# 40. Candidate-Cap Saturation

For representative puzzles run:

```text
maxCandidateMoves:
8
12
18
25
40
60
```

under M8.1.

Measure:

```text
mean score
Gold rate
Hexalink rate
actual mean noticed moves
```

The goal is to find whether outcomes plateau.

A healthy result would show diminishing change beyond a reasonable cap.

---

# 41. Temperature Sensitivity

For each player model test a reasonable local range around the default.

For example, use relative multipliers:

```text
0.75×
1.0×
1.25×
```

rather than arbitrary absolute values where possible.

Measure outcome changes.

The objective is robustness, not finding the “best” temperature.

---

# 42. Familiarity-Curve Sensitivity

Perturb the recognition curves modestly:

```text
more restrictive
baseline
more permissive
```

Measure effects on:

```text
mean score
Gold rate
word familiarity used
```

This tells us whether model conclusions depend excessively on exact familiarity mapping.

---

# 43. Lookahead Sensitivity

For REGULAR/STRONG/EXPERT compare bounded alternatives such as:

```text
depth 0
current configured depth
slightly wider beam
```

within strict node limits.

Determine whether vocabulary accessibility or search sophistication dominates performance.

---

# 44. Variance Decomposition

Estimate which model parameters most strongly affect:

```text
mean score
Gold rate
Hexalink rate
```

At minimum compare leverage from:

```text
familiarity mapping
candidate cap
decision temperature
lookahead
Hexalink recognition
```

A simple standardized sensitivity table is sufficient.

Do not build an unnecessarily complex statistical model.

---

# 45. Parameter Robustness Goal

M8.1 should determine whether a region exists where:

```text
skill ordering remains stable
puzzle ranking remains reasonably stable
small parameter perturbations do not radically change outcomes
```

This is more important than selecting a single “correct” parameter value.

---

# 46. Skill Ordering

Re-evaluate:

```text
CASUAL < REGULAR < STRONG < EXPERT
```

for:

```text
mean score
Gold rate
known vocabulary breadth
noticed move count
```

Report violations.

Do not force ordering in simulation results.

---

# 47. Avoid Skill Saturation

M8 produced:

```text
STRONG Gold = 97.73%
EXPERT Gold = 99.70%
```

This severely limits puzzle discrimination.

Investigate whether real familiarity data and improved discovery modeling reduce this saturation naturally.

Do not artificially lower Strong/Expert ability merely to force separation.

Report whether saturation persists.

---

# 48. Regular Model Priority

Treat REGULAR as the primary diagnostic model.

Reason:

```text
CASUAL may naturally struggle
EXPERT may naturally saturate
REGULAR should provide useful puzzle discrimination
```

Do not optimize exclusively for REGULAR, but give its robustness and puzzle separation special attention.

---

# 49. Puzzle Separation

For each model calculate:

```text
minimum Gold rate
P25
median
P75
maximum
interquartile range
standard deviation across puzzles
```

Compare M8 vs M8.1.

We want to know whether real familiarity data improves meaningful puzzle separation.

---

# 50. Puzzle Ranking Stability

Rank puzzles by:

```text
REGULAR Gold rate
REGULAR median score
STRONG Gold rate
```

Compare rankings across:

```text
baseline parameters
parameter perturbations
M8 heuristic
M8.1 frequency model
```

Use Spearman correlation.

A credible simulator should not completely reorder puzzles after small parameter changes.

---

# 51. Cross-Model Difficulty Correlation

Repeat:

```text
CASUAL vs REGULAR
REGULAR vs STRONG
STRONG vs EXPERT
```

rank correlations.

Determine whether M8.1 changes the weak Strong/Expert discrimination observed in M8.

---

# 52. Familiarity Examples

For several representative puzzles, report example words classified approximately across the familiarity distribution:

```text
very common
common
middle
uncommon
rare
unmatched
```

Use corpus-derived categories.

Do not editorially redefine validity.

---

# 53. OSCILLATED Case Study

Include `OSCILLATED` if its production grid remains available.

M8 identified the OSCILLATED family as comparatively difficult, especially for Casual/Regular.

Use it as one case study.

Analyze:

```text
words discovered by each model
frequency distribution
Gold rate
Hexalink rate
rare-word dependency
```

Compare heuristic vs real-frequency behavior.

---

# 54. AFFORDABLE Case Study

Include `AFFORDABLE` if available.

M8 identified it as comparatively easy for all bounded models.

Determine whether that remains true with real familiarity data.

This provides a useful contrast with OSCILLATED.

---

# 55. WATERMELON Case Study

Include `WATERMELON`.

It has already been used extensively in previous milestones.

Use it for:

```text
convergence
parameter sensitivity
familiarity sanity
before/after comparison
```

This preserves continuity across M7/M8 analysis.

---

# 56. Do Not Overuse Oracle

M8.1 is not another exact-solver milestone.

Oracle may be used for:

```text
reference certificate
known Gold capability
occasional comparison
```

Do not run expensive exact maximum-score analysis across the entire dataset.

---

# 57. M6 vs M7B Pairing

M8 could not perform the M6-vs-M7B comparison because paired complete grids were unavailable.

If practical, generate and preserve paired grids for a subset:

```text
M6 first valid candidate
M7B selected candidate
```

for the same answer/seed.

Then run M8.1 simulations against both.

Target at least:

```text
10 paired answers
```

if practical.

Do not block M8.1 if M7B generation cost makes this unreasonable.

---

# 58. Paired M6/M7B Questions

For each paired answer ask:

```text
Does M7B reduce Regular Gold rate?
Does M7B reduce Regular median score?
Does M7B change Hexalink discovery?
Does M7B change rare-word dependency?
```

Do not assume lower Gold rate always means better.

Report differences only.

---

# 59. Confidence Intervals

Use Monte Carlo confidence intervals for:

```text
Gold rate
Hexalink rate
```

and standard errors/intervals for mean score where practical.

When comparing M8 vs M8.1, report uncertainty around deltas.

---

# 60. Statistical Discipline

Do not treat repeated Monte Carlo runs as independent human subjects.

They are samples from a synthetic behavioral model.

Use terms such as:

```text
simulation estimate
Monte Carlo uncertainty
model sensitivity
```

not:

```text
human confidence interval
player population estimate
```

---

# 61. Required Tests — Familiarity Provider

Add tests for:

1. provider loads deterministic source data;
2. exact known word lookup;
3. missing word handling;
4. normalization monotonicity;
5. higher raw frequency never maps to lower familiarity without documented exception;
6. source metadata recorded;
7. Vocabulary 1.0 remains unchanged;
8. corpus-only words never become Qjynn-valid;
9. two-letter exception behavior;
10. provider fallback is explicitly labeled.

---

# 62. Required Tests — Player Integration

Add tests for:

11. higher familiarity increases known probability;
12. Expert known probability >= Strong >= Regular >= Casual for same ordinary word;
13. knowing and noticing are separate;
14. candidate cap is enforced;
15. increasing cap cannot change validity/state semantics;
16. no human model calls exact solver;
17. player model remains deterministic under same seed;
18. different seed can alter discovery/selection;
19. recognized Hexalink still requires legal path;
20. canonical scoring unchanged.

---

# 63. Required Tests — Robustness Infrastructure

Add tests for:

21. parameter sweep deterministic;
22. M8 baseline configuration preserved;
23. M8.1 configuration version recorded;
24. paired baseline/M8.1 runs use matching seeds;
25. Gold-route familiarity metrics calculated correctly;
26. rare-word dependency calculated correctly;
27. rank-correlation calculation correct;
28. confidence interval calculation correct;
29. no private data enters public puzzle JSON;
30. all existing M1–M8 tests pass.

---

# 64. Performance

Measure:

```text
familiarity provider load time
vocabulary annotation time
single simulation time
500-run profile time
1,000-run profile time
30-puzzle batch time
```

Cache familiarity lookups.

Do not repeatedly parse the raw frequency corpus for every simulation.

---

# 65. Output Artifacts

Create at minimum:

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
analysis/m81-m6-vs-m7b.csv
analysis/m81-summary.json
```

---

# 66. Familiarity Coverage CSV

Include:

```text
word_length
qjynn_words
source_matches
missing
coverage_pct
median_rank
median_familiarity
```

Include an ALL row.

---

# 67. Model Comparison CSV

One row per:

```text
puzzle × model × accessibility system
```

where accessibility system is:

```text
M8_HEURISTIC_BASELINE
M81_FREQUENCY_MODEL
```

Include:

```text
runs
mean_score
median_score
gold_rate
silver_rate
bronze_rate
hexalink_rate
mean_played_word_familiarity
rare_word_dependency
mean_known_moves
mean_noticed_moves
```

---

# 68. Gold Vocabulary CSV

Include aggregate or privacy-safe simulation information such as:

```text
puzzle
player_model
Gold_games
mean_Gold_word_familiarity
median_Gold_word_familiarity
least_familiar_percentile
Gold_with_low_familiarity_word_pct
Gold_with_multiple_low_familiarity_words_pct
```

Do not expose private Daily answers in public artifacts.

These analysis files remain private.

---

# 69. Robustness Scorecard

Create a compact scorecard for each player model:

| Property | Result |
|---|---|
| Skill ordering stable? | |
| Candidate-cap sensitivity | |
| Temperature sensitivity | |
| Familiarity sensitivity | |
| Puzzle ranking stability | |
| Gold saturation | |
| Suitable for comparative profiling? | |

Use descriptive conclusions supported by measured data.

Do not invent an opaque numeric “credibility score.”

---

# 70. Decision Criteria for Future Use

M8.1 should assess whether each model is suitable for:

```text
comparative puzzle profiling
M7B ranking input
absolute Gold-rate prediction
```

These are different standards.

A model may be useful for:

```text
Puzzle A appears harder than Puzzle B
```

without being credible for:

```text
83% of real humans will get Gold.
```

Make this distinction explicit.

---

# 71. Expected Decision Possibilities

The review should allow one of these conclusions:

### A — Strong result

```text
Real familiarity integration works.
Model ordering is stable.
Puzzle rankings are robust.
REGULAR meaningfully separates puzzles.
```

Then M8 may be suitable for **comparative** M7B ranking in M9.

### B — Partial result

```text
Models remain parameter-sensitive,
but relative puzzle ranking is reasonably stable.
```

Then use M8 only as a secondary comparative signal.

### C — Weak result

```text
Puzzle rankings and outcomes change radically
with plausible parameter choices.
```

Then do not integrate M8 into production ranking.

Do not force conclusion A.

---

# 72. Questions the Review Must Answer

### Q1
What real familiarity/frequency source was selected and why?

### Q2
What license applies?

### Q3
What percentage of Qjynn Vocabulary 1.0 is covered?

### Q4
Does the real source produce sensible familiarity ordering?

### Q5
How much do M8 outcomes change when heuristic familiarity is replaced?

### Q6
Does candidate-count sensitivity decrease?

### Q7
Does decision-temperature sensitivity decrease?

### Q8
Does CASUAL < REGULAR < STRONG < EXPERT remain stable?

### Q9
Does Strong/Expert Gold saturation decrease?

### Q10
How often does REGULAR Gold depend on low-familiarity words?

### Q11
How often can REGULAR reach Gold using only broadly familiar words?

### Q12
Are puzzle rankings stable under reasonable parameter perturbations?

### Q13
Do OSCILLATED, AFFORDABLE, and WATERMELON retain their relative characteristics?

### Q14
Does M7B selection appear different from M6 under the improved simulator?

### Q15
Is REGULAR now credible for comparative puzzle profiling?

### Q16
Is any M8.1 model credible for absolute human Gold-rate prediction?

### Q17
Should M8/M8.1 metrics be integrated into M7B ranking in M9?

Do not answer from intuition.

---

# 73. Required Review Document

Create:

```text
M81_REAL_FAMILIARITY_CALIBRATION_REVIEW.md
```

Include:

1. files created/modified;
2. scope;
3. production invariants;
4. familiarity-source investigation;
5. selected source;
6. source URL/version/license;
7. acquisition/reproduction instructions;
8. provider architecture;
9. normalization;
10. Vocabulary 1.0 coverage;
11. missing-word analysis;
12. familiarity distribution;
13. manual sanity checks;
14. knowing-vs-noticing architecture;
15. updated player-model parameters;
16. move-utility normalization changes;
17. baseline-vs-M8.1 methodology;
18. distinct puzzle dataset;
19. Monte Carlo run counts;
20. convergence;
21. aggregate outcomes;
22. Gold-vocabulary analysis;
23. rare-word dependency;
24. candidate-cap sensitivity;
25. temperature sensitivity;
26. familiarity-curve sensitivity;
27. lookahead sensitivity;
28. variance/leverage analysis;
29. skill ordering;
30. Strong/Expert saturation;
31. puzzle separation;
32. puzzle-ranking stability;
33. case studies: OSCILLATED, AFFORDABLE, WATERMELON;
34. M6-vs-M7B comparison if available;
35. tests/results;
36. performance;
37. answers to Q1–Q17;
38. known limitations;
39. suitability for comparative profiling;
40. suitability for M7B/M9 ranking;
41. suitability for absolute human prediction;
42. recommended next step;
43. `git status --short`;
44. `git diff --stat`.

---

# 74. Required Summary Tables

## Familiarity source

| Property | Result |
|---|---|
| Source | |
| Version/date | |
| License | |
| Qjynn coverage | |
| Normalization | |
| Missing-word fallback | |

## Player outcomes — M8 vs M8.1

| Model | M8 Mean Score | M8.1 Mean Score | M8 Gold % | M8.1 Gold % |
|---|---:|---:|---:|---:|

## Gold vocabulary dependency

| Model | Gold Games | Familiar-only Gold % | Low-familiarity Dependency % |
|---|---:|---:|---:|

## Robustness

| Model | Candidate-Cap Sensitivity | Temperature Sensitivity | Ranking Stability |
|---|---|---|---|

## Puzzle separation

| Model | Min Gold % | P25 | Median | P75 | Max |
|---|---:|---:|---:|---:|---:|

---

# 75. Important Interpretation Rule

Do not write:

> “REGULAR represents the average Qjynn player.”

There is no evidence for that yet.

Instead use:

> “REGULAR is a bounded synthetic behavioral model configured between CASUAL and STRONG.”

Likewise, simulated Gold percentages are **model outputs**, not estimates of actual human Gold percentages.

---

# 76. No Production Ranking Change

Even if M8.1 results look promising:

```text
do not modify M7B production ranking
```

in this milestone.

M8.1 should provide evidence for a later decision.

Any M8 integration into production selection belongs in M9.

---

# 77. No Gameplay Changes

Do not change:

```text
game.js
Gold/Silver/Bronze thresholds
scoring
turn count
Hexalink rules
Hint rules
Vocabulary 1.0
```

M8.1 is analysis infrastructure only.

---

# 78. Acceptance Criteria

M8.1 passes if:

1. a defensible real familiarity provider is integrated, or the inability to obtain one is explicitly documented without fabricated data;
2. source provenance and licensing are recorded;
3. Vocabulary 1.0 remains unchanged;
4. knowing and noticing are modeled separately;
5. M8 heuristic baseline remains reproducible;
6. M8.1 frequency model is deterministic;
7. player models remain bounded and non-Oracle;
8. robustness sweeps complete;
9. puzzle-ranking stability is measured;
10. Gold rare-word dependency is measured;
11. all prior tests pass;
12. new M8.1 tests pass;
13. production files/rules remain unchanged;
14. conclusions distinguish comparative profiling from absolute human prediction.

---

# 79. Stop Condition

When M8.1 is complete:

1. save all M8.1 analysis artifacts;
2. create `M81_REAL_FAMILIARITY_CALIBRATION_REVIEW.md`;
3. report artifact paths;
4. stop.

Do not implement M9.

Do not add M8 metrics to M7B ranking.

Do not modify gameplay rules.

Wait for review.