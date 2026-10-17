import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { createCollection, updateCollection, type Collection } from '../db/repo';
import { haptic } from '../lib/haptics';
import { brutal, collectionColors, collectionIcons, colors, radius } from '../theme';
import { Sheet } from './Sheet';
import { Button, Icon, Input, Label, type IconName } from './ui';

type FormProps = {
  onClose: () => void;
  editing?: Collection | null;
  parentId?: string | null;
  onSaved?: (id: string) => void;
};

export function CollectionForm({ visible, ...props }: FormProps & { visible: boolean }) {
  const { editing, parentId, onClose } = props;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'Edit collection' : parentId ? 'New sub-collection' : 'New collection'}
    >
      {visible ? <CollectionFormBody {...props} /> : null}
    </Sheet>
  );
}

function CollectionFormBody({ onClose, editing, parentId, onSaved }: FormProps) {
  const db = useSQLiteContext();
  const [name, setName] = useState(editing?.name ?? '');
  const [color, setColor] = useState<string>(
    () => editing?.color ?? collectionColors[Math.floor(Math.random() * collectionColors.length)],
  );
  const [icon, setIcon] = useState<string>(editing?.icon ?? 'folder');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your collection a name.');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await updateCollection(db, editing.id, { name, color, icon });
        onSaved?.(editing.id);
      } else {
        const id = await createCollection(db, { name, color, icon, parentId });
        onSaved?.(id);
      }
      haptic.success();
      onClose();
    } catch (error) {
      Alert.alert('Could not save collection', String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Label>Name</Label>
      <Input
        value={name}
        onChangeText={setName}
        placeholder="e.g. Recipes, Travel, Design ideas…"
        autoFocus={!editing}
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Label>Color</Label>
      <View style={styles.wrap}>
        {collectionColors.map((c) => (
          <Pressable
            key={c}
            accessibilityLabel={`Color ${c}`}
            onPress={() => {
              haptic.select();
              setColor(c);
            }}
            style={[styles.swatch, { backgroundColor: c }, color === c && styles.selected]}
          >
            {color === c ? <Icon name="check" size={18} /> : null}
          </Pressable>
        ))}
      </View>
      <Label>Icon</Label>
      <View style={styles.wrap}>
        {collectionIcons.map((i) => (
          <Pressable
            key={i}
            accessibilityLabel={`Icon ${i}`}
            onPress={() => {
              haptic.select();
              setIcon(i);
            }}
            style={[styles.iconCell, { backgroundColor: icon === i ? color : colors.white }, icon === i && styles.selected]}
          >
            <Icon name={i as IconName} size={18} />
          </Pressable>
        ))}
      </View>
      <Button title={editing ? 'Save changes' : 'Create collection'} size="lg" loading={busy} onPress={submit} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { boxShadow: '2px 2px 0px #111111', borderWidth: brutal.border },
});
