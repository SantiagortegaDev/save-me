import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractUrl, hostname, normalizeUrl, resolveUrl } from '../src/lib/url';

test('extractUrl finds the first link in shared text', () => {
  assert.equal(extractUrl('Look at this! https://example.com/a?b=1 so good'), 'https://example.com/a?b=1');
  assert.equal(extractUrl('(see https://x.com/post/1).'), 'https://x.com/post/1');
  assert.equal(extractUrl('no link here'), null);
  assert.equal(extractUrl(null), null);
});

test('normalizeUrl adds a scheme and rejects junk', () => {
  assert.equal(normalizeUrl('example.com/page'), 'https://example.com/page');
  assert.equal(normalizeUrl('  http://example.com  '), 'http://example.com/');
  assert.equal(normalizeUrl('ftp://example.com'), null);
  assert.equal(normalizeUrl('hello'), null);
  assert.equal(normalizeUrl(''), null);
});

test('hostname strips www', () => {
  assert.equal(hostname('https://www.youtube.com/watch?v=1'), 'youtube.com');
});

test('resolveUrl handles relative paths', () => {
  assert.equal(resolveUrl('/img.png', 'https://a.com/b/c'), 'https://a.com/img.png');
  assert.equal(resolveUrl(null, 'https://a.com'), null);
});

test('normalizeUrl strips share-sheet tracking parameters', () => {
  assert.equal(normalizeUrl('https://www.instagram.com/reel/C1abc/?igsh=MTc4MmM1YmI2Ng=='), 'https://www.instagram.com/reel/C1abc/');
  assert.equal(normalizeUrl('https://youtu.be/dQw4w9WgXcQ?si=AbC123&t=42'), 'https://youtu.be/dQw4w9WgXcQ?t=42');
  assert.equal(normalizeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(normalizeUrl('https://x.com/user/status/1?s=20&t=abc'), 'https://x.com/user/status/1');
  assert.equal(normalizeUrl('https://example.com/a?utm_source=x&id=7&fbclid=1'), 'https://example.com/a?id=7');
  // Parameters that matter on other sites stay.
  assert.equal(normalizeUrl('https://example.com/search?s=bread&t=1'), 'https://example.com/search?s=bread&t=1');
  assert.equal(normalizeUrl('https://www.tiktok.com/@a/video/1?_r=1&_t=8abc&lang=es'), 'https://www.tiktok.com/@a/video/1?lang=es');
});

test('likeTerms splits words, drops tag hashes and escapes wildcards', async () => {
  const { likeTerms, escapeLike } = await import('../src/lib/searchTerms');
  assert.deepEqual(likeTerms('  pan  Receta pan '), ['%pan%', '%receta%']);
  assert.deepEqual(likeTerms('#recipes 100%'), ['%recipes%', '%100\\%%']);
  assert.equal(escapeLike('a_b\\c'), 'a\\_b\\\\c');
  assert.deepEqual(likeTerms('   '), []);
});

test('search folds accents on both sides', async () => {
  const { foldAccents, foldSql, likeTerms } = await import('../src/lib/searchTerms');
  assert.equal(foldAccents('Canción AÑO Über'), 'cancion ano uber');
  assert.deepEqual(likeTerms('Canción'), ['%cancion%']);
  assert.ok(foldSql('x').includes("replace(x, 'á', 'a')"));
});
