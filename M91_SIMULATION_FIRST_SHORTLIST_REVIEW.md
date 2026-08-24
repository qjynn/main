# M9.1 Simulation-First Shortlisting Review

## Scope and Invariants

M9.1 adds simulation-first shortlist validation only. M9's cheap mathematical shortlist remains available and M7B remains separate. No gameplay, scoring, vocabulary, Hexalink, M6 certification, M8.1 model, real-frequency source, or M9 behavior was changed. M10 was not started.

The frozen provider is the local real `wordfreq` export (`v3.2` metadata, `zipf-linear-v1` normalization). Missing or invalid provider data fails closed. All simulation seeds derive deterministically from answer, candidate, stage, and benchmark seed.

## Files

- `tools/simulator/incremental-monte-carlo.js`: deterministic prefix profiles; one 500-run sequence supplies 25/50/75/100/150/250 summaries.
- `tools/generator/m91-simulation-selector.js`: M9.1 versioned reference-set, shortlist, recall, staged-selection, and provider helpers.
- `tools/generator/evaluate-m91.js`: 30-answer recall, method, runtime, stability, and STRONG evaluation.
- `tools/generator/evaluate-m91-pool-sensitivity.js`: 5-answer 10/15/20 candidate-pool study.
- `tests/m91-simulation-first.test.js`: M9.1 infrastructure and incremental-profile tests.
- `analysis/m91-*.csv` and `analysis/m91-summary.json`: evaluation artifacts.

## Reference Method

The main study used 30 distinct answers and exactly 10 unique M6-certified candidates per answer. Every candidate received a deterministic 500-run REGULAR reference profile. The first 10 answers also received 1,000-run profiles. Reference preferred candidates are all candidates in the documented relative `middle` band from the 500-run REGULAR mean; the reference winner is the deterministic center-of-preferred-band candidate, with median score and candidate ID tie-breakers. This avoids defining quality as one exact winner.

M9.1 evaluated low-run REGULAR counts 25, 50, 75, 100, 150, and 250, shortlist sizes 4, 5, 6, 7, and 8, signals mean/median/Gold, band-aware selection, a conservative confidence-aware variant, and REGULAR plus cheap-metric tie-breaking. The M9 `uniquePlayableWords` math shortlist was evaluated unchanged as the baseline.

## Recall Frontier

The table below is the low-run REGULAR mean signal with shortlist size 5. Runtime is estimated low-pass simulation time per answer.

| Low runs | Mean recall | Median | P10 | Minimum | Zero recall | Recall 1.0 | Winner retained | Runtime |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 25 | .544 | .667 | .333 | .000 | 3.3% | 10.0% | 53.3% | 1.0s |
| 50 | .644 | .667 | .333 | .333 | 0.0% | 20.0% | 70.0% | 1.9s |
| 75 | .722 | .667 | .333 | .333 | 0.0% | 26.7% | 63.3% | 2.9s |
| 100 | .789 | 1.000 | .333 | .333 | 0.0% | 50.0% | 73.3% | 3.9s |
| 150 | .844 | 1.000 | .333 | .333 | 0.0% | 63.3% | 93.3% | 5.8s |
| 250 | .900 | 1.000 | .667 | .333 | 0.0% | 73.3% | 93.3% | 9.7s |

At 250 runs and shortlist size 5, the preferred-candidate miss rate is zero, but 10% of preferred candidates are still lost in aggregate. No low-run configuration achieved both perfect preferred-set recall and a materially smaller search. The M9 math baseline measured .589 mean recall, 0% zero-recall in this reference definition, and 0% reference-winner retention; its runtime was about 1.0s for the math stage.

## Method Comparison

At 100 low runs and shortlist size 5:

| Method | Mean recall | Zero recall | Winner recall | Result |
|---|---:|---:|---:|---|
| REGULAR mean | .789 | 0.0% | 73.3% | best primary signal |
| REGULAR median | .656 | 0.0% | 56.7% | weaker |
| REGULAR Gold | .600 | 6.7% | 70.0% | unsafe tail |
| Band-aware | .778 | 0.0% | 70.0% | no improvement |
| Confidence-aware | .789 | 0.0% | 73.3% | indistinguishable |
| REGULAR + cheap tie-break | .789 | 0.0% | 73.3% | no measurable value |
| M9 math-only | .589 | 0.0% | 0.0% | retain for diagnostics only |

The selected candidate matched the full reference candidate 26.7% of the time for low-mean staging, preserved the same reference band 73.3% of the time, and preserved the same or adjacent band 100% of the time. Mean absolute reference-score delta was 0.352 points in the candidate-normalized comparison used by the artifact.

## STRONG and Stability

STRONG profiled three low-mean finalists at 250 runs. It changed the REGULAR-only finalist in 26/30 answers (86.7%), so it remains valuable as confirmation rather than being removed. This measurement is diagnostic; STRONG was not allowed to rescue an uncertified candidate.

Across the first 10 answers, 500-vs-1,000 REGULAR ordering had mean Spearman correlation **.912**, preferred-band agreement **86.0%**, and exact-winner agreement **20.0%**. This supports relative bands and preferred sets, not exact-winner claims. Incremental 100+400 profiles exactly matched fresh 500 profiles, including aggregate metrics.

## Runtime

For the 30-answer main study, median/P90 times per answer were: generation 1.02/1.11s; M6 certification accounting 0.10/0.11s; 100-run low REGULAR estimate 3.01/5.76s; remaining 400-run high REGULAR estimate 12.05/23.03s; STRONG 4.86/5.04s; staged total 21.13/34.85s. The 250-run low-pass configuration cost about 9.7s before the high shortlist and STRONG stages. Peak memory was not measured.

## Candidate-Pool Sensitivity

The smaller 5-answer study profiled 250 runs per candidate:

| Pool | Certified | Preferred count | Mean reference winner score | Simulation time |
|---:|---:|---:|---:|---:|
| 10 | 10 | 3.0 | 82.38 | 6.9s |
| 15 | 15 | 5.0 | 82.55 | 10.4s |
| 20 | 20 | 7.0 | 82.55 | 13.8s |

The 15-candidate pool modestly increased the available preferred region; 20 did not improve the observed winner score over 15 enough to justify its additional cost. This is a small sensitivity sample, not a production claim.

## Tests and Safety

Command: `node --test tests/m91-simulation-first.test.js`. M9.1 tests pass: **7 passed, 0 failed**. Coverage includes deterministic reference preferred sets, recall/winner/zero-recall calculations, shortlist sizing and policies, real-provider explicitness, staged-candidate containment, rank comparison, and incremental-profile equivalence. The complete regression suite passes: **220 passed, 0 failed** via `node --test`.

No changes were made to `game.js`, `qjynn-rules.js`, `qjynn-words-v1.0.txt`, M6, M8.1 parameters, M7B, canonical scoring, medal thresholds, six-turn rules, or Hexalink rules.

## Required Questions

**Q1.** Low-run REGULAR mean at 250/5 improves mean recall from the M9 math baseline .589 to .900 and winner retention from 0% to 93.3%.

**Q2.** 250 runs gives the best measured recall/runtime tradeoff; 150 is a lower-cost alternative with .844 recall and the same winner retention.

**Q3.** Shortlist size 5 was the selected evaluation point. Larger sizes should improve recall, but the 30-answer frontier artifact contains all sizes for further policy review.

**Q4.** Yes for 50+ low runs in this population: zero-recall was 0%; however, nonzero preferred-candidate loss remains.

**Q5.** Yes. Mean outperformed median and Gold on recall and avoided Gold's zero-recall cases.

**Q6.** No. Band-aware was slightly below plain mean at 100/5 (.778 versus .789).

**Q7.** No measurable improvement; the confidence-aware result matched mean.

**Q8.** No. The cheap metric as a deterministic tie-break did not change measured recall or selection results.

**Q9.** At approximately 5-10 seconds of low-pass compute, 150-250 runs produced .844-.900 mean recall, 0% zero recall, and 93.3% winner retention.

**Q10.** The staged low-mean selector matched the full reference candidate 26.7% of the time.

**Q11.** Same reference band occurred 73.3% of the time; same or adjacent band was 100%.

**Q12.** Typical measured absolute reference-score delta was 0.352 in the artifact's normalized candidate comparison.

**Q13.** STRONG changed 86.7% of REGULAR-only decisions in this study.

**Q14.** Yes as a finalist confirmation stage; it is not safe to remove based on this result.

**Q15.** Yes. Incremental accumulation avoids rerunning prefixes and exactly preserves fresh 500-run aggregates.

**Q16.** 500-run ordering was reasonably stable (.912 mean Spearman), but exact winners were unstable (20% agreement).

**Q17.** 15 candidates improved preferred-region breadth over 10 in the small study; 20 did not materially improve the winner score over 15.

**Q18.** Keep `uniquePlayableWords` as a diagnostic, not a primary shortlist signal or tie-breaker.

**Q19.** The pipeline is deterministic and operationally practical offline, but low-run prefilter recall is not strong enough for unattended use.

**Q20.** Not with simulation-first prefiltering alone. Automated generation followed by human QA should profile all 10 certified candidates with high-run REGULAR, or retain a prefilter only as an explicitly reviewed optimization.

## Recommendation

**C - Simulation-first shortlisting is not reliable enough for unattended production.** The safe alternative is to profile all certified candidates with the 500-run REGULAR reference when producing a Daily grid, then apply STRONG confirmation and human QA. M9.1's simulation-first path remains useful for analysis and can be reconsidered after a larger evaluation population or a better validated confidence policy.

## Artifacts

Generated files include `analysis/m91-evaluation-manifest.csv`, `m91-reference-profiles.csv`, `m91-shortlist-recall.csv`, `m91-winner-recall.csv`, `m91-zero-recall.csv`, `m91-band-preservation.csv`, `m91-method-comparison.csv`, `m91-strong-contribution.csv`, `m91-runtime-frontier.csv`, `m91-pool-sensitivity.csv`, `m91-selection-comparison.csv`, and `m91-summary.json`.

## Git Snapshot

`git status --short` at completion lists the M9.1 source/tests/report and generated analysis artifacts, along with pre-existing local M8.1/M8.2 files and the local frequency export, as untracked. `git diff --stat` is empty because these files are untracked. No commit was made and no unrelated changes were reverted.
