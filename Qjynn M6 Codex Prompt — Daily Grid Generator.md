Implement **M6 only: Qjynn Daily Grid Generator**. Do not implement M7 yet.

M1–M5 are complete and approved. Use the existing canonical rules, Vocabulary 1.0, M4 move enumerator, and M5 exact `findGold` solver. Do not duplicate those components.

## Objective

Build a deterministic Daily Grid Generator that takes a valid Qjynn daily answer and clue and generates an 8×6 consonant grid that:

1. contains the correct six-letter Hexalink as a legal adjacent path;
2. satisfies all Qjynn structural rules;
3. is reproducible from a random seed;
4. can be independently validated;
5. is **provably Gold-capable**, meaning the M5 exact `findGold` solver finds at least one legal sequence of no more than 6 turns scoring **>=100**.

M6 should determine whether a grid is structurally valid and Gold-certifiable.

Do **not** attempt to decide whether the grid is enjoyable, appropriately difficult, vocabulary-friendly, or strategically balanced. Those are M7 responsibilities.

---

## 1. Input Model

The preferred editorial input is:

```json
{
  "answer": "WATERMELON",
  "clue": "Large summer striped fruit",
  "date": "2026-09-01",
  "seed": 123456
}
```

Validate that:

- `answer` contains exactly 10 ASCII letters;
- answer length is exactly 10;
- answer exists in `qjynn-words-v1.0.txt`;
- vowels are only A/E/I/O/U for Hexalink derivation purposes;
- the answer contains exactly 4 vowels;
- removing A/E/I/O/U produces exactly 6 consonants;
- the derived six-letter consonant skeleton becomes the Hexalink;
- clue is present and non-empty;
- date is valid if supplied;
- seed is accepted or generated explicitly.

Example:

```text
WATERMELON -> WTRMLN
```

Do not require the editor to supply Hexalink separately when it can be derived deterministically.

---

## 2. Generator Module

Create standalone generator modules under:

```text
tools/generator/
```

Suggested files:

```text
tools/generator/
  grid-generator.js
  puzzle-validator.js
  generate-puzzle.js
```

Do not put generation logic in `game.js`.

Expose an API conceptually like:

```javascript
generatePuzzle({
  answer,
  clue,
  date,
  seed,
  maxAttempts
}, wordIndex, options)
```

Return either a certified puzzle or a structured failure.

Example success shape:

```javascript
{
  puzzle: {
    schema_version: 1,
    date: "2026-09-01",
    clue: "Large summer striped fruit",
    grid: [...],
    hexalink: "WTRMLN",
    hexarowcol: [
      [5,0],
      [6,1],
      [5,2],
      [4,3],
      [4,4],
      [3,5]
    ]
  },

  privateMetadata: {
    answer: "WATERMELON",
    seed: 123456,
    attempt: 27,
    goldCertified: true,
    goldScore: 104,
    goldCertificate: [...],
    rulesVersion: "...",
    vocabularyVersion: "1.0"
  }
}
```

The public puzzle object must not contain the 10-letter answer or Gold solution.

---

## 3. Deterministic Seeded Randomness

Generation must be reproducible.

Given identical:

```text
answer
clue
seed
rules version
vocabulary version
generator configuration
```

the generator must produce the same candidate sequence and same final puzzle.

Do not use `Math.random()` directly unless wrapped in a deterministic seeded PRNG.

Implement or use a small deterministic PRNG suitable for reproducible puzzle generation.

Add tests proving reproducibility.

---

## 4. Hexalink Path Generation

Generate a six-cell path satisfying:

- exactly 6 distinct grid coordinates;
- each consecutive coordinate is adjacent horizontally, vertically, or diagonally;
- no coordinate is reused;
- all coordinates are within the 8×6 board;
- Hexalink letters appear in the exact path order;
- reverse traversal also corresponds correctly to the Hexalink under the canonical Qjynn rules.

Avoid hardcoding paths.

Support varied geometries rather than always generating a straight left-to-right chain.

However, do not implement M7 Hexalink-difficulty scoring yet.

The generated path must pass the canonical `isExactHexalink()` logic from `qjynn-rules.js`.

---

## 5. Grid Filling

After placing the six Hexalink consonants, fill the remaining 42 cells using an explicit consonant-distribution policy.

For M6, use a simple defensible policy.

Prefer reusing the established Qjynn consonant distribution if it is already defined in the repository.

If there is an existing authoritative tile distribution, use it.

If the generator must derive the remaining letters from counts, preserve the intended full-board letter inventory as closely as possible after the Hexalink letters have been placed.

Important:

- all 48 grid cells must contain valid consonants;
- do not place A/E/I/O/U in the main grid;
- do not silently change Qjynn's established consonant distribution;
- if the required Hexalink consumes more occurrences of a consonant than the baseline distribution permits, return a structured generation error rather than inventing a new distribution.

Document exactly how the fill distribution is calculated.

---

## 6. Structural Puzzle Validation

Create a reusable `validatePuzzle()` function.

It must verify at minimum:

- 8 rows;
- exactly 6 columns in every row;
- exactly 48 cells;
- every grid entry is a valid consonant;
- valid Hexalink string of length 6;
- exactly 6 `hexarowcol` coordinates;
- coordinates are unique;
- coordinates are in bounds;
- every consecutive Hexalink coordinate is adjacent;
- letters at those coordinates reconstruct the Hexalink exactly;
- canonical exact-Hexalink validation succeeds;
- input answer reconstructs correctly from Hexalink + its vowel placements;
- answer is valid in Vocabulary 1.0;
- public puzzle does not expose private answer/certificate fields.

Return explicit validation errors rather than a boolean-only failure.

---

## 7. Gold Certification

Every candidate grid that passes structural validation must be passed to the approved M5 solver in:

```javascript
mode: "findGold"
```

Use the exact M5 solver. Do not implement a second Gold-checking algorithm inside M6.

A candidate passes M6 only if:

```text
goldReachable === true
```

and the returned certificate independently replays to:

```text
score >= 100
turnsUsed <= 6
```

Use `replaySequence()` to verify the solver certificate before accepting the board.

If replay does not exactly reproduce the certificate score, reject the candidate and treat that as an internal error.

---

## 8. Candidate Regeneration Loop

Generation should work approximately as:

```text
validate answer
      |
derive Hexalink
      |
generate Hexalink path
      |
fill remaining consonants
      |
validate structure
      |
run findGold
      |
  +---+---+
  |       |
 no      yes
  |       |
retry    replay certificate
          |
       valid?
        /   \
      no     yes
      |       |
    error    PASS
```

Support configurable:

```javascript
maxAttempts
```

For example:

```javascript
maxAttempts: 1000
```

If no Gold-capable grid is found within the limit, return a structured failure containing:

- answer;
- Hexalink;
- seed;
- attempts made;
- number structurally valid;
- number Gold-certified;
- solver timing summary;
- reason for failure.

Do not loop indefinitely.

---

## 9. Generator Performance Statistics

Track at least:

```javascript
{
  attempts,
  structurallyValidCandidates,
  goldCertifiedCandidates,
  solverCalls,
  totalSolverMs,
  averageSolverMs,
  generationMs
}
```

Also record the accepted candidate's:

- raw M4 move count if readily available;
- M5 solver-relevant move count if readily available;
- Gold score;
- turns used.

This information will be useful for M7 and later production monitoring.

---

## 10. Private Certification Record

For every accepted puzzle, create a private certification structure containing:

```javascript
{
  schemaVersion,
  generatorVersion,
  rulesVersion,
  vocabularyVersion,
  answer,
  clue,
  date,
  seed,
  attemptNumber,
  hexalink,
  hexarowcol,
  goldScore,
  goldTurns,
  goldCertificate,
  certificateReplayResult,
  generationStats
}
```

This data must remain separate from the public puzzle JSON.

The purpose is reproducibility, debugging, fairness verification, and future generator calibration.

---

## 11. Output Files

Support writing:

```text
puzzles/public/YYYY-MM-DD.json
puzzles/private/certificates/YYYY-MM-DD.json
```

The public file should contain only gameplay data.

The private certificate may contain:

- answer;
- Gold solution;
- seed;
- statistics;
- generator metadata.

Do not make `game.js` depend on the private file.

---

## 12. Command-Line Interface

Provide a small CLI such as:

```bash
node tools/generator/generate-puzzle.js \
  --answer WATERMELON \
  --clue "Large summer striped fruit" \
  --date 2026-09-01 \
  --seed 123456
```

Support at minimum:

```text
--answer
--clue
--date
--seed
--max-attempts
--output-dir
```

Print a concise result such as:

```text
Qjynn puzzle generated

Answer:          WATERMELON
Hexalink:        WTRMLN
Seed:            123456
Attempts:        27
Gold certified:  yes
Gold score:      104
Gold turns:      6

Public:
puzzles/public/2026-09-01.json

Private:
puzzles/private/certificates/2026-09-01.json
```

Do not print the Gold certificate unless a verbose/debug option is explicitly requested.

---

## 13. Tests

Create thorough M6 automated tests.

At minimum test:

1. valid 10-letter / four-vowel answer is accepted;
2. invalid answer length is rejected;
3. answer with wrong vowel/consonant count is rejected;
4. answer not in Qjynn Vocabulary 1.0 is rejected;
5. Hexalink derivation is exact;
6. generated Hexalink path has six unique adjacent cells;
7. Hexalink letters match path coordinates;
8. reverse exact Hexalink remains valid under canonical rules;
9. all 48 grid cells are valid consonants;
10. board dimensions are always exactly 8×6;
11. seeded generation is deterministic;
12. different seeds can generate different candidate boards;
13. structural validator rejects malformed grids;
14. structural validator rejects duplicate Hexalink coordinates;
15. structural validator rejects nonadjacent Hexalink coordinates;
16. structural validator rejects incorrect Hexalink letters;
17. generated candidate rejected when `findGold` says false;
18. generated candidate accepted only when `findGold` says true;
19. accepted Gold certificate replays exactly;
20. accepted certificate score is >=100;
21. accepted certificate uses <=6 turns;
22. generator respects `maxAttempts`;
23. failure after `maxAttempts` is structured and non-destructive;
24. public output does not contain answer or certificate;
25. private certificate contains reproducibility metadata;
26. full generation with a known test answer produces a certified puzzle.

All existing M1–M5 tests must continue to pass.

---

## 14. Important Scope Boundary

Do **not** implement M7 puzzle-quality scoring.

Specifically, do not yet reject grids because of:

- obscure words in the Gold route;
- number of Gold routes;
- Gold difficulty;
- maximum theoretical score;
- strategic diversity;
- excessive short words;
- Hexalink visual obviousness;
- vocabulary familiarity;
- estimated human difficulty.

M6 answers only:

> Is this a structurally valid Qjynn puzzle containing the intended Hexalink, and is Gold mathematically attainable under the exact game rules?

M7 will answer:

> Is this a good daily Qjynn puzzle for humans?

Keep these responsibilities separate.

---

## 15. Performance Benchmark

Run M6 with at least several representative valid 10-letter/four-vowel answers.

For each report:

- answer;
- derived Hexalink;
- seed;
- candidates attempted;
- structurally valid candidates;
- Gold solver calls;
- average `findGold` time;
- total generation time;
- Gold score;
- Gold turns.

Also perform a small deterministic batch, for example 10 valid test answers if readily available, and report:

```text
success count
failure count
mean attempts
median attempts
max attempts
mean generation time
```

Do not weaken correctness to improve benchmark numbers.

---

## 16. Required Review Document

Create:

```text
M6_IMPLEMENTATION_REVIEW.md
```

Include:

1. files created/modified;
2. public generator API;
3. input validation;
4. Hexalink derivation;
5. path-generation algorithm;
6. grid-fill algorithm and consonant-distribution policy;
7. deterministic PRNG approach;
8. structural validation;
9. integration with M5 `findGold`;
10. Gold certificate replay verification;
11. regeneration-loop behavior;
12. public/private output format;
13. CLI usage;
14. complete test names and results;
15. example generated puzzle;
16. example private Gold certificate;
17. single-puzzle performance;
18. batch-generation performance;
19. known limitations/ambiguities;
20. `git status --short`;
21. `git diff --stat`.

Do not start M7.

Stop after producing `M6_IMPLEMENTATION_REVIEW.md` for review.