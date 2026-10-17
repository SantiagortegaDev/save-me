import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { CollectionWithCount } from '../db/repo';
import { brutal, colors, spacing } from '../theme';
import { Card, Icon, Text, type IconName } from './ui';

export function CollectionCard({
  collection,
  width,
  onLongPress,
}: {
  collection: CollectionWithCount;
  width: number;
  onLongPress?: () => void;
}) {
  return (
    <Card
      accessibilityLabel={`Open collection ${collection.name}`}
      onPress={() => router.push(`/collection/${collection.id}`)}
      onLongPress={onLongPress}
      color={collection.color}
      style={[styles.card, { width }]}
    >
      <View style={styles.top}>
        <View style={styles.iconBadge}>
          <Icon name={collection.icon as IconName} size={18} />
        </View>
        {collection.pinned ? <Icon name="map-pin" size={16} /> : null}
      </View>
      <Text weight="bold" size="md" numberOfLines={2}>
        {collection.name}
      </Text>
      <Text weight="medium" size="sm" color={colors.ink}>
        {collection.save_count} {collection.save_count === 1 ? 'save' : 'saves'}
        {collection.child_count ? ` · ${collection.child_count} sub` : ''}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.xs, minHeight: 120 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
