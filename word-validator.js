(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QjynnWordValidator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_VOCABULARY_URL = 'qjynn-words-v1.0.txt';
  let vocabularyPromise = null;

  function parseWordList(text) {
    const words = new Set();
    String(text).split(/\r?\n/).forEach(line => {
      const word = line.trim().toLowerCase();
      if (word) words.add(word);
    });
    return words;
  }

  async function loadVocabulary(options = {}) {
    if (options.words instanceof Set) return options.words;
    if (Array.isArray(options.words)) return new Set(options.words.map(w => String(w).toLowerCase()));
    if (typeof options.text === 'string') return parseWordList(options.text);

    if (!vocabularyPromise || options.reload) {
      const url = options.url || DEFAULT_VOCABULARY_URL;
      vocabularyPromise = fetch(url).then(response => {
        if (!response.ok) throw new Error(`Unable to load vocabulary: ${response.status}`);
        return response.text();
      }).then(parseWordList);
    }
    return vocabularyPromise;
  }

  async function validateWord(word, options = {}) {
    try {
      const vocabulary = await loadVocabulary(options);
      return {
        valid: vocabulary.has(String(word).toLowerCase()),
        unavailable: false
      };
    } catch (error) {
      return {
        valid: null,
        unavailable: true,
        error
      };
    }
  }

  function resetVocabularyCache() {
    vocabularyPromise = null;
  }

  return {
    DEFAULT_VOCABULARY_URL,
    parseWordList,
    loadVocabulary,
    validateWord,
    resetVocabularyCache
  };
});
