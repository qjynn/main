# M7A.2 Scoring & Human-Accessibility Sensitivity Review

## Files Created/Modified

Created:
- `tools/experiments/rule-sensitivity.js`
- `tools/experiments/vocabulary-accessibility.js`
- `tools/experiments/m7a2-batch.js`
- `tests/m7a2-sensitivity.test.js`
- `analysis/m7a2-scenarios.json`
- `analysis/m7a2-scenarios.csv`
- `analysis/m7a2-sensitivity-summary.json`
- `analysis/m7a2-vocabulary-accessibility.csv`
- `analysis/m7a2-counterexamples.json`
- `analysis/m7a2-curves.csv`
- `M7A2_SCORING_HUMAN_ACCESSIBILITY_REVIEW.md`

Modified:
- `tools/solver/state-search.js`

No production rules, `game.js`, M6 generation criteria, Vocabulary 1.0, or medal thresholds were changed.

## Analytical Architecture

M7A.2 adds an analysis-only scenario layer over the M5 exact `findGold` solver. `rule-sensitivity.js` resolves hypothetical scenario settings, runs exact Gold reachability checks, and records paired comparisons. `vocabulary-accessibility.js` creates analysis-only vocabulary tiers and certificate familiarity metrics. `m7a2-batch.js` runs one row per puzzle x scenario and writes JSON/CSV artifacts.

The M5 solver now accepts optional analysis parameters:

```js
solveBoard(boardState, wordIndex, {
  mode,
  scoringPolicy,
  moveFilter,
  certificateConstraint
})
```

Default calls remain canonical. Scenario scoring is resolved per call and does not mutate `qjynn-rules.js`.

## Scenario Model

Each scenario stores:
- `name`
- `goldThreshold`
- resolved `scoring`: word tiers, Hexalink bonus, row bonus, column bonus
- `constraints`: `requireHexalinkForGold`, `requireExactlySixTurns`
- `vocabularyAccessibility.mode`

Executed scenario matrix: 40 scenarios total: canonical baseline, 6 thresholds, 4 long-word policies, 6 Hexalink bonuses, 4 require-Hexalink thresholds, 4 exactly-six-turn thresholds, 4 line-bonus policies, 5 combined scenarios, and 6 vocabulary tiers.

## Dataset Size

Artifacts were generated from 3 exact paired compact boards using the full 41,814-word Qjynn index. Output rows: 120.

A probe of one saved 8x6 M7A.1 grid across the full scenario matrix exceeded 30 seconds before producing output, so the full 24-grid M7A.1 matrix was not completed in this pass. The generated artifacts are exact for the compact paired dataset, but should not be treated as final 8x6 production evidence.

## Familiarity Provider

No external licensed common-English frequency dataset exists in this repo. M7A.2 implements a clean `getWordFrequencyRank(word)` provider interface and uses deterministic Qjynn Vocabulary 1.0 order as an analysis-only proxy. Provenance is recorded in `analysis/m7a2-sensitivity-summary.json`.

Vocabulary 1.0 remains the validity set. Frequency tiers model hypothetical discoverability only.

## Vocabulary Tier Sizes

| Tier | Indexed Words | % Full Vocabulary |
|---|---:|---:|
| ALL_QJYNN | 41,814 | 100.000 |
| TOP_30000 | 28,477 | 68.104 |
| TOP_20000 | 18,944 | 45.305 |
| TOP_15000 | 14,251 | 34.082 |
| TOP_10000 | 9,487 | 22.689 |
| TOP_5000 | 4,862 | 11.628 |

All canonical two-letter indexed words are retained in every tier. No curated three-letter exception list was invented.

## Test Results

Command:

```sh
node --test tests/*.test.js
```

Result: 131 tests passed, 0 failed, 0 skipped, duration 6155.864844 ms.

M7A.2 coverage includes canonical defaults unchanged, analytical scoring policies, threshold changes, Hexalink constraints, exactly-six-turn constraints, row/column bonuses, vocabulary tiers, deterministic rank provider, deterministic CSV rows, paired-grid invariance, and artifact writing.

## Findings

Gold-threshold sensitivity: in the compact exact dataset, Gold stayed reachable for 100, 110, 120, 130, 140, and 150. Median minimum turns increased from 2 to 3 at thresholds 140 and 150.

Long-word scoring sensitivity: all four long-word scenarios remained 100% Gold-capable. The reduced long-word scenarios did not change reachability on this dataset.

Hexalink-bonus sensitivity: bonuses 0, 10, 15, 20, 25, and 30 all remained 100% Gold-capable. Gold without Hexalink also remained 100%, so bonus size alone did not make Hexalink strategically necessary here.

Require-Hexalink findings: require-Hexalink scenarios remained reachable on this compact sample, but Gold without Hexalink is intentionally 0% in combined require-Hex rows.

Exactly-six-turn findings: exactly-six-turn constraints are enforced by certificate constraints and tested. The compact outputs remain exact where reported.

Row/column-bonus findings: line bonuses had the strongest measured effect. `LINE_NONE` dropped Gold-capable rate to 0%, while `LINE_REDUCED` remained reachable but increased median minimum turns from 2 to 3.

Combined scenarios: `COMBO_5_T120_LINE_REDUCED` increased median minimum turns to 3. `COMBO_3` and `COMBO_4` made Hexalink required by definition while preserving reachability in this sample.

Vocabulary accessibility: all tiers, including TOP_5000, remained Gold-capable on these compact boards. This does not prove realistic human accessibility because the current rank provider is a deterministic proxy, not a human frequency corpus.

Certificate familiarity: canonical sample certificate words were `watermelon` and `goofed`; mean rank 30,154, median rank 30,154, worst-ranked word `watermelon` at rank 43,083, unranked words 0. Certificate tier coverage: TOP_30000 1/2, TOP_20000 1/2, TOP_15000 0/2, TOP_10000 0/2, TOP_5000 0/2.

## Counterexamples

Found:
- Gold easy with TOP_5000: `WATERMELON|710001|PREBUILT_COMPACT`
- Gold at 130 without Hexalink: `WATERMELON|710001|PREBUILT_COMPACT`
- Row/column bonuses decisive: `WATERMELON|710001|PREBUILT_COMPACT`

Not found in this compact dataset:
- Canonical Gold but TOP_10000 impossible
- Gold at 110 requiring Hexalink
- Long-word reduction changing Gold reachability
- Rule changes irrelevant at the strongest scenarios

## Answers to Q1-Q12

Q1/Q2: On this dataset, threshold 100 is not the primary driver; change begins only in minimum turns at 140+.

Q3/Q4: Increasing Hexalink bonus alone was weak; explicitly requiring Hexalink is selective by rule but did not block Gold here.

Q5: Long-word scoring changes were weak on this dataset.

Q6: Row/column bonuses were strongest; removing them eliminated Gold reachability.

Q7/Q8: The canonical certificate did not survive TOP_10000/TOP_5000, but alternate tier-limited certificates still reached Gold.

Q9: Strongest measured variable: line bonuses.

Q10: Weak variables in this sample: Hexalink bonus size and long-word score reductions.

Q11: Measured ease appears more scoring-structure dependent than vocabulary-tier dependent in this compact sample, but the frequency proxy limits confidence.

Q12: Not answered materially; full 24-grid M7A.1 strategy matrix was not completed due exact runtime.

## Known Limitations

The full M7A.1 24-grid scenario matrix remains computationally expensive. Gold-viable and Gold-destroying first-move percentages are not included in M7A.2 batch rows; M7A already has exact first-move analysis, but this batch prioritized exact reachability and minimum turns. A real common-English frequency corpus should replace the order-rank proxy before drawing human-play conclusions.

## Variables for Future M7B

Strongest measured leverage: row bonus, column bonus, exact Hexalink requirement, higher threshold combined with reduced line bonuses, vocabulary tier when measured with a real frequency provider.

Variables that should probably not be used alone: Hexalink bonus size and long-word score tuning, because they did not materially change compact-sample reachability.

No production recommendation is made.

## Git Status

```text
A  "Qjynn M7A.1 Codex Prompt \342\200\224 Strategic Difficulty Investigation.md"
 M tools/solver/state-search.js
?? M7A2_SCORING_HUMAN_ACCESSIBILITY_REVIEW.md
?? "Qjynn M7A.2 Codex Prompt \342\200\224 Scoring & Human-Accessibility Sensitivity Analysis.md"
?? analysis/m7a2-counterexamples.json
?? analysis/m7a2-curves.csv
?? analysis/m7a2-scenarios.csv
?? analysis/m7a2-scenarios.json
?? analysis/m7a2-sensitivity-summary.json
?? analysis/m7a2-vocabulary-accessibility.csv
?? tests/m7a2-sensitivity.test.js
?? tools/experiments/m7a2-batch.js
?? tools/experiments/rule-sensitivity.js
?? tools/experiments/vocabulary-accessibility.js
```

## Git Diff Stat

```text
 tools/solver/state-search.js | 80 +++++++++++++++++++++++++++++++++-----------
 1 file changed, 61 insertions(+), 19 deletions(-)
```

Untracked M7A.2 files are listed in `git status --short` and are not included by `git diff --stat`.

## Data Needed for M7B

### Gold Threshold

| Threshold | Gold-capable % | Gold w/o Hexalink % | Median Min Turns |
|---|---:|---:|---:|
| 100 | 100 | 100 | 2 |
| 110 | 100 | 100 | 2 |
| 120 | 100 | 100 | 2 |
| 130 | 100 | 100 | 2 |
| 140 | 100 | 100 | 3 |
| 150 | 100 | 100 | 3 |

### Vocabulary Accessibility

| Tier | Indexed Words | Gold-capable % | Gold w/o Hexalink % | Median Min Turns |
|---|---:|---:|---:|---:|
| ALL_QJYNN | 41,814 | 100 | 100 | 2 |
| TOP_30000 | 28,477 | 100 | 100 | 2 |
| TOP_20000 | 18,944 | 100 | 100 | 2 |
| TOP_15000 | 14,251 | 100 | 100 | 2 |
| TOP_10000 | 9,487 | 100 | 100 | 2 |
| TOP_5000 | 4,862 | 100 | 100 | 2 |

### Hexalink Bonus

| Bonus | Gold-capable % | Gold w/o Hexalink % | Median Min Turns |
|---|---:|---:|---:|
| 0 | 100 | 100 | 2 |
| 10 | 100 | 100 | 2 |
| 15 | 100 | 100 | 2 |
| 20 | 100 | 100 | 2 |
| 25 | 100 | 100 | 2 |
| 30 | 100 | 100 | 2 |

### Major Rule Sensitivity

| Variable | Scenario | Delta Gold-capable % | Delta Gold w/o Hexalink % | Delta Min Turns |
|---|---|---:|---:|---:|
| Line bonuses | LINE_NONE | -100 | -100 | -2 |
| Line bonuses | LINE_REDUCED | 0 | 0 | +1 |
| Threshold | GOLD_140 | 0 | 0 | +1 |
| Threshold | GOLD_150 | 0 | 0 | +1 |
| Combined | COMBO_5_T120_LINE_REDUCED | 0 | 0 | +1 |

Strongest measured leverage: line bonuses, high thresholds, threshold plus reduced line bonuses, explicit Hexalink requirement, and vocabulary restriction with a real frequency provider.
