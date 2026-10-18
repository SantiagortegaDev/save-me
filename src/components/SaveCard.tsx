import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Save } from '../db/repo';
import { detectPlatform } from '../lib/platform';
import { hostname } from '../lib/url';
import { brutal, colors, radius, spacing } from '../theme';
import { Favicon } from './Favicon';
import { SaveMedia } from './SaveMedia';
import { Card, Icon, Text } from './ui';

export const CARD_FILL_RATIO = 1.6;

export function SaveCard({ save, width, onLongPress }: { save: Save; width: number; onLongPress?: () => void }) {
  const platform = detectPlatform(save.url);
  return (
    <Card accessibilityLabel={`Open ${save.title}`} onPress={() => router.push(`/save/${save.id}`)} onLongPress={onLongPress} style={{ width }}>
      <SaveMedia save={save} fillRatio={CARD_FILL_RATIO} style={styles.media}>
        <View style={styles.badges}>
          {save.pinned ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Icon name="map-pin" size={12} />
            </View>
          ) : null}
          {!save.seen ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text weight="heavy" size="xxs">
                NEW
              </Text>
            </View>
          ) : null}
        </View>
      </SaveMedia>
      <View style={styles.body}>
        {save.kind === 'link' ? (
          <View style={styles.site}>
            <Favicon uri={save.favicon} />
            <Text size="xxs" weight="bold" numberOfLines={1} style={{ flex: 1 }} color={platform.key === 'web' ? colors.inkMuted : colors.ink}>
              {platform.key === 'web' ? save.site_name || hostname(save.url) : platform.name}
            </Text>
          </View>
        ) : null}
        <Text weight="bold" size="sm" numberOfLines={3} style={{ lineHeight: 18 }}>
          {save.title || save.url}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  media: { borderBottomWidth: brutal.border, borderColor: colors.ink },
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
});
