# M5 Implementation Review

## Summary

M5 adds an exact six-turn Qjynn solver and certificate replay support. It uses the M4 vocabulary index and legal move enumerator directly, then searches inter-turn board states where played consonant tiles become unavailable, row and column bonuses are awarded once, and exact Hexalink moves receive the canonical Hexalink bonus.

M6 and M7 were not implemented.

## Files Created/Modified

Created:

- `tools/solver/state-search.js`
- `tests/solver-state-search.test.js`
- `M5_IMPLEMENTATION_REVIEW.md`

Modified:

- None.

## Public API

```js
const { solveBoard, replaySequence } = require('./tools/solver/state-search');

const result = solveBoard({
  grid,
  tileStates,
  hexalink,
  hexarowcol,
  maxTurns: 6,
  goldThreshold: 100
}, wordIndex);
```

Return shape:

```js
{
  maxScore,
  goldReachable,
  turnsUsed,
  bestSequence,
  goldCertificate,
  stats: {
    statesExplored,
    statesPruned,
    memoHits,
    startingLegalMoveCount,
    elapsedMs
  },
  replay
}
```

Each certificate move contains:

```js
{
  word,
  consonantSkeleton,
  path,
  insertedVowels,
  vowelPlacements,
  baseScore,
  isHexalink,
  hexalinkBonus,
  rowBonus,
  columnBonus,
  scoreDelta,
  cumulativeScore,
  unavailableTiles,
  resultingUsedMask
}
```

## Solver Architecture

`solveBoard` calls `enumerateLegalMoves` from `tools/solver/grid-word-finder.js` once for the starting board. The enumerator already enforces M4 legality: OFF consonant tiles only, 8-direction adjacency, no tile reuse within a word path, word length limits, consonant skeleton matching, and exact Hexalink path classification.

M5 converts each legal move path into a `BigInt` tile mask. The search then explores legal sequences by rejecting any future move whose mask overlaps the current used-tile mask.

## Exact State Representation

The DFS state is:

```js
{
  usedMask,       // BigInt of unavailable consonant tiles
  completedRows, // bitset of rows that have already paid bonus
  completedCols, // bitset of columns that have already paid bonus
  turnsUsed,
  score
}
```

Initial `usedMask` is derived from `tileStates` and any non-OFF grid cells. Initial completed rows/columns are recorded up front so already-complete lines do not pay a bonus later.

Memoization key:

```js
`${turnsUsed}|${usedMask}|${completedRows}|${completedCols}`
```

The prior score is intentionally excluded because the best remaining achievable delta from the same tile/line/turn state is independent of how that state was reached.

## State Transition And Scoring

For each candidate move:

1. Reject if `move.mask & state.usedMask` is non-zero.
2. Set `nextUsedMask = state.usedMask | move.mask`.
3. Detect newly completed rows and columns by comparing line completion before and after the move.
4. Compute score delta with canonical rule values from `qjynn-rules.js`:
   - `move.baseScore`, supplied by M4 and derived from canonical word scoring.
   - `QJYNN_RULES.scoring.hexalinkBonus` for exact Hexalink.
   - `QJYNN_RULES.scoring.rowCompleteBonus` per newly completed row.
   - `QJYNN_RULES.scoring.columnCompleteBonus` per newly completed column.
5. Advance `turnsUsed` by one.

Hexalink state follows M4 classification from `qjynn-rules.js`: a move receives the bonus only when the path exactly matches the configured Hexalink path in forward or reverse order.

## Memoization And Pruning

The solver is exact. It uses two safe optimizations:

- Memoization: stores the best future score delta from a complete state key. This is safe because future legal moves and future bonuses depend only on used tiles, completed rows, completed columns, and remaining turns.
- Branch-and-bound: computes an optimistic upper bound by scoring every currently playable disjoint move independently, sorting those deltas, and adding the best `remainingTurns` deltas. This overestimates the true future because it ignores conflicts among those future moves. Pruning only occurs when `state.score + optimisticBound <= incumbentScore`, so it cannot remove a branch that could beat the incumbent.

No heuristic or approximate pruning is used in exact mode.

## Tests

Command:

```bash
node --test tests/*.test.js
```

Result:

```text
tests 41
pass 41
fail 0
duration_ms 552.76795
```

M5 tests added:

- `Gold impossible`
- `Gold exactly 100`
- `Gold greater than 100`
- `greedily taking the best first move can be worse`
- `used tiles cannot be reused`
- `row bonuses are awarded exactly once`
- `column bonuses are awarded exactly once`
- `exact Hexalink bonus is applied correctly`
- `reverse Hexalink is handled correctly`
- `solver never exceeds six successful moves`
- `replaying a Gold certificate reproduces the reported final score`
- `optimized solver matches brute-force reference on a handcrafted board`
- `move dominance keeps only the highest scoring move for one tile mask`
- `findGold returns an exact certificate without proving maximum score`
- `optimized solver matches brute force across small feasible boards`

The last test compares the optimized solver against a simple brute-force reference solver on a small handcrafted board to validate memoization/pruning correctness.

## M5.1 Performance Optimization

M5.1 keeps the solver exact, but changes the production path from proving the maximum score first to supporting two explicit exact modes:

- `findGold`: stop as soon as a replayable legal certificate reaches `goldThreshold`.
- `maximizeScore`: continue until the maximum score is proven.

This matches the Daily Grid Generator requirement: Gold certification needs proof of at least one legal route to 100, not proof of the theoretical maximum.

### Profiling Findings

The dominant M5 costs were:

- Branching over many vocabulary variants that produced the same tile mask.
- Recomputing static move facts inside DFS.
- Scanning every raw move repeatedly for compatibility.
- Computing the optimistic bound by applying moves recursively enough to rebuild line state.

On the representative 8x6 grid in this report, the current repository produced these starting move counts:

```text
raw M4 moves: 14,373
unique tile-path masks: 2,949
unique (tile mask, static score) combinations: 5,085
unique ordered paths: 4,729
dominated/equivalent moves removed: 11,424
solver-relevant moves: 2,949
```

Earlier M4 notes listed 15,607 raw moves for a tutorial-style grid variant. Re-running against the grid shown in this document with the current repository gives 14,373 raw moves, so the measured M5.1 reduction is:

```text
14,373 raw moves -> 2,949 solver-relevant moves
```

### Optimizations Implemented

Move dominance/deduplication:

- Each M4 move is converted to a BigInt tile mask.
- Moves with the same mask produce the same unavailable-tile state and the same future row/column completion possibilities.
- For the same mask, only the move with the highest static score is searched.
- Lower-scoring same-mask moves are provably dominated because every future continuation is identical but starts from a lower score.
- Equal-scoring same-mask moves are equivalent for solver correctness; one certificate representative is retained.

Precomputed move fields:

- `mask`
- `tileIndexes`
- `touchedRows`
- `touchedCols`
- `hexalinkBonus`
- `staticScore`
- certificate metadata from M4

Compatibility indexing:

- The solver now caches compatible move lists by `usedMask`.
- This preserves the full legal move set because compatibility is still exactly `(move.mask & usedMask) === 0n`; the cache only avoids repeated scans for the same used-tile state.

Upper bound:

- Static score bound: sum of the top `remainingTurns` compatible move static scores, ignoring conflicts. This is an overestimate, so it is safe.
- Line bonus bound: enumerate all row/column subsets, remove already-completed lines, and only count a subset if its missing tiles are still available and fit within the remaining tile budget. This still ignores move-shape constraints, so it remains an overestimate.
- Pruning occurs only when the overestimate cannot reach the active target: Gold threshold for `findGold`, incumbent maximum for `maximizeScore`.

State dominance:

- State key remains `(turnsUsed, usedMask, completedRows, completedCols)`.
- If the same key is reached with a lower or equal cumulative score, that history is dominated and can be pruned.
- If a higher-scoring history reaches the same key, it is not discarded; cached future sequences are rebased so certificate `cumulativeScore` values remain correct.

### M5.1 API

```js
solveBoard(boardState, wordIndex, { mode: 'findGold' });
solveBoard(boardState, wordIndex, { mode: 'maximizeScore' });
```

Default mode remains `maximizeScore` for backward compatibility with the original M5 tests.

The solver also exports:

```js
MODE_FIND_GOLD
MODE_MAXIMIZE_SCORE
prepareSolverMoves
maxFutureLineBonusBound
```

### M5.1 Regression Results

Command:

```bash
node --test tests/*.test.js
```

Result:

```text
tests 41
pass 41
fail 0
duration_ms 552.76795
```

Additional M5.1 tests:

- Dominance keeps only the highest-scoring move for one tile mask and matches brute force.
- `findGold` returns a replayable exact certificate without proving maximum score.
- Optimized solver matches brute force across multiple small feasible boards.

Syntax check:

```bash
node --check tools/solver/state-search.js
```

Result: passed.

### Production Benchmark

Representative 8x6 grid:

```js
[
  ['S','T','R','N','G','H'],
  ['C','L','M','P','D','R'],
  ['B','R','S','T','L','N'],
  ['F','R','M','W','K','S'],
  ['P','L','N','T','R','C'],
  ['D','G','M','S','B','L'],
  ['H','R','V','N','F','T'],
  ['W','C','K','P','G','M']
]
```

Full Qjynn Vocabulary 1.0:

```text
indexed words: 41,814
```

`findGold`:

```text
raw starting moves: 14,373
solver-relevant moves: 2,949
states explored: 6
states pruned: 0
memo hits: 0
compatibility cache hits: 0
elapsed time: 247.93955 ms
score/certificate found: 100
Gold reachable: true
RSS before/after: 132.4 MB / 224.7 MB
```

Gold certificate:

```text
abilities   [[2,0],[1,1],[0,1],[0,0]]                 +20 => 20
abortions   [[5,4],[4,4],[4,3],[4,2],[5,3]]           +20 => 40
airframes   [[2,1],[3,0],[3,1],[3,2],[2,2]]           +20 => 60
airplanes   [[0,2],[1,3],[2,4],[2,5],[3,5]]           +20 => 80
caregiving  [[7,1],[6,1],[5,1],[6,2],[6,3],[7,4]]     +20 => 100
```

`maximizeScore`:

```text
raw starting moves: 14,373
solver-relevant moves: 2,949
maximum score: not completed
Gold reachable: already proven by findGold
elapsed time: stopped after > 5 minutes without completion
peak memory: not measured
```

`maximizeScore` remains exact, but dense full-vocabulary maximum proof is still not production-practical on this representative 8x6 grid. The production-critical exact Gold certification path is now practical.

## Handcrafted Gold Certificate

Board:

```js
{
  grid: [
    ['B', 'C'],
    ['D', 'F'],
    ['G', 'H'],
    ['J', 'K'],
    ['L', 'M']
  ],
  maxTurns: 6,
  goldThreshold: 100
}
```

Vocabulary:

```js
['bc', 'df', 'gh', 'jk', 'lm']
```

Returned certificate:

```json
[
  {
    "word": "bc",
    "consonantSkeleton": "bc",
    "path": [[0, 0], [0, 1]],
    "vowelPlacements": [],
    "baseScore": 2,
    "hexalinkBonus": 0,
    "rowBonus": 10,
    "columnBonus": 0,
    "scoreDelta": 12,
    "cumulativeScore": 12,
    "resultingUsedMask": "3"
  },
  {
    "word": "df",
    "consonantSkeleton": "df",
    "path": [[1, 0], [1, 1]],
    "vowelPlacements": [],
    "baseScore": 2,
    "hexalinkBonus": 0,
    "rowBonus": 10,
    "columnBonus": 0,
    "scoreDelta": 12,
    "cumulativeScore": 24,
    "resultingUsedMask": "15"
  },
  {
    "word": "gh",
    "consonantSkeleton": "gh",
    "path": [[2, 0], [2, 1]],
    "vowelPlacements": [],
    "baseScore": 2,
    "hexalinkBonus": 0,
    "rowBonus": 10,
    "columnBonus": 0,
    "scoreDelta": 12,
    "cumulativeScore": 36,
    "resultingUsedMask": "63"
  },
  {
    "word": "jk",
    "consonantSkeleton": "jk",
    "path": [[3, 0], [3, 1]],
    "vowelPlacements": [],
    "baseScore": 2,
    "hexalinkBonus": 0,
    "rowBonus": 10,
    "columnBonus": 0,
    "scoreDelta": 12,
    "cumulativeScore": 48,
    "resultingUsedMask": "255"
  },
  {
    "word": "lm",
    "consonantSkeleton": "lm",
    "path": [[4, 0], [4, 1]],
    "vowelPlacements": [],
    "baseScore": 2,
    "hexalinkBonus": 0,
    "rowBonus": 10,
    "columnBonus": 40,
    "scoreDelta": 52,
    "cumulativeScore": 100,
    "resultingUsedMask": "1023"
  }
]
```

Certificate replay verification:

```text
reported maxScore: 100
replayed score: 100
turns used: 5
final used mask: 1023
```

## Historical M5 Baseline

The original M5 implementation used the same representative grid:

```js
[
  ['S','T','R','N','G','H'],
  ['C','L','M','P','D','R'],
  ['B','R','S','T','L','N'],
  ['F','R','M','W','K','S'],
  ['P','L','N','T','R','C'],
  ['D','G','M','S','B','L'],
  ['H','R','V','N','F','T'],
  ['W','C','K','P','G','M']
]
```

Full Qjynn Vocabulary 1.0 baseline notes:

```text
indexed vocabulary size: 41,814
previously reported starting legal move count: 15,607
```

An original maximum-score exact solve attempt was still running after approximately 60 seconds and was interrupted for reporting. No unsafe heuristic was added to force completion.

Available representative result:

```text
states explored: unavailable, run interrupted
states pruned: unavailable, run interrupted
memoization hits: unavailable, run interrupted
maximum score found: unavailable, run interrupted before completion
Gold reachable: unavailable, run interrupted before completion
elapsed time: > 60 seconds before interruption
peak memory: not measured
```

This section is retained as the pre-M5.1 baseline. The current M5.1 benchmark is documented above; `findGold` now certifies Gold quickly on the measured 8x6 grid, while dense full-vocabulary `maximizeScore` remains impractical.

## Known Limitations And Ambiguities

- The solver assumes any non-OFF tile in `tileStates` is already unavailable before turn one.
- Hexalink bonus is derived from M4 `isHexalink`; there is no separate persisted `hexalinkAlreadyAwarded` input. Because a played Hexalink path consumes its tiles, the same exact path cannot score again in normal play.
- Exact `findGold` certification is production-practical on the representative grid measured in M5.1.
- Exact dense full-vocabulary `maximizeScore` still did not complete after more than five minutes. Further optimization should preserve exactness.
- Row and column completion semantics follow `qjynn-rules.js`: row bonus is 10, column bonus is 20, and each line pays once when newly completed.

## Git Diff Summary

`git status --short` at report time:

```text
?? M5_IMPLEMENTATION_REVIEW.md
?? tests/solver-state-search.test.js
?? tools/solver/state-search.js
```

`git diff --stat` at report time:

```text

```

The diff stat is empty because the M5 files are currently untracked and have not been staged.
