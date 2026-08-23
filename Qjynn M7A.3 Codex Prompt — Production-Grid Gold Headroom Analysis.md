# Qjynn M7A.3 — Production-Grid Gold Headroom Analysis

Implement **M7A.3 only**.

Do **not** implement M7B quality thresholds, difficulty labels, production rejection rules, or changes to the live M6 generator.

M1–M7A.2 are complete and approved.

Use the existing:

- `qjynn-rules.js`;
- Qjynn Vocabulary 1.0;
- M4 move enumerator;
- M5 exact `findGold` solver and analysis hooks;
- M6 Daily Grid Generator;
- M7A analyzer;
- M7A.1 strategy framework;
- M7A.2 scenario framework.

This milestone is a **production-grid evidence pass**.

---

# 1. Objective

M7A.2 built the rule-sensitivity machinery, but its full scenario matrix was only practical on compact boards.

M7A.3 must answer:

> **On actual 8×6 Qjynn grids, how much scoring headroom exists above the Gold threshold, and which few analytical rule variations materially change Gold accessibility?**

The purpose is to obtain representative evidence before M7B.

Do not broaden the scope beyond that.

---

# 2. Production-Size Dataset Only

Use only full:

```text
8 rows × 6 columns = 48 tiles
```

Qjynn grids generated through M6 or the approved experimental framework.

Do not use compact boards for balance conclusions.

Compact boards may still be used in unit tests.

---

# 3. Dataset Size

Target:

```text
20 production-size puzzles
```

Minimum acceptable if exact analysis is computationally expensive:

```text
10 production-size puzzles
```

Prefer multiple answers and multiple seeds.

Recommended design:

```text
10 answers × 2 seeds = 20 grids
```

If only 10 are practical:

```text
10 answers × 1 seed
```

All selected grids must:

- satisfy canonical inventory;
- contain the intended exact Hexalink;
- pass M6 structural validation;
- be exact Gold-certified under canonical rules;
- replay successfully.

---

# 4. Grid Selection

Use deterministic seeds and record them.

Prefer ordinary M6-generated grids for the primary dataset.

Optionally include a small secondary subset from:

```text
HIGH_VALUE_PATH_SUPPRESSED
COMMON_CONSONANT_CLUSTERED
COMMON_CONSONANT_DISPERSED
```

but do not let experimental strategies dominate the dataset.

Primary conclusions must be clearly separated:

```text
M6 baseline grids
vs
experimental grids
```

---

# 5. Core Metric: Gold Headroom

Define:

```text
Gold Headroom = highest proven reachable score threshold - canonical Gold threshold
```

Canonical Gold threshold:

```text
100
```

Example:

```text
highest proven reachable threshold = 140
Gold Headroom = 40
```

Important:

Do not call this the mathematical maximum score unless the exact maximum has been proven.

Use the name:

```text
highestProvenReachableThreshold
```

and:

```text
goldHeadroom
```

---

# 6. Threshold Probe

For each production grid, run exact `findGold` probes at:

```text
100
110
120
130
140
150
160
170
180
200
```

Stop once:

- two consecutive higher thresholds are proven unreachable; or
- 200 is reached.

If a threshold is computationally unresolved, report:

```text
exact: false
status: timeout/not-completed
```

Do not infer unreachable from timeout.

---

# 7. Optional Threshold Refinement

If practical, after the coarse 10-point probes identify the highest reachable and first unreachable threshold, refine within that interval.

Example:

```text
reachable at 130
unreachable at 140
```

Probe:

```text
131–139
```

or use exact binary search if solver semantics permit.

Return:

```text
highestProvenReachableThreshold
firstProvenUnreachableThreshold
```

If the exact transition is not fully determined, report the interval.

---

# 8. Minimum Gold Turns

For every tested threshold that is reachable, determine the exact:

```text
minimum turns required to reach threshold
```

Possible values:

```text
1–6
```

For canonical threshold 100, record explicitly:

```text
canonicalMinimumGoldTurns
```

For 120 and 130, also record:

```text
minimumTurnsAt120
minimumTurnsAt130
```

if reachable.

---

# 9. Narrow Scenario Set Only

Do not rerun the full 40-scenario M7A.2 matrix.

For each production grid, analyze only these scenarios:

## S0 — CANONICAL

```text
threshold = 100
row bonus = 10
column bonus = 20
Hexalink bonus = 10
Hexalink not required
```

## S1 — GOLD_110

```text
threshold = 110
canonical scoring
```

## S2 — GOLD_120

```text
threshold = 120
canonical scoring
```

## S3 — GOLD_130

```text
threshold = 130
canonical scoring
```

## S4 — REDUCED_LINES

```text
threshold = 100
row bonus = 5
column bonus = 10
```

## S5 — REDUCED_LINES_GOLD_120

```text
threshold = 120
row bonus = 5
column bonus = 10
```

## S6 — HEXALINK_REQUIRED

```text
threshold = 100
requireHexalinkForGold = true
```

## S7 — HEXALINK_REQUIRED_GOLD_120

```text
threshold = 120
requireHexalinkForGold = true
```

Exactly eight scenarios.

Do not add more unless required to resolve an implementation ambiguity.

---

# 10. Required Scenario Results

For each puzzle × scenario report:

```text
goldReachable
exact
minimumGoldTurns
goldReachableWithoutHexalink
goldReachableWithHexalinkRequired
solverElapsedMs
statesExplored if available
statesPruned if available
memoHits if available
```

Do not perform exhaustive Gold-viable-first-move analysis as part of the main matrix.

---

# 11. Canonical Gold Without Hexalink

For every production grid, determine exactly whether:

```text
Gold >= 100
```

is reachable when exact Hexalink moves are prohibited.

This is one of the primary M7A.3 results.

Report:

```text
goldReachableWithoutHexalinkCanonical
```

---

# 12. Gold at 120 Without Hexalink

Also determine exactly:

```text
Gold >= 120 without Hexalink
```

where computationally practical.

Report:

```text
gold120ReachableWithoutHexalink
```

This helps distinguish:

```text
Hexalink irrelevant at 100
but strategically useful at higher score
```

from:

```text
Hexalink irrelevant across the useful score range
```

---

# 13. Hexalink Requirement Cost

For each production puzzle compare:

```text
minimum turns to Gold normally
vs
minimum turns when Hexalink is required
```

at thresholds:

```text
100
120
```

Return:

```text
hexalinkRequirementTurnDeltaAt100
hexalinkRequirementTurnDeltaAt120
```

when both are reachable.

---

# 14. Line-Bonus Leverage

Compare exact results:

```text
canonical line bonuses 10/20
vs
reduced line bonuses 5/10
```

at:

```text
threshold 100
threshold 120
```

Report:

```text
lineBonusChangesReachability
lineBonusMinimumTurnDelta
```

Do not remove line bonuses entirely in the main production experiment.

M7A.2 already established that the no-line scenario can be extreme.

---

# 15. Score Composition of Certificates

For the canonical Gold certificate and the highest-threshold certificate found, report score contribution by:

```text
word base scores
Hexalink bonus
row bonuses
column bonuses
```

Example:

```text
base word points: 80
Hexalink: 10
row bonuses: 20
column bonuses: 20
total: 130
```

This is important.

We need to know whether headroom comes primarily from:

```text
many high-value words
or
coverage bonuses
or
Hexalink
```

---

# 16. Certificate Characteristics

For each canonical and highest-threshold certificate report:

```text
turns used
word lengths
Hexalink used?
Hexalink turn
rows completed
columns completed
unique consonant tiles consumed
```

Keep full certificates private.

---

# 17. Gold Headroom Distribution

Across the production dataset calculate:

```text
min
P25
median
P75
P90
max
mean
standard deviation
```

for:

```text
highestProvenReachableThreshold
goldHeadroom
canonicalMinimumGoldTurns
```

If some grids have unresolved upper thresholds, handle them separately rather than treating them as exact values.

---

# 18. Gold Headroom Categories — Analysis Labels Only

For reporting convenience only, you may create descriptive **analysis bins**:

```text
0–10
20–30
40–50
60+
```

Do not call these Easy/Medium/Hard.

Do not use them in production.

Example:

```text
headroomBand: "40-50"
```

This is purely descriptive.

---

# 19. Headroom vs Existing M7A Metrics

For each production grid, retrieve or recompute:

```text
unique playable words
unique tile masks
high-value first moves
short-word fraction
tile participation spread
Hexalink move participation
N/R/T/L/S adjacency count
```

Explore correlations with:

```text
goldHeadroom
canonicalMinimumGoldTurns
goldReachableWithoutHexalinkCanonical
```

This will help determine whether existing M7A metrics predict actual scoring headroom.

---

# 20. Most Important Correlation Question

Specifically test:

> Does a lower number of high-value first moves correspond to lower Gold headroom?

and:

> Does a lower unique tile-mask count correspond to lower Gold headroom?

M7A.1 suggested those metrics could be useful, but Gold reachability remained 100%.

M7A.3 should determine whether they predict **degree of scoring permissiveness**, even if they do not eliminate Gold.

---

# 21. Runtime Optimization

The previous full scenario matrix was too expensive.

For M7A.3:

- reuse prepared solver moves;
- reuse word index;
- reuse static move masks;
- reuse scenario-independent board preprocessing;
- reuse compatibility caches where exact and safe;
- avoid rerunning M4 enumeration for every scenario;
- run scenarios serially or with bounded parallelism to avoid memory blowup.

Do not sacrifice exactness.

---

# 22. Per-Puzzle Timeout Policy

Support a configurable analytical timeout per probe, but:

```text
timeout != unreachable
```

If a probe times out, record:

```json
{
  "exact": false,
  "status": "timeout"
}
```

Do not use unresolved probes in exact aggregate reachability percentages.

---

# 23. Production Evidence Table

Create a primary table with one row per full 8×6 puzzle.

Columns:

```text
answer
seed
strategy
canonicalGoldReachable
canonicalMinTurns
goldWithoutHexalink100
gold120Reachable
goldWithoutHexalink120
gold130Reachable
highestProvenReachableThreshold
firstProvenUnreachableThreshold
goldHeadroom
reducedLinesGold100
reducedLinesGold120
hexalinkRequiredGold100
hexalinkRequiredGold120
canonicalCertificateBasePoints
canonicalCertificateLineBonus
canonicalCertificateHexalinkBonus
analysisMs
```

---

# 24. Aggregate Scenario Table

Create:

| Scenario | Exact Puzzles | Gold-Capable % | Median Min Turns | Median Solver Time |
|---|---:|---:|---:|---:|

for all eight scenarios.

---

# 25. Gold Headroom Table

Create:

| Metric | Min | P25 | Median | P75 | P90 | Max |
|---|---:|---:|---:|---:|---:|---:|
| Highest reachable threshold | | | | | | |
| Gold headroom | | | | | | |
| Canonical min Gold turns | | | | | | |

---

# 26. Hexalink Importance Table

Create:

| Metric | Result |
|---|---:|
| Gold @100 without Hexalink | % |
| Gold @120 without Hexalink | % |
| Gold @100 with Hexalink required | % |
| Gold @120 with Hexalink required | % |
| Median Hexalink turn delta @100 | |
| Median Hexalink turn delta @120 | |

Use exact completed cases only.

---

# 27. Line Bonus Table

Create:

| Scenario | Gold-Capable % | Median Min Turns |
|---|---:|---:|
| Canonical @100 | | |
| Reduced lines @100 | | |
| Canonical @120 | | |
| Reduced lines @120 | | |

---

# 28. Counterexamples

Find and report full 8×6 examples of:

### A
Gold headroom <= 10.

### B
Gold headroom >= 50.

### C
Gold @100 possible without Hexalink but Gold @120 impossible without Hexalink.

### D
Gold @100 requires Hexalink.

### E
Reduced line bonuses make canonical Gold impossible.

### F
Reduced line bonuses preserve Gold but increase minimum turns.

### G
Two grids with similar unique-mask counts but very different Gold headroom.

### H
Two grids with similar Gold headroom but very different move-space metrics.

If a type is not found, say so.

---

# 29. Important Decision Boundary

M7A.3 must **not** decide:

```text
new Gold threshold
new line bonuses
Hexalink mandatory
new scoring rules
```

Its job is to provide representative production-grid evidence.

M7B will make quality-generation recommendations.

---

# 30. Tests

Add tests for at least:

1. production-size 8×6 puzzle ingestion;
2. Gold headroom calculation;
3. timeout not treated as unreachable;
4. threshold probe ordering;
5. highest proven reachable threshold;
6. first proven unreachable threshold;
7. minimum Gold turns exact on handcrafted board;
8. canonical scenario matches production M5;
9. reduced-line scenario applies only analytical overrides;
10. require-Hexalink scenario is exact;
11. canonical rules remain unchanged;
12. certificate score decomposition sums correctly;
13. aggregation excludes unresolved exact values where appropriate;
14. deterministic results for same puzzle/scenario;
15. all existing M1–M7A.2 tests continue to pass.

---

# 31. Output Files

Save:

```text
analysis/m7a3-production-grids.json
analysis/m7a3-production-grids.csv
analysis/m7a3-threshold-probes.csv
analysis/m7a3-scenario-summary.json
analysis/m7a3-counterexamples.json
```

---

# 32. Required Review Document

Create:

```text
M7A3_PRODUCTION_GRID_GOLD_HEADROOM_REVIEW.md
```

Include:

1. files created/modified;
2. production-grid dataset;
3. number of 8×6 grids analyzed;
4. answers/seeds/strategies used;
5. solver reuse/optimization;
6. threshold probing algorithm;
7. Gold headroom definition;
8. exactness/timeout policy;
9. test results;
10. canonical Gold results;
11. Gold threshold sensitivity;
12. Gold headroom distribution;
13. Gold-without-Hexalink findings;
14. Hexalink-required findings;
15. line-bonus sensitivity;
16. certificate score composition;
17. correlations with M7A/M7A.1 metrics;
18. counterexamples;
19. runtime results;
20. unexpected findings;
21. known limitations;
22. data quality assessment;
23. whether evidence is finally sufficient for M7B;
24. **do not implement M7B**;
25. `git status --short`;
26. `git diff --stat`.

---

# 33. Questions the Report Must Answer

Use production-size evidence to answer:

### Q1
What is the distribution of Gold headroom on actual 8×6 grids?

### Q2
Is Gold threshold 100 far below what these grids can support?

### Q3
How often can Gold @100 be achieved without Hexalink?

### Q4
How often can Gold @120 be achieved without Hexalink?

### Q5
Does requiring Hexalink materially increase minimum turns?

### Q6
Do reduced row/column bonuses materially affect reachability or turn count?

### Q7
Does Gold headroom correlate with unique tile-mask count?

### Q8
Does Gold headroom correlate with high-value first-move count?

### Q9
Are there production grids with low headroom under the current generator?

### Q10
Is the evidence now sufficient to design M7B quality-generation criteria?

Do not answer from compact-board results.

---

# 34. Stop Condition

When M7A.3 is complete:

1. save all production-grid analysis artifacts;
2. create `M7A3_PRODUCTION_GRID_GOLD_HEADROOM_REVIEW.md`;
3. report paths;
4. stop.

Do not implement M7B.

Do not alter production rules.

Wait for review.