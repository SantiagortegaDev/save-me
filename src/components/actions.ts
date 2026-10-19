import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Share } from 'react-native';

import {
  deleteCollection,
  deleteSave,
  deleteSaves,
  listSaves,
  setCollectionPinned,
  setSavePinned,
  type Collection,
  type Save,
} from '../db/repo';
import { haptic } from '../lib/haptics';
import { deleteImages } from '../lib/images';
import { Alert } from '../lib/dialog';

export function confirmDeleteCollection(db: SQLiteDatabase, c: Collection, onDone?: () => void) {
  Alert.alert('Delete collection?', `"${c.name}", its sub-collections and all their saves will be deleted. This cannot be undone.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        const images = await deleteCollection(db, c.id);
        deleteImages(images);
        haptic.warning();
        onDone?.();
      },
    },
  ]);
}

export function confirmDeleteSave(db: SQLiteDatabase, s: Save, onDone?: () => void) {
  Alert.alert('Delete save?', 'Permanently delete this save?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        const image = await deleteSave(db, s.id);
        deleteImages([image]);
        haptic.warning();
        onDone?.();
      },
    },
  ]);
}

export function confirmDeleteSaves(db: SQLiteDatabase, ids: string[], onDone?: () => void) {
  Alert.alert(`Delete ${ids.length} ${ids.length === 1 ? 'save' : 'saves'}?`, 'They will be permanently deleted. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        deleteImages(await deleteSaves(db, ids));
        haptic.warning();
        onDone?.();
      },
    },
  ]);
}

export async function shareCollection(db: SQLiteDatabase, c: Collection) {
  const saves = await listSaves(db, { collectionId: c.id, filter: 'links' });
  if (saves.length === 0) {
    Alert.alert('Nothing to share', 'This collection has no links yet.');
    return;
  }
  const body = saves.map((s) => `• ${s.title || s.url}\n  ${s.url}`).join('\n');
  await Share.share({ title: c.name, message: `${c.name}\n\n${body}` });
}

export function collectionMenu(db: SQLiteDatabase, c: Collection, onEdit: () => void) {
  const options: Parameters<typeof Alert.alert>[2] = [
    { text: 'Edit', onPress: onEdit },
    { text: c.pinned ? 'Unpin' : 'Pin to top', onPress: () => setCollectionPinned(db, c.id, !c.pinned) },
    { text: 'Share links', onPress: () => shareCollection(db, c) },
  ];
  if (!c.is_inbox) options.push({ text: 'Delete', style: 'destructive', onPress: () => confirmDeleteCollection(db, c) });
  options.push({ text: 'Cancel', style: 'cancel' });
  Alert.alert(c.name, undefined, options);
}

export function saveMenu(db: SQLiteDatabase, s: Save, onMove: () => void, onSelect?: () => void) {
  Alert.alert(s.title || 'Save', undefined, [
    { text: 'Open details', onPress: () => router.push(`/save/${s.id}`) },
    ...(onSelect ? [{ text: 'Select multiple', onPress: onSelect }] : []),
    { text: s.pinned ? 'Unpin' : 'Pin', onPress: () => setSavePinned(db, s.id, !s.pinned) },
    { text: 'Move…', onPress: onMove },
    ...(s.kind === 'link' ? [{ text: 'Share', onPress: () => Share.share({ message: s.url }) }] : []),
    { text: 'Delete', style: 'destructive' as const, onPress: () => confirmDeleteSave(db, s) },
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
