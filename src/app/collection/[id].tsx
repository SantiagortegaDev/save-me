import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSaveSheet } from '../../components/AddSaveSheet';
import { collectionMenu, saveMenu } from '../../components/actions';
import { CollectionCard } from '../../components/CollectionCard';
import { CollectionForm } from '../../components/CollectionForm';
import { useGrid } from '../../components/grid';
import { MoveSheet } from '../../components/MoveSheet';
import { SaveCard } from '../../components/SaveCard';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button, Chip, EmptyState, Icon, IconButton, SectionHeader, Text } from '../../components/ui';
import {
  getCollection,
  getCollectionPath,
  listCollections,
  listSaves,
  type Collection,
  type Save,
  type SaveFilter,
} from '../../db/repo';
import { useQuery } from '../../lib/useQuery';
import { brutal, colors, spacing } from '../../theme';

const FILTERS: { key: SaveFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'links', label: 'Links' },
  { key: 'images', label: 'Images' },
  { key: 'pinned', label: 'Pinned' },
  { key: 'unseen', label: 'New' },
];

export default function CollectionScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; filter?: SaveFilter }>();
  const isAll = params.id === 'all';
  const collectionId = isAll ? null : params.id;
  const [filter, setFilter] = useState<SaveFilter>(params.filter ?? 'all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [creatingSub, setCreatingSub] = useState(false);
  const [moving, setMoving] = useState<Save | null>(null);
  const { itemWidth, gap } = useGrid(150);

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

  if (!isAll && !loading && !collection) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Not found" />
        <EmptyState emoji="🫥" title="Collection not found" message="It may have been deleted." />
      </View>
    );
  }

  const title = isAll ? 'All saves' : collection?.name ?? '';
  const accent = collection?.color ?? colors.primary;

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
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
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
            <Text weight="bold" size="xl" numberOfLines={2}>
              {title}
            </Text>
            <Text weight="medium" size="sm">
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

        <SectionHeader title="Saves" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={filter === f.key} color={accent} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>

        {saves && saves.length > 0 ? (
          <View style={[styles.grid, { gap, marginTop: spacing.md }]}>
            {saves.map((s) => (
              <SaveCard key={s.id} save={s} width={itemWidth} onLongPress={() => saveMenu(db, s, () => setMoving(s))} />
            ))}
          </View>
        ) : (
          <EmptyState
            emoji={filter === 'images' ? '🖼️' : filter === 'pinned' ? '📍' : '🔗'}
            title={filter === 'all' ? 'No saves yet' : 'Nothing here'}
            message={filter === 'all' ? 'Share something to SaveMe or tap + to add it here.' : 'Try another filter.'}
          />
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save to this collection"
        onPress={() => setAdding(true)}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + spacing.lg, backgroundColor: accent }, pressed ? null : brutal.shadow]}
      >
        <Icon name="plus" size={30} />
      </Pressable>

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
      <MoveSheet save={moving} onClose={() => setMoving(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
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
});
