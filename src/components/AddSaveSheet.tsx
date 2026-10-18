import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { INBOX_ID } from '../db/schema';
import { haptic } from '../lib/haptics';
import { saveImage, saveLink } from '../lib/saving';
import { extractUrl, normalizeUrl } from '../lib/url';
import { colors, spacing } from '../theme';
import { CollectionPicker } from './CollectionPicker';
import { Sheet } from './Sheet';
import { Button, Input, Label, Text } from './ui';

type Props = { onClose: () => void; defaultCollectionId?: string };

export function AddSaveSheet({ visible, ...props }: Props & { visible: boolean }) {
  return (
    <Sheet visible={visible} onClose={props.onClose} title="Save something">
      {visible ? <AddSaveForm {...props} /> : null}
    </Sheet>
  );
}

function AddSaveForm({ onClose, defaultCollectionId }: Props) {
  const db = useSQLiteContext();
  const [url, setUrl] = useState('');
  const [collectionId, setCollectionId] = useState(defaultCollectionId ?? INBOX_ID);
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Pre-fill from the clipboard when it holds a link.
    Clipboard.hasUrlAsync()
      .then(async (has) => {
        if (!has) return;
        const text = await Clipboard.getStringAsync();
        const found = extractUrl(text);
        if (found) setUrl(found);
      })
      .catch(() => {});
  }, []);

  async function pasteLink() {
    const text = await Clipboard.getStringAsync();
    const found = extractUrl(text) ?? normalizeUrl(text);
    if (!found) {
      Alert.alert('Nothing to paste', 'Copy a link first, then tap Paste.');
      return;
    }
    setUrl(found);
  }

  async function submitLink() {
    if (!normalizeUrl(url)) {
      Alert.alert('Invalid link', 'Please enter a valid http or https link.');
      return;
    }
    setBusy(true);
    try {
      const res = await saveLink(db, url, { collectionId, pinned });
      haptic.success();
      onClose();
      if (res.duplicate) {
        Alert.alert('Already saved', 'This link is already in your library.', [
          { text: 'OK' },
          { text: 'Open', onPress: () => router.push(`/save/${res.id}`) },
        ]);
      }
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function pickImages() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (result.canceled) return;
    setBusy(true);
    try {
      for (const asset of result.assets) {
        await saveImage(db, asset.uri, { mimeType: asset.mimeType, title: asset.fileName ?? undefined, collectionId, pinned });
      }
      haptic.success();
      onClose();
    } catch (error) {
      Alert.alert('Save failed', String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Label>Link</Label>
      <View style={styles.row}>
        <Input
          value={url}
          onChangeText={setUrl}
          placeholder="Paste a link to save…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={submitLink}
          style={{ flex: 1 }}
        />
        <Button icon="clipboard" variant="plain" accessibilityLabel="Paste" onPress={pasteLink} />
      </View>
      <CollectionPicker value={collectionId} onChange={setCollectionId} />
      <View style={styles.pinRow}>
        <Text weight="semibold">Pin this save</Text>
        <Switch
          value={pinned}
          onValueChange={setPinned}
          trackColor={{ true: colors.ink, false: '#D6D6D6' }}
          thumbColor={colors.white}
        />
      </View>
      <Button title="Save link" icon="bookmark" size="lg" loading={busy} onPress={submitLink} />
      <Button title="Save images from gallery" icon="image" variant="plain" disabled={busy} onPress={pickImages} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  pinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
