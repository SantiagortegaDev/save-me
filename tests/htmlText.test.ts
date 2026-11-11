import assert from 'node:assert/strict';
import { test } from 'node:test';

import { charsetOf, decodeHtmlBytes } from '../src/lib/htmlText';

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

test('decodes ISO-8859-1 / Windows-1252 pages declared in the header or a meta tag', () => {
  const page = latin1('<html><head><title>Canci\xf3n del a\xf1o \x93hoy\x94 \x80</title></head></html>');
  assert.match(decodeHtmlBytes(page, 'text/html; charset=ISO-8859-1'), /Canción del año “hoy” €/);
  const meta = latin1('<html><head><meta charset="windows-1252"><title>Ni\xf1o</title>');
  assert.equal(charsetOf('text/html', meta), 'windows-1252');
  assert.match(decodeHtmlBytes(meta, 'text/html'), /Niño/);
});

test('UTF-8 stays the default', () => {
  const bytes = new TextEncoder().encode('<title>Canción 🍞</title>');
  assert.equal(decodeHtmlBytes(bytes, 'text/html'), '<title>Canción 🍞</title>');
});
