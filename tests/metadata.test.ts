import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeEntities, parseHtmlMetadata } from '../src/lib/metadataParse';

test('prefers Open Graph tags', () => {
  const html = `<html><head>
    <title>Fallback title</title>
    <meta property="og:title" content="Tom &amp; Jerry&#39;s &quot;Best&quot;">
    <meta property="og:description" content="  A   classic.  ">
    <meta property="og:image" content="/cover.jpg">
    <meta property="og:site_name" content="Cartoons">
    <link rel="icon" href="/fav.png">
  </head></html>`;
  const meta = parseHtmlMetadata(html, 'https://cartoons.example/show/1');
  assert.equal(meta.title, 'Tom & Jerry\'s "Best"');
  assert.equal(meta.description, 'A classic.');
  assert.equal(meta.thumbnail, 'https://cartoons.example/cover.jpg');
  assert.equal(meta.favicon, 'https://cartoons.example/fav.png');
  assert.equal(meta.siteName, 'Cartoons');
});

test('falls back to <title>, twitter tags and hostname', () => {
  const html = `<head><title>Plain page</title><meta name="twitter:image" content='https://cdn.example/x.png'></head>`;
  const meta = parseHtmlMetadata(html, 'https://www.example.org/p');
  assert.equal(meta.title, 'Plain page');
  assert.equal(meta.thumbnail, 'https://cdn.example/x.png');
  assert.equal(meta.siteName, 'example.org');
  assert.equal(meta.favicon, 'https://www.example.org/favicon.ico');
});

test('uses hostname when there is no title at all', () => {
  assert.equal(parseHtmlMetadata('<html></html>', 'https://news.example.com/').title, 'news.example.com');
});

test('decodes numeric entities', () => {
  assert.equal(decodeEntities('caf&#233; &#x1F600;'), 'café 😀');
});
