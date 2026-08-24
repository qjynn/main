# M11 Daily Catalog, Scheduling & Runtime Delivery Review

## Scope and Decision

M11 adds the delivery layer between M10 publication-ready artifacts and the game. It does not deploy to `qjynn.com`, add HTTP/cron infrastructure, or implement M12. **Recommendation: A, ready for runtime integration.** The local catalog, clock, spoiler controls, activation/recovery behavior, and public/private boundary are implemented and tested.

## Architecture

M10 remains the producer and validator. `DailyPuzzleCatalog` consumes only an `ok` M10 result, validates it with the existing publication validator, freezes it, and stores primary plus two private backups. `FileStorageAdapter` is a local adapter behind the catalog interface; each write uses temporary-file plus rename semantics, then atomically updates `state.json`.

Queue states are centralized in `tools/delivery/state-machine.js`: `GENERATED -> CERTIFIED -> AUTO_PUBLISH_ELIGIBLE -> ACTIVE -> EXPIRED`, with controlled `BLOCKED` and `SUPERSEDED` exits. A frozen date cannot be silently replaced. Activation validates the primary; failures deterministically validate and promote backup1, then backup2, or return `TODAY_BLOCKED`. The state records the active candidate and private promotion history.

The default canonical timezone is `America/New_York`, stored in the versioned delivery policy. `getQjynnDate` uses timezone-aware calendar dates, and `nextQjynnBoundary` finds the next local midnight without assuming a 24-hour day. Client-supplied dates are ignored for today delivery. Future requests return `NOT_YET_AVAILABLE`; past public entries are available through the configurable archive policy.

## Public API

```js
getTodayPublicPuzzle({ now, policy, catalog })
getPublicPuzzleByDate({ date, now, policy, catalog, allowFuture })
```

The today response is `{ ok, schemaVersion, puzzleId, date, puzzle, publicArtifactHash, etag, expiresAt, archived }`. `puzzleId` is deterministic, for example `QJYNN-2032-07-01`; `etag` is the quoted public artifact hash. The response contains no answer, certificate, candidate profiles, selection rationale, or private manifest. Future artifacts are stored server-side/private and are never returned by the public lookup policy.

## Inventory and Inputs

`build-delivery-catalog.js` accepts an explicit private CSV of `{ date, answer, clue, seed }`, rejects duplicate dates, and invokes M10 generation rather than duplicating it. `inventoryHealth` reports ready future dates, blocked dates, backup completeness, `HEALTHY/DEGRADED/CRITICAL`, and either `REQUEST_REPLENISHMENT` or `INPUT_CATALOG_EXHAUSTED`. Defaults are a 14-day horizon, two backups, and replenishment below seven ready days.

## Verification

The 14-day simulation generated 14 catalog entries and recorded 14/14 correct activation decisions: 11 primary activations, one backup1 promotion, one backup2 promotion, and one intentional `TODAY_BLOCKED` result after all three candidates were corrupted. It found 0 wrong-date deliveries, 0 future leaks, and 0 dual-active states. Backup promotion is independently revalidated and audited. Inventory reaches `REQUEST_REPLENISHMENT` at seven or fewer future-ready entries in the simulation.

Focused command: `node --test tests/m11-daily-delivery.test.js` -> **11 passed, 0 failed**.

Full command: `node --test` -> **238 passed, 0 failed, 0 skipped**, duration `15.15s`.

Focused tests cover canonical boundary, US DST spring/fall dates, durable reload, public-only/cache-stable delivery, future blocking, midnight activation, archive policy, primary/backup1/backup2/all-corrupt recovery, inventory exhaustion, duplicate input rejection, and state-machine transition safety.

## Performance

Measured on the local file adapter and generated M10 fixture catalog. The 14 single-lookup samples had approximately **10.1 ms median**, **15.3 ms P90**, and **34.6 ms P99**. Twenty-iteration summaries were: activation **4.76/6.50/6.96 ms**, backup promotion **2.22/3.31/3.83 ms**, catalog reload **0.015/0.028/0.146 ms**, and archive lookup **1.26/1.40/1.42 ms** for median/P90/P99. These are local measurements, not production capacity claims.

## Files

Created: `tools/delivery/clock.js`, `delivery-policy.js`, `state-machine.js`, `file-storage-adapter.js`, `daily-catalog.js`, `runtime-delivery.js`, `inventory-health.js`, `evaluate-m11.js`; `tools/daily/build-delivery-catalog.js`, `get-today.js`; `tests/m11-daily-delivery.test.js`; and M11 analysis CSV/JSON artifacts under `analysis/`.

The implementation consumes existing M10 modules, including `generate-publication-ready.js` and `publication-validator.js`; no game scoring or puzzle-generation rules were changed for M11. The workspace also contains pre-existing M8.1/M10 working-tree changes; they are shown by the requested status output and are not treated as M11 design changes.

## Q1-Q20 Review Answers

1. **Q1:** `America/New_York` is the explicit default.
2. **Q2:** Yes; the date is derived from the canonical timezone.
3. **Q3:** No; the browser/device clock and client date do not control delivery.
4. **Q4:** No; future lookup returns `NOT_YET_AVAILABLE`.
5. **Q5:** Yes; the new entry is authoritative at local midnight.
6. **Q6:** Yes; DST transitions are tested.
7. **Q7:** One active candidate is recorded per date.
8. **Q8:** Yes; backup1 and backup2 are independently revalidated.
9. **Q9:** `TODAY_BLOCKED` is returned when every candidate fails.
10. **Q10:** Local writes use temp-file plus rename and atomic state replacement.
11. **Q11:** Yes; reload reconstructs state from `state.json` and artifacts.
12. **Q12:** Yes; public and private artifacts use separate storage paths and response shapes.
13. **Q13:** Yes; past public entries remain archive-readable by policy.
14. **Q14:** Responses include date, ID, public hash, ETag, and expiry.
15. **Q15:** Horizon is configurable; default is 14 days.
16. **Q16:** Replenishment is requested below seven ready future days.
17. **Q17:** Missing approved inputs produce `INPUT_CATALOG_EXHAUSTED` rather than fabricated puzzles.
18. **Q18:** Lookup is about 10.1 ms median locally; see Performance.
19. **Q19:** No future leaks or dual-active states occurred in the 14-day run.
20. **Q20:** Yes, ready for the next runtime integration step; no live deployment was attempted.

## Git Snapshot

`git status --short` at review time:

```text
 M tools/daily/generate-publication-ready.js
 M tools/publication/publication-validator.js
?? M11_DAILY_CATALOG_SCHEDULING_DELIVERY_REVIEW.md
?? "Qjynn M11 Codex Prompt — Daily Puzzle Catalog, Scheduling & Runtime Delivery.md"
?? analysis/m11-backup-promotion.csv
?? analysis/m11-calendar-simulation.csv
?? analysis/m11-catalog-results.csv
?? analysis/m11-inventory-health.csv
?? analysis/m11-performance.csv
?? analysis/m11-spoiler-tests.csv
?? analysis/m11-storage-corruption.csv
?? analysis/m11-summary.json
?? data/
?? scripts/
?? tests/familiarity-provider.test.js
?? tests/m11-daily-delivery.test.js
?? tests/m81-calibration.test.js
?? tools/daily/build-delivery-catalog.js
?? tools/daily/get-today.js
?? tools/delivery/
?? tools/simulator/calibrate-m81.js
?? tools/simulator/familiarity-provider.js
```

`git diff --stat`:

```text
 tools/daily/generate-publication-ready.js  | 6 +++---
 tools/publication/publication-validator.js | 5 ++++-
 2 files changed, 7 insertions(+), 4 deletions(-)
```

The status also contains pre-existing M8.1/M10 working-tree artifacts and the copied M11 prompt; those are shown for completeness and are not additional M11 design changes.

## Limitations

The adapter is suitable for local development and tests, not concurrent multi-process production writes. A future backend must provide transactional state updates, conditional writes/leases, durable audit history, and atomic promotion. No live endpoint, scheduler, monitoring, or operator UI is included. Those integrations remain outside M11 and must preserve the same public/private and future-spoiler invariants.
