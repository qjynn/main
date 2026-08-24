# M10 Autonomous Daily Certification Review

## Objective and Scope

M10 adds autonomous publication-readiness infrastructure around the existing M6 generator and M9.1 full-candidate profiling path. It does not publish to the live website, run a scheduler, or modify gameplay. M7B, M9, and M9.1 remain callable and unchanged. M11 was not started.

## Architecture

| Stage | Component | Mandatory | Failure behavior |
|---|---|---:|---|
| Input | `validateEditorialInput` | Yes | `BLOCKED` |
| Candidate | Existing M6 `generateCandidatePool`/certificate | Yes | Candidate rejected or regenerate |
| Difficulty | REGULAR 500 on every certified candidate | Yes | Regenerate |
| Finalist | STRONG 250 on three finalists | Policy | Next finalist |
| QA | Versioned gate registry | Mixed | Warn, reject, or regenerate |
| Release | Independent publication validator | Yes | Regenerate/block |
| Reserve | Two independently validated backups | Default | Regenerate or degraded policy |
| Queue | Versioned queue manager | Yes | Block unsafe transition |

Public API:

```js
generatePublicationReadyDaily({
  date, answer, clue, seed, wordIndex, frequencyFile,
  history, config
})
```

Success returns `AUTO_PUBLISH_ELIGIBLE` or `RESERVE_ELIGIBLE`, `primary`, `backups`, `privateManifest`, `queueEntry`, `health`, and timing data. Failure returns structured `BLOCKED`, `REGENERATE`, or input/provider reasons. The default target is 10 certified unique grids, 500 REGULAR runs per certified candidate, 3 STRONG finalists at 250 runs, and 2 backups.

## Files Created

- `tools/quality/gate-registry.js`: M10 policy and gate versions.
- `tools/quality/quality-evaluator.js`: structured PASS/WARN/FAIL gate evaluation and confidence classification.
- `tools/quality/historical-envelope.js`: warm-up and percentile history envelope.
- `tools/publication/artifact-hashes.js`: stable SHA-256 artifact/version hashing.
- `tools/publication/publication-validator.js`: independent schema, privacy, grid, Hexalink, certificate, version, and hash validation.
- `tools/publication/queue-manager.js`: queue states, freeze, supersede, and backup promotion.
- `tools/publication/health-check.js`: provider/version/validator kill-switch health check.
- `tools/daily/generate-publication-ready.js`: autonomous primary/backup generation.
- `tools/daily/build-queue.js`: offline CSV batch queue builder.
- `tools/generator/evaluate-m10.js`: evaluation and mutation artifact generation.
- `tests/m10-publication-readiness.test.js`: M10 safety and integration tests.
- `analysis/m10-*.csv` and `analysis/m10-summary.json`: 30-answer evaluation artifacts.

## Gates and Policy

Mandatory gates are structural certification, data integrity, real familiarity, public/private separation, artifact schema, and reproducibility. Comparative difficulty, medal distribution, vocabulary accessibility, historical similarity, selection margin, and Monte Carlo stability are quality gates. Move-space, tile participation, and Hexalink are diagnostic gates. Diagnostic warnings never block publication.

The preferred candidate set is the relative REGULAR middle band. Adjacent bands are allowed by explicit policy. REVIEW_RECOMMENDED candidates are discarded automatically and the next finalist is tried; no human decision is on the publication critical path. Rare-word dependency and Hexalink simulation remain diagnostics/warnings, never standalone validity gates. Historical data starts in `WARMUP` until the configured minimum history exists.

Private manifests include the answer, clue, certificate, all candidate profiles, gate explanations, seeds, versions, hashes, validator result, primary, and backups. Public artifacts contain only the existing game-facing puzzle schema. Queue entries contain artifact references and hashes, not answers or certificates.

## Evaluation Results

Command:

```bash
M10_ANSWERS=30 node tools/generator/evaluate-m10.js
```

Population: **30 distinct approved answers, 10 certified candidates per answer**, full REGULAR profiling, and STRONG finalist confirmation.

| Result | Rate |
|---|---:|
| Publication-ready primary | 100% (30/30) |
| Primary + 1 backup | 100% (30/30) |
| Primary + 2 backups | 100% (30/30) |
| Regeneration required | 0% |
| Blocked | 0% |

All 30 selected candidates were `ACCEPTABLE`; none required routine human judgment. Gate warnings were vocabulary accessibility (90 finalist evaluations), tile participation (90), and move-space tail diagnostics (6). No mandatory gate failed. The historical gate remained warm-up because no historical publication store was supplied.

The seven-day queue test generated seven distinct dates using the default policy. All seven primaries and both backups per day were validator-passing and `AUTO_PUBLISH_ELIGIBLE`. Corrupt-primary recovery promoted backup 1 deterministically. An all-backups-unavailable queue state returns `BLOCKED`.

## Validator and Kill-Switch Results

The independent validator rejected **180/180 seeded mutations** across grid, Hexalink, certificate, privacy, hash, and version metadata. It independently recomputes structural validity, canonical Hexalink reconstruction, Gold certificate replay, turn limit, public/private leakage, hashes, and version metadata.

The health check blocks missing real familiarity, rules hash mismatch, vocabulary hash mismatch, validator regression, and certificate replay failure. Existing certified reserves are not deleted when new generation is blocked. Queue entries are immutable after freeze and are superseded rather than silently overwritten.

## Performance

Measured over 30 entries; times are milliseconds per entry:

| Stage | Median | P90 |
|---|---:|---:|
| Generation | 1,080 | 1,149 |
| M6 certification | 1,078 | 1,147 |
| REGULAR all candidates | 14,672 | 15,262 |
| STRONG finalists | 4,941 | 5,130 |
| Quality gates | <1 | <1 |
| Independent validator | 1,522 | 1,635 |
| Total | 22,357 | 23,168 |

This is offline generation and is operationally practical. Peak memory was not measured.

## Tests

Focused command: `node --test tests/m10-publication-readiness.test.js` passed **7/7**. The complete suite passed **227 tests, 0 failures** via `node --test`. Coverage includes provider fail-closed behavior, M10 policy, independent validation and mutations, gate severity, queue schema/freeze/promotion, health kill-switches, public privacy, and an end-to-end publication-ready artifact.

## Q1-Q20

**Q1.** Yes. M10 generated publication-ready entries without routine human decisions; live website publication remains intentionally unimplemented.

**Q2.** 100% of the 30 approved inputs succeeded automatically.

**Q3.** 100% produced two validated backups.

**Q4.** No gate rejected a candidate in the benchmark. The most frequent warnings were accessibility and tile participation; both are intentionally non-blocking.

**Q5.** No gate was too aggressive in this run. Accessibility and tile warnings should be monitored during history warm-up.

**Q6.** No material redundancy was demonstrated. Move-density measures remain diagnostic and are not stacked into a hidden score.

**Q7.** Yes. M10 profiles all 10 certified candidates, eliminating M9/M9.1 lossy shortlist recall as a mandatory production risk.

**Q8.** STRONG is retained for three finalists. M10 records its profile for confirmation; the benchmark produced 30 acceptable primaries.

**Q9.** Rare-word dependency is a quality warning/diagnostic, not a blocking gate.

**Q10.** No. Hexalink simulation is not stable enough for blocking; canonical Hexalink legality remains mandatory and synthetic participation is diagnostic.

**Q11.** Not yet. The history provider is implemented, but the benchmark is warm-up with no prior publication store. It becomes active after the configured history minimum.

**Q12.** Zero regeneration rounds were required in the 30-answer benchmark.

**Q13.** Yes. Candidate IDs, seeds, hashes, queue ordering, and backup promotion are deterministic.

**Q14.** Yes. The validator rejected all 180 seeded corruption cases.

**Q15.** Yes. Public/private artifacts, certificates, grid hashes, versions, and queue references are reproducible and independently checked.

**Q16.** Yes. The health check blocks unsafe new generation while existing certified queue entries remain unchanged.

**Q17.** Median/P90 total autonomous generation time was 22.36/23.17 seconds per Daily entry.

**Q18.** Yes for the tested architecture. A seven-day queue with two backups per day completed successfully; the 14-day path is supported by the same batch interface but was not benchmarked here.

**Q19.** Human work remains for maintaining approved answer/clue inputs, intentional policy/version changes, and investigating blocked or anomalous cases. Routine daily approval is not required.

**Q20.** Yes for unattended generation and automatic publication eligibility. Actual website publication, scheduling, and deployment remain future work.

## Final Recommendation

**A - Ready for unattended publication-ready generation.** M10 produced 30/30 primary-plus-two-backup results, preserved all canonical certification invariants, independently validated every selected artifact, passed all seeded mutation tests, supported deterministic queue recovery, and kept live publication outside the milestone.

## Git Snapshot

`git status --short` lists M10 source, tests, review, and generated artifacts as untracked along with pre-existing local M8.1/M8.2/M9/M9.1 files and the local third-party frequency export. `git diff --stat` is empty because these files are untracked. No commit was made and no unrelated changes were reverted.
