// Offline content: readable article text for links and recognized text (OCR) for saved images.
// Both are stored in the database so they work without a connection and are searchable.
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { updateSave } from '../db/repo';
import { imageUri } from './images';
import { detectPlatform } from './platform';
import { extractArticle, serializeBlocks } from './readability';

const TIMEOUT_MS = 15_000;
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';

// '' when the page has no readable article, null when it could not be fetched (retried later).
export async function fetchArticleText(url: string): Promise<string | null> {
  // Social posts have no article body worth keeping.
  const platform = detectPlatform(url).key;
  if (platform !== 'web' && platform !== 'medium') return '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' }, signal: controller.signal });
    if (res.status >= 500) return null;
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return '';
    return serializeBlocks(extractArticle(await res.text()));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function saveArticleText(db: SQLiteDatabase, id: string, url: string): Promise<string | null> {
  const text = await fetchArticleText(url);
  if (text !== null) await updateSave(db, id, { article_text: text });
  return text;
}

type TextExtractor = { isSupported: boolean; extractTextFromImage: (uri: string) => Promise<string[]> };

// On-device text recognition (ML Kit on Android, Vision on iOS). Not available on web.
function extractor(): TextExtractor | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-text-extractor') as TextExtractor;
    return mod.isSupported ? mod : null;
  } catch {
    return null;
  }
}

export async function recognizeImageText(db: SQLiteDatabase, id: string, imagePath: string): Promise<void> {
  const ocr = extractor();
  const uri = imageUri(imagePath);
  if (!ocr || !uri) return;
  try {
    const lines = await ocr.extractTextFromImage(uri);
    await updateSave(db, id, { ocr_text: lines.join('\n').trim() });
  } catch (error) {
    console.warn('[offline] text recognition failed', error);
    await updateSave(db, id, { ocr_text: '' });
  }
}

let running = false;

// Run at startup: fills in article text and image text for saves that do not have it yet.
export async function maintainOfflineContent(db: SQLiteDatabase, opts: { articles: boolean }): Promise<void> {
  if (running || Platform.OS === 'web') return;
  running = true;
  try {
    const images = await db.getAllAsync<{ id: string; image_path: string }>(
      "SELECT id, image_path FROM saves WHERE kind = 'image' AND image_path IS NOT NULL AND ocr_text IS NULL ORDER BY created_at DESC LIMIT 25",
    );
    for (const row of images) await recognizeImageText(db, row.id, row.image_path);
    if (opts.articles) {
      const links = await db.getAllAsync<{ id: string; url: string }>(
        "SELECT id, url FROM saves WHERE kind = 'link' AND article_text IS NULL ORDER BY created_at DESC LIMIT 15",
      );
      for (const row of links) await saveArticleText(db, row.id, row.url);
    }
  } catch (error) {
    console.warn('[offline] maintenance failed', error);
  } finally {
    running = false;
  }
}
