# M8 Synthetic Player Simulation Review

## Scope

M8 adds private, deterministic synthetic-player simulation and profiling. It does not modify `game.js`, Qjynn rules, scoring, thresholds, Vocabulary 1.0, Hexalink legality, M6 gates, or M7B ranking.

## Files

Created:
- `tools/simulator/player-models.js`
- `tools/simulator/move-discovery.js`
- `tools/simulator/move-ranking.js`
- `tools/simulator/hexalink-recognition.js`
- `tools/simulator/simulate-game.js`
- `tools/simulator/monte-carlo.js`
- `tools/simulator/puzzle-profiler.js`
- `tools/simulator/batch-profile.js`
- `tests/simulator-player-models.test.js`
- `tests/simulator-game.test.js`
- `tests/simulator-monte-carlo.test.js`
- `M8_SYNTHETIC_PLAYER_SIMULATION_REVIEW.md`
- `analysis/m8-puzzle-profiles.json`
- `analysis/m8-puzzle-profiles.csv`
- `analysis/m8-model-summary.csv`
- `analysis/m8-score-distributions.csv`
- `analysis/m8-convergence.csv`
- `analysis/m8-model-sensitivity.csv`
- `analysis/m8-m6-vs-m7b.csv`
- `analysis/m8-summary.json`

No production files were modified.

## Architecture

`simulateGame()` builds or receives one immutable M4/M5 solver context per puzzle. Human models use bounded random move sampling, accessibility weighting, softmax selection, and capped one- or two-turn lookahead. They never call `solveBoard()`. ORACLE is separate and may call the exact solver. State transitions use `applyMove()` and canonical rule functions.

`simulatePuzzleMonteCarlo()` derives each run seed from master seed, puzzle identity, model, and run index. Timing fields are observational; all outcome fields are reproducible.

## Player Models

| Model | Vocabulary Access | Move Consideration | Lookahead | Hexalink Skill | Decision Noise |
|---|---:|---:|---:|---:|---:|
| CASUAL | 42% | 8 candidates / 40 samples | 0 | low | high |
| REGULAR | 62% | 18 / 80 | 1 turn, 35 nodes | medium | medium |
| STRONG | 80% | 32 / 130 | 1 turn, 80 nodes | high | low |
| EXPERT | 93% | 55 / 220 | 2 turns, 150 nodes | very high | very low |
| ORACLE | full | exact infrastructure | exact | automatic | none |

Parameters are versioned as `m8.players.0`; simulator version is `m8.0`.

## Accessibility and Discovery

Vocabulary 1.0 remains authoritative for validity. M8 uses a pluggable frequency/familiarity provider when supplied; no provider was available here, so artifacts are marked `familiarityBasis: "heuristic"`. The fallback uses length, unusual letters, consonant clusters, and morphology. Two-letter words receive model-specific recognition probabilities and are not globally excluded.

Discovery samples a bounded subset of compatible, same-mask-deduplicated moves, applies notice probability and accessibility weighting, and caps the noticed set. Ranking combines canonical immediate score, familiarity, line progress, remaining-move flexibility, recognized Hexalink relevance, seeded softmax noise, and bounded lookahead. It never uses exact future score.

Hexalink recognition is a seeded event influenced by skill, clue accessibility, turn number, and noticed path overlap. Recognition exposes no private answer automatically. A recognized Hexalink still has to be available and legal. Hint use is probabilistic; every sixth hint consumes a turn, matching current `game.js` behavior. Invalid attempts consume turns, also matching `game.js`.

## Public APIs

```js
simulateGame({ puzzle, privateCertification, playerModel, simulationSeed }, wordIndex, options)
simulatePuzzleMonteCarlo({ puzzle, playerModel, runs, masterSeed }, wordIndex, options)
profilePuzzle(input, wordIndex, options)
```

Game results include score, canonical medal, turns, words, invalid attempts, hints, row/column completions, Hexalink discovery, move history, and versioned metadata. Monte Carlo results include mean, median, standard deviation, P10/P25/P75/P90, medal rates, confidence intervals, Hexalink metrics, completion, accessibility, and strategic metrics.

## Dataset and Results

The completed run used 30 production-size grids: 10 distinct answers from the existing M7A.3 M6-certified artifact, repeated with three deterministic seed identities because 30 distinct certified M7B grids were not present locally. It ran 100 simulations per human model, 12,000 human-like games total, with zero generation failures.

| Model | Mean Score | Gold % | Silver % | Bronze % | Hexalink % |
|---|---:|---:|---:|---:|---:|
| CASUAL | 87.26 | 18.63 | 72.63 | 8.73 | 44.87 |
| REGULAR | 111.46 | 83.47 | 16.47 | 0.07 | 63.07 |
| STRONG | 121.99 | 97.73 | 2.27 | 0 | 74.30 |
| EXPERT | 128.23 | 99.70 | 0.30 | 0 | 79.90 |
| ORACLE* | 108.50 | 100 | 0 | 0 | 100 |

`ORACLE*` is the M6 Gold-certificate benchmark in this batch, not a completed maximum-score proof. `simulateGame(..., playerModel: "ORACLE", runExactOracle: true)` can invoke M5 exact solving separately. The certificate benchmark must therefore not be interpreted as an upper bound; Expert scores exceeding it are expected.

| Model | Min Gold % | P25 | Median | P75 | Max |
|---|---:|---:|---:|---:|---:|
| CASUAL | 6 | 8 | 18 | 25 | 39 |
| REGULAR | 60 | 74 | 89 | 92 | 96 |
| STRONG | 87 | 97 | 99 | 100 | 100 |
| EXPERT | 95 | 100 | 100 | 100 | 100 |

Puzzle ordering was monotonic in all 30 rows: Regular beat Casual, Strong beat Regular, and Expert beat Strong in 100% of puzzle comparisons. Gold-rate rank correlations were Casual/Regular 0.733, Regular/Strong 0.788, and Strong/Expert 0.271.

Convergence on representative WATERMELON: Regular mean score was 104.11, 103.70, and 103.14 at 100, 250, and 500 runs; Gold rate was 0.68, 0.644, and 0.626. A provisional default of 500 runs is more defensible than 100 for a single puzzle; 1,000 remains preferable for production profiling.

Sensitivity was material: Regular with max candidates 8 versus 40 produced mean scores 88.43 versus 125.37; temperatures 1.5 versus 5 produced 108.98 versus 96.32. Hexalink recognition 0.2 versus 0.7 produced 103.91 versus 102.55. Parameter calibration is therefore a major credibility dependency.

Simulation time for the 30-puzzle, 100-run batch was approximately 4.2s Casual, 8.5s Regular, 13.5s Strong, and 20.5s Expert, excluding puzzle-context preparation and file generation. Context caching was required for this performance.

## Required Comparisons and Counterexamples

The current repository has no paired M6-first-candidate and M7B-selected puzzle artifact containing both complete grids, so `analysis/m8-m6-vs-m7b.csv` is a structured empty comparison and no M7B improvement claim is made. The repeated 10-answer dataset also limits independent puzzle conclusions.

Observed examples include `AFFORDABLE#3` as easy for all bounded models and `OSCILLATED#1/#2` as the hardest family, especially for Casual and Regular. The same OSCILLATED family showed low Hexalink discovery for Regular/Strong while still producing substantial scores, demonstrating that Hexalink discovery and score are separable. A genuine M7B-versus-M6 counterexample cannot be established from the local artifacts.

## Answers to M8 Questions

Q1: Yes, bounded models differ substantially from each other and from the certificate benchmark, but the current ORACLE batch is not a maximum-score comparison.

Q2: Yes. Aggregate score and Gold rate order cleanly CASUAL < REGULAR < STRONG < EXPERT.

Q3: Yes for Casual and Regular; Strong and Expert are close to saturated, limiting separation.

Q4: Yes. Hexalink rates range from 44.87% Casual to 79.90% Expert.

Q5: High sensitivity exists for candidate count and temperature; Hexalink probability was less influential in this sample.

Q6: 500 runs materially stabilizes the representative Regular estimate; use 1,000 for production-quality reports.

Q7: Not established. Correlations with M7A/M7B mathematical metrics were not run against a complete paired metric table.

Q8: Not established because paired M6/M7B grids were unavailable.

Q9: Gold appears permissive for Regular and above under these heuristic parameters, while Casual remains substantially below Gold. This is an observation, not a threshold recommendation.

Q10: No. M8 is useful analysis infrastructure, but heuristic familiarity, calibration, dataset independence, exact Oracle comparison, and M6/M7B pairing remain unresolved.

## Limitations and Stop Condition

The main missing dependency is a validated real frequency/familiarity source. The fallback is transparent but not evidence of human word knowledge. No model was fitted to user outcomes, no production difficulty label was added, and no M8 metric was added to M7B ranking. M8 is complete for review; no later milestone was started.

## Verification

```sh
node --test tests/*.test.js
```

Result: **186 passed, 0 failed, 0 skipped**, duration 7526.770954 ms.

Current `git status --short`:

```text
A  "Qjynn M7B.1 Codex Prompt — Exact Minimum-Gold-Turn Solver Optimization.md"
?? M8_SYNTHETIC_PLAYER_SIMULATION_REVIEW.md
?? "Qjynn M8 Codex Prompt — Synthetic Player Modeling, Monte Carlo Simulation & Difficulty Profiling.md"
?? analysis/m8-convergence.csv
?? analysis/m8-m6-vs-m7b.csv
?? analysis/m8-model-sensitivity.csv
?? analysis/m8-model-summary.csv
?? analysis/m8-puzzle-profiles.csv
?? analysis/m8-puzzle-profiles.json
?? analysis/m8-score-distributions.csv
?? analysis/m8-summary.json
?? tests/simulator-game.test.js
?? tests/simulator-monte-carlo.test.js
?? tests/simulator-player-models.test.js
?? tools/simulator/
```

`git diff --stat` has no tracked-file output because the M8 implementation and artifacts are currently untracked. No production gameplay file changed in this milestone.
