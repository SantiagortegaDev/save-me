// Keeps a small compressed JPEG of each link's preview image on the device, so cards load
// instantly, work offline and survive the original image going away.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { SQLiteDatabase } from 'expo-sqlite';

import { updateSave } from '../db/repo';

const MAX_WIDTH = 720;
const QUALITY = 0.7;
const BACKFILL_LIMIT = 30;

function thumbsDir(): Directory {
  const dir = new Directory(Paths.document, 'thumbs');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function thumbnailUri(name: string | null | undefined): string | null {
  if (!name) return null;
  return new File(Paths.document, 'thumbs', name).uri;
}

// Resizes and recompresses a local image. Returns the stored file name and the image's size.
async function compressInto(sourceUri: string, name: string): Promise<{ name: string; width: number; height: number }> {
  const original = await ImageManipulator.manipulate(sourceUri).renderAsync();
  const context = ImageManipulator.manipulate(sourceUri);
  if (original.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  const target = new File(thumbsDir(), name);
  if (target.exists) target.delete();
  new File(saved.uri).moveSync(target);
  return { name, width: original.width, height: original.height };
}

// Natural size of a local image, used to lay out "fit" cards for saved images.
export async function imageSize(uri: string): Promise<{ width: number; height: number } | null> {
  try {
    const ref = await ImageManipulator.manipulate(uri).renderAsync();
    return { width: ref.width, height: ref.height };
  } catch {
    return null;
  }
}

export async function cacheThumbnail(db: SQLiteDatabase, saveId: string, remoteUrl: string): Promise<void> {
  const download = new File(Paths.cache, `thumb-${saveId}`);
  try {
    await File.downloadFileAsync(remoteUrl, download, { idempotent: true });
    const res = await compressInto(download.uri, `${saveId}.jpg`);
    await updateSave(db, saveId, { thumbnail_local: res.name, media_width: res.width, media_height: res.height });
  } catch (error) {
    console.warn('[thumbnails] could not cache preview', error);
  } finally {
    if (download.exists) download.delete();
  }
}

export function deleteThumbnail(saveId: string): void {
  const file = new File(Paths.document, 'thumbs', `${saveId}.jpg`);
  if (file.exists) file.delete();
}

let backfilling = false;

// Run at startup: caches previews for links that only have a remote image (imports, restores,
// links saved by Claude) and removes files whose save was deleted.
export async function maintainThumbnails(db: SQLiteDatabase): Promise<void> {
  if (backfilling) return;
  backfilling = true;
  try {
    const dir = thumbsDir();
    const keep = new Set(
      (await db.getAllAsync<{ thumbnail_local: string }>('SELECT thumbnail_local FROM saves WHERE thumbnail_local IS NOT NULL')).map(
        (r) => r.thumbnail_local,
      ),
    );
    for (const entry of dir.list()) {
      if (entry instanceof File && !keep.has(entry.name)) entry.delete();
    }
    const missing = await db.getAllAsync<{ id: string; thumbnail: string }>(
      `SELECT id, thumbnail FROM saves
       WHERE kind = 'link' AND thumbnail IS NOT NULL AND thumbnail_local IS NULL
       ORDER BY created_at DESC LIMIT ?`,
      BACKFILL_LIMIT,
    );
    for (const row of missing) await cacheThumbnail(db, row.id, row.thumbnail);
  } catch (error) {
    console.warn('[thumbnails] maintenance failed', error);
  } finally {
    backfilling = false;
  }
}
