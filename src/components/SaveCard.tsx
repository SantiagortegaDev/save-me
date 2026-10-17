import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Save } from '../db/repo';
import { imageUri } from '../lib/images';
import { hostname } from '../lib/url';
import { brutal, colors, radius, spacing } from '../theme';
import { Card, Icon, Text } from './ui';

export function SaveCard({ save, width, onLongPress }: { save: Save; width: number; onLongPress?: () => void }) {
  const preview = save.kind === 'image' ? imageUri(save.image_path) : save.thumbnail;
  return (
    <Card
      accessibilityLabel={`Open ${save.title}`}
      onPress={() => router.push(`/save/${save.id}`)}
      onLongPress={onLongPress}
      style={{ width }}
    >
      <View style={[styles.preview, { height: width * 0.62 }]}>
        {preview ? (
          <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <View style={styles.placeholder}>
            <Icon name={save.kind === 'image' ? 'image' : 'link'} size={28} />
          </View>
        )}
        <View style={styles.badges}>
          {save.pinned ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Icon name="map-pin" size={12} />
            </View>
          ) : null}
          {!save.seen ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text weight="bold" size="xs">
                NEW
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.body}>
        <Text weight="semibold" numberOfLines={2}>
          {save.title || save.url}
        </Text>
        {save.kind === 'link' ? (
          <View style={styles.site}>
            {save.favicon ? <Image source={{ uri: save.favicon }} style={styles.favicon} /> : null}
            <Text size="xs" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
              {save.site_name || hostname(save.url)}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  preview: { backgroundColor: '#F1EADB', borderBottomWidth: brutal.border, borderColor: colors.ink },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badges: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', gap: 4 },
  badge: {
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  body: { padding: spacing.sm + 2, gap: 6 },
  site: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  favicon: { width: 14, height: 14, borderRadius: 3 },
});
