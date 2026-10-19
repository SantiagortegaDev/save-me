import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSaveSheet } from '../../components/AddSaveSheet';
import { collectionMenu, confirmDeleteSaves, saveMenu } from '../../components/actions';
import { BulkTagSheet } from '../../components/BulkTagSheet';
import { CollectionCard } from '../../components/CollectionCard';
import { CollectionForm } from '../../components/CollectionForm';
import { useGrid } from '../../components/grid';
import { MoveSheet } from '../../components/MoveSheet';
import { SaveGrid } from '../../components/SaveGrid';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button, Chip, EmptyState, Icon, IconButton, SectionHeader, Text, type IconName } from '../../components/ui';
import {
  getCollection,
  getCollectionPath,
  listCollections,
  listSaves,
  setPinnedMany,
  setSeenMany,
  type Collection,
  type Save,
  type SaveFilter,
} from '../../db/repo';
import { haptic } from '../../lib/haptics';
import { useQuery } from '../../lib/useQuery';
import { brutal, colors, spacing, themed } from '../../theme';
import { useTheme } from '../../lib/theme';

const FILTERS: { key: SaveFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'links', label: 'Links' },
  { key: 'images', label: 'Images' },
  { key: 'pinned', label: 'Pinned' },
  { key: 'unseen', label: 'New' },
];

export default function CollectionScreen() {
  useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; filter?: SaveFilter }>();
  const isAll = params.id === 'all';
  const collectionId = isAll ? null : params.id;
  const [filter, setFilter] = useState<SaveFilter>(params.filter ?? 'all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [creatingSub, setCreatingSub] = useState(false);
  const [moving, setMoving] = useState<Save[] | null>(null);
  // Ids of the selected saves while selecting several; null when not selecting.
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [bulkTagging, setBulkTagging] = useState(false);
  const { columns, itemWidth, gap } = useGrid(150);

  const { data: collection, loading } = useQuery(
    () => (collectionId ? getCollection(db, collectionId) : Promise.resolve(null)),
    [db, collectionId],
  );
  const { data: path } = useQuery(
    () => (collectionId ? getCollectionPath(db, collectionId) : Promise.resolve([])),
    [db, collectionId],
  );
  const { data: children } = useQuery(
    () => (collectionId ? listCollections(db, collectionId) : Promise.resolve([])),
    [db, collectionId],
  );
  const { data: saves } = useQuery(() => listSaves(db, { collectionId, filter }), [db, collectionId, filter]);

  // Android back leaves selection mode before leaving the screen.
  useEffect(() => {
    if (!selection) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelection(null);
      return true;
    });
    return () => sub.remove();
  }, [selection]);

  if (!isAll && !loading && !collection) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Not found" />
        <EmptyState art="missing" title="Collection not found" message="It may have been deleted." />
      </View>
    );
  }

  const title = isAll ? 'All saves' : collection?.name ?? '';
  const accent = collection?.color ?? colors.primary;
  const selected = (saves ?? []).filter((s) => selection?.has(s.id));
  const selectedIds = selected.map((s) => s.id);
  const allSelected = !!saves?.length && selected.length === saves.length;

  function toggle(save: Save) {
    haptic.select();
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(save.id)) next.delete(save.id);
      else next.add(save.id);
      return next;
    });
  }

  function startSelecting(save?: Save) {
    haptic.select();
    setSelection(new Set(save ? [save.id] : []));
  }

  const allPinned = selected.length > 0 && selected.every((s) => s.pinned);
  const bulkActions: { icon: IconName; label: string; onPress: () => void; danger?: boolean }[] = [
    { icon: 'folder', label: 'Move', onPress: () => setMoving(selected) },
    { icon: 'tag', label: 'Tag', onPress: () => setBulkTagging(true) },
    {
      icon: 'map-pin',
      label: allPinned ? 'Unpin' : 'Pin',
      onPress: async () => {
        await setPinnedMany(db, selectedIds, !allPinned);
        haptic.success();
      },
    },
    {
      icon: 'check-circle',
      label: 'Opened',
      onPress: async () => {
        await setSeenMany(db, selectedIds, true);
        haptic.success();
      },
    },
    { icon: 'trash-2', label: 'Delete', danger: true, onPress: () => confirmDeleteSaves(db, selectedIds, () => setSelection(null)) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader
        title={title}
        right={
          collection ? (
            <IconButton icon="more-horizontal" accessibilityLabel="Collection options" onPress={() => collectionMenu(db, collection, () => setEditing(collection))} />
          ) : null
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (selection ? 190 : 120) }]}>
        {path && path.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crumbs}>
            {path.map((p, i) => (
              <View key={p.id} style={styles.crumb}>
                {i > 0 ? <Icon name="chevron-right" size={14} color={colors.inkMuted} /> : null}
                <Pressable onPress={() => (p.id === collectionId ? null : router.push(`/collection/${p.id}`))}>
                  <Text size="sm" weight={p.id === collectionId ? 'bold' : 'medium'} color={p.id === collectionId ? colors.ink : colors.inkMuted}>
                    {p.name}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={[styles.hero, brutal.shadow, { backgroundColor: accent }]}>
          <View style={{ flex: 1 }}>
            <Text weight="bold" size="xl" numberOfLines={2} color={colors.ink}>
              {title}
            </Text>
            <Text weight="medium" size="sm" color={colors.ink}>
              {saves?.length ?? 0}{' '}
              {filter === 'all' ? (saves?.length === 1 ? 'save' : 'saves') : FILTERS.find((f) => f.key === filter)?.label.toLowerCase()}
            </Text>
          </View>
          <Button
            title="Focus"
            icon="layers"
            variant="plain"
            size="sm"
            accessibilityHint="Review this collection's saves one by one"
            onPress={() => router.push(collectionId ? `/focus?collectionId=${collectionId}&scope=all` : '/focus?scope=all')}
          />
        </View>

        {collectionId ? (
          <>
            <SectionHeader
              title="Sub-collections"
              right={
                <Pressable onPress={() => setCreatingSub(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Create sub-collection">
                  <Text weight="bold" size="sm">
                    + New
                  </Text>
                </Pressable>
              }
            />
            {children && children.length > 0 ? (
              <View style={[styles.grid, { gap }]}>
                {children.map((c) => (
                  <CollectionCard key={c.id} collection={c} width={itemWidth} onLongPress={() => collectionMenu(db, c, () => setEditing(c))} />
                ))}
              </View>
            ) : (
              <Text size="sm" color={colors.inkMuted}>
                Group saves further with sub-collections.
              </Text>
            )}
          </>
        ) : null}

        <SectionHeader
          title="Saves"
          right={
            saves && saves.length > 0 ? (
              <Pressable
                onPress={() => (selection ? setSelection(null) : startSelecting())}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={selection ? 'Stop selecting' : 'Select saves'}
                style={[styles.selectToggle, selection && { backgroundColor: colors.primary }]}
              >
                <Icon name={selection ? 'x' : 'check-square'} size={14} color={selection ? colors.ink : colors.text} />
                <Text weight="bold" size="xs" color={selection ? colors.ink : colors.text}>
                  {selection ? 'Cancel' : 'Select'}
                </Text>
              </Pressable>
            ) : null
          }
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={filter === f.key} color={accent} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>

        {saves && saves.length > 0 ? (
          <View style={{ marginTop: spacing.md }}>
            <SaveGrid
              saves={saves}
              columns={columns}
              itemWidth={itemWidth}
              gap={gap}
              selection={selection}
              onPress={selection ? toggle : undefined}
              onLongPress={(s) => (selection ? toggle(s) : saveMenu(db, s, () => setMoving([s]), () => startSelecting(s)))}
            />
          </View>
        ) : (
          <EmptyState
            art={filter === 'images' ? 'image' : filter === 'pinned' ? 'pin' : 'link'}
            title={filter === 'all' ? 'No saves yet' : 'Nothing here'}
            message={filter === 'all' ? 'Share something to SaveMe or tap + to add it here.' : 'Try another filter.'}
          />
        )}
      </ScrollView>

      {selection ? (
        <View style={[styles.bulk, brutal.shadow, { bottom: insets.bottom + spacing.md }]}>
          <View style={styles.bulkHead}>
            <Text weight="heavy" style={{ flex: 1 }}>
              {selected.length} selected
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                haptic.select();
                setSelection(allSelected ? new Set() : new Set((saves ?? []).map((s) => s.id)));
              }}
              style={styles.selectToggle}
            >
              <Icon name={allSelected ? 'square' : 'check-square'} size={14} />
              <Text weight="bold" size="xs">
                {allSelected ? 'None' : 'All'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.bulkActions}>
            {bulkActions.map((a, i) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                disabled={selected.length === 0}
                onPress={() => {
                  haptic.tap();
                  a.onPress();
                }}
                style={({ pressed }) => [
                  styles.bulkAction,
                  i > 0 && styles.bulkDivider,
                  pressed && { backgroundColor: colors.pressed },
                  selected.length === 0 && { opacity: 0.4 },
                ]}
              >
                <Icon name={a.icon} size={18} color={a.danger ? colors.danger : colors.text} />
                <Text size="xxs" weight="bold" color={a.danger ? colors.danger : colors.text}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save to this collection"
          onPress={() => setAdding(true)}
          style={({ pressed }) => [styles.fab, { bottom: insets.bottom + spacing.lg, backgroundColor: accent }, pressed ? null : brutal.shadow]}
        >
          <Icon name="plus" size={30} color={colors.ink} />
        </Pressable>
      )}

      <AddSaveSheet visible={adding} onClose={() => setAdding(false)} defaultCollectionId={collectionId ?? undefined} />
      <CollectionForm
        visible={!!editing || creatingSub}
        editing={editing}
        parentId={creatingSub ? collectionId : null}
        onClose={() => {
          setEditing(null);
          setCreatingSub(false);
        }}
      />
      <MoveSheet saves={moving} onClose={() => setMoving(null)} onMoved={() => setSelection(null)} />
      <BulkTagSheet ids={bulkTagging ? selectedIds : null} onClose={() => setBulkTagging(false)} onDone={() => setSelection(null)} />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: { paddingHorizontal: spacing.md, maxWidth: 1000, width: '100%', alignSelf: 'center' },
    crumbs: { gap: 4, paddingBottom: spacing.sm },
    crumb: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: 16,
      borderWidth: brutal.border,
      borderColor: colors.ink,
      marginTop: spacing.xs,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    filters: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.md },
    selectToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1.5,
      borderColor: colors.ink,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.surface,
    },
    bulk: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      maxWidth: 560,
      alignSelf: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      backgroundColor: colors.card,
      borderWidth: brutal.border,
      borderColor: colors.ink,
      borderRadius: 16,
    },
    bulkHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: spacing.sm },
    bulkActions: { flexDirection: 'row', borderWidth: brutal.border, borderColor: colors.ink, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
    bulkAction: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10 },
    bulkDivider: { borderLeftWidth: brutal.borderThin, borderColor: colors.ink },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      width: 64,
      height: 64,
      borderRadius: 20,
      borderWidth: brutal.border,
      borderColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
