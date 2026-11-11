import assert from 'node:assert/strict';
import { test } from 'node:test';

import { redirectSystemPath } from '../src/app/+native-intent';

test('share intents go to the share screen; other links pass through', () => {
  assert.equal(redirectSystemPath({ path: 'saveme://expo-sharing?x=1', initial: true }), '/share');
  assert.equal(redirectSystemPath({ path: 'saveme://focus?scope=new', initial: false }), 'saveme://focus?scope=new');
  assert.equal(redirectSystemPath({ path: '/focus?scope=new', initial: true }), '/focus?scope=new');
});
