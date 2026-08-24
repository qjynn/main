# Qjynn M10 — Autonomous Daily Puzzle Certification, Safety Gates & Publication Readiness

Implement **M10 only**.

M1–M9.1 are complete and approved.

Do **not** begin M11.

M10's objective is:

> Build the autonomous certification, quality-gate, validation, fallback, audit, and publication-readiness layer required for Qjynn Daily Puzzles to operate without routine human QA.

M10 must **not automatically publish to the live website**.

It should determine whether a generated Daily puzzle is:

```text
AUTO_PUBLISH_ELIGIBLE
RESERVE_ELIGIBLE
REGENERATE
BLOCKED
```

and produce a reproducible publication-ready artifact for a later deployment/scheduling milestone.

---

# 1. Core Operating Goal

The intended end-state is:

```text
Approved answer + clue
        ↓
Generate multiple candidates
        ↓
M6 certification
        ↓
REGULAR high-quality profiling on ALL certified candidates
        ↓
preferred comparative-difficulty region
        ↓
STRONG finalist confirmation
        ↓
automated quality gates
        ↓
independent publication validator
        ↓
confidence classification
        ↓
primary + backups
        ↓
publication-ready queue
```

There is no mandatory daily human approval step.

Candidates that need human judgment should not block the system.

They should be rejected or replaced automatically.

---

# 2. Production Invariants

Do not modify:

```text
game.js
qjynn-rules.js
qjynn-words-v1.0.txt
canonical word validity
canonical consonant inventory
six-turn limit
canonical scoring
Gold/Silver/Bronze thresholds
Hexalink legality
M6 certification semantics
M8.1 frozen player models
M8.1 familiarity curves
real-frequency provider semantics
```

M10 adds safety and readiness infrastructure around the existing system.

It does not change Qjynn gameplay.

---

# 3. Preserve Existing Selectors

Do not delete or silently rewrite:

```text
M7B
M9
M9.1
```

M10 should use the safest current candidate-evaluation approach while preserving prior selectors for regression and comparison.

Version M10 independently.

---

# 4. M10 Candidate Evaluation Policy

For unattended generation, do **not** use the M9 or M9.1 lossy shortlist as a mandatory prefilter.

Default M10 policy:

```text
generate certified candidate pool
        ↓
REGULAR 500 runs on ALL certified candidates
        ↓
derive preferred comparative region
        ↓
STRONG on finalists
```

Use the existing deterministic incremental Monte Carlo infrastructure where useful.

---

# 5. Candidate Pool Size

Support configurable candidate pools.

Initial target:

```text
10 certified candidates
```

Preferred configurable range:

```text
10–15
```

M9.1 suggested modest gains going from 10 to 15 and little observed gain from 15 to 20 in its small sensitivity sample.

Do not require 20+ candidates by default.

---

# 6. Candidate Acquisition

Continue generation until either:

```text
certifiedCandidateTarget reached
```

or:

```text
maximum generation attempts reached
```

Every candidate must be unique by canonical grid hash.

Do not count duplicate grids toward the target.

---

# 7. Insufficient Candidate Behavior

If fewer than the configured certified target are found, apply explicit policy.

Example statuses:

```text
FULL_POOL
DEGRADED_POOL
INSUFFICIENT_POOL
```

Do not silently treat a 2-candidate pool as equivalent to a 10-candidate pool.

A configurable minimum may permit continuation.

Below that minimum, generation must fail safely.

---

# 8. Approved Answer/Clue Boundary

M10 assumes that:

```text
answer
clue
date/id
```

are approved editorial inputs.

Do not autonomously invent or rewrite clues in M10.

Puzzle-grid automation and clue editorial quality are separate concerns.

Validate that clue is present and non-empty.

---

# 9. Stage A — Input Certification

Before generation verify:

```text
answer structure valid
answer exists in Vocabulary 1.0
correct vowel/consonant structure
Hexalink derivation valid
clue present
date/id valid
seed/config valid
required versions available
real familiarity source available
```

Fail closed on any error.

---

# 10. Stage B — M6 Candidate Certification

Every candidate must pass existing M6 checks unchanged:

```text
8×6 dimensions
canonical inventory
legal Hexalink path
correct Hexalink letters
answer consistency
Gold reachable
Gold certificate replay
privacy constraints
```

Do not duplicate M6 logic.

Call the existing certified path.

---

# 11. Independent Certification Evidence

For each candidate preserve:

```text
candidateId
gridHash
generationSeed
M6 validation result
Gold certificate
Gold certificate replay result
certificate score
certificate turns
rules version
vocabulary version
```

Private only.

---

# 12. Stage C — Full REGULAR Profiling

Profile **all certified candidates** with:

```text
REGULAR
500 runs/candidate
```

by default.

Make configurable.

Use the frozen real-frequency M8.1 model.

Do not use heuristic familiarity in publication-readiness mode.

---

# 13. Incremental Monte Carlo

Reuse M9.1's deterministic incremental profiling where practical.

A candidate profile may be built as:

```text
100
→ 250
→ 500
```

without recomputing prior runs.

However, M10's default publication-readiness decision must use the configured final run count, not a partial profile.

---

# 14. REGULAR Metrics

For every candidate record:

```text
mean score
median score
Gold rate
Silver rate
Bronze rate
Hexalink rate
mean played familiarity
rare-word dependency
mean known moves
mean noticed moves
```

Keep synthetic percentages clearly labeled as model outputs.

---

# 15. Comparative Difficulty Region

Do not choose an exact ordinal winner solely from REGULAR mean score.

Use broad relative bands.

For each candidate pool derive:

```text
EASIER
MIDDLE
HARDER
```

or equivalent internal relative bands.

These are internal selector bands, not public difficulty labels.

---

# 16. Preferred Difficulty Policy

Default:

```text
prefer MIDDLE
```

because M8.2/M9.1 showed broad regions are more stable than exact winners.

Allow adjacent band fallback only under explicit policy.

Do not always choose the hardest or easiest candidate.

---

# 17. Candidate Acceptance Set

Create:

```text
preferredCandidateSet
```

containing candidates satisfying the preferred REGULAR region.

Do not reduce this immediately to one winner.

Subsequent QA gates should operate on the set.

---

# 18. Stage D — STRONG Confirmation

Run STRONG on finalists from the preferred REGULAR set.

M9.1 showed STRONG changed REGULAR-only finalist selection frequently, so retain this stage.

Default:

```text
3 finalists
250 or 500 STRONG runs
```

Choose based on measured existing configuration/runtime.

Keep configurable.

---

# 19. STRONG Purpose

STRONG is not used to maximize or minimize score.

It provides:

```text
skill-gap characterization
advanced-player behavior
anomaly detection
finalist differentiation
```

Record:

```text
Strong mean
Strong median
Strong Gold rate
Strong - Regular mean
Strong - Regular Gold
```

---

# 20. Stage E — Automated Quality Gates

Create independent automated quality gates.

Each gate must return structured:

```text
PASS
WARN
FAIL
NOT_AVAILABLE
```

plus:

```text
reason
observed value
expected envelope
version
```

Do not collapse all quality into one hidden numeric score.

---

# 21. Gate 1 — Structural Certification

Mandatory:

```text
M6 certification = PASS
Gold replay = PASS
```

Any failure:

```text
FAIL
```

Candidate cannot continue.

---

# 22. Gate 2 — Data Integrity

Verify:

```text
rules version known
vocabulary version known
generator version known
selector version known
simulator version known
player model version known
familiarity source/version known
grid hash valid
certificate hash valid
```

Unknown or mismatched critical versions:

```text
FAIL
```

---

# 23. Gate 3 — Real Familiarity

Publication-ready mode requires:

```text
real familiarity provider loaded
fallback not silently active
expected provider/source metadata present
```

Missing real source:

```text
FAIL
```

---

# 24. Gate 4 — Comparative Score Difficulty

Reject pathological candidate extremes relative to the current certified candidate pool.

Use REGULAR mean/median primarily.

Avoid hard-coded pseudo-human Gold targets.

Initial logic should be relative.

Example:

```text
preferred middle region = PASS
adjacent acceptable region = WARN or policy-dependent
extreme tail = FAIL for automatic selection
```

Document exact implementation.

---

# 25. Gate 5 — Medal Distribution Sanity

Use REGULAR medal distribution as an anomaly signal.

Do not set claims like:

```text
real humans should have 10% Gold
```

Instead detect within-pool or historical extreme behavior.

Example conditions:

```text
nearly always Gold
nearly never reaches meaningful score
degenerate medal distribution
```

Use relative/historical envelopes.

---

# 26. Gate 6 — Vocabulary Accessibility

Use:

```text
rare-word dependency
mean played familiarity
familiar-only performance
```

to detect extreme vocabulary dependence.

Do not reject legitimate hard vocabulary automatically.

Flag only significant outliers.

Prefer:

```text
WARN
```

for moderate extremes and:

```text
FAIL
```

only for clearly pathological behavior based on documented policy.

---

# 27. Gate 7 — Move-Space Sanity

Use one or a small number of non-redundant existing opportunity metrics.

Potentially:

```text
uniquePlayableWords
raw legal moves
```

Do not sum several highly correlated move-density metrics.

Detect extreme:

```text
move starvation
move explosion
```

relative to operating history or candidate population.

---

# 28. Gate 8 — Tile Participation

Use existing M7A participation metrics.

Detect boards with:

```text
severe dead zones
extreme tile concentration
highly uneven opportunity
```

Do not require perfectly uniform participation.

---

# 29. Gate 9 — Hexalink Sanity

Keep Hexalink quality separate from score difficulty.

Check:

```text
path valid
geometry non-degenerate
Hexalink participation not pathological
synthetic Hexalink rate not extreme relative to comparison set/history
```

Because synthetic Hexalink rates are less stable, use them conservatively.

Prefer WARN over FAIL except in obvious anomalies.

---

# 30. Gate 10 — Recent-Puzzle Similarity

Create historical comparison support.

Check selected candidate against recent published/queued grids for:

```text
same grid
high grid similarity
same Hexalink geometry
repeated answer
repeated Hexalink
excessive structural repetition
```

Use deterministic similarity metrics.

Do not require a full production database; support a history provider/interface.

---

# 31. Historical Window

Make configurable, for example:

```text
last 14
last 30
```

published/queued puzzles.

Do not hard-code one value deeply.

---

# 32. Similarity Metrics

Use interpretable measures such as:

```text
grid-position agreement
letter-position similarity
Hexalink path-shape similarity
answer duplication
```

Do not use embeddings or LLMs.

---

# 33. Gate 11 — Selection Margin

Measure whether the selected candidate is clearly inside the acceptable region or only marginally preferred.

Do not require exact winner confidence.

Possible inputs:

```text
distance from band boundary
difference from rejected extreme candidates
REGULAR replicate uncertainty
STRONG confirmation
```

Classify candidate confidence.

---

# 34. Gate 12 — Monte Carlo Stability

For selected/finalist candidates, verify that simulation metrics are sufficiently stable.

Use existing standard errors/intervals or replicate checks.

Detect cases where:

```text
ranking changes substantially with small Monte Carlo variation
```

Such candidates may receive:

```text
WARN
```

or be replaced by a more stable finalist.

---

# 35. Gate 13 — Public/Private Separation

Mandatory.

Verify public artifact contains no:

```text
answer
Gold certificate
private seeds
simulation traces
frequency data
selection rationale
candidate pool
```

unless a field is explicitly part of the public game contract.

Failure:

```text
FAIL
```

---

# 36. Gate 14 — Artifact Schema

Validate:

```text
public schema
private manifest schema
certificate schema
queue-entry schema
```

against explicit versioned validators.

Malformed artifact:

```text
FAIL
```

---

# 37. Gate 15 — Reproducibility

Regenerate or independently recompute selected puzzle identity from:

```text
answer
seed
config
versions
```

Verify:

```text
same grid hash
same candidate ID
same public artifact hash
```

Unexpected mismatch:

```text
FAIL
```

---

# 38. Confidence Classification

After gates, classify selected candidate as one of:

```text
HIGH_CONFIDENCE
ACCEPTABLE
REVIEW_RECOMMENDED
REJECT
```

This classification is internal/private.

---

# 39. Autonomous Behavior for REVIEW_RECOMMENDED

In no-human-QA mode:

```text
REVIEW_RECOMMENDED
```

must **not wait for a human**.

Instead:

```text
discard candidate
try next eligible finalist
```

If none qualify:

```text
regenerate candidate pool
```

Human review remains optional for debugging, not operationally required.

---

# 40. Publication Eligibility

Map confidence classes:

```text
HIGH_CONFIDENCE  → AUTO_PUBLISH_ELIGIBLE
ACCEPTABLE       → AUTO_PUBLISH_ELIGIBLE
REVIEW_RECOMMENDED → not eligible
REJECT             → not eligible
```

Make mapping configurable/versioned.

---

# 41. Candidate Fallback Ordering

Create deterministic fallback order among qualified finalists.

Conceptually:

```text
primary
backup1
backup2
```

All backups must independently pass mandatory gates.

Do not store an uncertified candidate as backup.

---

# 42. Primary + Backup Requirement

For each Daily puzzle, target:

```text
1 primary
2 backups
```

all:

```text
M6 certified
publication validated
AUTO_PUBLISH_ELIGIBLE
```

If three cannot be found within configured limits, return structured degraded status.

---

# 43. Degraded Reserve Policy

Support states such as:

```text
FULL_RESERVE
ONE_BACKUP
NO_BACKUP
FAILED
```

Do not hide reserve shortages.

Define whether:

```text
NO_BACKUP
```

can still be considered publication-ready.

Keep policy configurable.

---

# 44. Rolling Puzzle Inventory

Implement queue/inventory support for future puzzles.

Target architecture:

```text
today
tomorrow
+2
...
+14 or +30
```

Do not connect to live scheduling yet.

M10 should be able to generate and validate a batch of future publication-ready entries.

---

# 45. Queue Entry

Each queue item should include:

```text
date
public puzzle artifact reference
private manifest reference
status
primary hash
backup hashes
created timestamp
version metadata
```

Do not expose answer in public queue metadata.

---

# 46. Queue Status

Support statuses such as:

```text
GENERATED
CERTIFIED
AUTO_PUBLISH_ELIGIBLE
BLOCKED
EXPIRED
SUPERSEDED
```

Use clear state transitions.

---

# 47. Batch Queue Generation

Provide an offline command for a file containing:

```text
date,answer,clue,seed
```

Generate a future queue.

Conceptually:

```bash
node tools/daily/build-queue.js \
  --input approved-daily-inputs.csv \
  --days 14 \
  --output generated-queue/
```

Adapt to repository architecture.

---

# 48. Independent Publication Validator

Create a standalone validator that **does not generate puzzles**.

Conceptually:

```text
tools/publication/
  validate-publication.js
```

It should accept completed artifacts and independently verify them.

---

# 49. Validator Independence

The publication validator should reuse canonical rules and schemas, but must not call:

```text
candidate generation
candidate ranking
synthetic selection
```

Its job is only:

```text
verify
```

This creates separation between manufacturing and final release validation.

---

# 50. Publication Validator Checks

At minimum independently verify:

```text
public schema valid
private schema valid
grid dimensions
canonical inventory
Hexalink
answer/grid consistency
Gold certificate replay
certificate score >=100
turns <=6
rules version
vocabulary version
hashes
public/private leakage
queue metadata
```

---

# 51. Independent Recalculation

Where practical, validator should recompute important values rather than trusting stored ones.

For example:

```text
inventory counts
Hexalink reconstruction
certificate replay score
grid hash
public hash
```

Do not trust stored `valid: true`.

---

# 52. Publication Eligibility Requires Validator PASS

A candidate cannot enter:

```text
AUTO_PUBLISH_ELIGIBLE
```

unless independent publication validation passes.

Mandatory.

---

# 53. Private Audit Manifest

Create a comprehensive private manifest.

Include:

```text
date
answer
clue
Hexalink
public grid
primary candidate ID
backup candidate IDs

all version metadata
all seeds

M6 certificate
certificate replay

REGULAR profile
STRONG profile

quality-gate results
confidence class
selection rationale

public artifact hash
private artifact hash
certificate hash
grid hash

publication-validator result
```

---

# 54. Audit Immutability

Once an entry is marked publication-ready, its manifest should be considered immutable.

If regenerated:

```text
create new version
mark prior version SUPERSEDED
```

Do not silently mutate certified history.

---

# 55. Historical Audit Trail

Support lookup by:

```text
date
puzzle ID
grid hash
```

to reconstruct:

```text
what was generated
which rules were active
why it was selected
which backups existed
```

This is essential for unattended operation.

---

# 56. Version Hashes

Record hashes or immutable identifiers for:

```text
rules file
vocabulary file
generator policy
selector policy
simulator config
familiarity export
```

Use practical cryptographic hashes such as SHA-256.

---

# 57. Kill-Switch Conditions

Define system-level conditions that block new publication-ready entries.

At minimum:

```text
rules hash unexpected
vocabulary hash unexpected
real familiarity source missing
frequency source hash changed unexpectedly
validator regression
M6 certificate replay failure
public/private leakage detected
quality metrics grossly outside historical envelope
candidate certification rate collapses
```

---

# 58. Kill-Switch Result

When triggered:

```text
new queue entries = BLOCKED
existing already-certified reserve remains unchanged
```

Do not automatically delete prior certified inventory.

---

# 59. Health Check

Create a production-readiness health check.

Conceptually:

```bash
node tools/publication/health-check.js
```

Return structured status:

```text
HEALTHY
DEGRADED
BLOCKED
```

plus reasons.

---

# 60. Historical Quality Envelope

Support a historical metric store built from prior publication-ready puzzles.

Track distributions such as:

```text
REGULAR mean
REGULAR Gold
STRONG mean
rare-word dependency
unique playable words
tile participation
Hexalink rate
```

Use this only for anomaly detection.

---

# 61. Envelope Warm-Up

The system may initially lack sufficient publication history.

Support:

```text
WARMUP
```

mode where only candidate-pool-relative gates are active.

Do not pretend 5 historical puzzles define a stable long-term envelope.

Make minimum-history requirements explicit.

---

# 62. Historical Anomaly Detection

Once enough history exists, flag extreme outliers using simple transparent statistics.

Examples:

```text
percentile envelopes
robust z-score
IQR-based bounds
```

Do not train a black-box anomaly model.

---

# 63. Do Not Over-Reject

Quality gates must avoid creating a generator that almost never succeeds.

Track:

```text
candidate rejection rate
pool regeneration rate
queue generation success rate
```

M10 evaluation must measure this.

---

# 64. Gate Severity

Each gate must explicitly declare:

```text
MANDATORY
QUALITY
DIAGNOSTIC
```

and:

```text
PASS/WARN/FAIL
```

Do not allow a diagnostic-only metric to block publication accidentally.

---

# 65. Gate Registry

Centralize gate definitions/configuration.

Conceptually:

```text
tools/quality/gate-registry.js
```

Each gate should define:

```text
id
version
severity
inputs
evaluation
failure behavior
```

Avoid scattered hard-coded gate logic.

---

# 66. Policy Versioning

Introduce explicit:

```text
M10 quality policy version
publication validator version
queue schema version
```

Changing thresholds/gates later must increment the relevant version.

---

# 67. Gate Explainability

Private manifest should contain explanations such as:

```text
REGULAR_DIFFICULTY:
PASS
candidate in middle band

VOCABULARY_ACCESSIBILITY:
WARN
rare-word dependency at 92nd pool percentile

PUBLIC_PRIVATE_SEPARATION:
PASS

PUBLICATION_VALIDATOR:
PASS
```

No hidden decisions.

---

# 68. Candidate Substitution

If the highest-ranked candidate fails a quality gate:

```text
evaluate next finalist
```

Do not immediately regenerate the full pool unless finalists are exhausted.

---

# 69. Pool Regeneration

If no finalist becomes publication eligible:

```text
generate a new deterministic candidate batch
```

using a derived regeneration seed.

Support:

```text
maxRegenerationRounds
```

Do not loop indefinitely.

---

# 70. Regeneration Determinism

Derive regeneration seeds from:

```text
master seed
regeneration round
selector version
```

Identical inputs must regenerate the same sequence.

---

# 71. Failure State

If no eligible puzzle is found after limits:

```text
status = BLOCKED
```

Produce:

```text
failure reasons
candidate statistics
gate failures
version metadata
```

Do not publish a candidate that failed policy.

---

# 72. Reserve Promotion

Design offline logic for:

```text
primary fails later integrity check
        ↓
backup1 promoted
```

All promotion must be deterministic and independently validated.

Do not connect to live scheduler yet.

---

# 73. Revalidation

Support revalidating already queued puzzles after:

```text
application restart
deployment
rule/version check
```

If canonical rules/vocabulary intentionally change, old queued puzzles must not silently inherit new semantics.

Return explicit:

```text
VERSION_MISMATCH
```

where appropriate.

---

# 74. Publication Freeze

Allow queue to be frozen.

A frozen entry cannot be regenerated/overwritten without explicit operator action.

This is useful once a puzzle is scheduled.

---

# 75. No Automatic Rule Migration

Do not automatically regenerate old queue entries because a new version exists.

Preserve certified history.

New versions affect new entries unless explicitly migrated.

---

# 76. Evaluation Dataset

Evaluate M10 autonomously across at least:

```text
30 approved answer/clue inputs
```

Prefer:

```text
50
```

if practical.

Use legitimately distinct answers.

---

# 77. Candidate Count

For each answer target:

```text
10 certified candidates
```

using full REGULAR profiling.

Do not use lossy shortlist prefiltering.

---

# 78. M10 Evaluation Outputs

Measure:

```text
candidate certification rate
quality-gate pass rate
primary eligibility rate
backup availability rate
regeneration rounds
BLOCKED rate
confidence-class distribution
validator failure rate
total runtime
```

---

# 79. No-Human-QA Success Metric

The most important M10 metric is:

> What percentage of valid approved answer/clue inputs produce a fully publication-ready primary puzzle plus reserve puzzle(s) with no human decision?

Report separately:

```text
primary-only success
primary + 1 backup
primary + 2 backups
```

---

# 80. Confidence Distribution

Report:

```text
HIGH_CONFIDENCE
ACCEPTABLE
REVIEW_RECOMMENDED
REJECT
```

for evaluated finalists.

Also report final queue eligibility distribution.

---

# 81. Gate Failure Distribution

Create counts/rates for each gate:

```text
gate ID
PASS
WARN
FAIL
```

This will identify gates that are overly strict or irrelevant.

---

# 82. Gate Interaction

Identify whether multiple gates repeatedly reject the same candidates.

Do not automatically loosen them.

Report redundancy.

---

# 83. Regeneration Effectiveness

Measure:

```text
success round 0
success round 1
success round 2
...
```

Determine whether regeneration meaningfully resolves failures.

---

# 84. Runtime

Measure median/P90:

```text
candidate generation
M6 certification
REGULAR all-candidate profiling
STRONG finalist profiling
quality gates
independent validator
reserve generation
total Daily entry generation
```

This is offline.

Correctness matters more than seconds.

---

# 85. Queue Generation Test

Build at least one deterministic future queue of:

```text
7 days
```

Prefer:

```text
14 days
```

using approved test inputs.

Do not publish externally.

Validate every queued primary and backup.

---

# 86. Queue Recovery Test

Simulate:

```text
primary corrupted
backup1 valid
```

and verify deterministic promotion.

Also simulate:

```text
all backups invalid
```

and verify:

```text
BLOCKED
```

rather than unsafe publication.

---

# 87. Validator Mutation Tests

Create tests that deliberately corrupt:

```text
grid
Hexalink coordinates
certificate score
certificate path
inventory
public/private fields
hash
version
```

The independent validator must reject them.

---

# 88. Kill-Switch Tests

Add tests for:

```text
missing frequency file
changed vocabulary hash
changed rules hash
validator failure
certificate replay mismatch
unexpected provider version
```

Ensure generation is blocked appropriately.

---

# 89. Quality-Gate Tests

Add deterministic tests for:

```text
PASS
WARN
FAIL
```

on each major gate.

Test gate severity handling.

Diagnostic WARN must not accidentally behave like mandatory FAIL.

---

# 90. Confidence Tests

Verify:

```text
mandatory FAIL -> REJECT
quality WARN -> policy-dependent
all mandatory PASS + acceptable quality -> ACCEPTABLE/HIGH_CONFIDENCE
```

Use explicit policy.

---

# 91. Backup Tests

Add tests verifying:

```text
primary != backup1 != backup2
all hashes unique
all certified
all publication-validator PASS
promotion deterministic
```

---

# 92. Queue Schema Tests

Validate:

```text
date uniqueness
status transitions
freeze behavior
supersede behavior
artifact references
hash integrity
```

---

# 93. Public Privacy Tests

Ensure public output never includes:

```text
answer
Gold certificate
private audit data
synthetic profiles
frequency values
gate explanations
backup secrets
```

---

# 94. Full Regression

Run:

```bash
node --test tests/*.test.js
```

M9.1 baseline:

```text
220 passed
0 failed
```

No prior test may regress.

---

# 95. Production Safety Snapshot

Explicitly verify unchanged:

```text
game.js
qjynn-rules.js
qjynn-words-v1.0.txt
canonical scoring
medal thresholds
six-turn limit
Hexalink rules
M6 semantics
M8.1 frozen models
```

---

# 96. Suggested Architecture

Adapt to repository conventions, but conceptually:

```text
tools/quality/
    gate-registry.js
    quality-evaluator.js
    historical-envelope.js

tools/publication/
    publication-validator.js
    health-check.js
    queue-manager.js
    artifact-hashes.js

tools/daily/
    generate-publication-ready.js
    build-queue.js
```

Do not force these exact paths if a cleaner existing structure exists.

---

# 97. M10 API

Expose something conceptually like:

```javascript
generatePublicationReadyDaily({
  date,
  answer,
  clue,
  seed,
  wordIndex,
  frequencyFile,
  historyProvider,
  config
})
```

Return:

```javascript
{
  ok,
  status,
  primary,
  backups,
  privateManifest,
  queueEntry,
  health
}
```

---

# 98. Public Artifact

Public puzzle artifact should remain minimal and game-facing.

It must not depend on M10 private QA data at runtime unless intentionally designed.

---

# 99. Private Manifest

Private manifest should be sufficient to recreate the complete generation and publication-readiness decision.

Treat this as the authoritative audit record.

---

# 100. Output Artifacts

Create at minimum:

```text
analysis/m10-evaluation-manifest.csv
analysis/m10-gate-results.csv
analysis/m10-confidence-results.csv
analysis/m10-reserve-results.csv
analysis/m10-regeneration-results.csv
analysis/m10-performance.csv
analysis/m10-validator-mutations.csv
analysis/m10-queue-results.csv
analysis/m10-summary.json
```

---

# 101. Gate Results CSV

One row per:

```text
answer × candidate × gate
```

Include:

```text
answer
candidate_id
gate_id
gate_version
severity
result
observed_value
envelope
reason
```

---

# 102. Reserve Results CSV

Include:

```text
answer
primary_available
backup1_available
backup2_available
eligible_candidate_count
regeneration_rounds
final_status
```

---

# 103. Performance CSV

Include:

```text
answer
candidate_generation_ms
certification_ms
regular_ms
strong_ms
quality_gates_ms
validator_ms
reserve_ms
total_ms
```

---

# 104. Queue Results CSV

Include:

```text
date
primary_hash
backup1_hash
backup2_hash
status
validator_pass
frozen
policy_version
```

Do not include the answer if this artifact is treated as public-facing.

Analysis copy may remain private.

---

# 105. Required Review Document

Create:

```text
M10_AUTONOMOUS_DAILY_CERTIFICATION_REVIEW.md
```

Include:

1. objective;
2. architecture;
3. files created/modified;
4. production invariants;
5. M10 policy/versioning;
6. candidate-pool policy;
7. full REGULAR profiling policy;
8. STRONG finalist policy;
9. quality-gate registry;
10. each gate definition;
11. mandatory vs quality vs diagnostic gates;
12. confidence classification;
13. autonomous REVIEW_RECOMMENDED behavior;
14. reserve strategy;
15. regeneration;
16. historical envelope;
17. publication validator;
18. independence of validator;
19. hashes/reproducibility;
20. queue architecture;
21. freeze/supersede behavior;
22. kill switch;
23. health check;
24. evaluation population;
25. primary eligibility;
26. reserve eligibility;
27. no-human-QA success rates;
28. gate failure distribution;
29. confidence distribution;
30. regeneration effectiveness;
31. validator mutation results;
32. queue test results;
33. performance;
34. full test results;
35. limitations;
36. answers to Q1–Q20 below;
37. final recommendation;
38. `git status --short`;
39. `git diff --stat`.

---

# 106. Required Architecture Table

| Stage | Component | Mandatory? | Failure Behavior |
|---|---|---|---|
| Input | Input certification | Yes | Block |
| Candidate | M6 certification | Yes | Reject candidate |
| Difficulty | REGULAR profiling | Yes | Reject/Block |
| Finalist | STRONG | Policy | Next candidate |
| QA | Quality gates | Mixed | Warn/Reject |
| Release | Independent validator | Yes | Block |
| Reserve | Backup validation | Policy | Degraded status |
| Queue | Queue manager | Yes | Block |

Fill with actual implementation.

---

# 107. Required Gate Summary

| Gate | Severity | Pass % | Warn % | Fail % | Recommendation |
|---|---|---:|---:|---:|---|

---

# 108. Required Autonomous Success Table

| Result | Rate |
|---|---:|
| Publication-ready primary | |
| Primary + 1 backup | |
| Primary + 2 backups | |
| Regeneration required | |
| Blocked | |

---

# 109. Required Confidence Table

| Confidence | Candidates | Selected Primaries |
|---|---:|---:|
| HIGH_CONFIDENCE | | |
| ACCEPTABLE | | |
| REVIEW_RECOMMENDED | | |
| REJECT | | |

---

# 110. Required Performance Table

| Stage | Median | P90 |
|---|---:|---:|
| Generation | | |
| Certification | | |
| REGULAR | | |
| STRONG | | |
| Quality gates | | |
| Validator | | |
| Total | | |

---

# 111. Required Questions

Answer explicitly:

### Q1
Can M10 generate publication-ready Qjynn Daily grids with no human decision?

### Q2
What percentage of approved answer/clue inputs succeed automatically?

### Q3
What percentage produce two validated backups?

### Q4
Which quality gates reject the most candidates?

### Q5
Are any gates too aggressive?

### Q6
Are any gates redundant?

### Q7
Does full REGULAR profiling eliminate the shortlist-recall risk from M9/M9.1?

### Q8
How often does STRONG materially affect finalist selection?

### Q9
Is rare-word dependency useful as a blocking gate, warning, or diagnostic only?

### Q10
Is Hexalink simulation stable enough for any blocking rule?

### Q11
Does historical anomaly detection provide useful protection?

### Q12
How many regeneration rounds are typically required?

### Q13
Can primary/backup generation be made deterministic?

### Q14
Does the independent publication validator catch every seeded corruption test?

### Q15
Can queued puzzles be reproduced exactly?

### Q16
Does the kill switch block unsafe new generation without invalidating existing reserves?

### Q17
What is median/P90 total autonomous generation time?

### Q18
Is a rolling 14-day certified inventory operationally practical?

### Q19
What residual issues still require human intervention, if any?

### Q20
Is Qjynn ready for **unattended Daily puzzle generation with automatic publication eligibility**, while keeping actual website publication for a later milestone?

---

# 112. Final Recommendation

Choose exactly one:

### A — Ready for unattended publication-ready generation

Use if:

```text
automated success high
validator reliable
reserve behavior adequate
quality gates sensible
runtime practical
no mandatory human decision remains
```

This still does not mean website auto-publication is implemented.

### B — Autonomous architecture works but one specific safety issue remains

State the exact issue.

### C — Routine human QA remains necessary

Use only if automated gates/validator cannot provide an adequate safety envelope.

Do not default to C merely because human review would provide extra assurance.

---

# 113. No Automatic Publishing

Do not implement:

```text
website deployment
cron publication
production scheduler
CMS upload
```

M10 creates:

```text
publication eligibility
queue
primary/backups
validation
```

Actual publication belongs in a later milestone.

---

# 114. Human Involvement Model

M10 should assume:

```text
routine daily approval = none
```

Human involvement may remain for:

```text
maintaining approved answer/clue input corpus
investigating BLOCKED cases
periodic audit sampling
intentional rules/version changes
```

Do not make those activities part of the Daily publication critical path.

---

# 115. Git Handling

Do not commit automatically.

Do not use:

```bash
git add .
```

Keep:

```text
data/familiarity/wordfreq-en-large.json
```

separate as local third-party data unless repository policy has explicitly changed.

At completion show:

```bash
git status --short
git diff --stat
```

Clearly separate project-owned M10 files from local/third-party data.

---

# 116. Stop Condition

When M10 is complete:

1. save all M10 analysis artifacts;
2. create `M10_AUTONOMOUS_DAILY_CERTIFICATION_REVIEW.md`;
3. run the complete regression suite;
4. verify gameplay invariants;
5. report evaluation population;
6. report publication-ready primary success;
7. report backup success;
8. report gate failure distribution;
9. report confidence distribution;
10. report regeneration behavior;
11. report validator corruption tests;
12. report queue/recovery tests;
13. report kill-switch behavior;
14. report median/P90 runtime;
15. answer Q1–Q20;
16. choose A/B/C;
17. show `git status --short`;
18. show `git diff --stat`;
19. stop.

Do not begin M11.

Wait for review.