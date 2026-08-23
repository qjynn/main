const qjynnRules = require('../../qjynn-rules.js');
const {
  VOWELS,
  consonantSkeleton,
  reconstructWord,
  insertedVowelsForWord,
  normalizeWord
} = require('../solver/word-index.js');

const ROWS = 8;
const COLS = 6;
const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
const CONSONANT_SET = new Set(CONSONANTS);

function normalizeAnswer(answer) {
  return normalizeWord(answer);
}

function isValidDate(value) {
  if (value === undefined || value === null || value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function wordExistsInIndex(answer, wordIndex) {
  const normalized = normalizeAnswer(answer).toLowerCase();
  return Boolean(wordIndex?.entries?.some(entry => entry.word === normalized));
}

function validateEditorialInput(input, wordIndex) {
  const errors = [];
  const answer = normalizeAnswer(input?.answer);
  const clue = String(input?.clue || '').trim();

  if (!/^[A-Z]+$/.test(answer)) errors.push({ code: 'answer.invalidCharacters', message: 'Answer must contain only ASCII letters.' });
  if (answer.length !== 10) errors.push({ code: 'answer.invalidLength', message: 'Answer must contain exactly 10 letters.' });
  if (!clue) errors.push({ code: 'clue.required', message: 'Clue is required.' });
  if (!isValidDate(input?.date)) errors.push({ code: 'date.invalid', message: 'Date must be a valid YYYY-MM-DD value.' });
  if (wordIndex && answer && !wordExistsInIndex(answer, wordIndex)) {
    errors.push({ code: 'answer.notInVocabulary', message: 'Answer is not in Qjynn Vocabulary 1.0.' });
  }

  const letters = answer.split('');
  const vowelCount = letters.filter(letter => VOWELS.has(letter)).length;
  const skeleton = consonantSkeleton(answer);
  if (answer.length === 10 && vowelCount !== 4) {
    errors.push({ code: 'answer.wrongVowelCount', message: 'Answer must contain exactly four A/E/I/O/U vowels.' });
  }
  if (answer.length === 10 && skeleton.length !== 6) {
    errors.push({ code: 'answer.wrongConsonantCount', message: 'Answer must produce exactly six consonants.' });
  }

  return {
    ok: errors.length === 0,
    errors,
    answer,
    clue,
    hexalink: skeleton,
    vowelPlacements: insertedVowelsForWord(answer).map(run => ({
      index: run.index,
      letters: run.letters.toLowerCase()
    }))
  };
}

function normalizeGridCell(cell) {
  return String(cell?.letter || cell || '').toUpperCase();
}

function gridForRules(grid) {
  return grid.map(row => row.map(cell => ({ letter: normalizeGridCell(cell), state: 0 })));
}

function validatePuzzle(puzzle, options = {}) {
  const errors = [];
  const answer = options.answer ? normalizeAnswer(options.answer) : '';
  const wordIndex = options.wordIndex;
  const grid = puzzle?.grid;
  const hexalink = String(puzzle?.hexalink || '').toUpperCase();
  const hexarowcol = puzzle?.hexarowcol;

  if (!puzzle || typeof puzzle !== 'object') {
    return { ok: false, errors: [{ code: 'puzzle.required', message: 'Puzzle object is required.' }] };
  }

  for (const field of ['answer', 'goldCertificate', 'privateMetadata', 'certificateReplayResult']) {
    if (Object.prototype.hasOwnProperty.call(puzzle, field)) {
      errors.push({ code: 'public.privateField', message: `Public puzzle must not contain ${field}.` });
    }
  }

  if (!Array.isArray(grid) || grid.length !== ROWS) {
    errors.push({ code: 'grid.rows', message: 'Grid must contain exactly 8 rows.' });
  } else {
    for (let row = 0; row < ROWS; row++) {
      if (!Array.isArray(grid[row]) || grid[row].length !== COLS) {
        errors.push({ code: 'grid.columns', message: `Grid row ${row} must contain exactly 6 cells.` });
        continue;
      }
      for (let col = 0; col < COLS; col++) {
        const letter = normalizeGridCell(grid[row][col]);
        if (!CONSONANT_SET.has(letter)) {
          errors.push({ code: 'grid.invalidConsonant', message: `Grid cell (${row},${col}) must be a consonant.` });
        }
      }
    }
  }

  if (!/^[A-Z]{6}$/.test(hexalink) || hexalink.split('').some(letter => !CONSONANT_SET.has(letter))) {
    errors.push({ code: 'hexalink.invalid', message: 'Hexalink must contain exactly six consonants.' });
  }

  if (!Array.isArray(hexarowcol) || hexarowcol.length !== 6) {
    errors.push({ code: 'hexarowcol.length', message: 'Hexalink path must contain exactly six coordinates.' });
  } else {
    const seen = new Set();
    for (let index = 0; index < hexarowcol.length; index++) {
      const pair = hexarowcol[index];
      const row = pair?.[0];
      const col = pair?.[1];
      const key = `${row},${col}`;
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= ROWS || col < 0 || col >= COLS) {
        errors.push({ code: 'hexarowcol.bounds', message: `Hexalink coordinate ${index} is out of bounds.` });
        continue;
      }
      if (seen.has(key)) errors.push({ code: 'hexarowcol.duplicate', message: `Hexalink coordinate ${index} is duplicated.` });
      seen.add(key);
      if (index > 0) {
        const [prevRow, prevCol] = hexarowcol[index - 1];
        if (!qjynnRules.areAdjacent({ row: prevRow, col: prevCol }, { row, col })) {
          errors.push({ code: 'hexarowcol.nonAdjacent', message: `Hexalink coordinate ${index} is not adjacent to the previous coordinate.` });
        }
      }
    }
  }

  if (Array.isArray(grid) && grid.length === ROWS && Array.isArray(hexarowcol) && hexarowcol.length === 6) {
    const pathLetters = hexarowcol.map(([row, col]) => normalizeGridCell(grid?.[row]?.[col])).join('');
    if (pathLetters !== hexalink) {
      errors.push({ code: 'hexalink.lettersMismatch', message: 'Letters at Hexalink coordinates do not reconstruct the Hexalink.' });
    }
    const chain = hexarowcol.map(([row, col]) => ({ row, col }));
    const exactForward = qjynnRules.isExactHexalink(chain, gridForRules(grid), hexalink, hexarowcol);
    const exactReverse = qjynnRules.isExactHexalink(chain.slice().reverse(), gridForRules(grid), hexalink, hexarowcol);
    if (!exactForward) errors.push({ code: 'hexalink.canonicalForward', message: 'Canonical exact-Hexalink validation failed.' });
    if (!exactReverse) errors.push({ code: 'hexalink.canonicalReverse', message: 'Canonical reverse exact-Hexalink validation failed.' });
  }

  if (answer) {
    const expectedHexalink = consonantSkeleton(answer);
    if (expectedHexalink !== hexalink) {
      errors.push({ code: 'answer.hexalinkMismatch', message: 'Answer does not derive the public Hexalink.' });
    }
    const reconstructed = reconstructWord(hexalink, insertedVowelsForWord(answer));
    if (reconstructed !== answer) {
      errors.push({ code: 'answer.reconstructionFailed', message: 'Answer does not reconstruct from Hexalink and vowel placements.' });
    }
    if (wordIndex && !wordExistsInIndex(answer, wordIndex)) {
      errors.push({ code: 'answer.notInVocabulary', message: 'Answer is not in Qjynn Vocabulary 1.0.' });
    }
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  ROWS,
  COLS,
  CONSONANTS,
  CONSONANT_SET,
  normalizeAnswer,
  isValidDate,
  wordExistsInIndex,
  validateEditorialInput,
  validatePuzzle,
  gridForRules
};
