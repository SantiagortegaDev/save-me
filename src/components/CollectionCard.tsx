import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CollectionWithCount } from '../db/repo';
import { haptic } from '../lib/haptics';
import { brutal, colors, radius, spacing } from '../theme';
import { Icon, Text, type IconName } from './ui';

const TAB_HEIGHT = 14;

// A folder: a colored tab sitting on a white card with a small colored icon badge.
export function CollectionCard({
  collection,
  width,
  hasNew,
  onLongPress,
}: {
  collection: CollectionWithCount;
  width: number;
  hasNew?: boolean;
  onLongPress?: () => void;
}) {
  const color = collection.color;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open collection ${collection.name}`}
      onPress={() => {
        haptic.tap();
        router.push(`/collection/${collection.id}`);
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => [{ width, paddingTop: TAB_HEIGHT - brutal.border }, pressed && styles.pressed]}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.tab, { backgroundColor: color }]} />
          <View style={[styles.body, pressed ? brutal.shadowSmall : brutal.shadow]}>
            <View style={styles.top}>
              <View style={[styles.badge, { backgroundColor: color }]}>
                <Icon name={collection.icon as IconName} size={18} color={colors.white} />
              </View>
              <View style={styles.meta}>
                <Text size="xxs" weight="semibold" color={colors.inkMuted} numberOfLines={1}>
                  {collection.save_count} {collection.save_count === 1 ? 'item' : 'items'}
                </Text>
                {collection.child_count ? (
                  <Text size="xxs" weight="semibold" color={colors.inkMuted} numberOfLines={1}>
                    {collection.child_count} {collection.child_count === 1 ? 'folder' : 'folders'}
                  </Text>
                ) : null}
              </View>
              {hasNew ? (
                <View style={styles.newBadge}>
                  <Text size="xxs" weight="heavy">
                    NEW
                  </Text>
                </View>
              ) : collection.pinned ? (
                <Icon name="map-pin" size={14} />
              ) : null}
            </View>
            <Text weight="bold" size="sm" numberOfLines={2} style={styles.name}>
              {collection.name}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  tab: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '46%',
    height: TAB_HEIGHT + 6,
    borderWidth: brutal.border,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  body: {
    minHeight: 112,
    backgroundColor: colors.card,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.md,
    borderTopLeftRadius: 0,
    padding: spacing.sm + 2,
    justifyContent: 'space-between',
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, paddingTop: 1, gap: 1 },
  newBadge: {
    backgroundColor: colors.primary,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  name: { marginTop: spacing.md, lineHeight: 17 },
});
