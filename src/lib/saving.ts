import type { SQLiteDatabase } from 'expo-sqlite';

import { createSave, findSaveByUrl, setSavePinned, updateSave } from '../db/repo';
import { storeImage } from './images';
import { fallbackMetadata, fetchMetadata } from './metadata';
import { hostname, normalizeUrl } from './url';

export type SaveResult = { id: string; duplicate: boolean };

// Saves right away with a placeholder title, then fills the preview in the background.
export async function saveLink(
  db: SQLiteDatabase,
  rawUrl: string,
  opts: { collectionId?: string; pinned?: boolean; note?: string | null } = {},
): Promise<SaveResult> {
  const url = normalizeUrl(rawUrl);
  if (!url) throw new Error('Please enter a valid http or https link.');

  const existing = await findSaveByUrl(db, url);
  if (existing) {
    if (opts.pinned && !existing.pinned) await setSavePinned(db, existing.id, true);
    return { id: existing.id, duplicate: true };
  }

  const fallback = fallbackMetadata(url);
  const id = await createSave(db, {
    kind: 'link',
    url,
    title: fallback.title,
    favicon: fallback.favicon,
    siteName: fallback.siteName,
    collectionId: opts.collectionId,
    pinned: opts.pinned,
    note: opts.note ?? null,
  });
  void refreshMetadata(db, id, url);
  return { id, duplicate: false };
}

export async function refreshMetadata(
  db: SQLiteDatabase,
  id: string,
  url: string,
  opts: { keepTitle?: boolean } = {},
): Promise<void> {
  try {
    const meta = await fetchMetadata(url);
    await updateSave(db, id, {
      ...(opts.keepTitle ? {} : { title: meta.title || hostname(url) }),
      description: meta.description,
      thumbnail: meta.thumbnail,
      favicon: meta.favicon,
      site_name: meta.siteName,
    });
  } catch (error) {
    console.warn('[saving] metadata refresh failed', error);
  }
}

export async function saveImage(
  db: SQLiteDatabase,
  sourceUri: string,
  opts: { mimeType?: string | null; title?: string; collectionId?: string; pinned?: boolean } = {},
): Promise<SaveResult> {
  const name = await storeImage(sourceUri, opts.mimeType);
  const id = await createSave(db, {
    kind: 'image',
    imagePath: name,
    title: opts.title?.trim() || 'Image',
    collectionId: opts.collectionId,
    pinned: opts.pinned,
  });
  return { id, duplicate: false };
}
