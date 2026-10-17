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
