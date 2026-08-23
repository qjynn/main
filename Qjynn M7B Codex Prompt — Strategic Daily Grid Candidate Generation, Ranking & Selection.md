# Qjynn M7B — Strategic Daily Grid Candidate Generation, Ranking & Selection

Implement **M7B only**.

M1–M7A.3 are complete and approved.

M7B is the first milestone that may improve **production Daily Grid candidate selection**, but it must **not change Qjynn gameplay rules**.

Use the existing:

- `qjynn-rules.js`;
- Qjynn Vocabulary 1.0;
- M4 vocabulary index and legal-move enumerator;
- M5 exact `findGold` solver;
- M6 deterministic Daily Grid Generator;
- M7A analyzer;
- M7A.1 placement experiments;
- M7A.2 analytical scenario infrastructure;
- M7A.3 production-grid Gold-headroom analysis.

Do not duplicate those systems.

---

# 1. Objective

M6 currently answers:

> Can this valid grid achieve canonical Gold?

M7B must answer:

> Among multiple valid Gold-capable candidate grids for the same Daily answer, which candidate provides the strongest strategic Qjynn puzzle?

Implement a deterministic:

```text
Generate
   ↓
Validate
   ↓
Certify Gold
   ↓
Analyze
   ↓
Rank
   ↓
Select
```

pipeline.

M7B should improve puzzle selection without changing:

- vocabulary validity;
- scoring;
- medal thresholds;
- turn count;
- consonant inventory;
- Hexalink rules;
- player-facing game mechanics.

---

# 2. Evidence from M7A.3

Design M7B around the following measured production-grid findings:

```text
10/10 grids:
canonical Gold reachable

10/10:
minimum canonical Gold turns = 5

10/10:
Gold >= 130 reachable

10/10:
Gold @100 reachable without Hexalink

10/10:
Gold @120 reachable without Hexalink
```

Observed proven Gold headroom:

```text
minimum = 30
median  = 40
maximum = 60
```

These are lower bounds because higher-threshold probes sometimes timed out.

Therefore:

- Gold reachability alone is insufficient as a quality criterion;
- production scoring rules must remain unchanged;
- lower Gold headroom is potentially desirable;
- six-turn Gold is potentially desirable;
- Hexalink relevance is useful as a ranking signal but should not initially be mandatory;
- move-space metrics should be secondary signals rather than hard gates.

---

# 3. Production Rules Must Remain Unchanged

M7B must not change:

```text
Gold threshold = 100
turns = 6
Hexalink bonus
row bonus
column bonus
word scoring
canonical consonant inventory
Vocabulary 1.0
Hexalink legality
```

Do not modify `game.js` scoring behavior.

Do not make Hexalink mandatory for Gold.

Do not remove valid words.

M7B changes **which grid is selected**, not how Qjynn is played.

---

# 4. Preserve M6 Compatibility

Existing M6 behavior and APIs should remain available.

Prefer adding an M7B selection layer around or above M6 rather than rewriting M6.

Conceptually:

```javascript
generateDailyGrid(...)
```

may remain the M6 primitive.

Add something conceptually like:

```javascript
generateRankedDailyGrid(...)
```

or:

```javascript
selectDailyGrid(...)
```

that performs multi-candidate generation and ranking.

Choose naming consistent with the repository.

---

# 5. Candidate Pool

For each Daily puzzle:

```text
answer
clue
date
master seed
```

generate multiple deterministic candidate grids.

Initial default:

```text
candidatePoolSize = 100
```

Make configurable:

```text
25
50
100
250
500
```

Do not require all configurations to have identical runtime.

The default should be reasonable for offline Daily puzzle generation.

---

# 6. Deterministic Candidate Seeds

Derive each candidate seed deterministically from:

```text
master seed
candidate index
generator version
```

Conceptually:

```text
candidateSeed = derive(masterSeed, candidateIndex)
```

The same:

```text
answer + date + masterSeed + software versions
```

must produce:

- identical candidate grids;
- identical metrics;
- identical ranking;
- identical selected winner.

Do not depend on process-global random state.

---

# 7. Candidate Generation Strategy

For initial production M7B, use the canonical M6-compatible random placement strategy as the baseline candidate generator.

Do not automatically promote M7A.1 experimental placement strategies into production.

However, architect the candidate generator so alternative approved placement strategies can later be plugged in.

Example:

```javascript
candidateGenerator: "M6_BASELINE"
```

---

# 8. Hard Candidate Gates

Every candidate entering ranking must pass all existing M6 hard requirements.

At minimum:

```text
valid 8×6 board
exact canonical inventory
valid exact Hexalink
valid answer
deterministic generation
canonical Gold reachable
Gold certificate replay succeeds
```

Any candidate failing a hard M6 gate is rejected before ranking.

Record the rejection reason privately.

---

# 9. Do Not Add Arbitrary Strategic Hard Gates Yet

Do not initially reject a candidate merely because:

```text
minimum Gold turns = 5
Gold headroom > 20
Gold possible without Hexalink
unique mask count is high
```

These should initially be **ranking signals**.

The only hard gates in initial M7B should be established M6 validity/correctness requirements.

This avoids making production generation impossible based on thresholds not yet supported by enough data.

---

# 10. Primary Ranking Objective #1 — Canonical Minimum Gold Turns

For each candidate determine:

```text
canonicalMinimumGoldTurns
```

exactly.

Ranking preference:

```text
6 turns > 5 turns > 4 turns > 3 turns > 2 turns > 1 turn
```

A candidate requiring more turns to reach canonical Gold should rank above one allowing Gold more quickly, all else equal.

Do not reject five-turn grids if no six-turn candidate exists.

---

# 11. Six-Turn Gold Discovery Experiment

M7B must explicitly measure whether naturally generated six-turn-Gold grids exist.

For the validation experiment:

```text
at least 20 Daily answers
```

generate:

```text
at least 250 candidates per answer
```

if runtime permits.

That is:

```text
>= 5,000 candidate grids
```

Target 10,000 if practical.

Report distribution:

```text
minimum Gold turns = 1
minimum Gold turns = 2
...
minimum Gold turns = 6
```

The purpose is to answer:

> Are six-turn-Gold grids naturally obtainable often enough to use as a meaningful ranking objective?

Do not assume the answer.

---

# 12. Primary Ranking Objective #2 — Gold Headroom

Use M7A.3's concept:

```text
goldHeadroom =
highestProvenReachableThreshold - 100
```

Lower proven headroom is preferred.

However:

```text
highestProvenReachableThreshold
```

may be a lower bound when higher probes time out.

Therefore M7B must not rank:

```text
timeout
```

as equivalent to:

```text
proven unreachable
```

---

# 13. Efficient Headroom Probe

Running the entire M7A.3 probe sequence on 100+ candidates may be expensive.

Implement a staged headroom probe.

Suggested thresholds:

```text
110
120
130
140
150
```

Candidate already passed canonical 100.

Prefer candidates that fail at lower thresholds **only when failure is exactly proven**.

Conceptually:

```text
candidate A:
100 reachable
110 reachable
120 reachable
130 unreachable

candidate B:
100 reachable
110 reachable
120 reachable
130 reachable
140 reachable

A has stronger evidence of lower headroom.
```

But:

```text
130 timeout
```

must not be treated as equivalent to:

```text
130 unreachable
```

---

# 14. Headroom Evidence Representation

Store:

```javascript
{
  highestProvenReachableThreshold,
  firstProvenUnreachableThreshold,
  unresolvedThresholds,
  headroomLowerBound,
  headroomUpperBound
}
```

Where possible.

Example:

```text
100 reachable
110 reachable
120 reachable
130 unreachable
```

gives:

```text
headroom lower bound = 20
headroom upper bound < 30
```

If:

```text
130 timeout
```

then upper bound remains unresolved.

Use explicit uncertainty.

---

# 15. Primary Ranking Objective #3 — Hexalink Strategic Relevance

Measure:

```text
goldReachableWithoutHexalink
```

at canonical 100 where practical.

Preference:

```text
Gold impossible without Hexalink
>
Gold possible without Hexalink
```

but do not make this a hard gate.

Also use:

```text
hexalinkMoveParticipationPct
```

from M7A as a secondary signal.

Higher meaningful Hexalink participation may be preferred, but avoid over-weighting it.

---

# 16. Secondary Ranking Signal — Strategic Move Space

Use existing M7A metrics such as:

```text
uniqueTileMasks
solverRelevantMoves
uniquePlayableWords
```

Do not assume “fewer is always better.”

M7A.3 showed unique tile masks correlate only weakly/moderately with Gold headroom.

Use move-space metrics mainly for:

- tie-breaking;
- diversity;
- avoiding extreme outliers.

Do not make them dominant.

---

# 17. Secondary Ranking Signal — Tile Participation Balance

Use:

```text
tileParticipationSpread
```

or a more stable existing equivalent.

Avoid grids with extreme dead zones or extreme opportunity concentration.

Prefer reasonable board-wide participation.

Do not invent a hard threshold yet.

---

# 18. Secondary Ranking Signal — Hexalink Geometry

Use existing metrics:

```text
rows touched
columns touched
direction changes
diagonal/horizontal/vertical steps
```

as low-weight diversity/tie-breaking signals.

Do not define one Hexalink shape as universally optimal.

The goal is to prevent repeated geometric monotony across Daily puzzles.

---

# 19. Avoid a Premature Opaque Composite Score

Do not start with an unexplained formula such as:

```text
quality =
0.4*A +
0.3*B +
0.2*C +
0.1*D
```

Instead implement **lexicographic / tiered ranking** initially.

Recommended ranking order:

```text
1. canonicalMinimumGoldTurns
2. proven Gold-headroom evidence
3. Hexalink dependency/relevance
4. move-space sanity
5. tile-participation balance
6. geometry/diversity tie-breakers
7. deterministic candidate index
```

This is easier to audit.

---

# 20. Ranking Semantics

Implement a transparent comparison function.

Conceptually:

```javascript
compareCandidates(a, b)
```

Return not only ordering but diagnostic reasons.

Example:

```text
Candidate 37 beats Candidate 12 because:

1. both require 6 turns for Gold;
2. candidate 37 is proven unreachable at 130;
3. candidate 12 remains reachable at 140.
```

Or:

```text
Candidate 8 beats Candidate 21 because:

1. both require 5 turns;
2. headroom evidence tied;
3. Candidate 8 cannot reach Gold without Hexalink.
```

This auditability is important.

---

# 21. Ranking Evidence

For each candidate retain private ranking evidence:

```javascript
{
  candidateIndex,
  candidateSeed,

  hardGateStatus,

  canonicalMinimumGoldTurns,

  headroom: {...},

  goldReachableWithoutHexalink,

  hexalinkMoveParticipationPct,

  uniqueTileMasks,

  solverRelevantMoves,

  tileParticipationSpread,

  rankingReasons
}
```

Do not expose this in public Daily puzzle JSON.

---

# 22. Selected Puzzle Output

Public output should remain compatible with the Daily puzzle contract.

Do not expose:

```text
answer
Gold certificate
candidate pool
candidate ranking
private solver data
headroom analysis
```

unless the existing public/private contract explicitly allows some field.

Keep M6 privacy guarantees intact.

---

# 23. Private Generation Manifest

Create a private generation manifest for each selected Daily puzzle.

Conceptually:

```json
{
  "answer": "...",
  "date": "...",
  "masterSeed": "...",
  "candidatePoolSize": 100,
  "selectedCandidateIndex": 37,
  "selectedCandidateSeed": "...",

  "selectedMetrics": {
    "canonicalMinimumGoldTurns": 6,
    "highestProvenReachableThreshold": 120,
    "firstProvenUnreachableThreshold": 130,
    "goldReachableWithoutHexalink": false
  },

  "rankingReasons": [...],

  "versions": {...}
}
```

Private only.

---

# 24. Candidate Evaluation Pipeline

Use staged evaluation to control cost.

Recommended:

### Stage 1 — Cheap generation/validation

For all N candidates:

```text
generate
structural validation
M6 hard gates
canonical Gold certification
```

### Stage 2 — Minimum Gold Turns

For all surviving candidates determine exact:

```text
canonicalMinimumGoldTurns
```

### Stage 3 — Shortlist

Retain the strongest subset.

Suggested configurable value:

```text
shortlistSize = 20
```

### Stage 4 — Expensive Analysis

Only for shortlist:

```text
headroom probes
Gold without Hexalink
full M7A metrics needed for ranking
```

### Stage 5 — Rank and Select

Rank shortlist and choose winner.

This prevents expensive M7A.3 analysis across every candidate.

---

# 25. Shortlist Rules

Initial shortlist ordering should primarily use:

```text
canonicalMinimumGoldTurns descending
```

Then inexpensive existing metrics if necessary.

Do not use Gold headroom before it has been measured.

If more than `shortlistSize` candidates tie, choose deterministically using candidate index or a documented inexpensive metric.

---

# 26. Candidate Diversity

Prevent duplicate grids in the candidate pool.

Create a canonical grid hash.

If two candidate seeds produce the same grid:

```text
retain one
record duplicate
```

Do not let duplicates influence statistics or ranking.

---

# 27. Daily-to-Daily Diversity

Design an optional interface for future historical comparison.

For example:

```javascript
historicalPuzzleProvider
```

Future metrics may compare:

```text
grid similarity
Hexalink shape
selected candidate characteristics
```

Do not require a history database in M7B.

Do not block M7B if no historical provider is supplied.

---

# 28. Fallback Behavior

Production generation must always have explicit fallback behavior.

If:

```text
candidatePoolSize = N
```

produces valid Gold-certified candidates but none have desirable strategic characteristics:

```text
select the highest-ranked valid candidate
```

Do not fail merely because no six-turn grid exists.

Only fail if no candidate passes the established M6 hard validity gates.

---

# 29. Candidate Pool Exhaustion

If no valid M6 candidate is found:

return a structured error containing:

```text
candidate count
failure categories
generation attempts
versions
seed
```

Do not expose private answer/certificate information in public errors.

---

# 30. Performance Budget

This is offline Daily generation, so quality matters more than sub-second response.

However, measure:

```text
candidate generation time
M6 certification time
minimum-turn analysis time
shortlist analysis time
total selection time
```

Report performance for:

```text
25 candidates
50 candidates
100 candidates
250 candidates
```

if practical.

Do not optimize prematurely at the expense of correctness.

---

# 31. Experimental Validation Dataset

Use at least:

```text
20 valid Daily answers
```

preferably drawn from the existing Qjynn 10-letter/four-vowel answer dataset.

For each answer test:

```text
candidatePoolSize = 250
```

if practical.

If runtime makes that unreasonable, use the largest practical deterministic pool and report the limitation.

---

# 32. Required Candidate Statistics

Across the validation experiment report:

```text
total candidates generated
unique candidates
M6-valid candidates
Gold-certified candidates

minimum Gold turn distribution

4-or-fewer-turn count
5-turn count
6-turn count

Gold-headroom probe distribution

Gold-without-Hexalink rate

selected-candidate minimum Gold turn distribution

selected-candidate headroom distribution
```

---

# 33. Compare M6 vs M7B

For each answer compare:

```text
M6 first valid candidate
vs
M7B selected candidate
```

Report at minimum:

```text
minimum Gold turns
headroom evidence
Gold without Hexalink
unique tile masks
tile participation spread
Hexalink participation
```

This is critical.

M7B must demonstrate whether candidate ranking actually improves measurable strategic properties.

---

# 34. Acceptance Experiment: Six-Turn Grids

Explicitly answer:

```text
How often do canonical six-turn-Gold grids occur?
```

Report:

```text
six-turn candidates / valid candidates
```

and:

```text
answers for which at least one six-turn candidate was found
```

Also report the number of candidates required before the first six-turn candidate was discovered for each answer.

This will inform whether six-turn Gold should later become a stronger requirement.

---

# 35. Acceptance Experiment: Lower Headroom

Determine whether candidate pooling finds grids with lower proven headroom than M6 first-candidate selection.

For each answer calculate:

```text
M6 candidate headroom evidence
M7B selected candidate headroom evidence
difference
```

Do not overstate improvement where upper bounds remain unresolved.

---

# 36. Acceptance Experiment: Hexalink Dependency

Determine whether candidate pooling can find grids where:

```text
Gold @100 impossible without Hexalink
```

Report frequency.

Do not make this mandatory.

If none are found across thousands of candidates, document that clearly.

That would be evidence that Hexalink dependency should not be a production selection goal under current rules.

---

# 37. Ranking Ablation

Perform a small diagnostic ablation.

Compare selection using:

```text
A. minimum Gold turns only

B. minimum Gold turns + headroom

C. full M7B ranking
```

For the validation answers.

Report whether secondary signals materially change selected grids.

This helps prevent unnecessary ranking complexity.

---

# 38. Candidate Ranking Tests

Create deterministic handcrafted candidate records to test ranking.

At minimum verify:

1. 6-turn candidate beats otherwise identical 5-turn candidate;
2. 5-turn beats 4-turn;
3. proven lower headroom beats proven higher headroom when turns tie;
4. timeout does not beat proven unreachable;
5. Hexalink-dependent candidate wins the appropriate tie;
6. secondary metrics only affect lower ranking tiers;
7. deterministic candidate index resolves a complete tie;
8. comparison reasons match the actual ranking decision.

---

# 39. Generator Tests

Add tests for:

1. deterministic candidate-seed derivation;
2. deterministic candidate pool;
3. duplicate-grid detection;
4. all candidates preserve canonical inventory;
5. all candidates preserve exact Hexalink;
6. M6 hard gates remain unchanged;
7. invalid candidates never enter ranking;
8. shortlist size is respected;
9. expensive analysis runs only on shortlist;
10. winner belongs to candidate pool;
11. repeated invocation selects identical winner;
12. fallback selects best valid candidate;
13. structured failure when no valid candidate exists;
14. public output contains no private ranking data;
15. private manifest contains required evidence;
16. existing M1–M7A.3 tests continue to pass.

---

# 40. Production Safety Test

Add an explicit regression test proving:

```text
game.js gameplay scoring before M7B
==
game.js gameplay scoring after M7B
```

and:

```text
Vocabulary 1.0 hash before
==
Vocabulary 1.0 hash after
```

and:

```text
canonical consonant inventory before
==
canonical consonant inventory after
```

M7B must not silently change game rules.

---

# 41. Suggested Architecture

Use repository naming conventions, but conceptually something like:

```text
tools/generator/
    daily-grid-generator.js       # existing M6
    candidate-pool.js             # M7B
    candidate-ranker.js           # M7B
    strategic-selector.js         # M7B
```

Tests:

```text
tests/generator-candidate-ranker.test.js
tests/generator-strategic-selector.test.js
```

Do not force these exact filenames if the existing structure suggests something cleaner.

---

# 42. Configuration

Centralize M7B generation configuration.

Conceptually:

```javascript
{
  candidatePoolSize: 100,
  shortlistSize: 20,

  headroomThresholds: [
    110,
    120,
    130,
    140,
    150
  ],

  analysisTimeoutMs: ...,

  candidateGenerator: "M6_BASELINE"
}
```

Record resolved configuration in the private generation manifest.

---

# 43. Versioning

Introduce an explicit:

```text
M7B selector version
```

or equivalent generator-policy version.

A Daily puzzle must be reproducible from:

```text
answer
date
master seed
generator version
selector version
rules version
vocabulary version
```

Changing ranking policy later must increment the selector/policy version.

---

# 44. Do Not Hide Uncertainty

Headroom probes may remain unresolved.

Ranking data should distinguish:

```text
reachable
unreachable
timeout
not tested
```

Never collapse these into a boolean.

This applies both to artifacts and comparison logic.

---

# 45. No Human-Familiarity Ranking Yet

Do not use the M7A.2 vocabulary-order proxy for production ranking.

It was not a real human-frequency dataset.

Therefore M7B must not rank grids based on:

```text
common words
obscure words
frequency tier
human familiarity
```

until a validated familiarity dataset is available.

---

# 46. No Production Difficulty Labels Yet

Do not label selected puzzles:

```text
Easy
Medium
Hard
Expert
```

M7B selects strategically stronger grids.

Difficulty labeling, if desired, belongs in a later milestone after real player data exists.

---

# 47. No LLM in the Generation Loop

Do not use an LLM to:

```text
judge grids
rank words
assess difficulty
select puzzles
```

M7B must be deterministic, testable, reproducible, and solver/metric driven.

---

# 48. Output Artifacts

For the validation experiment create:

```text
analysis/m7b-candidates.csv
analysis/m7b-selected-puzzles.csv
analysis/m7b-selection-comparison.csv
analysis/m7b-six-turn-analysis.csv
analysis/m7b-ranking-ablation.csv
analysis/m7b-summary.json
```

Detailed candidate/private information may also be stored in JSON.

---

# 49. Selected Puzzle CSV

One row per Daily answer.

Include:

```text
answer
master_seed
candidate_pool_size
valid_candidates
selected_candidate_index
selected_candidate_seed
canonical_min_gold_turns
highest_proven_reachable_threshold
first_proven_unreachable_threshold
headroom_lower_bound
gold_without_hexalink
unique_tile_masks
tile_participation_spread
hexalink_participation_pct
generation_ms
```

Private analysis artifact only.

---

# 50. M6 vs M7B Comparison Table

The review must contain a table conceptually like:

| Answer | M6 Turns | M7B Turns | M6 Headroom | M7B Headroom | M6 Gold w/o Hex | M7B Gold w/o Hex |
|---|---:|---:|---:|---:|---|---|

Do not claim improvement where uncertainty prevents comparison.

---

# 51. Six-Turn Feasibility Table

Include:

| Answer | Valid Candidates | 6-Turn Candidates | Rate | First Found At Candidate |
|---|---:|---:|---:|---:|

This is one of the most important M7B outputs.

---

# 52. Candidate-Pool Sensitivity

For a representative subset of answers compare:

```text
25 candidates
50 candidates
100 candidates
250 candidates
```

Measure:

```text
selected min Gold turns
selected headroom evidence
runtime
```

This will help determine whether 100 candidates is sufficient or whether larger pools materially improve quality.

---

# 53. Questions M7B Must Answer

Use measured data to answer:

### Q1
Do six-turn canonical Gold grids exist under current rules and M6 placement?

### Q2
How frequently do they occur?

### Q3
Does candidate pooling materially improve minimum Gold turns over M6 first-valid selection?

### Q4
Does candidate pooling find lower-headroom grids?

### Q5
Can candidate pooling find grids where Gold requires Hexalink?

### Q6
Which ranking signals actually affect winner selection?

### Q7
Are move-space and geometry signals useful beyond minimum turns/headroom?

### Q8
What candidate pool size gives a reasonable quality/runtime tradeoff?

### Q9
Does M7B consistently select measurably stronger puzzles than M6?

### Q10
Should any ranking signal become a hard production gate in a future milestone?

Do not answer these questions from intuition.

---

# 54. Required Review Document

Create:

```text
M7B_STRATEGIC_DAILY_GRID_SELECTION_REVIEW.md
```

Include:

1. files created/modified;
2. architecture;
3. production-rule invariants;
4. candidate generation;
5. deterministic seed derivation;
6. hard M6 gates;
7. staged evaluation pipeline;
8. ranking semantics;
9. ranking auditability;
10. uncertainty handling;
11. candidate-pool configuration;
12. validation dataset;
13. number of candidates evaluated;
14. six-turn-Gold findings;
15. Gold-headroom findings;
16. Hexalink-dependency findings;
17. M6-vs-M7B comparison;
18. ranking ablation;
19. candidate-pool-size sensitivity;
20. performance;
21. tests and results;
22. answers to Q1–Q10;
23. unexpected findings;
24. known limitations;
25. recommended production M7B defaults based on the experiment;
26. whether any ranking criterion should become a hard gate later;
27. `git status --short`;
28. `git diff --stat`.

---

# 55. Production Default Decision

After the validation experiment, Codex may recommend values for:

```text
candidatePoolSize
shortlistSize
headroom probe thresholds
analysis timeout
```

based on measured runtime/quality tradeoffs.

However, do not change Qjynn gameplay rules.

If evidence does not support a clear configuration, retain conservative defaults and state that.

---

# 56. Acceptance Criteria

M7B passes only if:

1. all M1–M7A.3 tests still pass;
2. new M7B tests pass;
3. gameplay rules remain byte/semantically unchanged as appropriate;
4. candidate generation is deterministic;
5. selection is deterministic;
6. ranking is auditable;
7. private solver information does not leak publicly;
8. M6 remains usable independently;
9. at least 20 Daily answers are evaluated if computationally practical;
10. M6-vs-M7B comparison is produced;
11. six-turn feasibility is measured rather than assumed;
12. uncertainty from solver timeouts is represented correctly.

---

# 57. Stop Condition

When M7B implementation and validation are complete:

1. save all M7B analysis artifacts;
2. create `M7B_STRATEGIC_DAILY_GRID_SELECTION_REVIEW.md`;
3. report artifact paths;
4. stop.

Do not begin another milestone.

Do not modify gameplay rules.

Wait for review.