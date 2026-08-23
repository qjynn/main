# Qjynn M1-M3 Implementation Notes

## Overview

This document summarizes the M1-M3 implementation completed for Qjynn. The work focused on stabilizing core rules, adding characterization tests, replacing external dictionary validation with the local Qjynn vocabulary, and correcting Hexalink detection.

## M1: Characterization Tests

Tests were added using Node's built-in test runner:

- `tests/qjynn-rules.test.js`
- `tests/word-validator.test.js`

Coverage includes:

- adjacency and chain length limits
- word length limits from 2 to 10 letters
- scoring tiers and Hexalink bonus
- row and column bonus calculation
- six-turn game-over accounting
- medal thresholds
- exact Hexalink path matching, including reverse direction
- vocabulary parsing, validation, and load-error behavior

Run tests with:

```bash
node --test tests/*.test.js
```

## M2: Pure Rule Extraction

Core gameplay rules were extracted into `qjynn-rules.js`, a browser/Node-compatible module. It exposes pure helper functions for:

- chain adjacency and append validation
- word length validation
- word scoring
- full row and full column counting
- row/column bonus calculation
- turn accounting
- medal threshold selection
- exact Hexalink detection
- partial Hexalink overlap detection

`game.js` now uses these helpers for chain rules, scoring, line bonuses, medal selection, and Hexalink detection while preserving the existing rendering and UI flow.

## M3: Local Vocabulary Validation

`word-validator.js` was added to load and cache `qjynn-words-v1.0.txt`. Word validation now uses the local vocabulary instead of `dictionaryapi.dev`.

Important behavior:

- the word list is loaded once and cached
- words are normalized to lowercase
- missing or unloadable vocabulary is reported as unavailable
- vocabulary load failure does not consume a turn and is not treated as an invalid word

In that failure case, the player sees:

```text
Word list unavailable. Try again.
```

## Hexalink Behavior Change

Hexalink detection now requires:

- exactly six chain tiles
- exact `hexarowcol` coordinates
- exact `hexalink` letters
- either forward or reverse direction

Partial overlap with Hexalink coordinates can still show the existing warning toast, but it no longer sets `hexalinkUsed` or disables the Hint path.

## Files Changed

- `game.js`
- `qjynn-rules.js`
- `word-validator.js`
- `tests/qjynn-rules.test.js`
- `tests/word-validator.test.js`

## Verification

The following checks were run successfully:

```bash
node --test tests/*.test.js
node --check game.js
node --check qjynn-rules.js
node --check word-validator.js
```

Result: all 9 tests passed.
