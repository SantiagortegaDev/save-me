import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';

import { listAllCollections } from '../db/repo';
import { useQuery } from '../lib/useQuery';
import { spacing } from '../theme';
import { Chip } from './ui';

// Horizontal-wrapping chips to choose a destination collection.
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
  return (
    <View style={styles.wrap}>
      {(data ?? [])
        .filter((c) => c.id !== excludeId)
        .map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            icon={c.is_inbox ? 'inbox' : undefined}
            color={c.color}
            active={value === c.id}
            onPress={() => onChange(c.id)}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm } });
