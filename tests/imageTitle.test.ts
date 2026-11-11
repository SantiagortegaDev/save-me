import assert from 'node:assert/strict';
import { test } from 'node:test';

import { imageTitle } from '../src/lib/imageTitle';

test('imageTitle turns gallery file names into readable titles', () => {
  assert.equal(imageTitle('Screenshot_20261111-120000_Instagram.png'), 'Screenshot · Instagram');
  assert.equal(imageTitle('Screenshot_2026-11-11-12-00-00-123_com.android.chrome.jpg'), 'Screenshot · com.android.chrome');
  assert.equal(imageTitle('Screenshot 2026-11-11 at 12.00.00.png'), 'Screenshot');
  assert.equal(imageTitle('IMG_1234.JPG'), 'Photo');
  assert.equal(imageTitle('PXL_20261111_120000123.jpg'), 'Photo');
  assert.equal(imageTitle('3f2b9c1e-8a7d-4e2b-9c1a-2b3c4d5e6f70.jpeg'), 'Photo');
  assert.equal(imageTitle('1000012345.jpg'), 'Photo');
  assert.equal(imageTitle('receta_pan-casero.png'), 'receta pan casero');
  assert.equal(imageTitle(null), 'Image');
});
