(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QjynnRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_CHAIN_LENGTH = 6;
  const MIN_WORD_LENGTH = 2;
  const MAX_WORD_LENGTH = 10;
  const MAX_TURNS = 6;
  const MEDAL_THRESHOLDS = { gold: 100, silver: 70, bronze: 40 };
  const CONSONANT_INVENTORY = Object.freeze({
    N: 4,
    R: 4,
    T: 4,
    L: 4,
    S: 4,
    D: 3,
    B: 2,
    C: 2,
    F: 2,
    G: 2,
    H: 2,
    M: 2,
    P: 2,
    V: 2,
    W: 2,
    Y: 2,
    J: 1,
    K: 1,
    Q: 1,
    X: 1,
    Z: 1
  });

  function areAdjacent(a, b) {
    return Math.abs(a.row - b.row) <= 1 &&
      Math.abs(a.col - b.col) <= 1 &&
      !(a.row === b.row && a.col === b.col);
  }

  function canAppendToChain(chain, pos, maxLength = MAX_CHAIN_LENGTH) {
    if (!pos || chain.length >= maxLength) return false;
    if (chain.some(p => p.row === pos.row && p.col === pos.col)) return false;
    if (chain.length === 0) return true;
    return areAdjacent(chain[chain.length - 1], pos);
  }

  function isValidWordLength(length) {
    return length >= MIN_WORD_LENGTH && length <= MAX_WORD_LENGTH;
  }

  function scoreWordByLength(length, isHexalink = false) {
    let wordScore = 0;
    let bonus = 0;
    if (length === 2 || length === 3) wordScore = length;
    else if (length >= 4 && length <= 6) wordScore = 2 * length;
    else if (length === 7 || length === 8) {
      wordScore = 10;
      bonus = 5;
    } else if (length === 9 || length === 10) {
      wordScore = 10;
      bonus = 10;
    }
    return wordScore + bonus + (isHexalink ? 10 : 0);
  }

  function countFullRows(grid, activeStates) {
    return grid.reduce((total, row) =>
      total + (row.every(tile => activeStates.includes(tile.state)) ? 1 : 0), 0);
  }

  function countFullColumns(grid, activeStates) {
    if (!grid.length) return 0;
    let full = 0;
    for (let c = 0; c < grid[0].length; c++) {
      let complete = true;
      for (let r = 0; r < grid.length; r++) {
        if (!activeStates.includes(grid[r][c].state)) {
          complete = false;
          break;
        }
      }
      if (complete) full++;
    }
    return full;
  }

  function rowColumnBonus(previousRows, previousColumns, nextRows, nextColumns) {
    return {
      completedRows: Math.max(0, nextRows - previousRows),
      completedColumns: Math.max(0, nextColumns - previousColumns),
      points: Math.max(0, nextRows - previousRows) * 10 +
        Math.max(0, nextColumns - previousColumns) * 20
    };
  }

  function nextTurn(turns, maxTurns = MAX_TURNS) {
    const next = turns + 1;
    return { turns: next, gameOver: next >= maxTurns };
  }

  function medalForScore(score) {
    if (score >= MEDAL_THRESHOLDS.gold) return 'gold';
    if (score >= MEDAL_THRESHOLDS.silver) return 'silver';
    if (score >= MEDAL_THRESHOLDS.bronze) return 'bronze';
    return 'none';
  }

  function normalizePath(path) {
    return Array.isArray(path) ? path.map(([row, col]) => ({ row, col })) : [];
  }

  function isExactHexalink(chain, grid, hexalink, hexarowcol) {
    if (!hexalink || !Array.isArray(chain) || chain.length !== MAX_CHAIN_LENGTH) return false;
    const target = normalizePath(hexarowcol);
    if (target.length !== MAX_CHAIN_LENGTH || hexalink.length !== MAX_CHAIN_LENGTH) return false;

    const matchesDirection = positions => chain.every((pos, i) => {
      const targetPos = positions[i];
      const tile = grid?.[pos.row]?.[pos.col];
      return targetPos &&
        pos.row === targetPos.row &&
        pos.col === targetPos.col &&
        tile &&
        String(tile.letter).toUpperCase() === hexalink[i].toUpperCase();
    });

    const reversedPath = target.slice().reverse();
    const reversedWord = hexalink.split('').reverse().join('');
    return matchesDirection(target) ||
      chain.every((pos, i) => {
        const targetPos = reversedPath[i];
        const tile = grid?.[pos.row]?.[pos.col];
        return targetPos &&
          pos.row === targetPos.row &&
          pos.col === targetPos.col &&
          tile &&
          String(tile.letter).toUpperCase() === reversedWord[i].toUpperCase();
      });
  }

  function hasPartialHexalinkOverlap(chain, hexarowcol) {
    const target = normalizePath(hexarowcol);
    if (!target.length) return false;
    return chain.some(pos => target.some(targetPos =>
      pos.row === targetPos.row && pos.col === targetPos.col));
  }

  return {
    MAX_CHAIN_LENGTH,
    MIN_WORD_LENGTH,
    MAX_WORD_LENGTH,
    MAX_TURNS,
    MEDAL_THRESHOLDS,
    CONSONANT_INVENTORY,
    areAdjacent,
    canAppendToChain,
    isValidWordLength,
    scoreWordByLength,
    countFullRows,
    countFullColumns,
    rowColumnBonus,
    nextTurn,
    medalForScore,
    isExactHexalink,
    hasPartialHexalinkOverlap
  };
});
