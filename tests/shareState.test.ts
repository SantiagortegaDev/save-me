import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shareSignature } from '../src/lib/shareSignature';

test('shareSignature ignores order and is empty for no share', () => {
  const a = { shareType: 'text', mimeType: 'text/plain', value: 'https://x.com/a' };
  const b = { shareType: 'image', mimeType: 'image/png', value: 'content://1' };
  assert.equal(shareSignature([a, b]), shareSignature([b, a]));
  assert.notEqual(shareSignature([a]), shareSignature([b]));
  assert.equal(shareSignature([]), '');
});
