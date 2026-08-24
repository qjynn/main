# Qjynn M11 — Daily Puzzle Catalog, Scheduling & Runtime Delivery

Implement **M11 only**.

M1–M10 are complete and approved.

Do **not** begin M12.

M10 established autonomous generation of publication-ready Daily puzzles with:

```text
primary
backup1
backup2
private audit manifest
publication validator result
queue metadata
```

M11 must build the reliable delivery layer between those certified artifacts and the Qjynn game.

The objective is:

> Given a canonical Qjynn date, reliably return exactly the correct validated public Daily Puzzle for that date, without exposing future puzzles, private answers, certificates, or audit data.

M11 must support unattended operation.

M11 must **not yet deploy to or modify the live qjynn.com production environment** unless an existing local integration test explicitly requires local application wiring.

---

# 1. Core Responsibility

Build the pipeline:

```text
Approved date/answer/clue catalog
        ↓
M10 generates publication-ready entries
        ↓
M11 stores catalog entries durably
        ↓
canonical Qjynn clock determines today's date
        ↓
activate correct Daily entry
        ↓
serve ONLY today's public puzzle
        ↓
Qjynn game consumes public puzzle
```

M11 does not determine whether the grid is good.

M10 already did that.

---

# 2. Production Invariants

Do not modify:

```text
game scoring
Gold/Silver/Bronze thresholds
six-turn rule
Vocabulary 1.0
Hexalink legality
canonical consonant inventory
M6 certification semantics
M8.1 player models
M9/M9.1 behavior
M10 quality gates
M10 publication-validator semantics
```

Do not redesign puzzle generation.

---

# 3. Preserve M10

M10 remains responsible for:

```text
candidate generation
M6 certification
REGULAR profiling
STRONG confirmation
quality gates
publication eligibility
primary/backups
private manifest
independent artifact validation
```

M11 consumes M10 output.

Do not duplicate M10 logic.

---

# 4. M11 Responsibilities

Implement:

```text
Daily puzzle catalog
canonical puzzle date/time policy
durable public/private storage abstraction
future-puzzle queue
today lookup
backup promotion
atomic activation
runtime public delivery
cache-safe puzzle identity
historical archive support
rolling inventory health
queue replenishment interface
spoiler protection
revalidation
rollback
```

---

# 5. Non-Responsibilities

M11 must not implement:

```text
new grid algorithms
new scoring
new medal rules
new synthetic-player models
new familiarity data
clue generation
answer generation
leaderboards
player accounts
streak logic
social sharing
analytics
website deployment
production cron infrastructure
```

Keep scope disciplined.

---

# 6. Canonical Qjynn Date

Define one authoritative Qjynn Daily Puzzle day boundary.

Do not use the browser/device local clock as the authority.

Implement configurable canonical timezone.

Default policy should be explicit.

For example:

```text
America/New_York
```

or another clearly documented zone.

Do not silently infer timezone.

Store:

```text
qjynnTimezone
```

in policy/version metadata.

---

# 7. Time Provider Abstraction

Do not call `new Date()` unpredictably throughout business logic.

Create a clock/time provider abstraction.

Conceptually:

```javascript
getCurrentQjynnTime()
getCurrentPuzzleDate()
```

Tests must inject fixed times.

---

# 8. Puzzle Date Format

Use an unambiguous date key:

```text
YYYY-MM-DD
```

Example:

```text
2026-08-24
```

Daily identity must not depend on locale formatting.

---

# 9. Puzzle ID

Every published Daily puzzle must have a stable public identifier.

Conceptually:

```text
QJYNN-2026-08-24
```

or repository-consistent equivalent.

The ID must be deterministic from the canonical date.

Do not expose answer data in the ID.

---

# 10. Catalog Architecture

Create a Daily Puzzle Catalog abstraction.

Conceptually:

```javascript
getDaily(date)
putDaily(entry)
listDaily(range)
getToday()
getFutureInventory()
getArchiveEntry(date)
```

M11 should not hard-code one storage backend into business logic.

---

# 11. Storage Interface

Define a storage adapter interface supporting at minimum:

```text
write publication-ready entry
read by date
list date range
update queue status
promote backup
freeze entry
supersede entry
```

Implement a local/file-backed adapter suitable for development and tests.

Design so a cloud/database adapter can be added later.

Do not introduce cloud dependencies unless already present.

---

# 12. Public vs Private Storage

Maintain strict physical/logical separation between:

```text
PUBLIC DAILY ARTIFACT
```

and:

```text
PRIVATE M10 MANIFEST
```

Public storage may contain:

```text
puzzle ID
date
grid
public clue
public Hexalink-related game fields already allowed
schema/version metadata
```

Private storage may contain:

```text
answer
Gold certificate
candidate profiles
quality gates
seeds
backups
private hashes
selection rationale
```

The runtime Daily endpoint must never require sending the private manifest.

---

# 13. Future Puzzle Spoiler Protection

This is mandatory.

Do not make future Daily puzzle artifacts browser-discoverable through:

```text
static bundled JSON
JavaScript constants
frontend preload
directory listing
public index
public archive API before activation
```

Future entries must remain server-side/private until their canonical date is active.

---

# 14. Runtime Delivery API

Create a clean runtime API/function.

Conceptually:

```javascript
getTodayPublicPuzzle({
  now,
  timezone,
  store
})
```

Return:

```javascript
{
  ok: true,
  puzzleId,
  date,
  puzzle
}
```

It must return only the currently active public artifact.

---

# 15. Explicit Date Lookup

Also support controlled lookup:

```javascript
getPublicPuzzleByDate(date)
```

Policy must distinguish:

```text
past
today
future
```

Future lookup must be blocked by default in public/runtime mode.

---

# 16. Future Lookup Policy

If requested date > canonical current puzzle date:

```text
status = NOT_YET_AVAILABLE
```

Do not return the future public artifact even if it exists in storage.

This prevents answer/puzzle leakage.

---

# 17. Past Puzzle Policy

Support past-puzzle retrieval through an explicit archive policy.

Default may be:

```text
past public puzzles readable
```

if that is consistent with architecture.

But keep archive behavior configurable because UI archive support is not part of M11.

---

# 18. Today's Puzzle Availability

For today's date:

```text
ACTIVE primary
```

must be served.

If primary fails runtime revalidation:

```text
attempt deterministic backup promotion
```

using M10/M11 reserve logic.

---

# 19. Runtime Revalidation

Before first activation, or according to explicit cached-validation policy, verify:

```text
artifact hash
schema
date
queue status
publication-validator PASS
version compatibility
```

Do not rerun expensive candidate generation.

---

# 20. Backup Promotion

If active primary becomes invalid or unavailable:

```text
primary
  ↓ fail
backup1
  ↓
independent validation
  ↓
promote atomically
```

Then backup2 if required.

All promotion decisions must be deterministic and audited privately.

---

# 21. Atomic Activation

Implement atomic state transition for one date.

Players must never observe:

```text
half-updated entry
two simultaneous active primaries
temporary missing puzzle during promotion
```

With local storage, emulate atomicity using safe file-write/rename semantics or equivalent.

Document backend requirements for future storage adapters.

---

# 22. One Active Puzzle Per Date

Enforce:

```text
exactly one active primary per date
```

unless the entry is BLOCKED.

Duplicate active puzzle IDs for one date are invalid.

---

# 23. Queue States

Reuse or extend M10 queue states carefully.

Support at minimum:

```text
GENERATED
CERTIFIED
AUTO_PUBLISH_ELIGIBLE
ACTIVE
EXPIRED
BLOCKED
SUPERSEDED
```

Do not create contradictory state transitions.

---

# 24. State Machine

Centralize allowed transitions.

Example:

```text
CERTIFIED
   ↓
AUTO_PUBLISH_ELIGIBLE
   ↓
ACTIVE
   ↓
EXPIRED
```

And:

```text
ACTIVE
   ↓
SUPERSEDED
```

only through controlled backup promotion or operator-approved replacement.

---

# 25. Freeze Behavior

Publication-ready entries should be frozen before activation.

A frozen entry cannot be silently regenerated.

If content changes:

```text
create new version
supersede old version
```

Preserve audit history.

---

# 26. Midnight / Day-Boundary Behavior

Test exact transitions around the canonical day boundary.

For example:

```text
23:59:59
00:00:00
00:00:01
```

in the configured timezone.

At exactly the boundary, the new Daily Puzzle becomes authoritative.

---

# 27. Daylight Saving Time

If the selected canonical timezone observes DST, explicitly test DST transitions.

Do not assume every day is exactly 24 wall-clock hours.

Use timezone-aware calendar-date logic.

---

# 28. Server Clock Authority

The runtime system must derive today's puzzle from server-side canonical time.

Frontend-provided date must not determine the live Daily puzzle.

This prevents users from manipulating device time to access future puzzles.

---

# 29. Cache Identity

Public Daily response must have stable cache identity.

Recommended elements:

```text
puzzleId
date
publicArtifactHash
```

Design suitable ETag/cache metadata.

Do not embed future puzzle identity.

---

# 30. Cache Expiry

The current Daily puzzle may be cached until the next canonical day boundary.

Compute explicit expiry relative to canonical timezone.

Do not use arbitrary 24-hour TTL from request time.

---

# 31. Stale Puzzle Protection

If a cache or storage layer attempts to serve yesterday's puzzle after the new day begins:

```text
date mismatch
```

must be detectable.

Include canonical date/puzzle ID in the public response.

---

# 32. Runtime Response Schema

Create a versioned schema.

Conceptually:

```json
{
  "schemaVersion": "...",
  "puzzleId": "QJYNN-2026-08-24",
  "date": "2026-08-24",
  "puzzle": { }
}
```

No answer.

No certificate.

No future metadata.

---

# 33. Error Responses

Define structured statuses such as:

```text
TODAY_NOT_FOUND
TODAY_BLOCKED
NOT_YET_AVAILABLE
INVALID_DATE
STORE_ERROR
VALIDATION_FAILED
```

Do not leak private reasons or answers in public errors.

---

# 34. Rolling Inventory

Maintain inventory metrics.

For configured future horizon:

```text
14 days
```

report:

```text
ready days
missing days
blocked days
reserve completeness
```

Keep horizon configurable:

```text
7
14
30
```

---

# 35. Inventory Health

Define:

```text
HEALTHY
DEGRADED
CRITICAL
```

based on future ready-day count and reserve coverage.

Example policy can be configurable.

Do not hard-code operational assumptions invisibly.

---

# 36. Replenishment Trigger

M11 should determine when more M10 entries are needed.

Conceptually:

```text
if readyFutureDays < replenishThreshold:
    requestReplenishment
```

M11 may invoke an existing local M10 generation interface or emit a structured replenishment request.

Do not add production cron scheduling yet.

---

# 37. Replenishment Boundary

M11 should not invent answers/clues.

Replenishment requires approved catalog inputs.

If future approved input is unavailable:

```text
INPUT_CATALOG_EXHAUSTED
```

not fabricated puzzle content.

---

# 38. Approved Input Catalog

Create or formalize an input catalog abstraction for:

```text
date
answer
clue
seed
status
```

This remains private.

Do not expose future rows publicly.

---

# 39. Input Catalog Validation

Enforce:

```text
one row per date
unique answer policy if configured
clue non-empty
seed valid
date valid
```

Do not automatically rewrite bad editorial input.

---

# 40. Catalog Consumption

M11 should be able to process a future date range:

```text
catalog inputs
      ↓
M10 generation
      ↓
M11 stored queue entries
```

while preserving deterministic results.

---

# 41. Queue Builder

Reuse or extend M10's queue builder rather than replacing it.

Add M11 delivery metadata/state only as necessary.

Avoid duplicate queue representations.

---

# 42. Initial Queue Build CLI

Provide an offline command conceptually like:

```bash
node tools/daily/build-delivery-catalog.js \
  --input approved-daily-inputs.csv \
  --days 14 \
  --output runtime-store/
```

Use existing naming if preferable.

---

# 43. Runtime Today's Puzzle CLI/Test Endpoint

Provide a local command for QA:

```bash
node tools/daily/get-today.js \
  --now 2026-08-24T12:00:00-05:00
```

It should print only the public artifact/status.

Useful for deterministic testing.

---

# 44. Historical Archive

Preserve expired public puzzles by date.

Do not delete them during queue rotation.

Support:

```text
getArchiveEntry(date)
```

without building archive UI.

---

# 45. Private Historical Audit

Private manifests must remain available after expiration for:

```text
debugging
reproduction
complaint investigation
version audit
```

Do not expose them through archive public API.

---

# 46. Archive Immutability

Once a Daily puzzle has been active, its public historical record should be immutable.

If a correction is required:

```text
new superseding version
audit reason
```

Do not silently rewrite history.

---

# 47. Puzzle Consistency Across Players

M11 must guarantee:

> All users requesting the same canonical Daily Puzzle date receive the same active puzzle ID/grid.

Add deterministic concurrency/read tests where practical.

---

# 48. No User-Specific Puzzle Variation

Do not generate different Daily grids by:

```text
user ID
browser
geography
session
device
```

Daily means one canonical puzzle per date.

---

# 49. Spoiler-Safe HTML/JS Integration Boundary

If local app integration is added, `game.js` should receive only:

```text
today public puzzle payload
```

Do not embed:

```text
answer
future catalog
backups
private manifest
```

into frontend bundle or page source.

---

# 50. game.js Scope

Do not substantially rewrite `game.js`.

If needed, add only the minimal adapter/interface required to consume a Daily Puzzle payload.

Prefer testing the delivery API independently first.

---

# 51. Fallback When Today's Puzzle Missing

Never silently serve tomorrow's puzzle.

Policy options may include:

```text
serve last valid active puzzle with explicit stale status
or
return unavailable
```

Choose the safer default and document it.

Do not expose future content.

---

# 52. Recommended Missing-Today Default

Prefer:

```text
TODAY_NOT_AVAILABLE
```

over silently serving another date.

This avoids inconsistent puzzle/streak behavior.

---

# 53. Backup Failure

If primary and all validated backups fail:

```text
TODAY_BLOCKED
```

Do not select an uncertified candidate at runtime.

---

# 54. Runtime Kill Switch

Integrate M10 health-check state.

If system health is:

```text
BLOCKED
```

new future activations should not occur unless the entry was previously frozen/certified under an explicitly valid policy.

Document exact behavior.

---

# 55. Existing Certified Inventory

Preserve M10's principle:

```text
new-generation health failure
does not automatically invalidate already certified reserves
```

M11 must respect per-entry version validity.

---

# 56. Version Compatibility

Each queue entry must record:

```text
rules version/hash
vocabulary version/hash
M10 policy
publication-validator version
M11 delivery policy
schema versions
```

Runtime must validate expected compatibility.

---

# 57. Do Not Retroactively Reinterpret

A puzzle certified under version X should not silently be reinterpreted under changed rules Y.

If incompatible:

```text
VERSION_MISMATCH
```

and use explicit migration/regeneration policy.

---

# 58. Delivery Policy Version

Introduce explicit:

```text
M11 delivery policy version
```

Changing:

```text
timezone
archive policy
cache policy
activation rules
fallback rules
```

must increment the appropriate version.

---

# 59. Publication Record

When a puzzle becomes ACTIVE, create a private publication record:

```text
date
activation time
puzzle ID
public hash
selected candidate ID
backup state
delivery policy version
```

---

# 60. Activation Idempotency

Activating the same already-active puzzle again must be safe and produce no duplicate side effects.

---

# 61. Backup Promotion Audit

When promotion happens record:

```text
old primary
new primary
reason
timestamp
validator result
```

Private only.

---

# 62. Catalog Integrity Hash

Optionally create a deterministic catalog hash for a queue snapshot.

This helps detect accidental mutation.

Do not expose private contents through the hash metadata.

---

# 63. Storage Corruption Tests

Seed corruption cases including:

```text
missing public file
modified public hash
missing private manifest
bad queue reference
two active entries
future entry marked active
wrong date/puzzle ID
```

M11 must fail safely.

---

# 64. Spoiler Tests

Explicitly test:

```text
request tomorrow
request next week
enumerate catalog
public response fields
static/public output directory
```

Future puzzle data must remain inaccessible through the public delivery interface.

---

# 65. Clock Manipulation Tests

Simulate frontend/request-provided bogus dates.

The public today's-puzzle path must ignore user-supplied local date.

Only injected server-side test clock may change canonical today.

---

# 66. Midnight Tests

Test activation at:

```text
one second before boundary
exact boundary
one second after
```

for consecutive dates.

---

# 67. DST Tests

If canonical timezone uses DST, test at least:

```text
spring transition
fall transition
```

Ensure puzzle dates advance correctly once per calendar day.

---

# 68. Cache Tests

Verify:

```text
same-day repeated requests produce same identity
new-day request changes puzzle ID
ETag/hash matches payload
stale cache can be detected
future content not cached publicly
```

---

# 69. Queue Recovery Tests

Simulate restart.

Reload catalog/store.

Verify active/ready/backup state reconstructs identically.

No hidden in-memory-only state may be required for correctness.

---

# 70. Atomic Write Tests

If using file storage, interrupt simulated writes where practical.

Ensure partially written entries are not exposed as valid.

Use temp-file + atomic rename or equivalent.

---

# 71. Archive Tests

Verify:

```text
past puzzle remains readable if archive enabled
future puzzle unavailable
active puzzle readable
private manifest never public
```

---

# 72. Replenishment Tests

Simulate future inventory:

```text
14 ready
10 ready
3 ready
0 ready
```

Verify correct health/replenishment status.

Do not actually schedule background jobs.

---

# 73. Catalog Exhaustion

When approved answer/clue inputs run out:

```text
replenishmentStatus = INPUT_CATALOG_EXHAUSTED
```

Do not fabricate content.

---

# 74. Batch Delivery Evaluation

Build at least:

```text
14 consecutive Daily entries
```

using M10 outputs.

Prefer:

```text
30
```

if runtime is reasonable.

---

# 75. Simulated Calendar Run

Advance the injected clock day by day across the generated queue.

For every date verify:

```text
correct puzzle ID
correct public hash
exactly one active puzzle
future puzzles inaccessible
previous puzzle archived/expired correctly
```

---

# 76. Backup Promotion Calendar Test

For selected days corrupt:

```text
primary
```

before activation and verify:

```text
backup1 promoted
```

For another day corrupt:

```text
primary + backup1
```

and verify backup2.

For another:

```text
all three
```

and verify BLOCKED.

---

# 77. No-Human Delivery Metric

Measure:

> Percentage of simulated Daily dates that activate the correct validated puzzle without any operator action.

Report separately:

```text
normal activation
backup promotion
blocked
```

---

# 78. Delivery Correctness Metric

Target:

```text
0 wrong-date deliveries
0 future leaks
0 dual-active entries
0 invalid artifacts served
```

Any such failure is critical.

---

# 79. Performance

Measure:

```text
catalog lookup latency
today response latency
activation latency
backup promotion latency
queue load latency
archive lookup latency
```

M11 runtime delivery should be lightweight.

Do not include M10 generation time when measuring request-time serving.

---

# 80. Delivery Performance Target

Do not impose arbitrary production SLA yet.

Report:

```text
median
P90
P99
```

for local benchmark.

The delivery layer should be orders of magnitude cheaper than M10 generation.

---

# 81. Suggested Architecture

Adapt to repository conventions, but conceptually:

```text
tools/delivery/
    daily-catalog.js
    delivery-policy.js
    clock.js
    storage-adapter.js
    file-storage-adapter.js
    activation-manager.js
    runtime-delivery.js
    inventory-health.js

tools/daily/
    build-delivery-catalog.js
    get-today.js

tests/
    m11-daily-delivery.test.js
```

Reuse M10 queue/publication modules where appropriate.

---

# 82. Avoid Duplication

Before adding new storage/state logic, inspect:

```text
tools/publication/queue-manager.js
tools/daily/build-queue.js
```

Reuse or extend them cleanly.

Do not create competing queue state machines.

---

# 83. Public Delivery API

Expose a clean core function independent of HTTP framework.

Conceptually:

```javascript
resolveTodayPuzzle({
  store,
  clock,
  policy
})
```

HTTP integration can wrap it later.

---

# 84. Optional Local HTTP Adapter

If the repository already uses an HTTP framework, a minimal local endpoint may be added:

```text
GET /api/daily
```

But this is optional.

Do not introduce a web framework solely for M11.

---

# 85. API Security Boundary

If an HTTP adapter exists:

```text
/api/daily
```

must expose only public payload.

There should be no unauthenticated endpoint for:

```text
future catalog
private manifests
answers
certificates
backups
```

---

# 86. Public Archive API

Do not implement broad archive exposure unless needed.

Core archive retrieval may exist internally for future use.

---

# 87. Evaluation Artifacts

Create at minimum:

```text
analysis/m11-catalog-results.csv
analysis/m11-calendar-simulation.csv
analysis/m11-spoiler-tests.csv
analysis/m11-backup-promotion.csv
analysis/m11-inventory-health.csv
analysis/m11-storage-corruption.csv
analysis/m11-performance.csv
analysis/m11-summary.json
```

---

# 88. Calendar Simulation CSV

One row per simulated date:

```text
date
expected_puzzle_id
served_puzzle_id
public_hash
activation_status
backup_used
future_leak_detected
dual_active_detected
validation_pass
```

---

# 89. Spoiler Tests CSV

Include:

```text
test
requested_date
canonical_today
result
future_data_exposed
```

Every future-access test must show:

```text
future_data_exposed = false
```

---

# 90. Inventory Health CSV

Include:

```text
date
future_ready_days
future_blocked_days
backup_complete_days
health
replenishment_required
replenishment_status
```

---

# 91. Backup Promotion CSV

Include:

```text
date
corruption_case
original_primary
promoted_candidate
promotion_level
result
```

---

# 92. Performance CSV

Include:

```text
operation
iterations
median_ms
p90_ms
p99_ms
```

---

# 93. Required Tests — Time

Add tests for:

1. canonical timezone date;
2. before-midnight puzzle;
3. exact-midnight transition;
4. after-midnight puzzle;
5. DST spring transition if applicable;
6. DST fall transition if applicable;
7. browser/client clock cannot override server date.

---

# 94. Required Tests — Catalog

Add tests for:

8. one entry per date;
9. duplicate date rejected;
10. duplicate active puzzle rejected;
11. puzzle ID deterministic;
12. catalog persisted/reloaded;
13. future listing not exposed publicly.

---

# 95. Required Tests — Delivery

Add tests for:

14. today returns correct puzzle;
15. tomorrow blocked;
16. past policy respected;
17. public response spoiler-safe;
18. unavailable today fails safely;
19. blocked today never serves uncertified fallback.

---

# 96. Required Tests — Backup

Add tests for:

20. primary healthy;
21. primary corrupt -> backup1;
22. primary + backup1 corrupt -> backup2;
23. all corrupt -> BLOCKED;
24. promotion atomic;
25. promotion deterministic;
26. promotion audited.

---

# 97. Required Tests — Storage

Add tests for:

27. corrupted hash rejected;
28. missing artifact rejected;
29. incomplete atomic write ignored;
30. reload preserves state;
31. frozen entry immutable;
32. supersede preserves history.

---

# 98. Required Tests — Privacy

Add tests for:

33. public response contains no answer;
34. no certificate;
35. no private seed;
36. no synthetic metrics;
37. no backup identities;
38. no future puzzle body.

---

# 99. Required Tests — Cache

Add tests for:

39. same-day ETag/hash stable;
40. next-day identity changes;
41. expiry aligned to canonical boundary;
42. stale-date mismatch detectable.

---

# 100. Required Tests — Inventory

Add tests for:

43. healthy future queue;
44. degraded queue;
45. critical queue;
46. replenishment requested;
47. input catalog exhaustion;
48. M11 never fabricates answer/clue.

---

# 101. Full Regression

Run:

```bash
node --test tests/*.test.js
```

M10 baseline:

```text
227 passed
0 failed
```

No previous functionality may regress.

---

# 102. Production Safety

Explicitly verify no unintended changes to:

```text
game scoring
Vocabulary 1.0
M6
M8.1
M9/M9.1
M10 quality policy
M10 validator semantics
```

---

# 103. Evaluation Population

Use at least:

```text
14 consecutive M10 publication-ready dates
```

Prefer:

```text
30
```

if practical.

All inputs must be legitimate approved test catalog entries.

---

# 104. Simulated Operational Run

Run a full virtual-calendar simulation across the entire evaluation window.

For each day:

```text
activate
serve
validate
expire prior
preserve archive
maintain future queue
```

No manual intervention.

---

# 105. Required Results

Report:

```text
correct Daily activation rate
wrong-date rate
future-leak rate
invalid-artifact-served rate
backup-promotion success
BLOCKED rate
inventory-health behavior
delivery latency
```

---

# 106. Acceptance Requirement

For M11 to pass:

```text
wrong-date deliveries = 0
future puzzle leaks = 0
uncertified puzzle deliveries = 0
dual active puzzle dates = 0
public answer/certificate leaks = 0
```

These are hard requirements.

---

# 107. Review Document

Create:

```text
M11_DAILY_CATALOG_SCHEDULING_DELIVERY_REVIEW.md
```

Include:

1. objective;
2. scope;
3. files created/modified;
4. production invariants;
5. M10 integration;
6. canonical timezone policy;
7. clock abstraction;
8. puzzle ID/date policy;
9. catalog architecture;
10. storage abstraction;
11. public/private separation;
12. runtime delivery API;
13. future spoiler protection;
14. state machine;
15. atomic activation;
16. cache behavior;
17. backup promotion;
18. freeze/supersede;
19. rolling inventory;
20. replenishment;
21. approved-input catalog;
22. archive support;
23. versioning;
24. calendar simulation;
25. spoiler tests;
26. corruption/recovery tests;
27. DST/date-boundary tests;
28. performance;
29. complete test results;
30. limitations;
31. answers to Q1–Q20 below;
32. recommendation;
33. `git status --short`;
34. `git diff --stat`.

---

# 108. Required Architecture Table

| Layer | Responsibility | Public/Private |
|---|---|---|
| Approved input catalog | Date/answer/clue | Private |
| M10 | Generate/certify | Private |
| Daily catalog | Store publication entries | Mixed |
| Activation manager | Select correct date | Private |
| Runtime delivery | Serve today's puzzle | Public |
| Audit/archive | Reproduction/history | Private/Mixed |

Fill with actual implementation.

---

# 109. Required Operational Results Table

| Metric | Result |
|---|---:|
| Simulated dates | |
| Correct activations | |
| Wrong-date deliveries | |
| Future leaks | |
| Primary activations | |
| Backup1 promotions | |
| Backup2 promotions | |
| Blocked dates | |

---

# 110. Required Inventory Table

| Metric | Result |
|---|---:|
| Configured horizon | |
| Ready days | |
| Days with 1 backup | |
| Days with 2 backups | |
| Replenishment triggers | |
| Input catalog exhaustion events | |

---

# 111. Required Performance Table

| Operation | Median | P90 | P99 |
|---|---:|---:|---:|
| Today's puzzle lookup | | | |
| Activation | | | |
| Backup promotion | | | |
| Catalog reload | | | |
| Archive lookup | | | |

---

# 112. Required Questions

Answer explicitly:

### Q1
What timezone defines the Qjynn Daily Puzzle date?

### Q2
Does every user receive the same puzzle for the same canonical date?

### Q3
Can client/device clock manipulation reveal another day's puzzle?

### Q4
Can tomorrow's stored puzzle be accessed through the public interface?

### Q5
Does the new puzzle activate correctly at the canonical day boundary?

### Q6
Are DST transitions handled correctly?

### Q7
Can two puzzles ever be active for the same date?

### Q8
Can a corrupted primary be replaced automatically?

### Q9
What happens if all backups fail?

### Q10
Are activation and backup promotion atomic?

### Q11
Can a process restart recover the exact catalog state?

### Q12
Are public and private artifacts fully separated?

### Q13
Can an expired puzzle be preserved for future archive use?

### Q14
How is stale-cache delivery detected/prevented?

### Q15
How many future ready days can M11 track?

### Q16
When does replenishment trigger?

### Q17
What happens when approved answer/clue inputs run out?

### Q18
What is runtime lookup latency?

### Q19
Does the simulated 14/30-day operational run require any human action?

### Q20
Is M11 ready to be connected to the Qjynn application/runtime in the next milestone?

---

# 113. Final Recommendation

Choose exactly one:

### A — Ready for runtime integration

Use if:

```text
delivery correct
no spoiler leakage
date/time behavior correct
backup recovery correct
runtime lightweight
```

### B — Delivery architecture works but one specific issue remains

State exactly what.

### C — Not ready for runtime integration

Explain why.

Do not implement runtime production deployment in M11.

---

# 114. Git Handling

Do not commit automatically.

Do not use:

```bash
git add .
```

Keep local third-party frequency data separate according to existing repository policy.

At completion show:

```bash
git status --short
git diff --stat
```

Separate project-owned M11 changes from local analysis data.

---

# 115. Stop Condition

When M11 is complete:

1. save all M11 analysis artifacts;
2. create `M11_DAILY_CATALOG_SCHEDULING_DELIVERY_REVIEW.md`;
3. run the complete test suite;
4. report evaluation date count;
5. report canonical timezone;
6. report correct-activation rate;
7. report future-leak result;
8. report backup-promotion result;
9. report BLOCKED behavior;
10. report inventory/replenishment behavior;
11. report runtime latency;
12. answer Q1–Q20;
13. choose A/B/C;
14. show `git status --short`;
15. show `git diff --stat`;
16. stop.

Do not begin M12.

Wait for review.