const test = require('node:test');
const assert = require('node:assert/strict');
const validator = require('../word-validator.js');

test('parses local vocabulary text into normalized words', () => {
  const words = validator.parseWordList('Apple\nbanana\n\nCARROT\r\n');
  assert.equal(words.has('apple'), true);
  assert.equal(words.has('banana'), true);
  assert.equal(words.has('carrot'), true);
  assert.equal(words.has(''), false);
});

test('validates words from injected vocabulary', async () => {
  assert.deepEqual(await validator.validateWord('Apple', { text: 'apple\npear\n' }), {
    valid: true,
    unavailable: false
  });
  assert.deepEqual(await validator.validateWord('orange', { text: 'apple\npear\n' }), {
    valid: false,
    unavailable: false
  });
});

test('vocabulary load errors are unavailable, not invalid words', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('network unavailable');
  };
  validator.resetVocabularyCache();
  const result = await validator.validateWord('apple', { reload: true, url: 'missing.txt' });
  global.fetch = originalFetch;
  assert.equal(result.valid, null);
  assert.equal(result.unavailable, true);
  assert.ok(result.error);
});
