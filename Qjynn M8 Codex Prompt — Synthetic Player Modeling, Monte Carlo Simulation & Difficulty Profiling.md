# Qjynn M8 — Synthetic Player Modeling, Monte Carlo Simulation & Puzzle Difficulty Profiling

Implement **M8 only**.

Do **not** change production Qjynn gameplay rules, scoring, medal thresholds, Vocabulary 1.0, canonical consonant inventory, Hexalink legality, M6 hard gates, or `game.js`.

M1–M7B.1 are complete and approved.

Use the existing:

- `qjynn-rules.js`
- Qjynn Vocabulary 1.0
- M4 vocabulary index and legal move enumerator
- M5 exact Gold solver
- M6 Daily Grid Generator
- M7A analysis framework
- M7B strategic selector
- M7B.1 minimum-turn infrastructure where useful

M8 is a **simulation and profiling milestone**, not a production rule-change milestone.

---

# 1. Objective

Build a deterministic, configurable synthetic-player simulation framework that estimates how different classes of human players might perform on a Qjynn Daily Grid.

The purpose is to answer:

> **How difficult does a puzzle appear to bounded, non-omniscient players rather than to the exact solver?**

The M5/M7 solver represents an Oracle with effectively perfect vocabulary knowledge and exhaustive search.

M8 must deliberately avoid that behavior.

---

# 2. Core Principle

Synthetic players must be:

```text
bounded
probabilistic
non-omniscient
skill-differentiated
reproducible
```

They must not:

- enumerate every legal move and choose the mathematically optimal one;
- use full-depth exact solver search;
- know the Gold certificate;
- know the private answer unless the simulated Hexalink-recognition process reveals it;
- infer hidden information unavailable to a real player.

The existing exact solver may be used only as an **Oracle benchmark**, not as the decision engine for Casual/Regular/Strong/Expert agents.

---

# 3. New Architecture

Create standalone simulation modules under:

```text
tools/simulator/
```

Suggested structure:

```text
tools/simulator/
  player-models.js
  move-discovery.js
  move-ranking.js
  hexalink-recognition.js
  simulate-game.js
  monte-carlo.js
  puzzle-profiler.js
  batch-profile.js
```

Tests:

```text
tests/simulator-player-models.test.js
tests/simulator-game.test.js
tests/simulator-monte-carlo.test.js
```

Do not put simulation logic into `game.js`.

---

# 4. Main Simulation API

Expose an API conceptually similar to:

```javascript
simulateGame({
  puzzle,
  privateCertification,
  playerModel,
  simulationSeed
}, wordIndex, options)
```

Return:

```javascript
{
  finalScore,
  medal,
  turnsPlayed,
  completed,
  hexalinkFound,
  hexalinkTurn,
  hintUsed,
  wordsPlayed,
  invalidAttempts,
  rowsCompleted,
  columnsCompleted,
  moveHistory,
  simulationMetadata
}
```

The exact structure may differ if justified, but keep it machine-readable and deterministic for a given seed.

---

# 5. Monte Carlo API

Expose:

```javascript
simulatePuzzleMonteCarlo({
  puzzle,
  privateCertification,
  playerModel,
  runs,
  masterSeed
}, wordIndex, options)
```

Return aggregate results such as:

```javascript
{
  runs,
  meanScore,
  medianScore,
  p10Score,
  p25Score,
  p75Score,
  p90Score,
  goldRate,
  silverRate,
  bronzeRate,
  noMedalRate,
  hexalinkRate,
  meanHexalinkTurn,
  completionRate,
  meanTurnsUsed,
  meanInvalidAttempts,
  meanRowsCompleted,
  meanColumnsCompleted
}
```

Include uncertainty statistics where practical.

---

# 6. Initial Player Models

Implement at minimum:

```text
CASUAL
REGULAR
STRONG
EXPERT
ORACLE
```

ORACLE may use existing exact/near-exact solver infrastructure.

The other four must remain bounded.

---

# 7. CASUAL Model

Model a player with:

```text
limited familiar vocabulary
small noticed-move set
little or no lookahead
strong preference for recognizable words
moderate chance of overlooking available words
lower Hexalink recognition
occasional suboptimal move choice
```

Initial configurable behavior may include:

```text
candidate moves noticed: low
lookahead depth: 0
move ranking noise: high
Hexalink recognition: low-to-moderate
advanced-word probability: low
```

Do not hardwire these as permanent game assumptions.

Store them as explicit model parameters.

---

# 8. REGULAR Model

Represent a competent recurring word-game player.

Characteristics:

```text
broader vocabulary
larger noticed-move set
evaluates immediate score
some awareness of board coverage
some awareness of preserving future options
moderate Hexalink recognition
limited one-turn strategic lookahead
```

This will likely become the most important model for future puzzle calibration.

---

# 9. STRONG Model

Represent a highly capable word-game player.

Characteristics:

```text
broad vocabulary
large noticed-move set
good immediate-score awareness
stronger coverage awareness
one-turn or bounded two-turn lookahead
higher Hexalink recognition
lower move-selection noise
```

Still do not allow exhaustive M5-style state search.

---

# 10. EXPERT Model

Represent an unusually strong player but still not an Oracle.

Characteristics:

```text
very broad vocabulary
large but bounded move consideration
limited beam search
high Hexalink recognition
good awareness of tile consumption
strong coverage strategy
low decision noise
```

Keep explicit computational limits.

---

# 11. ORACLE Model

Use existing exact solver infrastructure as the mathematical upper benchmark.

Report separately.

ORACLE results must never be mixed into human-like aggregate distributions.

---

# 12. Player-Model Configuration

Each model should resolve into an explicit configuration object.

Conceptually:

```javascript
{
  name: "REGULAR",

  vocabularyAccess: {...},

  discovery: {
    maxCandidateMoves: 100,
    moveNoticeProbability: ...,
    scoreBias: ...
  },

  planning: {
    lookaheadDepth: 1,
    beamWidth: 10
  },

  hexalink: {
    baseRecognitionProbability: ...,
    turnAdjustment: ...
  },

  decision: {
    temperature: ...,
    randomness: ...
  }
}
```

Do not hide behavior inside magic constants scattered through code.

---

# 13. Human-Accessibility Vocabulary Layer

Do not change Vocabulary 1.0.

Vocabulary 1.0 remains:

> the authoritative validity set.

M8 needs a separate analysis-only concept:

> probability that a player model is likely to notice/know a valid word.

Create an interface such as:

```javascript
getWordAccessibility(word, playerModel)
```

returning a normalized value or structured metadata.

---

# 14. Frequency/Familiarity Provider

Create a pluggable interface:

```javascript
getWordFrequencyRank(word)
```

or:

```javascript
getWordFamiliarity(word)
```

Do not use Vocabulary 1.0 alphabetical/order position as a human-frequency proxy.

If no validated external frequency source is available, support:

```text
familiarityProviderAvailable = false
```

and use clearly documented fallback heuristics only for simulator development.

Do not claim those fallbacks represent real human frequency.

---

# 15. Fallback Accessibility Heuristics

If a real frequency provider is unavailable, implement a transparent fallback based on non-authoritative signals such as:

```text
word length
morphological complexity
common inflection patterns
presence of unusual letter sequences
optional developer-supplied familiarity overrides
```

Mark all results produced under fallback mode:

```text
familiarityBasis = "heuristic"
```

Do not use such results to make strong human-behavior claims.

---

# 16. Preserve All Canonical Two-Letter Words

Because Qjynn intentionally accepts the established two-letter word-game set, synthetic players should not automatically lose access to all unusual two-letter words.

Create player-specific recognition probabilities for two-letter words.

Example behavior concept:

```text
CASUAL:
recognizes a subset

REGULAR:
recognizes many

STRONG/EXPERT:
recognizes most/all
```

Do not change validity.

---

# 17. Move Discovery Must Be Bounded

The synthetic player must not inspect every M4 move.

Implement a bounded move-discovery phase.

Possible process:

```text
all legal moves
      ↓
accessibility weighting
      ↓
notice probability
      ↓
candidate sampling
      ↓
bounded noticed set
```

The player may have only:

```text
N noticed strategic moves
```

even when thousands exist.

Make N configurable by model.

---

# 18. Deduplicate Human-Equivalent Moves

Do not overwhelm agents with many vocabulary variants using the same tile path.

When appropriate, group by:

```text
tile mask
path
consonant skeleton
```

and retain a bounded number of representative words.

However, preserve cases where different words sharing a path have materially different score or familiarity.

Document the policy.

---

# 19. Move Attractiveness

For each noticed move, compute a bounded player-facing attractiveness score.

Potential components:

```text
immediate score
word familiarity
row/column progress
Hexalink relevance
future tile flexibility
word length
```

Do not use exact future score from M5.

Weights must be configurable by player model.

---

# 20. Decision Noise

Human players are not deterministic optimizers.

Use seeded probabilistic selection.

For example, softmax or weighted sampling over top moves.

A stronger agent should:

```text
choose higher-ranked moves more consistently
```

A Casual agent should:

```text
make more variable/suboptimal choices
```

Given the same:

```text
puzzle + model + simulationSeed
```

the result must be reproducible.

---

# 21. Lookahead Rules

CASUAL:

```text
depth 0
```

REGULAR:

```text
depth 0 or bounded depth 1
```

STRONG:

```text
bounded depth 1
```

EXPERT:

```text
bounded depth 1–2 with beam width
```

Do not let any non-Oracle model invoke exhaustive search over all moves.

Explicitly cap:

```text
lookahead candidates
beam width
nodes evaluated
```

---

# 22. Lookahead Evaluation

A bounded lookahead may consider:

```text
next-turn plausible score
coverage opportunity
remaining accessible move count
Hexalink opportunity
```

It must not call M5 maximum-score or exact minimum-turn proof.

If existing canonical move-transition helpers are useful, reuse them.

---

# 23. Hexalink Recognition Model

Humans see the clue, so M8 must model Hexalink discovery separately from generic word discovery.

Implement a probabilistic mechanism based on configurable signals such as:

```text
player skill
turn number
whether Hexalink tiles/path have been partially used/observed
clue accessibility input
number of Hexalink letters involved in noticed moves
```

Do not use the private answer automatically.

---

# 24. Clue Accessibility Interface

Create an optional input:

```javascript
clueDifficulty
```

or:

```javascript
clueAccessibility
```

M8 must not use an LLM to score clues.

For now, allow editorial/test input such as:

```text
easy
medium
hard
```

or numeric:

```text
0..1
```

If unspecified, use a documented neutral default.

This is a simulation parameter only.

---

# 25. Hexalink Recognition Event

When the synthetic player recognizes the answer/Hexalink, it may:

```text
actively search for the exact path
prioritize the Hexalink move
```

subject to tile availability.

Do not automatically grant the move if some required tile has already been consumed.

---

# 26. Hint Modeling

The current game contains a Hint mechanism.

Add configurable player behavior:

```text
probability of using Hint
turn at which Hint becomes more likely
score frustration trigger
Hexalink-recognition failure trigger
```

If Hint behavior in canonical rules consumes or changes turns/state, use the canonical behavior.

If current Hint semantics are ambiguous, document rather than invent.

---

# 27. Invalid Word Attempts

Optionally model invalid submissions at low rates for Casual/Regular players.

These should reflect:

```text
uncertain word knowledge
```

rather than random nonsense.

Do not spend large simulation complexity here.

Make configurable and default to conservative rates.

---

# 28. Six-Turn Constraint

Every simulated game must obey exactly the canonical six-turn limit.

Synthetic players cannot receive extra turns.

All move/state transitions must use canonical Qjynn logic.

---

# 29. Medal Calculation

Use canonical thresholds.

Do not replicate constants manually.

Report:

```text
Gold
Silver
Bronze
None
```

from canonical rules.

---

# 30. Monte Carlo Repetition

For profiling, support:

```text
100
500
1,000
5,000
```

runs per:

```text
puzzle × player model
```

Default initial benchmark:

```text
1,000
```

for non-Oracle player models if runtime permits.

ORACLE does not need Monte Carlo if deterministic.

---

# 31. Deterministic Seed Hierarchy

Derive run seeds from:

```text
master simulation seed
puzzle identifier
player model
run index
simulator version
```

The same experiment must reproduce exactly.

---

# 32. Puzzle Difficulty Profile

Create a high-level profile:

```javascript
{
  puzzleId,

  CASUAL: {...},
  REGULAR: {...},
  STRONG: {...},
  EXPERT: {...},
  ORACLE: {...},

  metadata: {...}
}
```

Do not yet assign a single production difficulty label.

---

# 33. Required Outcome Metrics Per Model

At minimum:

```text
mean score
median score
score standard deviation
P10
P25
P75
P90

Gold rate
Silver rate
Bronze rate
No-medal rate

Hexalink-found rate
mean Hexalink turn
median Hexalink turn

mean turns played
completion rate

mean row completions
mean column completions

mean valid words
mean invalid attempts
mean Hint use
```

---

# 34. Strategic Metrics

Also report:

```text
mean immediate-score-per-turn
mean word length
mean number of unique consonant tiles consumed
mean remaining legal-move count after each turn
```

where practical.

These may help explain why one synthetic skill level performs better.

---

# 35. Word Accessibility Metrics

Per model report:

```text
mean accessibility of played words
median accessibility
least-accessible word used
fraction of plays using advanced/low-accessibility words
```

Only when a familiarity/accessibility provider supports the metric.

---

# 36. Oracle Comparison

For every puzzle report:

```text
synthetic mean/median score
vs
Oracle Gold certificate score
vs
highest proven threshold/headroom if available
```

The purpose is to quantify:

```text
solver-human gap
```

Do not interpret a large gap as inherently good or bad yet.

---

# 37. Calibration Sanity Expectations

The simulation should normally exhibit monotonic skill behavior.

Across a sufficiently large batch, we generally expect:

```text
CASUAL score <= REGULAR <= STRONG <= EXPERT <= ORACLE
```

and:

```text
CASUAL Gold rate <= REGULAR <= STRONG <= EXPERT
```

Do not force this mathematically per individual run.

But if aggregate behavior violates the ordering broadly, investigate model design.

---

# 38. Avoid Hardcoding Desired Gold Rates

Do not design models specifically to manufacture target results such as:

```text
Casual Gold = 5%
Regular Gold = 20%
```

The simulator should arise from explicit behavioral parameters.

M8 is measurement infrastructure, not outcome fabrication.

---

# 39. Initial Simulation Dataset

Use at least:

```text
30 production-size 8×6 Qjynn puzzles
```

generated through M6/M7B.

Prefer:

```text
30 different answers
```

rather than 30 seeds of one answer.

If only fewer valid answers are available, use multiple deterministic seeds and report the composition.

---

# 40. Candidate Selection Source

Use the best currently available production selection path:

```text
M7B selected puzzle
```

where practical.

If M7B candidate pooling is too expensive for 30 answers, use:

```text
M6 certified grid
```

for some/all and clearly mark source.

Do not block M8 on M7B.1 exact-minimum-turn proof.

---

# 41. Primary Experiment

For each of 30 puzzles run:

```text
CASUAL:  1,000 simulations
REGULAR: 1,000
STRONG:  1,000
EXPERT:  1,000
```

Total:

```text
120,000 simulated games
```

if runtime permits.

If not, start with 250–500 runs/model/puzzle and report convergence.

---

# 42. Convergence Analysis

For representative puzzles compare:

```text
100 runs
250
500
1,000
2,000
```

Measure stability of:

```text
mean score
Gold rate
Hexalink rate
```

Recommend a default simulation count based on convergence.

---

# 43. Monte Carlo Confidence

Where practical, report uncertainty such as:

```text
Gold-rate standard error
95% confidence interval
```

using standard binomial estimates or bootstrap.

Document methodology.

Do not overstate precision.

---

# 44. Player-Model Sensitivity

For a small subset, vary key model parameters such as:

```text
maxCandidateMoves
move-selection temperature
Hexalink recognition
lookahead width
```

Determine whether outputs are excessively sensitive to arbitrary parameter changes.

This is important.

A useful simulator should not completely reverse puzzle ordering from tiny parameter perturbations.

---

# 45. Synthetic Player Profiles Must Be Versioned

Introduce:

```text
simulatorVersion
playerModelVersion
```

For example:

```text
simulatorVersion = "m8.0"
playerModelVersion = "m8.players.0"
```

Any future parameter changes must increment appropriate versions.

---

# 46. No Training/Fitting Yet

Do not fit player-model parameters to target outcomes.

No real player dataset currently exists.

Keep initial models theory-driven and explicit.

Future real-user calibration can be a separate milestone.

---

# 47. Difficulty Comparison Across Puzzles

For each player model rank the 30 puzzles by:

```text
mean score
Gold rate
Hexalink rate
```

Check whether the same puzzles appear difficult across all models or whether skill-specific differences exist.

Report rank correlations where useful.

---

# 48. Candidate-Selection Evaluation

For a subset of answers where both are available, compare:

```text
M6 first candidate
vs
M7B selected candidate
```

through M8 simulation.

Ask:

> Does M7B selection produce measurably different predicted player outcomes?

Report:

```text
score delta
Gold-rate delta
Hexalink-rate delta
```

by player model.

This provides an indirect validation of M7B ranking.

---

# 49. Detect Degenerate Player Models

Add diagnostics for cases where a model:

```text
always chooses longest word
always finds Hexalink
never finds Hexalink
always gets Gold
never gets Gold
plays identical path every run
```

Flag these in tests/analysis.

A probabilistic model should show plausible variation.

---

# 50. Simulation Trace Mode

Support optional verbose trace for one simulation:

```text
turn
noticed moves
selected move
score
decision probabilities
Hexalink-recognition state
remaining tiles
```

This is for debugging only.

Do not enable by default for Monte Carlo batches.

---

# 51. Private Data Only

Synthetic simulation output is analytical/private.

Do not expose:

```text
private answer
Gold certificates
agent reasoning
candidate move lists
```

in public puzzle JSON.

---

# 52. Output Artifacts

Create:

```text
analysis/m8-puzzle-profiles.json
analysis/m8-puzzle-profiles.csv
analysis/m8-model-summary.csv
analysis/m8-score-distributions.csv
analysis/m8-convergence.csv
analysis/m8-model-sensitivity.csv
analysis/m8-m6-vs-m7b.csv
analysis/m8-summary.json
```

Optional trace examples:

```text
analysis/m8-traces/
```

---

# 53. Puzzle Profile CSV

One row per:

```text
puzzle × player model
```

Include:

```text
answer
seed
puzzle_source
player_model
runs
mean_score
median_score
p10_score
p25_score
p75_score
p90_score
gold_rate
silver_rate
bronze_rate
no_medal_rate
hexalink_rate
mean_hexalink_turn
completion_rate
mean_rows_completed
mean_columns_completed
mean_invalid_attempts
mean_hint_use
simulation_ms
```

---

# 54. Model Summary

Aggregate across all puzzles.

For each model report:

```text
mean puzzle score
median puzzle score
mean Gold rate
mean Silver rate
mean Bronze rate
mean Hexalink rate
mean completion rate
```

and variation across puzzles.

---

# 55. Puzzle Separation Metric

Measure whether the simulator meaningfully distinguishes puzzles.

For each model compute spread such as:

```text
min Gold rate
P25
median
P75
max
```

If every puzzle produces nearly identical outcomes, the simulator is not yet useful for puzzle calibration.

Flag that clearly.

---

# 56. Cross-Model Ordering

Report how often:

```text
REGULAR outperforms CASUAL
STRONG outperforms REGULAR
EXPERT outperforms STRONG
```

across puzzle-level aggregates.

Large systematic violations indicate model-design problems.

---

# 57. Difficulty Rank Correlation

Compute Spearman rank correlation of puzzle difficulty across models.

Examples:

```text
CASUAL vs REGULAR
REGULAR vs STRONG
STRONG vs EXPERT
```

This tells us whether different skill groups find the same puzzles difficult.

---

# 58. Relationship to Solver Metrics

Compare simulated results with:

```text
Gold headroom
unique tile masks
solver-relevant moves
Hexalink participation
M7B ranking
```

Report correlations with:

```text
REGULAR Gold rate
STRONG Gold rate
REGULAR mean score
STRONG mean score
```

This may reveal whether our previous mathematical metrics predict human-like outcomes at all.

---

# 59. Tests

Add at minimum:

1. deterministic simulation for same seed;
2. different seed can change choices;
3. six-turn limit enforced;
4. canonical scoring used;
5. tile reuse prohibited;
6. player cannot choose unavailable move;
7. Casual never calls exact solver;
8. Regular never calls exact solver;
9. Strong never calls exact solver;
10. Expert never calls exact solver;
11. Oracle may call exact solver;
12. bounded candidate-move counts enforced;
13. lookahead node cap enforced;
14. accessibility weighting affects move discovery;
15. model decision noise produces deterministic seeded variability;
16. Hexalink recognition is probabilistic and seeded;
17. recognized Hexalink still requires legal available path;
18. Hint behavior obeys configured policy;
19. medal classification matches canonical rules;
20. Monte Carlo aggregation correct;
21. confidence interval calculation correct;
22. player-model versions recorded;
23. trace mode does not alter simulation result;
24. private information does not enter public puzzle output;
25. existing M1–M7B.1 tests all pass.

---

# 60. Oracle-vs-Human Guard Test

Add an explicit regression test demonstrating that a bounded human-like model does **not** automatically choose the Oracle-optimal route on a handcrafted board.

This is critical.

The simulator fails conceptually if REGULAR/STRONG accidentally become thin wrappers around M5.

---

# 61. Performance

Measure:

```text
single simulated game latency
1,000 runs latency
30-puzzle batch latency
memory
```

for each player model.

The simulator should be suitable for offline batch analysis.

Exact Oracle solving may remain expensive and can be cached or sampled.

---

# 62. Caching

Cache immutable per-puzzle information such as:

```text
initial M4 legal move structures
word accessibility metadata
Hexalink geometry
```

Do not recompute the full vocabulary index for every simulation.

Reuse canonical transition helpers.

---

# 63. Parallelism

If useful, support bounded parallel simulation across:

```text
puzzles
models
runs
```

Ensure deterministic results are independent of worker scheduling.

Seed assignment must be precomputed from run identity.

Do not require parallelism for correctness.

---

# 64. Experimental Results to Highlight

The review must identify examples of:

### A
Puzzle easy for all models.

### B
Puzzle hard for all bounded models but easy for Oracle.

### C
Puzzle where Casual struggles but Strong performs well.

### D
Puzzle with high Hexalink discovery but modest scores.

### E
Puzzle with low Hexalink discovery but high scores.

### F
Puzzle where M7B selection appears better than M6 under bounded-player simulation.

### G
Puzzle where M7B mathematical ranking does not align with synthetic-player outcome.

These counterexamples will be particularly valuable.

---

# 65. No Production Difficulty Thresholds Yet

Do not declare:

```text
Easy
Medium
Hard
```

production categories.

Do not add M8 metrics to production M7B ranking yet.

That belongs in a later milestone after simulator quality is reviewed.

---

# 66. No Gameplay Rule Changes

M8 must not change:

```text
Gold = 100
Silver = 70
Bronze = 40
turns = 6
scoring
Hexalink bonus
line bonuses
canonical inventory
Vocabulary 1.0
```

Simulation only.

---

# 67. Questions the Review Must Answer

### Q1
Do the bounded synthetic models produce meaningfully different outcomes from the Oracle?

### Q2
Do CASUAL, REGULAR, STRONG, and EXPERT produce sensible skill ordering?

### Q3
Do puzzle Gold rates vary enough across puzzles to support difficulty profiling?

### Q4
Does the simulator produce meaningful Hexalink-discovery differences?

### Q5
How sensitive are outputs to player-model parameters?

### Q6
How many Monte Carlo runs are needed for stable puzzle metrics?

### Q7
Do M7A/M7B mathematical metrics correlate with REGULAR/STRONG simulated performance?

### Q8
Does M7B selection outperform M6 first-candidate selection under synthetic players?

### Q9
Does the current 100-point Gold threshold still appear overly permissive when player knowledge/search is bounded?

### Q10
Is M8 sufficiently credible to use as a candidate-ranking input in a future milestone?

Do not answer these questions from assumptions.

---

# 68. Required Review Document

Create:

```text
M8_SYNTHETIC_PLAYER_SIMULATION_REVIEW.md
```

Include:

1. files created/modified;
2. simulator architecture;
3. player model definitions;
4. explicit model parameter table;
5. word accessibility methodology;
6. fallback limitations if no real frequency provider;
7. move-discovery method;
8. move-ranking method;
9. decision-noise method;
10. lookahead design and hard limits;
11. Hexalink-recognition model;
12. Hint modeling;
13. determinism/seeding;
14. Monte Carlo design;
15. test results;
16. Oracle-vs-human guard results;
17. dataset composition;
18. simulation count;
19. convergence results;
20. performance;
21. aggregate player-model outcomes;
22. puzzle-level outcome spread;
23. skill-ordering analysis;
24. Hexalink findings;
25. mathematical-metric correlations;
26. M6-vs-M7B synthetic comparison;
27. sensitivity analysis;
28. counterexamples;
29. answers to Q1–Q10;
30. known limitations;
31. whether a real frequency/familiarity source is now the main missing dependency;
32. whether M8 is suitable for future ranking use;
33. `git status --short`;
34. `git diff --stat`.

---

# 69. Required Summary Tables

Include:

## Player models

| Model | Vocabulary Access | Move Consideration | Lookahead | Hexalink Skill | Decision Noise |
|---|---|---|---|---|---|

## Aggregate outcomes

| Model | Mean Score | Gold % | Silver % | Bronze % | Hexalink % |
|---|---:|---:|---:|---:|---:|

## Puzzle spread

| Model | Min Gold % | P25 | Median | P75 | Max |
|---|---:|---:|---:|---:|---:|

## Skill ordering

| Comparison | % puzzles correctly ordered |
|---|---:|
| Regular > Casual | |
| Strong > Regular | |
| Expert > Strong | |

## M6 vs M7B

| Model | Mean Score Δ | Gold Rate Δ | Hexalink Rate Δ |
|---|---:|---:|---:|

---

# 70. Stop Condition

When M8 is complete:

1. save all simulation artifacts;
2. create `M8_SYNTHETIC_PLAYER_SIMULATION_REVIEW.md`;
3. report artifact paths;
4. stop.

Do not add M8 metrics to production M7B ranking.

Do not modify gameplay rules.

Wait for review.