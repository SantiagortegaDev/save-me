// Remembers which incoming share was already handled. Android re-delivers the original share when the app is
// reopened from Recents, which made the "Save to SaveMe" sheet appear on a normal launch.
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '../db/repo';

export { shareSignature } from './shareSignature';

const KEY = 'share_handled';

export async function isShareHandled(db: SQLiteDatabase, signature: string): Promise<boolean> {
  return !!signature && (await getSetting(db, KEY)) === signature;
}

export async function markShareHandled(db: SQLiteDatabase, signature: string): Promise<void> {
  if (signature) await setSetting(db, KEY, signature);
}
