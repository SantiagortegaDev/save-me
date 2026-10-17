import { Directory, File, Paths } from 'expo-file-system';

import { newId } from './id';

function imagesDir(): Directory {
  const dir = new Directory(Paths.document, 'images');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function extensionFor(uri: string, mimeType?: string | null): string {
  const fromMime = mimeType?.split('/')[1]?.replace('jpeg', 'jpg');
  if (fromMime && /^[a-z0-9]{2,5}$/.test(fromMime)) return fromMime;
  const fromUri = uri.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return fromUri?.toLowerCase() ?? 'jpg';
}

// Copies an image into app storage. Returns the stored file name (kept in the DB, resolved with imageUri()).
export async function storeImage(sourceUri: string, mimeType?: string | null): Promise<string> {
  const name = `${newId()}.${extensionFor(sourceUri, mimeType)}`;
  const target = new File(imagesDir(), name);
  await new File(sourceUri).copy(target);
  return name;
}

export function storeImageBase64(name: string, base64: string): void {
  const target = new File(imagesDir(), name);
  target.create({ overwrite: true });
  target.writeSync(base64, { encoding: 'base64' });
}

export function imageUri(name: string | null | undefined): string | null {
  if (!name) return null;
  return new File(Paths.document, 'images', name).uri;
}

export function readImageBase64(name: string): string | null {
  const file = new File(Paths.document, 'images', name);
  return file.exists ? file.base64Sync() : null;
}

export function deleteImages(names: (string | null | undefined)[]): void {
  for (const name of names) {
    if (!name) continue;
    try {
      const file = new File(Paths.document, 'images', name);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn('[images] delete failed', error);
    }
  }
}

export function deleteAllImages(): void {
  const dir = new Directory(Paths.document, 'images');
  if (dir.exists) dir.delete();
}
