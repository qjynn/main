# Repository Guidelines

## Project Structure & Module Organization

This repository contains a small browser game implementation:

- `game.js` holds the Qjynn canvas game logic, UI state, scoring, sharing, tutorial flow, and local storage behavior.
- `qjynn-words-v1.0.txt` is the word-list data source. Treat it as data; avoid reformatting it unless the format intentionally changes.
- `Qjynn_Product_Architecture_and_Codex_Implementation_Guide.docx` contains product and architecture notes. Review it before larger feature or UX changes.

The code references runtime assets such as medal and share SVGs. Keep static assets near the game entry files and use clear lowercase names such as `share_active.svg`.

## Build, Test, and Development Commands

There is no package manifest or build system in this directory. Useful checks are:

- `node --check game.js` verifies JavaScript syntax without executing browser-only code.
- `python3 -m http.server 8000` serves the directory if an HTML entry point and assets are present.
- `rg "function|const|let" game.js` helps locate existing code patterns before editing.

If `package.json` is added, document the canonical `npm run dev`, `npm test`, and `npm run build` commands here.

## Coding Style & Naming Conventions

Use plain JavaScript consistent with `game.js`: `const` for fixed values, `let` for mutable state, uppercase names for constants such as `COLORS` and `TILE_STATES`, and camelCase for functions and variables. Keep indentation at two spaces. Prefer small helpers around complex canvas or state logic, and avoid broad rewrites.

## Testing Guidelines

No automated test framework is configured. At minimum, run `node --check game.js` after JavaScript edits. For gameplay changes, manually verify core flows in a browser: starting a puzzle, dragging/selecting letters, checking a word, using hints, tutorial behavior, reset behavior, medal display, and share output. When tests are introduced, place them in `tests/` or `__tests__/` and name files after the behavior, for example `scoring.test.js`.

## Commit & Pull Request Guidelines

This directory does not expose Git history, so no existing commit convention can be inferred. Use concise imperative commits such as `Fix tutorial hint state` or `Add share result persistence`. Pull requests should include a summary, manual test notes, linked issues when applicable, and screenshots or recordings for visible UI changes.

## Agent-Specific Instructions

Before editing, check whether generated or guidance files already exist and preserve them unless explicitly asked to replace them. Keep changes scoped, especially in `game.js`, which contains shared global state for many features.
