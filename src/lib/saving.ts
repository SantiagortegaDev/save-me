import type { SQLiteDatabase } from 'expo-sqlite';

import { createSave, findSaveByUrl, notifyChange, setSavePinned, updateSave } from '../db/repo';
import { imageUri, storeImage } from './images';
import { cacheThumbnail, imageSize } from './thumbnails';
import { recognizeImageText, saveArticleText } from './offline';
import { currentSettings } from './settings';
import { fallbackMetadata, fetchMetadata } from './metadata';
import { isWeakTitle, tidySocialTitle } from './metadataParse';
import { detectPlatform, fallbackTitle } from './platform';
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
      thumbnail_local: null,
    });
    if (meta.thumbnail) await cacheThumbnail(db, id, meta.thumbnail);
    if (currentSettings().offlineText) await saveArticleText(db, id, url);
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
  const size = await imageSize(imageUri(name) ?? sourceUri);
  const id = await createSave(db, {
    mediaWidth: size?.width,
    mediaHeight: size?.height,
    kind: 'image',
    imagePath: name,
    title: opts.title?.trim() || 'Image',
    collectionId: opts.collectionId,
    pinned: opts.pinned,
  });
  void recognizeImageText(db, id, name);
  return { id, duplicate: false };
}

let maintainingLinks = false;

// Run at startup: cleans tracking parameters out of links saved by older versions (so later shares of the same
// post are recognized as duplicates) and retries the preview of saves stuck with a generic title.
export async function maintainLinks(db: SQLiteDatabase): Promise<void> {
  if (maintainingLinks) return;
  maintainingLinks = true;
  try {
    const links = await db.getAllAsync<{ id: string; url: string; title: string }>("SELECT id, url, title FROM saves WHERE kind = 'link'");
    const taken = new Set(links.map((l) => l.url));
    let changed = false;
    for (const link of links) {
      const clean = normalizeUrl(link.url);
      if (!clean || clean === link.url || taken.has(clean)) continue;
      await db.runAsync('UPDATE saves SET url = ? WHERE id = ?', clean, link.id);
      taken.add(clean);
      link.url = clean;
      changed = true;
    }
    // 'Name on Instagram: "caption…"' titles from older versions become the caption itself.
    for (const link of links) {
      if (detectPlatform(link.url).key === 'web') continue;
      const tidy = tidySocialTitle(link.title);
      if (tidy === link.title) continue;
      await db.runAsync('UPDATE saves SET title = ? WHERE id = ?', tidy, link.id);
      link.title = tidy;
      changed = true;
    }
    if (changed) notifyChange();
    const generic = links.filter((l) => isWeakTitle(l.title, l.url) || l.title === fallbackTitle(l.url)).slice(0, 15);
    for (const link of generic) await refreshMetadata(db, link.id, link.url);
  } catch (error) {
    console.warn('[saving] link maintenance failed', error);
  } finally {
    maintainingLinks = false;
  }
}
