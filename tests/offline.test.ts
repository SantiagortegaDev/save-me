import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractArticle, parseBlocks, readingMinutes, serializeBlocks } from '../src/lib/readability';
import { compareVersions, parseRelease, shortNotes } from '../src/lib/updateCheck';

const para = (n: number) => `<p>${'This is a sentence of real article content that should be kept. '.repeat(n)}</p>`;

test('extractArticle keeps the article body and drops site chrome', () => {
  const html = `<html><body>
    <nav><p>Home About Contact and many more navigation links here</p></nav>
    <header><h1>Site name</h1></header>
    <article>
      <h1>How to bake bread</h1>
      ${para(3)}
      <h2>Ingredients</h2>
      <ul><li>Five hundred grams of strong flour</li><li>tiny</li></ul>
      <blockquote>Patience is the most important ingredient of all.</blockquote>
      ${para(4)}
      <p>Subscribe to our newsletter</p>
      <script>var x = '<p>not content at all, just code inside a script tag</p>';</script>
    </article>
    <footer><p>All rights reserved, copyright the example company</p></footer>
  </body></html>`;
  const blocks = extractArticle(html);
  assert.deepEqual(blocks[0], { type: 'h', text: 'How to bake bread' });
  assert.ok(blocks.some((b) => b.type === 'li' && b.text.startsWith('Five hundred')));
  assert.ok(!blocks.some((b) => b.text === 'tiny'));
  assert.ok(blocks.some((b) => b.type === 'quote'));
  assert.ok(!blocks.some((b) => /Subscribe|rights reserved|not content|Site name/.test(b.text)));
});

test('extractArticle returns nothing for pages without enough text', () => {
  assert.deepEqual(extractArticle('<html><body><p>Too short to be an article but long enough line.</p></body></html>'), []);
});

test('blocks survive serialize and parse', () => {
  const blocks = [
    { type: 'h' as const, text: 'Title' },
    { type: 'p' as const, text: 'Body text.' },
    { type: 'quote' as const, text: 'A quote' },
    { type: 'li' as const, text: 'An item' },
  ];
  assert.deepEqual(parseBlocks(serializeBlocks(blocks)), blocks);
  assert.equal(readingMinutes('word '.repeat(460)), 2);
  assert.equal(readingMinutes('short'), 1);
});

test('compareVersions orders semantic versions', () => {
  assert.equal(compareVersions('1.2.0', '1.1.9'), 1);
  assert.equal(compareVersions('v1.10.0', '1.9.0'), 1);
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
  assert.equal(compareVersions('1.2.0', '2.0.0'), -1);
});

test('parseRelease finds the APK and skips prereleases', () => {
  const release = parseRelease({
    tag_name: 'v1.3.0',
    body: '## What is new\n- **Faster** search\n- [Docs](https://x.y)',
    html_url: 'https://github.com/o/r/releases/tag/v1.3.0',
    assets: [
      { name: 'notes.txt', browser_download_url: 'https://x/notes.txt' },
      { name: 'SaveMe-1.3.0.apk', browser_download_url: 'https://x/app.apk' },
    ],
  });
  assert.equal(release?.version, '1.3.0');
  assert.equal(release?.apkUrl, 'https://x/app.apk');
  assert.equal(shortNotes(release!.notes), 'What is new\n• Faster search\n• Docs');
  assert.equal(parseRelease({ tag_name: 'v2.0.0', prerelease: true }), null);
});
