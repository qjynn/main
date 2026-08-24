# Qjynn M7B.1 — Exact Minimum-Gold-Turn Solver Optimization & Scalable Candidate Selection

Implement **M7B.1 only**.

Do **not** change Qjynn gameplay rules, scoring, medal thresholds, Vocabulary 1.0, canonical consonant inventory, Hexalink legality, M6 hard gates, or `game.js`.

M1–M7B are complete and approved.

Use the existing:

- `qjynn-rules.js`
- Qjynn Vocabulary 1.0
- M4 vocabulary index and legal-move enumerator
- M5 exact Gold solver
- M6 Daily Grid Generator
- M7A/M7A.1/M7A.2/M7A.3 analysis infrastructure
- M7B candidate pool, ranker, and strategic selector

This milestone is primarily an **exact solver-performance and ranking-evidence milestone**.

---

# 1. Objective

M7B architecture is correct, but the main ranking signal:

```text
canonicalMinimumGoldTurns
```

was exactly proven for only a small fraction of candidates because shorter-turn impossibility checks timed out.

M7B.1 must make this query practical:

> What is the exact minimum number of successful turns required to reach canonical Gold (score >=100) on this 8×6 Qjynn grid?

Possible exact results:

```text
1
2
3
4
5
6
unreachable
```

For M6-valid candidates, canonical Gold should already be reachable in <=6 turns.

The production use case is therefore primarily distinguishing:

```text
Gold in <=4
Gold first reachable in 5
Gold first reachable in 6
```

with exact proof.

---

# 2. Do Not Solve the Wrong Problem

Do **not** optimize maximum-score proof.

M7B.1 does not need to prove:

```text
maximum achievable score
```

It needs to prove:

```text
minimum turns required to reach threshold
```

These are different search problems.

Optimize specifically for threshold reachability under a turn budget.

---

# 3. Preferred Solver API

Extend M5 cleanly or add a dedicated module if that is architecturally better.

Conceptually support:

```javascript
findMinimumGoldTurns(boardState, wordIndex, {
  goldThreshold: 100,
  maxTurns: 6,
  scoringPolicy,
  moveFilter,
  timeoutMs
})
```

Return:

```javascript
{
  reachable: true,
  exact: true,
  minimumTurns: 5,
  certificate: [...],
  stats: {
    elapsedMs,
    statesExplored,
    statesPruned,
    memoHits,
    compatibilityCacheHits
  }
}
```

If analysis times out:

```javascript
{
  reachable: null,
  exact: false,
  minimumTurns: null,
  status: "timeout"
}
```

Never convert timeout into reachability or unreachability.

---

# 4. Exact Search Strategy

The simplest exact formulation is iterative threshold reachability by turn budget.

Conceptually:

```text
Can Gold be reached in 1 turn?
No.

Can Gold be reached in 2 turns?
No.

...

Can Gold be reached in 5 turns?
Yes.

minimumGoldTurns = 5
```

However, do not blindly run six completely independent searches if state/move preparation can be reused.

Design the most efficient exact approach.

---

# 5. Search Priority

Because real M6 grids previously reached Gold in roughly five turns, optimize query order for likely cases while preserving exact proof.

For production M7B candidates, a practical sequence may be:

```text
test <=4 turns
if reachable:
    refine exact minimum 1..4
else:
    test <=5 turns
    if reachable:
        minimum = 5
    else:
        test <=6
```

This avoids proving unnecessary lower budgets independently.

But exactness must remain mathematically valid.

---

# 6. Critical Correctness Definition

If M7B.1 reports:

```text
minimumTurns = 5
```

it must have proven:

```text
Gold unreachable in <=4 turns
AND
Gold reachable in <=5 turns
```

A five-turn certificate alone is insufficient.

Likewise:

```text
minimumTurns = 6
```

requires proof that Gold is impossible in <=5.

---

# 7. Reuse Prepared Moves

M4 enumeration and M5 move preparation are expensive enough that they should happen once per candidate wherever possible.

Precompute and reuse:

```text
raw legal moves
solver-relevant/dominated moves
BigInt masks
static scores
Hexalink flags
row/column touch information
certificate metadata
```

Do not rebuild them for each turn-budget query.

---

# 8. Same-Mask Dominance

Retain the proven M5 same-mask dominance rule:

> If two moves produce the same state transition, search only the highest-scoring representative.

Preserve exact Hexalink semantics.

Existing regression coverage involving same-mask Hexalink/non-Hexalink variants must continue to pass.

---

# 9. Threshold-Oriented Move Ordering

For reachability search, order moves to find a valid Gold route quickly.

Use safe ordering preferences such as:

```text
higher immediate score
moves completing rows/columns
exact Hexalink if beneficial
higher optimistic future potential
```

Ordering affects performance only.

It must not affect correctness.

---

# 10. Strong Safe Upper Bounds

Before exploring a state, calculate a mathematically safe upper bound on the maximum additional score achievable in the remaining turns.

If:

```text
currentScore + optimisticUpperBound < goldThreshold
```

prune immediately.

Improve the bound specifically for fixed turn budgets.

Consider safely combining:

```text
top compatible static scores
maximum possible remaining Hexalink bonus
maximum possible row bonuses
maximum possible column bonuses
remaining available tile constraints
remaining turn count
```

Any bound used for exact pruning must be documented and proven optimistic.

---

# 11. Required-Tile Lower Bound

Explore whether a safe minimum-tile-consumption bound can prune states.

Example concept:

If the remaining turns cannot possibly consume enough tiles to complete required rows/columns or produce sufficient score, prune.

Only implement if mathematically safe.

Do not add heuristic pruning.

---

# 12. Score-Bucket / Dominance Memoization

Investigate more aggressive state dominance for threshold reachability.

Candidate state identity may include:

```text
usedMask
completedRows
completedCols
turnsUsed
```

If the same structural state is reached with a lower or equal score than a prior visit, it is dominated.

Prove and test this carefully.

For threshold reachability, retaining only the highest score seen for an equivalent structural state may substantially reduce search.

---

# 13. Remaining-Turn Memoization

Memoize:

```text
Can this structural state reach threshold within N remaining turns?
```

or equivalent future-score information.

Reuse results across minimum-turn queries where possible.

Do not create separate redundant caches for budgets 4, 5, and 6 unless necessary.

---

# 14. Transposition Sharing Across Candidate Analysis

Within one candidate, all minimum-turn queries must share:

```text
prepared moves
compatibility cache
structural information
```

If safe, share memoized future bounds across turn-budget queries.

Do not share board-specific state across different grids.

---

# 15. Bitset/Mask Optimization

Profile whether current:

```text
BigInt usedMask
```

operations are a bottleneck.

The board has exactly 48 tiles, so BigInt is reasonable.

Do not replace it without profiling evidence.

If another representation materially improves runtime while maintaining clarity and correctness, document the benchmark.

---

# 16. Compatibility Lookup Optimization

M5 previously cached compatible move lists by `usedMask`.

Profile this again for minimum-turn queries.

Investigate:

```text
move conflict indexing
per-tile move lists
incremental compatible-move filtering
```

The objective is to avoid scanning thousands of candidate moves at every state.

Any optimization must preserve the exact move set.

---

# 17. Precompute Conflict Information

Investigate precomputing conflict metadata between solver-relevant moves.

For example:

```text
move A conflicts with move B if masks overlap
```

A full N×N matrix may be too large.

Consider compact indexing only if profiling supports it.

Do not over-engineer without measured benefit.

---

# 18. Canonical Gold Threshold First

Production benchmark must focus primarily on:

```text
goldThreshold = 100
```

Do not let generalized analytical thresholds dominate implementation complexity.

M7A.2 hooks should remain functional, but M7B.1 is optimized for canonical Gold-turn determination.

---

# 19. Exact Reference Validation

Continue using brute-force reference solving on small handcrafted boards.

Add randomized small-board comparisons.

For each small board:

```text
optimized minimumTurns
==
brute-force minimumTurns
```

Run enough deterministic randomized boards to exercise:

```text
tile conflicts
line bonuses
Hexalink
different thresholds
Gold impossible
Gold reachable in different turn counts
```

---

# 20. Handcrafted Minimum-Turn Tests

Create boards where exact minimum is known:

```text
Gold in 1
Gold in 2
Gold in 3
Gold in 4
Gold in 5
Gold in 6
Gold impossible
```

Where practical.

If a natural Qjynn-size example is awkward, use small test boards with compatible canonical rule hooks.

---

# 21. Important 5-vs-6 Regression Test

Create a test specifically proving that a board with:

```text
a valid 6-turn Gold route
```

but no <=5-turn route returns:

```text
minimumTurns = 6
```

This is central to M7B.

---

# 22. Certificate Replay

The returned minimum-turn certificate must replay exactly.

Verify:

```text
reported score == replay score
reported turns == replay turns
score >= threshold
```

For minimumTurns = N, also ensure the solver has exact proof that no smaller turn count qualifies.

---

# 23. Integrate with M7B Ranking

Update M7B to use:

```text
exactMinimumGoldTurns
```

when available.

Do not silently fall back to the M6 certificate turn count and treat it as exact.

Represent ranking evidence as:

```javascript
{
  minimumGoldTurns: 5,
  minimumGoldTurnsExact: true
}
```

or:

```javascript
{
  minimumGoldTurns: 5,
  minimumGoldTurnsExact: false,
  minimumGoldTurnsUpperBound: 5
}
```

---

# 24. Ranking Semantics Under Uncertainty

Define explicit ordering.

Preferred:

```text
exact 6-turn
>
exact 5-turn
>
exact 4-turn
...
```

But uncertain values must not be allowed to masquerade as exact values.

For example:

```text
candidate A:
5 turns exact

candidate B:
5-turn certificate, exact minimum unresolved
```

A should rank above B on the primary signal.

If both unresolved, defer to lower ranking tiers deterministically.

Document the rule.

---

# 25. Do Not Penalize Timeout as Difficulty

A slow solver does not imply a difficult puzzle.

Never interpret:

```text
minimum-turn timeout
```

as evidence that Gold requires many turns.

This is critical.

---

# 26. Candidate Pool Benchmark

After optimization, rerun candidate-pool selection at:

```text
3
10
25
50
100
```

for representative answers.

At minimum use:

```text
WATERMELON
OSCILLATED
ABANDONING
ACCESSIBLE
ADVENTURES
```

Prefer 10 answers if runtime permits.

Report exact-minimum-turn completion rate for each pool size.

---

# 27. Primary Performance Goal

The target is not a fixed millisecond requirement.

The target is:

> A 25-candidate pool should be practically usable for offline Daily puzzle selection with exact minimum-turn evidence for most or all candidates.

Measure this rather than claiming success from unit tests.

---

# 28. Stretch Goal

If performance permits:

```text
100-candidate pool
```

with exact minimum-turn classification for most candidates.

Do not sacrifice exactness to reach this target.

---

# 29. Production Benchmark Metrics

For each pool benchmark report:

```text
candidates
M6-valid candidates
exact min-turn classifications
timeouts
3-turn candidates
4-turn candidates
5-turn candidates
6-turn candidates
elapsed time
mean candidate min-turn analysis time
median
P90
states explored
states pruned
memo hits
```

---

# 30. Six-Turn Feasibility Experiment

Now that minimum-turn solving is optimized, rerun the key experiment properly.

Use at least:

```text
20 answers × 25 candidates
= 500 production-size candidates
```

if practical.

Prefer:

```text
20 × 50 = 1,000
```

if runtime permits.

Report exact:

```text
minimum turns = 1
2
3
4
5
6
```

distribution.

Do not use certificate upper bounds in this distribution.

---

# 31. Six-Turn Discovery Statistics

For each answer report:

```text
valid candidates
exact candidates
six-turn candidates
six-turn rate
first candidate index where six-turn found
```

This should finally answer whether six-turn Gold is realistically available under current rules.

---

# 32. Revisit M7B Selection

After exact minimum-turn optimization, rerun M7B selection.

Compare old bounded M7B winner vs new exact-evidence winner where possible.

Report:

```text
answers where winner changed
why winner changed
```

This validates whether uncertainty materially affected previous selections.

---

# 33. Headroom Staging

Do not optimize headroom proof deeply in M7B.1.

Once exact minimum-turn ranking works:

```text
shortlist
then headroom
```

Headroom remains secondary.

The key engineering goal is minimum-turn exactness.

---

# 34. Expensive Analysis Only After Exact Shortlist

Change staged evaluation if useful:

```text
M6 hard gates
↓
exact minimum-turn classification
↓
shortlist
↓
headroom / Hexalink / M7A analysis
```

Do not run headroom probes on candidates that cannot compete on minimum-turn ranking.

---

# 35. Profiling Requirement

Before major optimization, profile current implementation.

Report percentage/time spent in:

```text
move preparation
compatible move lookup
bound computation
state expansion
memoization
certificate construction
other
```

Use lightweight instrumentation if a full profiler is inconvenient.

Do not optimize blindly.

---

# 36. Before/After Benchmark

Use identical deterministic grids to compare:

```text
M7B original minimum-turn approach
vs
M7B.1 optimized approach
```

Report:

```text
elapsed time
states explored
timeouts
exact result
```

for at least 10 production grids.

---

# 37. Regression Requirements

All existing:

```text
M1–M7B
```

tests must still pass.

M7B.1 tests are additive.

M6 must remain independently usable.

Production rules remain unchanged.

---

# 38. Production Safety

Verify:

```text
game.js unchanged
Vocabulary 1.0 hash unchanged
canonical inventory unchanged
canonical scoring unchanged
Gold threshold unchanged
turn limit unchanged
```

Do not modify gameplay.

---

# 39. Suggested Files

Use existing architecture where possible.

Potential additions:

```text
tools/solver/minimum-turn-search.js
tests/solver-minimum-turn-search.test.js
```

or extend:

```text
tools/solver/state-search.js
```

if cleaner.

Do not duplicate scoring or state transition logic.

---

# 40. M7B Integration Files

Modify only what is needed in:

```text
tools/generator/strategic-selector.js
tools/generator/candidate-ranker.js
```

to consume exactness-aware minimum-turn evidence.

Do not rewrite the candidate-pool architecture.

---

# 41. Required Analysis Artifacts

Create:

```text
analysis/m7b1-min-turn-benchmark.csv
analysis/m7b1-pool-benchmark.csv
analysis/m7b1-six-turn-feasibility.csv
analysis/m7b1-before-after.csv
analysis/m7b1-selection-changes.csv
analysis/m7b1-summary.json
```

---

# 42. Minimum-Turn Benchmark CSV

One row per puzzle/candidate.

Include:

```text
answer
seed
candidate_index
raw_moves
solver_moves
minimum_turns
exact
status
certificate_score
elapsed_ms
states_explored
states_pruned
memo_hits
```

---

# 43. Pool Benchmark CSV

Include:

```text
answer
pool_size
valid_candidates
exact_candidates
timeouts
selected_candidate
selected_min_turns
selected_min_turns_exact
total_ms
```

---

# 44. Six-Turn Feasibility CSV

Include:

```text
answer
pool_size
exact_candidates
turn3_count
turn4_count
turn5_count
turn6_count
six_turn_rate
first_six_turn_candidate
```

Add 1/2-turn columns if encountered.

---

# 45. Tests

Add at minimum:

1. minimum-turn exact result for 1-turn board;
2. 2-turn board;
3. 3-turn board;
4. 4-turn board;
5. 5-turn board;
6. 6-turn board;
7. unreachable board;
8. returned certificate replays exactly;
9. 5-turn result proves <=4 impossible;
10. 6-turn result proves <=5 impossible;
11. optimized result equals brute force;
12. randomized small-board parity with brute force;
13. same-mask dominance remains exact;
14. Hexalink bonus works;
15. row bonus works;
16. column bonus works;
17. timeout is explicit;
18. timeout is never ranked as exact;
19. exact 5-turn candidate beats uncertain 5-turn candidate;
20. exact 6-turn candidate beats exact 5-turn candidate;
21. repeated analysis deterministic;
22. M6 independently unchanged;
23. existing M1–M7B tests all pass.

---

# 46. Required Review Document

Create:

```text
M7B1_EXACT_MINIMUM_GOLD_TURN_OPTIMIZATION_REVIEW.md
```

Include:

1. files created/modified;
2. original bottleneck;
3. profiling findings;
4. minimum-turn algorithm;
5. correctness argument;
6. state representation;
7. memoization/dominance;
8. upper bounds and pruning;
9. compatibility optimization;
10. move preparation reuse;
11. M7B uncertainty integration;
12. tests/results;
13. brute-force parity results;
14. before/after production-grid benchmark;
15. candidate-pool benchmark;
16. 500+ candidate six-turn feasibility results if practical;
17. exact turn distribution;
18. answers with six-turn candidates;
19. M7B winner changes after exact evidence;
20. runtime;
21. memory if practical;
22. known limitations;
23. recommended M7B candidate pool default after optimization;
24. whether exact minimum-turn evidence is now production-practical;
25. `git status --short`;
26. `git diff --stat`.

---

# 47. Questions the Review Must Answer

### Q1
Can canonical minimum Gold turns now be proven exactly on production 8×6 grids at practical speed?

### Q2
What fraction of candidates still time out?

### Q3
How much faster is M7B.1 than the prior M7B approach?

### Q4
Do true six-turn-Gold grids exist under current rules?

### Q5
If yes, how frequently?

### Q6
For how many Daily answers can a six-turn candidate be found in a reasonable pool?

### Q7
Did exact evidence change previously selected M7B winners?

### Q8
What candidate pool size is now practical?

### Q9
Is minimum-Gold-turn ranking now reliable enough to be the primary production ranking signal?

### Q10
Is any further solver optimization required before generating a real Daily-puzzle playtest batch?

---

# 48. Acceptance Criteria

M7B.1 passes only if:

- all prior tests pass;
- new exact minimum-turn tests pass;
- brute-force parity passes;
- production gameplay rules remain unchanged;
- uncertainty is explicit;
- candidate ranking distinguishes exact from unresolved evidence;
- at least a meaningful production candidate benchmark completes;
- six-turn feasibility is measured with exact values, not certificate upper bounds;
- performance improves materially over M7B.

---

# 49. Stop Condition

When M7B.1 is complete:

1. save all benchmark artifacts;
2. create `M7B1_EXACT_MINIMUM_GOLD_TURN_OPTIMIZATION_REVIEW.md`;
3. report artifact paths;
4. stop.

Do not begin a new milestone.

Do not modify Qjynn gameplay rules.

Wait for review.