import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listTags, tagSaves } from '../db/repo';
import { Alert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { useQuery } from '../lib/useQuery';
import { colors, spacing } from '../theme';
import { Sheet } from './Sheet';
import { Button, Chip, Input, Label, Text } from './ui';

// Adds one tag to several saves at once.
export function BulkTagSheet({ ids, onClose, onDone }: { ids: string[] | null; onClose: () => void; onDone?: () => void }) {
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const { data: all } = useQuery(() => listTags(db), [db]);
  const count = ids?.length ?? 0;

  async function apply(tag: string) {
    if (!ids || !tag.trim()) return;
    try {
      await tagSaves(db, ids, tag);
      haptic.success();
      setName('');
      onDone?.();
      onClose();
    } catch (error) {
      Alert.alert('Could not add tag', String(error));
    }
  }

  return (
    <Sheet visible={count > 0} onClose={onClose} title={`Tag ${count} ${count === 1 ? 'save' : 'saves'}`}>
      <View style={styles.row}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="New tag, e.g. inspiration"
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={() => apply(name)}
          style={{ flex: 1 }}
        />
        <Button icon="plus" accessibilityLabel="Add tag" disabled={!name.trim()} onPress={() => apply(name)} />
      </View>
      <Label>Your tags</Label>
      <View style={styles.wrap}>
        {(all ?? []).length === 0 ? (
          <Text color={colors.inkMuted}>No tags yet. Create your first one above.</Text>
        ) : (
          (all ?? []).map((t) => <Chip key={t.id} label={`#${t.name}`} color={colors.lilac} onPress={() => apply(t.name)} />)
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
