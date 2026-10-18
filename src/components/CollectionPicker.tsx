import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listAllCollections } from '../db/repo';
import { haptic } from '../lib/haptics';
import { useQuery } from '../lib/useQuery';
import { brutal, colors, radius, spacing } from '../theme';
import { CollectionForm } from './CollectionForm';
import { Icon, Text, type IconName } from './ui';

// Radio list of collections with a "New collection" shortcut, used by the save, share and move sheets.
export function CollectionPicker({
  value,
  onChange,
  excludeId,
}: {
  value: string;
  onChange: (id: string) => void;
  excludeId?: string;
}) {
  const db = useSQLiteContext();
  const { data } = useQuery(() => listAllCollections(db), [db]);
  const [creating, setCreating] = useState(false);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.header}>
        <Text weight="bold" size="sm">
          Save to collection
        </Text>
        <Pressable onPress={() => setCreating(true)} style={[styles.newButton, brutal.shadowSmall]} accessibilityRole="button">
          <Icon name="plus" size={14} />
          <Text size="xs" weight="bold">
            New collection
          </Text>
        </Pressable>
      </View>
      {(data ?? [])
        .filter((c) => c.id !== excludeId)
        .map((c) => {
          const selected = value === c.id;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={c.name}
              onPress={() => {
                haptic.select();
                onChange(c.id);
              }}
              style={[styles.row, selected ? [styles.rowSelected, brutal.shadowSmall] : null]}
            >
              <View style={[styles.badge, { backgroundColor: c.color }]}>
                <Icon name={(c.is_inbox ? 'inbox' : c.icon) as IconName} size={16} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text weight="bold" size="sm" numberOfLines={1}>
                  {c.name}
                </Text>
                <Text size="xxs" color={colors.inkMuted}>
                  {c.save_count} {c.save_count === 1 ? 'item' : 'items'}
                </Text>
              </View>
              <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
            </Pressable>
          );
        })}
      <CollectionForm visible={creating} onClose={() => setCreating(false)} onSaved={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.card,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    borderRadius: radius.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 10,
    backgroundColor: colors.card,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
  rowSelected: { backgroundColor: '#FFF1DE', borderWidth: brutal.border },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 7,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.inkLight, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
});
