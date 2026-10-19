import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'saveme.db';
export const INBOX_ID = 'inbox';

const SCHEMA_VERSION = 3;

const SCHEMA_V1 = `
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'folder',
    parent_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
    pinned INTEGER NOT NULL DEFAULT 0,
    is_inbox INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS saves (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL DEFAULT 'link',
    url TEXT NOT NULL DEFAULT '',
    image_path TEXT,
    title TEXT NOT NULL DEFAULT '',
    description TEXT,
    thumbnail TEXT,
    favicon TEXT,
    site_name TEXT,
    note TEXT,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    pinned INTEGER NOT NULL DEFAULT 0,
    seen INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE IF NOT EXISTS save_tags (
    save_id TEXT NOT NULL REFERENCES saves(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (save_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_saves_collection ON saves(collection_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_saves_created ON saves(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_collections_parent ON collections(parent_id);
`;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    await db.execAsync(SCHEMA_V1);
    const now = Date.now();
    await db.runAsync(
      `INSERT OR IGNORE INTO collections (id, name, color, icon, is_inbox, position, created_at, updated_at)
       VALUES (?, 'Inbox', '#C9C9C9', 'inbox', 1, -1, ?, ?)`,
      INBOX_ID,
      now,
      now,
    );
  }

  if (current < 2) {
    // Compressed local copy of the preview image and the media's natural size (for "fit" cards).
    await db.execAsync(`
      ALTER TABLE saves ADD COLUMN thumbnail_local TEXT;
      ALTER TABLE saves ADD COLUMN media_width INTEGER;
      ALTER TABLE saves ADD COLUMN media_height INTEGER;
    `);
  }

  if (current < 3) {
    // Readable article text for offline reading, and text recognized in saved images (searchable).
    await db.execAsync(`
      ALTER TABLE saves ADD COLUMN article_text TEXT;
      ALTER TABLE saves ADD COLUMN ocr_text TEXT;
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
