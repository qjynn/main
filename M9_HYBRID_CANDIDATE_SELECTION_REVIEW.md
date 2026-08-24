# M9 Hybrid Candidate Selection Review

## Status and Scope

M9 is implemented as a separate, deterministic selector. It does not modify Qjynn gameplay, M6 certification, M7B, M8.1, or M8.2. M10 was not started.

The pipeline is: generate M6 candidates, retain only certified candidates, calculate independent cheap opportunity metrics, retain a central shortlist, profile REGULAR players, profile a small finalist set with STRONG players, then select by deterministic ordered tie-breakers. Real familiarity is mandatory; missing or invalid frequency data returns `REAL_FAMILIARITY_REQUIRED`.

## Files

- `tools/generator/m9-hybrid-selector.js`: selector API, configuration, certification gate, cheap metrics, bands, profiling, audit manifest.
- `tools/daily/generate-daily.js`: offline single-puzzle CLI writing public and private JSON artifacts.
- `tools/generator/evaluate-m9.js`: reproducible offline evaluation and artifact writer.
- `tests/m9-hybrid-selector.test.js`: M9 unit and integration tests.
- `analysis/m9-*.csv` and `analysis/m9-summary.json`: 30-answer evaluation artifacts.

## Public API

```js
selectDailyGridM9({
  answer, date, seed, wordIndex, frequencyFile,
  profileAllCandidates, config
})
```

Success returns `{ ok: true, status: 'SELECTED', publicPuzzle, privateManifest, selected }`. `publicPuzzle` contains only the game-facing puzzle. `privateManifest` contains answer, certificate, candidate audit, profiles, seeds, versions, and selection explanation. Failure statuses include `INVALID_ANSWER`, `REAL_FAMILIARITY_REQUIRED`, `INSUFFICIENT_CANDIDATE_POOL`, and `SELECTION_FAILED`.

Default configuration is 20 raw candidates, 10 certified target, 8 shortlist, 250 REGULAR runs, 3 STRONG finalists, and 250 STRONG runs. Evaluation used 10 / 5 / 5 to make a 30-answer run practical. The production selector uses the configured central `uniquePlayableWords` metric, not a sum of correlated metrics.

## Selection Rules

M6 remains authoritative: uncertified candidates cannot be selected, regardless of simulation. Duplicate grid hashes are removed. Certified candidates are divided into relative easier/middle/harder bands. The default prefers the middle band and permits adjacent bands when necessary. REGULAR mean score is the primary synthetic signal; median, Gold rate, Hexalink rate, rare-word dependency, and played familiarity remain diagnostics/tie-break data. STRONG is run only for the finalist set. `skillGap` is `strongMeanScore - regularMeanScore`. Rare-word dependency and Hexalink characteristics are diagnostic-only and do not hard-reject valid candidates.

Candidate IDs derive from answer, seed, grid hash, and selector version. Monte Carlo seeds derive from answer, candidate ID, model, and stage. Identical inputs therefore select identically. M7B remains available independently; paired M7B grids were not available in the existing artifacts, so `analysis/m9-m7b-comparison.csv` explicitly records comparison as unavailable.

## Evaluation Results

Command:

```bash
M9_ANSWERS=30 node tools/generator/evaluate-m9.js
```

Results: 30/30 selections succeeded; every answer had 10 certified candidates, 5 shortlisted, and 3 finalists. Band distribution was 26 middle and 4 harder. Deterministic rerun mismatches: 0. STRONG changed the REGULAR-only choice for 19/30 answers. Math-only and full selections matched for 5/30; REGULAR-only and full selections matched for 11/30. Shortlist recall of the independently identified central REGULAR candidates averaged 0.408, with a minimum of 0; this is a material validation limitation and argues for broader shortlist-recall evaluation before production defaults are enlarged.

Selected candidate percentiles across certified pools: REGULAR mean average 37.0 (range 11.1-55.6), REGULAR Gold average 42.2 (0-100), STRONG mean average 60.0 (0-100), and cheap metric average 39.3 (22.2-66.7). These are relative positions, not human difficulty claims.

Ten selected-puzzle audit examples are recorded in `analysis/m9-candidate-pools.csv`. The first ten include WATERMELON (certificate 110, regular mean 82.724, Gold rate .084), OSCILLATED (100, 82.204, .068), ABANDONING (110, 82.260, .076), ACCESSIBLE (110, 81.632, .068), and ACCOUNTING (130, 81.836, .056). Full private certificates and grids remain in the generated private evaluation data, not the public artifact.

## Performance

Measured over 30 answers, 10 raw candidates each, full candidate profiling, and 250 runs per model: generation median/P90 1058.6/1154.4 ms; certification 1056.8/1152.5 ms; cheap metrics 1215.9/1326.7 ms; REGULAR 8114.2/8262.0 ms; STRONG 4779.7/5122.6 ms; total 15801.7/16357.9 ms. Peak memory was not measured. These numbers include exact M6 generation/certification and are not a claim of production throughput.

## Tests

The complete suite passes: **213 passed, 0 failed** via `node --test`. M9-specific coverage includes real-provider fail-closed behavior, configuration validation, central deterministic shortlisting, middle-band selection, certified-only selection, public/private separation, and identical-input determinism. Existing M1-M8.2 and M7A/M7B tests also pass unchanged.

## Limitations and Recommendation

M7B paired comparison is unavailable. The 30-answer evaluation meets the prompt minimum but not the preferred 50. Shortlist recall is weak for this initial central metric/size and needs a larger independent population before treating the prefilter as production-validated. The evaluator writes private analytical CSVs locally; deployment storage and retention policy are not defined. Batch CLI and profile caching/resume are not implemented because they were optional in the prompt.

**Recommendation: C - analysis-only.** The selector is suitable for reproducible offline analysis and review. Do not use it as an unattended production Daily generator until shortlist recall, broader evaluation, private artifact handling, and M7B comparison are resolved.

## Git Snapshot

At report generation, `git status --short` showed the M9 files, evaluation artifacts, and prior untracked M8.1/M8.2 files as untracked; no unrelated files were reverted. `git diff --stat` was empty because these new files are untracked. The exact commands should be rerun after staging to obtain a tracked diff summary.
