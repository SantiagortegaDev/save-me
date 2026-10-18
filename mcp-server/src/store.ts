// The server-side mirror of a SaveMe library. Runs on Durable Object SQLite in production and node:sqlite in tests.
import type { Op, Snapshot, SnapshotCollection, SnapshotSave } from '../../src/shared/sync';
import { INBOX_ID } from '../../src/shared/sync';

export type SqlValue = string | number | null;

export interface Db {
  all<T = Record<string, SqlValue>>(query: string, ...params: SqlValue[]): T[];
  run(query: string, ...params: SqlValue[]): void;
}

export class InputError extends Error {}

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, icon TEXT NOT NULL,
    parent_id TEXT, pinned INTEGER NOT NULL DEFAULT 0, is_inbox INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saves (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL,
    description TEXT, thumbnail TEXT, site_name TEXT, note TEXT, collection_id TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE);
  CREATE TABLE IF NOT EXISTS save_tags (save_id TEXT NOT NULL, tag_id TEXT NOT NULL, PRIMARY KEY (save_id, tag_id));
  CREATE TABLE IF NOT EXISTS ops (seq INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_saves_collection ON saves(collection_id);
`;

export function initSchema(db: Db): void {
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) db.run(stmt);
  ensureInbox(db);
}

function ensureInbox(db: Db) {
  const now = Date.now();
  db.run(
    `INSERT OR IGNORE INTO collections (id, name, color, icon, is_inbox, position, created_at, updated_at)
     VALUES (?, 'Inbox', '#C9C9C9', 'inbox', 1, -1, ?, ?)`,
    INBOX_ID,
    now,
    now,
  );
}

// --- meta -----------------------------------------------------------------

export function getMeta(db: Db, key: string): string | null {
  return db.all<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)[0]?.value ?? null;
}

export function setMeta(db: Db, key: string, value: string): void {
  db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

// --- snapshot & ops -------------------------------------------------------

export function replaceSnapshot(db: Db, snap: Snapshot): void {
  db.run('DELETE FROM save_tags');
  db.run('DELETE FROM tags');
  db.run('DELETE FROM saves');
  db.run('DELETE FROM collections');
  for (const c of snap.collections) {
    db.run(
      `INSERT OR REPLACE INTO collections (id, name, color, icon, parent_id, pinned, is_inbox, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      c.id, c.name, c.color, c.icon, c.parent_id, c.pinned, c.is_inbox, c.position, c.created_at, c.updated_at,
    );
  }
  ensureInbox(db);
  for (const s of snap.saves) {
    db.run(
      `INSERT OR REPLACE INTO saves (id, kind, url, title, description, thumbnail, site_name, note, collection_id, pinned, seen, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id, s.kind, s.url, s.title, s.description, s.thumbnail, s.site_name, s.note, s.collection_id, s.pinned, s.seen, s.created_at, s.updated_at,
    );
  }
  for (const t of snap.tags) db.run('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)', t.id, t.name);
  for (const st of snap.saveTags) db.run('INSERT OR IGNORE INTO save_tags (save_id, tag_id) VALUES (?, ?)', st.save_id, st.tag_id);
}

export function enqueueOp(db: Db, op: Op): number {
  db.run('INSERT INTO ops (op, created_at) VALUES (?, ?)', JSON.stringify(op), Date.now());
  return db.all<{ seq: number }>('SELECT MAX(seq) AS seq FROM ops')[0].seq;
}

export function pendingOps(db: Db, afterSeq = 0) {
  return db
    .all<{ seq: number; op: string }>('SELECT seq, op FROM ops WHERE seq > ? ORDER BY seq', afterSeq)
    .map((r) => ({ seq: r.seq, op: JSON.parse(r.op) as Op }));
}

export function ackOps(db: Db, upTo: number): void {
  db.run('DELETE FROM ops WHERE seq <= ?', upTo);
}

function placeholders(n: number) {
  return Array.from({ length: n }, () => '?').join(', ');
}

function ensureTagId(db: Db, name: string, newId: () => string): string {
  const existing = db.all<{ id: string }>('SELECT id FROM tags WHERE name = ? COLLATE NOCASE', name)[0];
  if (existing) return existing.id;
  const id = newId();
  db.run('INSERT INTO tags (id, name) VALUES (?, ?)', id, name);
  return id;
}

// Applies an op to the mirror. Ops are validated before being queued, so this only skips rows that vanished.
export function applyOp(db: Db, op: Op, newId: () => string = () => crypto.randomUUID()): void {
  const now = Date.now();
  switch (op.type) {
    case 'create_save': {
      const s = op.save;
      db.run(
        `INSERT OR IGNORE INTO saves (id, kind, url, title, note, collection_id, pinned, seen, created_at, updated_at)
         VALUES (?, 'link', ?, ?, ?, ?, ?, 0, ?, ?)`,
        s.id, s.url, s.title, s.note, s.collection_id, s.pinned ? 1 : 0, s.created_at, s.created_at,
      );
      for (const t of op.tags) db.run('INSERT OR IGNORE INTO save_tags (save_id, tag_id) VALUES (?, ?)', s.id, ensureTagId(db, t, newId));
      return;
    }
    case 'update_save': {
      if (op.title !== undefined) db.run('UPDATE saves SET title = ?, updated_at = ? WHERE id = ?', op.title, now, op.id);
      if (op.note !== undefined) db.run('UPDATE saves SET note = ?, updated_at = ? WHERE id = ?', op.note, now, op.id);
      return;
    }
    case 'move_saves':
      db.run(`UPDATE saves SET collection_id = ?, updated_at = ? WHERE id IN (${placeholders(op.ids.length)})`, op.collection_id, now, ...op.ids);
      return;
    case 'set_pinned':
      db.run(`UPDATE saves SET pinned = ?, updated_at = ? WHERE id IN (${placeholders(op.ids.length)})`, op.pinned ? 1 : 0, now, ...op.ids);
      return;
    case 'set_seen':
      db.run(`UPDATE saves SET seen = ? WHERE id IN (${placeholders(op.ids.length)})`, op.seen ? 1 : 0, ...op.ids);
      return;
    case 'tag_saves': {
      for (const name of op.add) {
        const tagId = ensureTagId(db, name, newId);
        for (const id of op.ids) db.run('INSERT OR IGNORE INTO save_tags (save_id, tag_id) SELECT id, ? FROM saves WHERE id = ?', tagId, id);
      }
      for (const name of op.remove) {
        db.run(
          `DELETE FROM save_tags WHERE tag_id IN (SELECT id FROM tags WHERE name = ? COLLATE NOCASE)
           AND save_id IN (${placeholders(op.ids.length)})`,
          name,
          ...op.ids,
        );
      }
      return;
    }
    case 'delete_saves':
      db.run(`DELETE FROM save_tags WHERE save_id IN (${placeholders(op.ids.length)})`, ...op.ids);
      db.run(`DELETE FROM saves WHERE id IN (${placeholders(op.ids.length)})`, ...op.ids);
      return;
    case 'create_collection': {
      const c = op.collection;
      const pos = db.all<{ p: number | null }>('SELECT MAX(position) AS p FROM collections WHERE parent_id IS ?', c.parent_id)[0]?.p ?? 0;
      db.run(
        `INSERT OR IGNORE INTO collections (id, name, color, icon, parent_id, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id, c.name, c.color, c.icon, c.parent_id, pos + 1, c.created_at, c.created_at,
      );
      return;
    }
    case 'update_collection': {
      const sets: string[] = [];
      const vals: SqlValue[] = [];
      if (op.name !== undefined) (sets.push('name = ?'), vals.push(op.name));
      if (op.color !== undefined) (sets.push('color = ?'), vals.push(op.color));
      if (op.icon !== undefined) (sets.push('icon = ?'), vals.push(op.icon));
      if (op.parent_id !== undefined) (sets.push('parent_id = ?'), vals.push(op.parent_id));
      if (op.pinned !== undefined) (sets.push('pinned = ?'), vals.push(op.pinned ? 1 : 0));
      if (sets.length) db.run(`UPDATE collections SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, ...vals, now, op.id);
      return;
    }
    case 'delete_collection': {
      const ids = descendantIds(db, op.id);
      if (!ids.length) return;
      db.run(`DELETE FROM save_tags WHERE save_id IN (SELECT id FROM saves WHERE collection_id IN (${placeholders(ids.length)}))`, ...ids);
      db.run(`DELETE FROM saves WHERE collection_id IN (${placeholders(ids.length)})`, ...ids);
      db.run(`DELETE FROM collections WHERE id IN (${placeholders(ids.length)})`, ...ids);
      return;
    }
  }
}

// --- queries --------------------------------------------------------------

export function descendantIds(db: Db, id: string): string[] {
  return db
    .all<{ id: string }>(
      `WITH RECURSIVE tree(id) AS (
         SELECT id FROM collections WHERE id = ?
         UNION ALL SELECT c.id FROM collections c JOIN tree t ON c.parent_id = t.id
       ) SELECT id FROM tree`,
      id,
    )
    .map((r) => r.id);
}

export function getCollection(db: Db, id: string): SnapshotCollection | null {
  return db.all<SnapshotCollection>('SELECT * FROM collections WHERE id = ?', id)[0] ?? null;
}

export function findCollectionByName(db: Db, name: string): SnapshotCollection[] {
  return db.all<SnapshotCollection>('SELECT * FROM collections WHERE name = ? COLLATE NOCASE', name);
}

export function getSaveRow(db: Db, id: string): SnapshotSave | null {
  return db.all<SnapshotSave>('SELECT * FROM saves WHERE id = ?', id)[0] ?? null;
}

export type CollectionNode = {
  id: string;
  name: string;
  color: string;
  icon: string;
  pinned: boolean;
  is_inbox: boolean;
  save_count: number;
  children: CollectionNode[];
};

export function collectionTree(db: Db): CollectionNode[] {
  const rows = db.all<SnapshotCollection & { save_count: number }>(
    `SELECT c.*, (SELECT COUNT(*) FROM saves s WHERE s.collection_id = c.id) AS save_count
     FROM collections c ORDER BY c.is_inbox DESC, c.pinned DESC, c.position, c.created_at`,
  );
  const nodes = new Map<string, CollectionNode>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      name: r.name,
      color: r.color,
      icon: r.icon,
      pinned: !!r.pinned,
      is_inbox: !!r.is_inbox,
      save_count: r.save_count,
      children: [],
    });
  }
  const roots: CollectionNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    const parent = r.parent_id ? nodes.get(r.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export type SaveView = {
  id: string;
  kind: 'link' | 'image';
  title: string;
  url: string | null;
  site: string | null;
  description: string | null;
  note: string | null;
  collection: { id: string; name: string };
  tags: string[];
  pinned: boolean;
  opened: boolean;
  saved_at: string;
};

function toViews(db: Db, rows: (SnapshotSave & { collection_name: string })[]): SaveView[] {
  if (!rows.length) return [];
  const tagRows = db.all<{ save_id: string; name: string }>(
    `SELECT st.save_id, t.name FROM save_tags st JOIN tags t ON t.id = st.tag_id
     WHERE st.save_id IN (${placeholders(rows.length)}) ORDER BY t.name COLLATE NOCASE`,
    ...rows.map((r) => r.id),
  );
  const tags = new Map<string, string[]>();
  for (const t of tagRows) tags.set(t.save_id, [...(tags.get(t.save_id) ?? []), t.name]);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    url: r.kind === 'link' ? r.url : null,
    site: r.site_name,
    description: r.description,
    note: r.note,
    collection: { id: r.collection_id, name: r.collection_name },
    tags: tags.get(r.id) ?? [],
    pinned: !!r.pinned,
    opened: !!r.seen,
    saved_at: new Date(r.created_at).toISOString(),
  }));
}

const SAVE_SELECT = `SELECT s.*, c.name AS collection_name FROM saves s LEFT JOIN collections c ON c.id = s.collection_id`;

export type SaveQuery = {
  collectionId?: string;
  includeSubcollections?: boolean;
  tag?: string;
  filter?: 'all' | 'links' | 'images' | 'pinned' | 'unopened';
  limit: number;
  offset: number;
};

export function listSaves(db: Db, q: SaveQuery): { total: number; saves: SaveView[] } {
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (q.collectionId) {
    const ids = q.includeSubcollections ? descendantIds(db, q.collectionId) : [q.collectionId];
    where.push(`s.collection_id IN (${placeholders(ids.length)})`);
    params.push(...ids);
  }
  if (q.tag) {
    where.push('s.id IN (SELECT st.save_id FROM save_tags st JOIN tags t ON t.id = st.tag_id WHERE t.name = ? COLLATE NOCASE)');
    params.push(q.tag.replace(/^#/, ''));
  }
  if (q.filter === 'links') where.push("s.kind = 'link'");
  if (q.filter === 'images') where.push("s.kind = 'image'");
  if (q.filter === 'pinned') where.push('s.pinned = 1');
  if (q.filter === 'unopened') where.push('s.seen = 0');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM saves s ${clause}`, ...params)[0].n;
  const rows = db.all<SnapshotSave & { collection_name: string }>(
    `${SAVE_SELECT} ${clause} ORDER BY s.pinned DESC, s.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    q.limit,
    q.offset,
  );
  return { total, saves: toViews(db, rows) };
}

export function getSaves(db: Db, ids: string[]): SaveView[] {
  if (!ids.length) return [];
  return toViews(db, db.all(`${SAVE_SELECT} WHERE s.id IN (${placeholders(ids.length)})`, ...ids));
}

export function searchLibrary(db: Db, query: string, limit: number) {
  const like = `%${query.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = db.all<SnapshotSave & { collection_name: string }>(
    `${SAVE_SELECT} WHERE s.title LIKE ? ESCAPE '\\' OR s.url LIKE ? ESCAPE '\\' OR s.description LIKE ? ESCAPE '\\'
       OR s.note LIKE ? ESCAPE '\\' OR s.site_name LIKE ? ESCAPE '\\'
       OR s.id IN (SELECT st.save_id FROM save_tags st JOIN tags t ON t.id = st.tag_id WHERE t.name LIKE ? ESCAPE '\\')
     ORDER BY s.created_at DESC LIMIT ?`,
    like, like, like, like, like, like,
    limit,
  );
  const collections = db.all<{ id: string; name: string }>(
    "SELECT id, name FROM collections WHERE name LIKE ? ESCAPE '\\' ORDER BY name COLLATE NOCASE LIMIT 20",
    like,
  );
  return { collections, saves: toViews(db, rows) };
}

export function listTagCounts(db: Db) {
  return db.all<{ name: string; save_count: number }>(
    `SELECT t.name, COUNT(st.save_id) AS save_count FROM tags t LEFT JOIN save_tags st ON st.tag_id = t.id
     GROUP BY t.id ORDER BY save_count DESC, t.name COLLATE NOCASE`,
  );
}

export function stats(db: Db) {
  return db.all<{ collections: number; saves: number; links: number; images: number; pinned: number; unopened: number; tags: number }>(
    `SELECT (SELECT COUNT(*) FROM collections WHERE is_inbox = 0) AS collections,
            (SELECT COUNT(*) FROM saves) AS saves,
            (SELECT COUNT(*) FROM saves WHERE kind = 'link') AS links,
            (SELECT COUNT(*) FROM saves WHERE kind = 'image') AS images,
            (SELECT COUNT(*) FROM saves WHERE pinned = 1) AS pinned,
            (SELECT COUNT(*) FROM saves WHERE seen = 0) AS unopened,
            (SELECT COUNT(*) FROM tags) AS tags`,
  )[0];
}
