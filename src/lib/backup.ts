import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { addTagToSave, createCollection, createSave, notifyChange, type Collection, type Save } from '../db/repo';
import { collectionColors } from '../theme';
import { toCsv, toNetscapeHtml, type ExportRow } from './exportFormat';
import { readImageBase64, storeImageBase64 } from './images';
import { detectAndParse } from './importParse';

const BACKUP_FORMAT = 'saveme-backup';

type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  collections: Collection[];
  saves: Save[];
  tags: { id: string; name: string }[];
  saveTags: { save_id: string; tag_id: string }[];
  images: Record<string, string>; // file name -> base64
};

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

async function shareText(fileName: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.writeSync(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
}

export async function exportBackup(db: SQLiteDatabase, opts: { includeImages: boolean }): Promise<number> {
  const [collections, saves, tags, saveTags] = await Promise.all([
    db.getAllAsync<Collection>('SELECT * FROM collections'),
    db.getAllAsync<Save>('SELECT * FROM saves'),
    db.getAllAsync<{ id: string; name: string }>('SELECT * FROM tags'),
    db.getAllAsync<{ save_id: string; tag_id: string }>('SELECT * FROM save_tags'),
  ]);
  if (saves.length === 0 && collections.length <= 1) return 0;
  const images: Record<string, string> = {};
  if (opts.includeImages) {
    for (const s of saves) {
      if (!s.image_path) continue;
      const data = readImageBase64(s.image_path);
      if (data) images[s.image_path] = data;
    }
  }
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    collections,
    saves,
    tags,
    saveTags,
    images,
  };
  await shareText(`saveme-backup-${stamp()}.json`, JSON.stringify(backup), 'application/json');
  return saves.length;
}

export function isSaveMeBackup(text: string): boolean {
  return text.slice(0, 200).includes(`"format":"${BACKUP_FORMAT}"`);
}

// Merges a backup into the current library. Existing rows with the same id are kept.
export async function restoreBackup(db: SQLiteDatabase, text: string): Promise<{ saves: number; collections: number }> {
  const data = JSON.parse(text) as BackupFile;
  if (data.format !== BACKUP_FORMAT) throw new Error('This file is not a SaveMe backup.');
  let saves = 0;
  let collections = 0;
  await db.withTransactionAsync(async () => {
    // Parents before children so foreign keys resolve.
    const pending = [...data.collections];
    const known = new Set((await db.getAllAsync<{ id: string }>('SELECT id FROM collections')).map((r) => r.id));
    let guard = pending.length + 1;
    while (pending.length && guard-- > 0) {
      for (let i = pending.length - 1; i >= 0; i--) {
        const c = pending[i];
        if (c.parent_id && !known.has(c.parent_id) && pending.some((p) => p.id === c.parent_id)) continue;
        const r = await db.runAsync(
          `INSERT OR IGNORE INTO collections (id, name, color, icon, parent_id, pinned, is_inbox, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          c.id, c.name, c.color, c.icon, c.parent_id && known.has(c.parent_id) ? c.parent_id : null,
          c.pinned, c.is_inbox, c.position, c.created_at, c.updated_at,
        );
        collections += r.changes;
        known.add(c.id);
        pending.splice(i, 1);
      }
    }
    for (const s of data.saves) {
      const r = await db.runAsync(
        `INSERT OR IGNORE INTO saves (id, kind, url, image_path, title, description, thumbnail, favicon, site_name, note,
                                      collection_id, pinned, seen, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s.id, s.kind, s.url, s.image_path, s.title, s.description, s.thumbnail, s.favicon, s.site_name, s.note,
        known.has(s.collection_id) ? s.collection_id : 'inbox', s.pinned, s.seen, s.created_at, s.updated_at,
      );
      saves += r.changes;
      if (r.changes && s.image_path && data.images?.[s.image_path]) {
        storeImageBase64(s.image_path, data.images[s.image_path]);
      }
    }
    for (const t of data.tags) {
      await db.runAsync('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)', t.id, t.name);
    }
    // A tag may already exist locally under another id; link by name.
    const tagNames = new Map(data.tags.map((t) => [t.id, t.name]));
    for (const st of data.saveTags) {
      const name = tagNames.get(st.tag_id);
      if (!name) continue;
      await db.runAsync(
        `INSERT OR IGNORE INTO save_tags (save_id, tag_id)
         SELECT ?, t.id FROM tags t WHERE t.name = ? COLLATE NOCASE LIMIT 1`,
        st.save_id,
        name,
      );
    }
  });
  notifyChange();
  return { saves, collections };
}

// Imports bookmarks from Pocket, Raindrop, Instapaper, browsers, or any CSV/HTML/JSON export.
export async function importBookmarks(
  db: SQLiteDatabase,
  fileName: string,
  text: string,
): Promise<{ imported: number; skipped: number }> {
  const links = detectAndParse(fileName, text);
  if (links.length === 0) throw new Error('No links were found in this file.');
  const existingUrls = new Set(
    (await db.getAllAsync<{ url: string }>("SELECT url FROM saves WHERE kind = 'link'")).map((r) => r.url),
  );
  const folderIds = new Map<string, string>();
  for (const c of await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM collections')) {
    folderIds.set(c.name.toLowerCase(), c.id);
  }
  let imported = 0;
  let skipped = 0;
  let colorIndex = 0;
  await db.withTransactionAsync(async () => {
    for (const link of links) {
      if (existingUrls.has(link.url)) {
        skipped++;
        continue;
      }
      let collectionId: string | undefined;
      if (link.folder) {
        const key = link.folder.toLowerCase();
        collectionId = folderIds.get(key);
        if (!collectionId) {
          collectionId = await createCollection(db, {
            name: link.folder,
            color: collectionColors[colorIndex++ % collectionColors.length],
            icon: 'folder',
          });
          folderIds.set(key, collectionId);
        }
      }
      const id = await createSave(
        db,
        {
          kind: 'link',
          url: link.url,
          title: link.title || link.url,
          note: link.note,
          collectionId,
          createdAt: link.createdAt ?? undefined,
        },
        { silent: true },
      );
      for (const tag of link.tags) await addTagToSave(db, id, tag, { silent: true });
      existingUrls.add(link.url);
      imported++;
    }
  });
  notifyChange();
  return { imported, skipped };
}

async function exportRows(db: SQLiteDatabase): Promise<ExportRow[]> {
  const rows = await db.getAllAsync<{ id: string; url: string; title: string; note: string | null; created_at: number; folder: string }>(
    `SELECT s.id, s.url, s.title, s.note, s.created_at, c.name AS folder
     FROM saves s JOIN collections c ON c.id = s.collection_id WHERE s.kind = 'link' ORDER BY s.created_at`,
  );
  const tagRows = await db.getAllAsync<{ save_id: string; name: string }>(
    'SELECT st.save_id, t.name FROM save_tags st JOIN tags t ON t.id = st.tag_id',
  );
  const tags = new Map<string, string[]>();
  for (const t of tagRows) tags.set(t.save_id, [...(tags.get(t.save_id) ?? []), t.name]);
  return rows.map((r) => ({
    url: r.url,
    title: r.title,
    folder: r.folder,
    tags: tags.get(r.id) ?? [],
    note: r.note,
    createdAt: r.created_at,
  }));
}

export async function exportAs(db: SQLiteDatabase, format: 'csv' | 'html'): Promise<number> {
  const rows = await exportRows(db);
  if (rows.length === 0) return 0;
  if (format === 'csv') await shareText(`saveme-links-${stamp()}.csv`, toCsv(rows), 'text/csv');
  else await shareText(`saveme-bookmarks-${stamp()}.html`, toNetscapeHtml(rows), 'text/html');
  return rows.length;
}
