import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '../lib/id';
import { INBOX_ID } from './schema';

export type SaveKind = 'link' | 'image';

export type Collection = {
  id: string;
  name: string;
  color: string;
  icon: string;
  parent_id: string | null;
  pinned: number;
  is_inbox: number;
  position: number;
  created_at: number;
  updated_at: number;
};

export type CollectionWithCount = Collection & { save_count: number; child_count: number; unseen_count: number };

export type CollectionSort = 'oldest' | 'newest' | 'name' | 'recent';

export type Save = {
  id: string;
  kind: SaveKind;
  url: string;
  image_path: string | null;
  title: string;
  description: string | null;
  thumbnail: string | null;
  favicon: string | null;
  site_name: string | null;
  note: string | null;
  collection_id: string;
  pinned: number;
  seen: number;
  created_at: number;
  updated_at: number;
};

export type Tag = { id: string; name: string };
export type TagWithCount = Tag & { save_count: number };

export type SaveFilter = 'all' | 'links' | 'images' | 'pinned' | 'unseen';

// --- change notifications -------------------------------------------------
// Screens subscribe and re-query whenever any write happens.

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyChange(): void {
  listeners.forEach((l) => l());
}

// --- collections ----------------------------------------------------------

const COLLECTION_WITH_COUNT = `
  SELECT c.*,
    (SELECT COUNT(*) FROM saves s WHERE s.collection_id = c.id) AS save_count,
    (SELECT COUNT(*) FROM collections k WHERE k.parent_id = c.id) AS child_count,
    (SELECT COUNT(*) FROM saves s WHERE s.collection_id = c.id AND s.seen = 0) AS unseen_count
  FROM collections c`;

const SORT_SQL: Record<CollectionSort, string> = {
  oldest: 'c.position ASC, c.created_at ASC',
  newest: 'c.created_at DESC',
  name: 'c.name COLLATE NOCASE ASC',
  recent: '(SELECT MAX(s.created_at) FROM saves s WHERE s.collection_id = c.id) DESC NULLS LAST, c.created_at DESC',
};

export function listCollections(db: SQLiteDatabase, parentId: string | null = null, sort: CollectionSort = 'oldest') {
  const order = SORT_SQL[sort];
  if (parentId === null) {
    return db.getAllAsync<CollectionWithCount>(
      `${COLLECTION_WITH_COUNT} WHERE c.parent_id IS NULL ORDER BY c.is_inbox DESC, c.pinned DESC, ${order}`,
    );
  }
  return db.getAllAsync<CollectionWithCount>(
    `${COLLECTION_WITH_COUNT} WHERE c.parent_id = ? ORDER BY c.pinned DESC, ${order}`,
    parentId,
  );
}

export function listAllCollections(db: SQLiteDatabase) {
  return db.getAllAsync<CollectionWithCount>(
    `${COLLECTION_WITH_COUNT} ORDER BY c.is_inbox DESC, c.pinned DESC, c.name COLLATE NOCASE ASC`,
  );
}

export function getCollection(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<CollectionWithCount>(`${COLLECTION_WITH_COUNT} WHERE c.id = ?`, id);
}

export async function createCollection(
  db: SQLiteDatabase,
  input: { name: string; color: string; icon: string; parentId?: string | null },
): Promise<string> {
  const id = newId();
  const now = Date.now();
  const max = await db.getFirstAsync<{ p: number | null }>(
    'SELECT MAX(position) AS p FROM collections WHERE parent_id IS ?',
    input.parentId ?? null,
  );
  await db.runAsync(
    `INSERT INTO collections (id, name, color, icon, parent_id, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.name.trim(),
    input.color,
    input.icon,
    input.parentId ?? null,
    (max?.p ?? 0) + 1,
    now,
    now,
  );
  notifyChange();
  return id;
}

export async function updateCollection(
  db: SQLiteDatabase,
  id: string,
  input: { name: string; color: string; icon: string },
): Promise<void> {
  await db.runAsync(
    'UPDATE collections SET name = ?, color = ?, icon = ?, updated_at = ? WHERE id = ?',
    input.name.trim(),
    input.color,
    input.icon,
    Date.now(),
    id,
  );
  notifyChange();
}

export async function setCollectionPinned(db: SQLiteDatabase, id: string, pinned: boolean) {
  await db.runAsync('UPDATE collections SET pinned = ?, updated_at = ? WHERE id = ?', pinned ? 1 : 0, Date.now(), id);
  notifyChange();
}

export async function deleteCollection(db: SQLiteDatabase, id: string): Promise<string[]> {
  if (id === INBOX_ID) return [];
  // Collect image files of this collection and all descendants so callers can remove them.
  const images = await db.getAllAsync<{ image_path: string }>(
    `WITH RECURSIVE tree(id) AS (
       SELECT id FROM collections WHERE id = ?
       UNION ALL SELECT c.id FROM collections c JOIN tree t ON c.parent_id = t.id
     )
     SELECT image_path FROM saves WHERE collection_id IN (SELECT id FROM tree) AND image_path IS NOT NULL`,
    id,
  );
  await db.runAsync('DELETE FROM collections WHERE id = ?', id);
  notifyChange();
  return images.map((r) => r.image_path);
}

// Breadcrumb from root to the given collection.
export function getCollectionPath(db: SQLiteDatabase, id: string) {
  return db.getAllAsync<{ id: string; name: string }>(
    `WITH RECURSIVE up(id, name, parent_id, depth) AS (
       SELECT id, name, parent_id, 0 FROM collections WHERE id = ?
       UNION ALL SELECT c.id, c.name, c.parent_id, up.depth + 1 FROM collections c JOIN up ON c.id = up.parent_id
     )
     SELECT id, name FROM up ORDER BY depth DESC`,
    id,
  );
}

// --- saves ----------------------------------------------------------------

function filterClause(filter: SaveFilter): string {
  switch (filter) {
    case 'links':
      return "AND s.kind = 'link'";
    case 'images':
      return "AND s.kind = 'image'";
    case 'pinned':
      return 'AND s.pinned = 1';
    case 'unseen':
      return 'AND s.seen = 0';
    default:
      return '';
  }
}

export function listSaves(
  db: SQLiteDatabase,
  opts: { collectionId?: string | null; filter?: SaveFilter; tagId?: string | null; limit?: number } = {},
) {
  const params: (string | number)[] = [];
  let where = 'WHERE 1 = 1';
  if (opts.collectionId) {
    where += ' AND s.collection_id = ?';
    params.push(opts.collectionId);
  }
  if (opts.tagId) {
    where += ' AND s.id IN (SELECT save_id FROM save_tags WHERE tag_id = ?)';
    params.push(opts.tagId);
  }
  where += ` ${filterClause(opts.filter ?? 'all')}`;
  const order = 'ORDER BY s.pinned DESC, s.created_at DESC';
  const limit = opts.limit ? `LIMIT ${Math.floor(opts.limit)}` : '';
  return db.getAllAsync<Save>(`SELECT s.* FROM saves s ${where} ${order} ${limit}`, ...params);
}

export function listRecentSaves(db: SQLiteDatabase, limit = 10) {
  return db.getAllAsync<Save>('SELECT * FROM saves ORDER BY created_at DESC LIMIT ?', limit);
}

// Saves for Focus Mode, oldest unseen first so the backlog gets cleared in order.
export function listFocusSaves(db: SQLiteDatabase, opts: { collectionId?: string | null; scope: 'new' | 'all' }) {
  const params: string[] = [];
  let where = 'WHERE 1 = 1';
  if (opts.collectionId) {
    where += ' AND collection_id = ?';
    params.push(opts.collectionId);
  }
  if (opts.scope === 'new') where += ' AND seen = 0';
  return db.getAllAsync<Save>(`SELECT * FROM saves ${where} ORDER BY seen ASC, created_at ASC LIMIT 200`, ...params);
}

export function getSave(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<Save>('SELECT * FROM saves WHERE id = ?', id);
}

export function findSaveByUrl(db: SQLiteDatabase, url: string) {
  return db.getFirstAsync<Save>("SELECT * FROM saves WHERE kind = 'link' AND url = ?", url);
}

export type NewSave = {
  kind: SaveKind;
  url?: string;
  imagePath?: string | null;
  title?: string;
  description?: string | null;
  thumbnail?: string | null;
  favicon?: string | null;
  siteName?: string | null;
  note?: string | null;
  collectionId?: string;
  pinned?: boolean;
  seen?: boolean;
  createdAt?: number;
};

export async function createSave(db: SQLiteDatabase, input: NewSave, opts: { silent?: boolean } = {}): Promise<string> {
  const id = newId();
  const now = input.createdAt ?? Date.now();
  await db.runAsync(
    `INSERT INTO saves (id, kind, url, image_path, title, description, thumbnail, favicon, site_name, note,
                        collection_id, pinned, seen, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.kind,
    input.url ?? '',
    input.imagePath ?? null,
    input.title ?? '',
    input.description ?? null,
    input.thumbnail ?? null,
    input.favicon ?? null,
    input.siteName ?? null,
    input.note ?? null,
    input.collectionId ?? INBOX_ID,
    input.pinned ? 1 : 0,
    input.seen ? 1 : 0,
    now,
    now,
  );
  if (!opts.silent) notifyChange();
  return id;
}

export async function updateSave(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Pick<Save, 'title' | 'description' | 'thumbnail' | 'favicon' | 'site_name' | 'note' | 'url'>>,
): Promise<void> {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => patch[k] ?? null);
  await db.runAsync(`UPDATE saves SET ${sets}, updated_at = ? WHERE id = ?`, ...values, Date.now(), id);
  notifyChange();
}

export async function setSavePinned(db: SQLiteDatabase, id: string, pinned: boolean) {
  await db.runAsync('UPDATE saves SET pinned = ?, updated_at = ? WHERE id = ?', pinned ? 1 : 0, Date.now(), id);
  notifyChange();
}

export async function markSeen(db: SQLiteDatabase, id: string, seen = true) {
  await db.runAsync('UPDATE saves SET seen = ? WHERE id = ?', seen ? 1 : 0, id);
  notifyChange();
}

export async function moveSave(db: SQLiteDatabase, id: string, collectionId: string) {
  await db.runAsync('UPDATE saves SET collection_id = ?, updated_at = ? WHERE id = ?', collectionId, Date.now(), id);
  notifyChange();
}

export async function deleteSave(db: SQLiteDatabase, id: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ image_path: string | null }>('SELECT image_path FROM saves WHERE id = ?', id);
  await db.runAsync('DELETE FROM saves WHERE id = ?', id);
  notifyChange();
  return row?.image_path ?? null;
}

// --- tags -----------------------------------------------------------------

export function listTags(db: SQLiteDatabase) {
  return db.getAllAsync<TagWithCount>(
    `SELECT t.*, (SELECT COUNT(*) FROM save_tags st WHERE st.tag_id = t.id) AS save_count
     FROM tags t ORDER BY t.name COLLATE NOCASE`,
  );
}

export function listTagsForSave(db: SQLiteDatabase, saveId: string) {
  return db.getAllAsync<Tag>(
    `SELECT t.* FROM tags t JOIN save_tags st ON st.tag_id = t.id WHERE st.save_id = ? ORDER BY t.name COLLATE NOCASE`,
    saveId,
  );
}

export async function ensureTag(db: SQLiteDatabase, name: string): Promise<string> {
  const clean = name.trim().replace(/^#/, '');
  const existing = await db.getFirstAsync<Tag>('SELECT * FROM tags WHERE name = ? COLLATE NOCASE', clean);
  if (existing) return existing.id;
  const id = newId();
  await db.runAsync('INSERT INTO tags (id, name) VALUES (?, ?)', id, clean);
  return id;
}

export async function addTagToSave(db: SQLiteDatabase, saveId: string, name: string, opts: { silent?: boolean } = {}) {
  const tagId = await ensureTag(db, name);
  await db.runAsync('INSERT OR IGNORE INTO save_tags (save_id, tag_id) VALUES (?, ?)', saveId, tagId);
  if (!opts.silent) notifyChange();
}

export async function removeTagFromSave(db: SQLiteDatabase, saveId: string, tagId: string) {
  await db.runAsync('DELETE FROM save_tags WHERE save_id = ? AND tag_id = ?', saveId, tagId);
  notifyChange();
}

export async function deleteTag(db: SQLiteDatabase, tagId: string) {
  await db.runAsync('DELETE FROM tags WHERE id = ?', tagId);
  notifyChange();
}

// --- library stats & search ----------------------------------------------

export type LibraryStats = { collections: number; saves: number; pinned: number; tags: number; unseen: number };

export async function getStats(db: SQLiteDatabase): Promise<LibraryStats> {
  const row = await db.getFirstAsync<LibraryStats>(
    `SELECT
       (SELECT COUNT(*) FROM collections WHERE is_inbox = 0) AS collections,
       (SELECT COUNT(*) FROM saves) AS saves,
       (SELECT COUNT(*) FROM saves WHERE pinned = 1) AS pinned,
       (SELECT COUNT(*) FROM tags) AS tags,
       (SELECT COUNT(*) FROM saves WHERE seen = 0) AS unseen`,
  );
  return row ?? { collections: 0, saves: 0, pinned: 0, tags: 0, unseen: 0 };
}

export async function search(db: SQLiteDatabase, query: string) {
  const q = `%${query.trim().replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const [collections, saves, tags] = await Promise.all([
    db.getAllAsync<CollectionWithCount>(
      `${COLLECTION_WITH_COUNT} WHERE c.name LIKE ? ESCAPE '\\' ORDER BY c.name COLLATE NOCASE LIMIT 30`,
      q,
    ),
    db.getAllAsync<Save>(
      `SELECT DISTINCT s.* FROM saves s
       LEFT JOIN save_tags st ON st.save_id = s.id
       LEFT JOIN tags t ON t.id = st.tag_id
       WHERE s.title LIKE ?1 ESCAPE '\\' OR s.url LIKE ?1 ESCAPE '\\' OR s.description LIKE ?1 ESCAPE '\\'
          OR s.note LIKE ?1 ESCAPE '\\' OR s.site_name LIKE ?1 ESCAPE '\\' OR t.name LIKE ?1 ESCAPE '\\'
       ORDER BY s.created_at DESC LIMIT 100`,
      q,
    ),
    db.getAllAsync<TagWithCount>(
      `SELECT t.*, (SELECT COUNT(*) FROM save_tags st WHERE st.tag_id = t.id) AS save_count
       FROM tags t WHERE t.name LIKE ? ESCAPE '\\' ORDER BY t.name COLLATE NOCASE LIMIT 30`,
      q,
    ),
  ]);
  return { collections, saves, tags };
}

// --- key/value settings ---------------------------------------------------

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
  notifyChange();
}

export async function wipeLibrary(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM save_tags');
    await db.runAsync('DELETE FROM tags');
    await db.runAsync('DELETE FROM saves');
    await db.runAsync('DELETE FROM collections WHERE is_inbox = 0');
  });
  notifyChange();
}
