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
import { Button, Chip, EmptyState, Icon, IconButton, Input, Label, Text, type IconName } from '../../components/ui';
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
import { brutal, colors, radius, spacing } from '../../theme';

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

  const [expanded, setExpanded] = useState(false);
  const date = new Date(save.created_at);
  const dateLabel = `${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}, ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  const actions: { icon: IconName; label: string; onPress: () => void; danger?: boolean; show: boolean }[] = [
    { icon: 'share', label: 'Share', onPress: () => Share.share({ message: save.url }), show: save.kind === 'link' },
    { icon: 'folder', label: 'Move', onPress: () => setMoving(true), show: true },
    { icon: 'refresh-cw', label: refreshing ? '…' : 'Refresh', onPress: refresh, show: save.kind === 'link' },
    { icon: 'trash-2', label: 'Delete', onPress: () => confirmDeleteSave(db, save, () => router.back()), danger: true, show: true },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          {preview ? (
            <Pressable onPress={() => (save.kind === 'image' ? setZoom(true) : open())} accessibilityLabel="Open" style={StyleSheet.absoluteFill}>
              <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            </Pressable>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
              <Icon name={save.kind === 'image' ? 'image' : 'link'} size={48} />
            </View>
          )}
          <View style={[styles.heroBar, { top: insets.top + spacing.sm }]}>
            <IconButton icon="arrow-left" accessibilityLabel="Back" size={38} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
            <IconButton
              icon="map-pin"
              size={38}
              color={save.pinned ? colors.primary : colors.white}
              accessibilityLabel={save.pinned ? 'Unpin' : 'Pin'}
              onPress={() => setSavePinned(db, save.id, !save.pinned)}
            />
          </View>
        </View>

        <View style={[styles.sheet, brutal.shadow]}>
          <View style={styles.source}>
            <View style={styles.sourceIcon}>
              {save.kind === 'link' && save.favicon ? (
                <Image source={{ uri: save.favicon }} style={{ width: 14, height: 14 }} />
              ) : (
                <Icon name={save.kind === 'image' ? 'image' : 'globe'} size={12} />
              )}
            </View>
            <Text size="xs" weight="bold" numberOfLines={1} style={{ flex: 1 }}>
              {save.kind === 'link' ? save.site_name || hostname(save.url) : 'Image'}
            </Text>
          </View>

          <View style={styles.titleRow}>
            {editingTitle ? (
              <Input value={title} onChangeText={setTitle} autoFocus onBlur={saveTitle} onSubmitEditing={saveTitle} returnKeyType="done" style={{ flex: 1 }} />
            ) : (
              <Text weight="heavy" size="xl" style={{ flex: 1, lineHeight: 28 }}>
                {save.title || save.url}
              </Text>
            )}
            {!editingTitle ? (
              <IconButton icon="edit-2" size={34} accessibilityLabel="Edit title" onPress={() => setEditingTitle(true)} />
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {collection ? (
              <Pressable onPress={() => router.push(`/collection/${collection.id}`)} style={styles.collectionChip} accessibilityRole="button">
                <View style={[styles.dot, { backgroundColor: collection.color }]} />
                <Text size="xxs" weight="bold" numberOfLines={1}>
                  {collection.name}
                </Text>
              </Pressable>
            ) : null}
            <Text size="xxs" color={colors.inkMuted}>
              {dateLabel}
            </Text>
          </View>

          {save.kind === 'link' ? (
            <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Open link" style={({ pressed }) => [styles.openBar, pressed ? null : brutal.shadowSmall]}>
              <View style={{ flex: 1 }}>
                <Text weight="heavy">Open link</Text>
                <Text size="xxs" color={colors.inkMuted} numberOfLines={1}>
                  {save.url.replace(/^https?:\/\//, '')}
                </Text>
              </View>
              <View style={styles.openArrow}>
                <Icon name="arrow-up-right" size={18} color={colors.white} />
              </View>
            </Pressable>
          ) : null}

          <View style={styles.actionBar}>
            {actions
              .filter((a) => a.show)
              .map((a, i) => (
                <Pressable
                  key={a.label}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  onPress={() => {
                    haptic.tap();
                    a.onPress();
                  }}
                  style={({ pressed }) => [styles.action, i > 0 && styles.actionDivider, pressed && { backgroundColor: '#F2F2EE' }]}
                >
                  <Icon name={a.icon} size={18} color={a.danger ? colors.danger : colors.ink} />
                  <Text size="xxs" weight="bold" color={a.danger ? colors.danger : colors.ink}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
          </View>

          {save.description ? (
            <>
              <Label style={styles.label}>Description</Label>
              <Text size="sm" color={colors.inkMuted} numberOfLines={expanded ? undefined : 4}>
                {save.description}
              </Text>
              {save.description.length > 180 ? (
                <Text size="xs" weight="bold" onPress={() => setExpanded(!expanded)} style={{ textDecorationLine: 'underline' }}>
                  {expanded ? 'Show less' : 'Show more'}
                </Text>
              ) : null}
            </>
          ) : null}

          <Label style={styles.label}>Tags</Label>
          <View style={styles.wrap}>
            {(tags ?? []).map((t) => (
              <Pressable key={t.id} onPress={() => removeTagFromSave(db, save.id, t.id)} accessibilityLabel={`Remove tag ${t.name}`} style={styles.tagChip}>
                <Text size="xs" weight="bold">
                  #{t.name}
                </Text>
                <Icon name="x" size={12} />
              </Pressable>
            ))}
            <Pressable onPress={() => setTagging(true)} accessibilityRole="button" style={styles.addTag}>
              <Icon name="plus" size={12} />
              <Text size="xs" weight="bold">
                Add
              </Text>
            </Pressable>
          </View>

          <Label style={styles.label}>Notes</Label>
          <Input
            multiline
            value={note}
            onChangeText={setNote}
            placeholder="Why did you save this? Write your notes here…"
            onBlur={() => note !== (save.note ?? '') && updateSave(db, save.id, { note: note.trim() || null })}
            style={styles.notes}
          />
        </View>
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
  hero: { height: 300, backgroundColor: '#F1EADB', borderBottomWidth: brutal.border, borderColor: colors.ink },
  heroBar: { position: 'absolute', left: spacing.md, right: spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  sheet: {
    marginTop: -48,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.lg,
    maxWidth: 760,
    alignSelf: 'center',
    width: '92%',
  },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  collectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.cream,
  },
  dot: { width: 10, height: 10, borderRadius: 3, borderWidth: 1, borderColor: colors.ink },
  openBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: 12,
    backgroundColor: colors.primary,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
  openArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  actionBar: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  action: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10 },
  actionDivider: { borderLeftWidth: brutal.borderThin, borderColor: colors.ink },
  label: { marginTop: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  notes: { backgroundColor: colors.cream, borderWidth: brutal.borderThin },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  zoom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
});
