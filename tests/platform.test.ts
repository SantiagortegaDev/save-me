import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fallbackMetadata } from '../src/lib/metadata';
import { isWeakTitle, parseHtmlMetadata, parseInstagramEmbed } from '../src/lib/metadataParse';
import { detectPlatform, fallbackTitle } from '../src/lib/platform';

test('detects platforms from many URL shapes', () => {
  const cases: [string, string][] = [
    ['https://www.instagram.com/reel/abc/', 'instagram'],
    ['https://vm.tiktok.com/ZM123/', 'tiktok'],
    ['https://youtu.be/xyz', 'youtube'],
    ['https://m.youtube.com/watch?v=1', 'youtube'],
    ['https://twitter.com/a/status/1', 'x'],
    ['https://x.com/a/status/1', 'x'],
    ['https://old.reddit.com/r/x/comments/1/', 'reddit'],
    ['https://pin.it/abc', 'pinterest'],
    ['https://www.pinterest.es/pin/1/', 'pinterest'],
    ['https://www.threads.net/@zuck/post/1', 'threads'],
    ['https://fb.watch/abc', 'facebook'],
    ['https://open.spotify.com/track/1', 'spotify'],
    ['https://www.amazon.co.uk/dp/1', 'amazon'],
    ['https://example.com/a', 'web'],
  ];
  for (const [url, key] of cases) assert.equal(detectPlatform(url).key, key, url);
  assert.equal(detectPlatform('https://www.example.com').name, 'example.com');
});

test('fallback titles describe hidden social posts', () => {
  assert.equal(fallbackTitle('https://www.instagram.com/reel/C3uLBYZr0Xs/'), 'Instagram reel');
  assert.equal(fallbackTitle('https://www.instagram.com/p/C0JY8qJM8Vh/'), 'Instagram post');
  assert.equal(fallbackTitle('https://www.tiktok.com/@chef/video/1'), 'TikTok by @chef');
  assert.equal(fallbackTitle('https://x.com/nasa/status/1'), 'Post by @nasa on X');
  assert.equal(fallbackTitle('https://www.reddit.com/r/cooking/comments/1/best_pasta/'), 'best pasta · r/cooking');
  assert.equal(fallbackTitle('https://www.youtube.com/shorts/abc'), 'YouTube Short');
});

test('fallback metadata names the platform and a favicon', () => {
  const m = fallbackMetadata('https://www.instagram.com/reel/abc/');
  assert.equal(m.siteName, 'Instagram');
  assert.equal(m.title, 'Instagram reel');
  assert.match(m.favicon ?? '', /instagram\.com/);
});

test('weak titles from login walls are ignored', () => {
  assert.ok(isWeakTitle('Instagram', 'https://instagram.com/p/1'));
  assert.ok(isWeakTitle('Threads • Log in', 'https://threads.net/x'));
  assert.ok(isWeakTitle('Just a moment...', 'https://site.example/'));
  assert.ok(isWeakTitle('example.org', 'https://example.org/'));
  assert.ok(!isWeakTitle('Instagram tips for bakers', 'https://blog.example/'));
});

test('falls back to JSON-LD when Open Graph is missing', () => {
  const html = `<head><title>Log in</title>
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"NewsArticle","headline":"Rain returns","image":[{"url":"https://cdn.example/rain.jpg"}],"description":"Forecast"}]}</script>
  </head>`;
  const m = parseHtmlMetadata(html, 'https://news.example/a');
  assert.equal(m.title, 'Rain returns');
  assert.equal(m.thumbnail, 'https://cdn.example/rain.jpg');
  assert.equal(m.description, 'Forecast');
});

test('reads Instagram embed pages', () => {
  const html = `<div><span class="UsernameText">baker.jo</span>
    <img class="EmbeddedMediaImage" alt="x" src="https://scontent.example/p.jpg?a=1&amp;b=2">
    <div class="Caption"><a class="CaptionUsername" href="#">baker.jo</a><br>Sourdough day &amp; more<br/>#bread</div><div class="CaptionComments"></div></div>`;
  const e = parseInstagramEmbed(html);
  assert.equal(e.image, 'https://scontent.example/p.jpg?a=1&b=2');
  assert.equal(e.user, 'baker.jo');
  assert.equal(e.caption, 'Sourdough day & more #bread');
});
