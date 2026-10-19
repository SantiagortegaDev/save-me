import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Save } from '../db/repo';
import { detectPlatform } from '../lib/platform';
import { hostname } from '../lib/url';
import { brutal, colors, radius, spacing, themed } from '../theme';
import { Favicon } from './Favicon';
import { SaveMedia } from './SaveMedia';
import { Card, Icon, Text } from './ui';

export const CARD_FILL_RATIO = 1.6;

export function SaveCard({
  save,
  width,
  onLongPress,
  onPress,
  selected,
}: {
  save: Save;
  width: number;
  onLongPress?: () => void;
  // Replaces opening the save, e.g. while selecting several.
  onPress?: () => void;
  // undefined: not selecting; true/false: selection mode.
  selected?: boolean;
}) {
  const platform = detectPlatform(save.url);
  const selecting = selected !== undefined;
  return (
    <Card
      accessibilityLabel={selecting ? `${selected ? 'Deselect' : 'Select'} ${save.title}` : `Open ${save.title}`}
      onPress={onPress ?? (() => router.push(`/save/${save.id}`))}
      onLongPress={onLongPress}
      style={[{ width }, selected && styles.selected]}
    >
      <SaveMedia save={save} fillRatio={CARD_FILL_RATIO} style={styles.media}>
        <View style={styles.badges}>
          {save.pinned ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Icon name="map-pin" size={12} color={colors.ink} />
            </View>
          ) : null}
          {!save.seen ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text weight="heavy" size="xxs" color={colors.ink}>
                NEW
              </Text>
            </View>
          ) : null}
        </View>
        {selecting ? (
          <View style={[styles.check, selected && styles.checkOn]}>{selected ? <Icon name="check" size={14} color={colors.ink} /> : null}</View>
        ) : null}
        {selected ? <View style={styles.tint} pointerEvents="none" /> : null}
      </SaveMedia>
      <View style={styles.body}>
        {save.kind === 'link' ? (
          <View style={styles.site}>
            <Favicon uri={save.favicon} />
            <Text size="xxs" weight="bold" numberOfLines={1} style={{ flex: 1 }} color={platform.key === 'web' ? colors.inkMuted : colors.text}>
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

const styles = themed(() =>
  StyleSheet.create({
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
    selected: { borderColor: colors.ink, transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: '0px 0px 0px transparent' },
    check: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: brutal.border,
      borderColor: colors.ink,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: colors.primary },
    tint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.primary, opacity: 0.25 },
    body: { padding: spacing.sm + 2, gap: 6 },
    site: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  }),
);
