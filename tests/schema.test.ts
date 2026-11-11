import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { migrate, SCHEMA_VERSION } from '../src/db/schema';

// Minimal async adapter with the expo-sqlite methods migrate() uses.
function adapter(db: DatabaseSync) {
  return {
    execAsync: async (sql: string) => db.exec(sql),
    runAsync: async (sql: string, ...args: (string | number)[]) => db.prepare(sql).run(...args),
    getFirstAsync: async (sql: string) => db.prepare(sql).get(),
    getAllAsync: async (sql: string) => db.prepare(sql).all(),
  } as never;
}

const columns = (db: DatabaseSync) => (db.prepare('PRAGMA table_info(saves)').all() as { name: string }[]).map((c) => c.name);

test('migrates a fresh database to the current version', async () => {
  const db = new DatabaseSync(':memory:');
  await migrate(adapter(db));
  assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, SCHEMA_VERSION);
  assert.ok(columns(db).includes('ocr_text'));
});

test('recovers from a migration interrupted halfway', async () => {
  const db = new DatabaseSync(':memory:');
  await migrate(adapter(db));
  // Simulate a phone killed mid-update: version still 1, but one v2 column already added.
  db.exec('PRAGMA user_version = 1');
  await migrate(adapter(db));
  assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, SCHEMA_VERSION);
  assert.equal(columns(db).filter((c) => c === 'media_width').length, 1);
});
