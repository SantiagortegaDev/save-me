import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmDeleteSave } from '../../components/actions';
import { MoveSheet } from '../../components/MoveSheet';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { Button, Card, Chip, EmptyState, Icon, IconButton, Input, Label, Text } from '../../components/ui';
import {
  addTagToSave,
  getCollection,
  getSave,
  listTags,
  listTagsForSave,
  markSeen,
  removeTagFromSave,
  setSavePinned,
  updateSave,
  type Save,
} from '../../db/repo';
import { haptic } from '../../lib/haptics';
import { imageUri } from '../../lib/images';
import { refreshMetadata } from '../../lib/saving';
import { hostname } from '../../lib/url';
import { useQuery } from '../../lib/useQuery';
import { brutal, colors, spacing } from '../../theme';

function TagSheet({ save, visible, onClose }: { save: Save; visible: boolean; onClose: () => void }) {
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const { data: all } = useQuery(() => listTags(db), [db]);
  const { data: mine } = useQuery(() => listTagsForSave(db, save.id), [db, save.id]);
  const mineIds = new Set((mine ?? []).map((t) => t.id));

  async function add(tag: string) {
    if (!tag.trim()) return;
    try {
      await addTagToSave(db, save.id, tag);
      haptic.success();
      setName('');
    } catch (error) {
      Alert.alert('Could not add tag', String(error));
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Tags">
      <View style={styles.row}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="New tag, e.g. inspiration"
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={() => add(name)}
          style={{ flex: 1 }}
        />
        <Button icon="plus" accessibilityLabel="Add tag" onPress={() => add(name)} />
      </View>
      <Label>Your tags</Label>
      <View style={styles.wrap}>
        {(all ?? []).length === 0 ? (
          <Text color={colors.inkMuted}>No tags yet. Create your first one above.</Text>
        ) : (
          (all ?? []).map((t) => (
            <Chip
              key={t.id}
              label={`#${t.name}`}
              active={mineIds.has(t.id)}
              color={colors.lilac}
              onPress={() => (mineIds.has(t.id) ? removeTagFromSave(db, save.id, t.id) : add(t.name))}
            />
          ))
        )}
      </View>
    </Sheet>
  );
}

export default function SaveDetailScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: save, loading } = useQuery(() => getSave(db, id), [db, id]);

  if (!loading && !save) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Save" />
        <EmptyState emoji="🫥" title="Save not found" message="It may have been deleted." />
      </View>
    );
  }
  if (!save) return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  return <SaveDetail key={save.id} save={save} />;
}

function SaveDetail({ save }: { save: Save }) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { data: tags } = useQuery(() => listTagsForSave(db, save.id), [db, save.id]);
  const { data: collection } = useQuery(() => getCollection(db, save.collection_id), [db, save.collection_id]);
  const [title, setTitle] = useState(save.title);
  const [note, setNote] = useState(save.note ?? '');
  const [editingTitle, setEditingTitle] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [moving, setMoving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [zoom, setZoom] = useState(false);

  // Opening the details counts as having seen it.
  useEffect(() => {
    if (!save.seen) void markSeen(db, save.id);
  }, [db, save.id, save.seen]);

  const preview = save.kind === 'image' ? imageUri(save.image_path) : save.thumbnail;

  async function open() {
    if (save.kind !== 'link') return;
    await markSeen(db, save.id);
    await WebBrowser.openBrowserAsync(save.url, { toolbarColor: colors.paper, controlsColor: colors.ink }).catch(() =>
      Alert.alert('Unable to open link'),
    );
  }

  async function saveTitle() {
    setEditingTitle(false);
    if (title.trim() && title !== save.title) await updateSave(db, save.id, { title: title.trim() });
  }

  async function refresh() {
    Alert.alert('Refresh preview?', 'Updates the title, image and description. Your notes, tags and collection stay the same.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Refresh',
        onPress: async () => {
          setRefreshing(true);
          await refreshMetadata(db, save.id, save.url);
          setRefreshing(false);
          haptic.success();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader
        title={collection?.name ?? ''}
        right={
          <IconButton
            icon="map-pin"
            color={save.pinned ? colors.primary : colors.white}
            accessibilityLabel={save.pinned ? 'Unpin' : 'Pin'}
            onPress={() => setSavePinned(db, save.id, !save.pinned)}
          />
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Card>
          {preview ? (
            <Pressable onPress={() => (save.kind === 'image' ? setZoom(true) : open())} accessibilityLabel="Open">
              <Image source={{ uri: preview }} style={styles.preview} contentFit="cover" transition={150} />
            </Pressable>
          ) : (
            <View style={[styles.preview, styles.placeholder]}>
              <Icon name={save.kind === 'image' ? 'image' : 'link'} size={40} />
            </View>
          )}
          <View style={styles.body}>
            {editingTitle ? (
              <Input value={title} onChangeText={setTitle} autoFocus onBlur={saveTitle} onSubmitEditing={saveTitle} returnKeyType="done" />
            ) : (
              <Pressable onPress={() => setEditingTitle(true)} accessibilityLabel="Edit title">
                <Text weight="bold" size="xl">
                  {save.title || save.url}
                </Text>
              </Pressable>
            )}
            {save.kind === 'link' ? (
              <View style={styles.site}>
                {save.favicon ? <Image source={{ uri: save.favicon }} style={styles.favicon} /> : null}
                <Text size="sm" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
                  {save.site_name || hostname(save.url)} · {new Date(save.created_at).toLocaleDateString()}
                </Text>
              </View>
            ) : (
              <Text size="sm" color={colors.inkMuted}>
                Saved {new Date(save.created_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        </Card>

        <View style={styles.actions}>
          {save.kind === 'link' ? <Button title="Open" icon="external-link" style={{ flex: 1 }} onPress={open} /> : null}
          {save.kind === 'link' ? (
            <Button icon="share-2" variant="plain" accessibilityLabel="Share" onPress={() => Share.share({ message: save.url })} />
          ) : null}
          <Button icon="folder" variant="plain" accessibilityLabel="Move" onPress={() => setMoving(true)} />
          {save.kind === 'link' ? (
            <Button icon="refresh-cw" variant="plain" accessibilityLabel="Refresh preview" loading={refreshing} onPress={refresh} />
          ) : null}
          <Button icon="trash-2" variant="danger" accessibilityLabel="Delete" onPress={() => confirmDeleteSave(db, save, () => router.back())} />
        </View>

        {save.description ? (
          <>
            <Label style={styles.label}>Description</Label>
            <Text color={colors.inkMuted}>{save.description}</Text>
          </>
        ) : null}

        <Label style={styles.label}>Tags</Label>
        <View style={styles.wrap}>
          {(tags ?? []).map((t) => (
            <Chip key={t.id} label={`#${t.name}  ✕`} active color={colors.lilac} onPress={() => removeTagFromSave(db, save.id, t.id)} />
          ))}
          <Chip label="Add tag" icon="plus" onPress={() => setTagging(true)} />
        </View>

        <Label style={styles.label}>Notes</Label>
        <Input
          multiline
          value={note}
          onChangeText={setNote}
          placeholder="Why did you save this? Write your notes here…"
          onBlur={() => note !== (save.note ?? '') && updateSave(db, save.id, { note: note.trim() || null })}
        />

        {save.kind === 'link' ? (
          <>
            <Label style={styles.label}>Link</Label>
            <Text size="sm" color={colors.inkMuted} selectable>
              {save.url}
            </Text>
          </>
        ) : null}
      </ScrollView>

      <TagSheet save={save} visible={tagging} onClose={() => setTagging(false)} />
      <MoveSheet save={moving ? save : null} onClose={() => setMoving(false)} />
      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <Pressable style={styles.zoom} onPress={() => setZoom(false)} accessibilityLabel="Close image">
          {preview ? <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, gap: spacing.sm, maxWidth: 760, width: '100%', alignSelf: 'center' },
  preview: { width: '100%', aspectRatio: 1.6, borderBottomWidth: brutal.border, borderColor: colors.ink },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EADB' },
  body: { padding: spacing.md, gap: spacing.sm },
  site: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  favicon: { width: 16, height: 16, borderRadius: 3 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  label: { marginTop: spacing.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  zoom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
});
