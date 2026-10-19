import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Save } from '../db/repo';
import { imageUri } from '../lib/images';
import { useSettings } from '../lib/settings';
import { thumbnailUri } from '../lib/thumbnails';
import { colors, themed } from '../theme';
import { Icon } from './ui';

// Tall phone screenshots down to wide banners; anything beyond is letterboxed.
const MIN_RATIO = 9 / 16;
const MAX_RATIO = 1.91;

export function mediaSource(save: Save): string | null {
  if (save.kind === 'image') return imageUri(save.image_path);
  return thumbnailUri(save.thumbnail_local) ?? save.thumbnail;
}

// Width / height of the media box for this save under the current fit setting.
export function mediaRatio(save: Save, fit: 'fill' | 'fit', fillRatio: number, minRatio = MIN_RATIO): number {
  if (fit === 'fill' || !save.media_width || !save.media_height) return fillRatio;
  return Math.min(MAX_RATIO, Math.max(minRatio, save.media_width / save.media_height));
}

export function SaveMedia({
  save,
  fillRatio,
  minRatio,
  style,
  children,
}: {
  save: Save;
  fillRatio: number;
  // Keeps very tall images from pushing the rest of a screen away.
  minRatio?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const fit = settings.imageFit;
  const uri = mediaSource(save);
  // Learned from the loaded image when the save has no stored size yet.
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const sized = save.media_width ? save : natural ? { ...save, media_width: natural.width, media_height: natural.height } : save;
  const ratio = mediaRatio(sized, fit, fillRatio, minRatio);
  return (
    <View style={[styles.box, { aspectRatio: ratio }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={fit === 'fit' ? 'contain' : 'cover'}
          transition={150}
          recyclingKey={save.id}
          onLoad={(e) => {
            if (save.media_width || !e.source.width || !e.source.height) return;
            setNatural({ width: e.source.width, height: e.source.height });
            // Stored quietly so lists do not reload just for this.
            db.runAsync('UPDATE saves SET media_width = ?, media_height = ? WHERE id = ?', e.source.width, e.source.height, save.id).catch(() => {});
          }}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon name={save.kind === 'image' ? 'image' : 'link'} size={28} />
        </View>
      )}
      {children}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    box: { width: '100%', backgroundColor: colors.placeholder, overflow: 'hidden' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  }),
);
