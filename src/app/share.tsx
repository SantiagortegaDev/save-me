import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useIncomingShare, type SharePayload } from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionPicker } from '../components/CollectionPicker';
import { Button, Icon, Text } from '../components/ui';
import { INBOX_ID } from '../db/schema';
import { haptic } from '../lib/haptics';
import { saveImage, saveLink } from '../lib/saving';
import { extractUrl, hostname } from '../lib/url';
import { brutal, colors, radius, spacing } from '../theme';

type Incoming = { kind: 'link'; url: string } | { kind: 'image'; uri: string; mimeType: string | null };

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function ShareScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { sharedPayloads, resolvedSharedPayloads, isResolving, clearSharedPayloads } = useIncomingShare();
  const [collectionId, setCollectionId] = useState(INBOX_ID);
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo<Incoming[]>(() => {
    const out: Incoming[] = [];
    const source = resolvedSharedPayloads.length ? resolvedSharedPayloads : sharedPayloads;
    for (const raw of source) {
      const p = raw as SharePayload & Partial<{ contentType: string | null; contentUri: string | null; contentMimeType: string | null }>;
      const contentType = p.contentType ?? null;
      const contentUri = p.contentUri ?? null;
      const mime = p.contentMimeType ?? p.mimeType ?? null;
      if ((p.shareType === 'image' || contentType === 'image') && (contentUri || p.value)) {
        out.push({ kind: 'image', uri: contentUri ?? p.value ?? '', mimeType: mime });
        continue;
      }
      const url = extractUrl(p.value) ?? (contentType === 'website' ? contentUri : null);
      if (url) out.push({ kind: 'link', url });
    }
    return out;
  }, [sharedPayloads, resolvedSharedPayloads]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      for (const item of items) {
        if (item.kind === 'link') await saveLink(db, item.url, { collectionId, pinned });
        else await saveImage(db, item.uri, { mimeType: item.mimeType, collectionId, pinned });
      }
      clearSharedPayloads();
      haptic.success();
      setDone(true);
      setTimeout(close, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const waiting = isResolving && items.length === 0;

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cancel" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.header}>
          <Text weight="bold" size="lg">
            Save to SaveMe
          </Text>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel">
            <Icon name="x" />
          </Pressable>
        </View>

        {done ? (
          <View style={styles.done}>
            <View style={[styles.doneBadge, brutal.shadow]}>
              <Icon name="check" size={36} />
            </View>
            <Text weight="bold" size="lg">
              Saved!
            </Text>
          </View>
        ) : waiting ? (
          <View style={styles.done}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.done}>
            <Text weight="bold">No link or image found</Text>
            <Text color={colors.inkMuted} style={{ textAlign: 'center' }}>
              SaveMe can save web links and images. Try sharing the post’s link instead.
            </Text>
            <Button title="Close" variant="plain" onPress={close} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled">
            {items.slice(0, 3).map((item, i) => (
              <View key={i} style={styles.preview}>
                {item.kind === 'image' ? (
                  <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.linkThumb]}>
                    <Icon name="link" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text weight="semibold" numberOfLines={1}>
                    {item.kind === 'link' ? hostname(item.url) : 'Image'}
                  </Text>
                  {item.kind === 'link' ? (
                    <Text size="xs" color={colors.inkMuted} numberOfLines={2}>
                      {item.url}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
            {items.length > 3 ? <Text size="sm">+{items.length - 3} more</Text> : null}
            <CollectionPicker value={collectionId} onChange={setCollectionId} />
            <View style={styles.pinRow}>
              <Text weight="semibold">Pin {items.length > 1 ? 'these' : 'this'}</Text>
              <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: colors.ink, false: '#D6D6D6' }} thumbColor={colors.white} />
            </View>
            {error ? (
              <Text color={colors.danger} weight="semibold">
                {error}
              </Text>
            ) : null}
            <Button title={items.length > 1 ? `Save ${items.length} items` : 'Save'} icon="bookmark" size="lg" loading={busy} onPress={save} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: brutal.border,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    padding: spacing.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, borderWidth: brutal.borderThin, borderColor: colors.ink },
  linkThumb: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  done: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  doneBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.accent,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
