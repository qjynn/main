const qjynnRules = require('../../qjynn-rules.js');
const {
  MAX_SKELETON_LENGTH,
  buildVocabularyIndex
} = require('./word-index.js');

const OFF_STATE = 0;

function normalizeLetter(cell) {
  return String(cell?.letter || cell?.l || cell || '').trim().toUpperCase();
}

function isTileAvailable(cell) {
  if (!cell) return false;
  return cell.state === undefined || cell.state === OFF_STATE || cell.state === 'OFF';
}

function tileStateAt(tileStates, row, col, colCount, cell) {
  if (Array.isArray(tileStates)) {
    if (Array.isArray(tileStates[row])) return tileStates[row][col];
    return tileStates[row * colCount + col];
  }
  if (tileStates && typeof tileStates === 'object') {
    return tileStates[`${row},${col}`];
  }
  return cell?.state;
}

function normalizeBoard(board, tileStates) {
  if (!Array.isArray(board) || board.length === 0) {
    throw new Error('Board must be a non-empty row array');
  }

  const colCount = Array.isArray(board[0]) ? board[0].length : 0;

  return board.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length === 0) {
      throw new Error(`Board row ${rowIndex} must be a non-empty array`);
    }

    return row.map((cell, colIndex) => {
      const letter = normalizeLetter(cell);
      if (!/^[A-Z]$/.test(letter)) {
        throw new Error(`Board cell (${rowIndex},${colIndex}) must contain one letter`);
      }
      return {
        row: rowIndex,
        col: colIndex,
        letter,
        state: tileStateAt(tileStates, rowIndex, colIndex, colCount, cell)
      };
    });
  });
}

function neighborsOf(pos, rowCount, colCount) {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const row = pos.row + dr;
      const col = pos.col + dc;
      if (row >= 0 && row < rowCount && col >= 0 && col < colCount) {
        neighbors.push({ row, col });
      }
    }
  }
  return neighbors;
}

function pathKey(path) {
  return path.map(pos => `${pos.row},${pos.col}`).join('|');
}

function moveKey(word, path) {
  return `${word}:${pathKey(path)}`;
}

function makeGridForRules(board) {
  return board.map(row => row.map(cell => ({ letter: cell.letter, state: cell.state })));
}

function flattenInsertedVowels(vowelPlacements) {
  return vowelPlacements.flatMap(run => run.letters.toLowerCase().split(''));
}

function normalizePathForOutput(path) {
  return path.map(pos => [pos.row, pos.col]);
}

function enumerateLegalMoves(boardState, vocabularyOrIndex, options = {}) {
  const board = normalizeBoard(boardState.grid, boardState.tileStates);
  const rowCount = board.length;
  const colCount = board[0].length;
  const index = vocabularyOrIndex?.bySkeleton
    ? vocabularyOrIndex
    : buildVocabularyIndex(vocabularyOrIndex || [], options.indexOptions);
  const maxChainLength = options.maxChainLength || MAX_SKELETON_LENGTH;
  const hexalink = String(boardState.hexalink || options.hexalink || '').toUpperCase();
  const hexarowcol = boardState.hexarowcol || options.hexarowcol || [];
  const rulesGrid = makeGridForRules(board);
  const moves = [];
  const seen = new Set();

  function emitMovesForSkeleton(skeleton, path) {
    const entries = index.bySkeleton.get(skeleton);
    if (!entries) return;

    for (const entry of entries) {
      const key = moveKey(entry.word, path);
      if (seen.has(key)) continue;
      seen.add(key);

      const isExactHexalink = qjynnRules.isExactHexalink(path, rulesGrid, hexalink, hexarowcol);
      const vowelPlacements = entry.vowelPlacements.map(run => ({ ...run }));
      moves.push({
        word: entry.word,
        consonantSkeleton: entry.consonantSkeleton,
        path: normalizePathForOutput(path),
        insertedVowels: flattenInsertedVowels(vowelPlacements),
        vowelPlacements,
        baseScore: qjynnRules.scoreWordByLength(entry.length, false),
        isHexalink: isExactHexalink
      });
    }
  }

  function visit(path, used, skeleton) {
    emitMovesForSkeleton(skeleton, path);

    if (path.length >= maxChainLength) return;
    const last = path[path.length - 1];
    for (const next of neighborsOf(last, rowCount, colCount)) {
      const key = `${next.row},${next.col}`;
      if (used.has(key)) continue;

      const cell = board[next.row][next.col];
      if (!isTileAvailable(cell)) continue;

      const nextSkeleton = skeleton + cell.letter;
      if (!index.skeletonPrefixes.has(nextSkeleton)) continue;

      used.add(key);
      path.push({ row: next.row, col: next.col });
      visit(path, used, nextSkeleton);
      path.pop();
      used.delete(key);
    }
  }

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const cell = board[row][col];
      if (!isTileAvailable(cell)) continue;
      const skeleton = cell.letter;
      if (!index.skeletonPrefixes.has(skeleton)) continue;
      const used = new Set([`${row},${col}`]);
      visit([{ row, col }], used, skeleton);
    }
  }

  moves.sort((a, b) =>
    a.word.localeCompare(b.word) ||
    JSON.stringify(a.path).localeCompare(JSON.stringify(b.path)));

  return moves;
}

module.exports = {
  OFF_STATE,
  normalizeBoard,
  tileStateAt,
  isTileAvailable,
  neighborsOf,
  enumerateLegalMoves
};
