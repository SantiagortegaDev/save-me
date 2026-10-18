import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionCard } from '../components/CollectionCard';
import { useGrid } from '../components/grid';
import { SaveCard } from '../components/SaveCard';
import { TagChip } from '../components/TagChip';
import { Chip, EmptyState, Icon, SectionHeader, Text, type IconName } from '../components/ui';
import { deleteTag, getStats, listSaves, listTags, search, type TagWithCount } from '../db/repo';
import { useQuery } from '../lib/useQuery';
import { brutal, colors, fonts, fontSize, radius, spacing } from '../theme';

const TILTS = [-4, 3, -2, 4, -3, 2];

function Stat({ icon, value, label, active, onPress }: { icon: IconName; value: number; label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}`} style={[styles.stat, active && styles.statActive]}>
      <Icon name={icon} size={16} />
      <Text weight="heavy" size="lg">
        {value}
      </Text>
      <Text size="xxs" weight="semibold">
        {label}
      </Text>
    </Pressable>
  );
}

export default function SearchScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { itemWidth, gap } = useGrid(150);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tag, setTag] = useState<TagWithCount | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results } = useQuery(
    () => (debounced.trim() ? search(db, debounced) : Promise.resolve(null)),
    [db, debounced],
  );
  const { data: tags } = useQuery(() => listTags(db), [db]);
  const { data: stats } = useQuery(() => getStats(db), [db]);
  const { data: tagSaves } = useQuery(
    () => (tag ? listSaves(db, { tagId: tag.id }) : Promise.resolve([])),
    [db, tag?.id],
  );

  function confirmDeleteTag(t: TagWithCount) {
    Alert.alert(`#${t.name}`, 'Delete this tag? Saves keep everything else.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete tag',
        style: 'destructive',
        onPress: async () => {
          await deleteTag(db, t.id);
          setTag(null);
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.searchBox, { paddingTop: insets.top + spacing.sm }]}>
        <View style={[styles.searchInput, brutal.shadowSmall]}>
          <Icon name="search" size={16} color={colors.inkMuted} />
          <TextInput
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              setTag(null);
            }}
            placeholder="Find collections or saves…"
            placeholderTextColor={colors.inkLight}
            autoFocus={params.tab !== 'tags'}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.searchText}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear">
              <Icon name="x" size={16} color={colors.inkMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[styles.cancel, brutal.shadowSmall]} accessibilityRole="button">
          <Text weight="bold" size="sm">
            Cancel
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        {results ? (
          results.collections.length + results.saves.length + results.tags.length === 0 ? (
            <EmptyState emoji="🔍" title="No results found" message={`Nothing matches "${debounced}".`} />
          ) : (
            <>
              {results.tags.length > 0 ? (
                <>
                  <SectionHeader title="Tags" />
                  <View style={styles.tagCloud}>
                    {results.tags.map((t, i) => (
                      <TagChip
                        key={t.id}
                        name={t.name}
                        count={t.save_count}
                        tilt={TILTS[i % TILTS.length]}
                        onPress={() => {
                          setQuery('');
                          setTag(t);
                        }}
                      />
                    ))}
                  </View>
                </>
              ) : null}
              {results.collections.length > 0 ? (
                <>
                  <SectionHeader title="Collections" />
                  <View style={[styles.grid, { gap }]}>
                    {results.collections.map((c) => (
                      <CollectionCard key={c.id} collection={c} width={itemWidth} />
                    ))}
                  </View>
                </>
              ) : null}
              {results.saves.length > 0 ? (
                <>
                  <SectionHeader title={`Saves · ${results.saves.length}`} />
                  <View style={[styles.grid, { gap }]}>
                    {results.saves.map((s) => (
                      <SaveCard key={s.id} save={s} width={itemWidth} />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )
        ) : tag ? (
          <>
            <View style={styles.tagHeader}>
              <TagChip name={tag.name} count={tag.save_count} />
              <Text weight="bold" size="sm" onPress={() => setTag(null)}>
                All tags
              </Text>
            </View>
            <View style={[styles.grid, { gap }]}>
              {(tagSaves ?? []).map((s) => (
                <SaveCard key={s.id} save={s} width={itemWidth} />
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={[styles.library, brutal.shadow]}>
              <Text size="xxs" weight="heavy" style={{ letterSpacing: 1 }}>
                YOUR LIBRARY
              </Text>
              <View style={styles.stats}>
                <Stat icon="folder" value={stats?.collections ?? 0} label="Collections" />
                <Stat icon="link" value={stats?.saves ?? 0} label="Saves" onPress={() => router.push('/collection/all')} />
                <Stat icon="map-pin" value={stats?.pinned ?? 0} label="Pinned" onPress={() => router.push('/collection/all?filter=pinned')} />
                <Stat icon="tag" value={stats?.tags ?? 0} label="Tags" active />
              </View>
            </View>
            <View style={styles.tagsTitle}>
              <Icon name="tag" size={14} />
              <Text weight="heavy" size="xs" style={{ letterSpacing: 1 }}>
                TAGS
              </Text>
            </View>
            {tags && tags.length > 0 ? (
              <View style={styles.tagCloud}>
                {tags.map((t, i) => (
                  <TagChip key={t.id} name={t.name} count={t.save_count} tilt={TILTS[i % TILTS.length]} onPress={() => setTag(t)} onLongPress={() => confirmDeleteTag(t)} />
                ))}
              </View>
            ) : (
              <Text color={colors.inkMuted}>No tags yet. Add tags from any save’s details.</Text>
            )}
            <SectionHeader title="Quick filters" />
            <View style={styles.wrap}>
              <Chip label="Pinned" icon="map-pin" onPress={() => router.push('/collection/all?filter=pinned')} />
              <Chip label="Images" icon="image" onPress={() => router.push('/collection/all?filter=images')} />
              <Chip label="Not opened yet" icon="eye-off" onPress={() => router.push('/collection/all?filter=unseen')} />
            </View>
          </>
        )}
        {tag ? (
          <Text size="xs" color={colors.danger} weight="semibold" style={{ marginTop: spacing.lg }} onPress={() => confirmDeleteTag(tag)}>
            Delete tag #{tag.name}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 12,
    minHeight: 44,
    backgroundColor: colors.card,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
  searchText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.ink, paddingVertical: 8 },
  cancel: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
  library: { backgroundColor: colors.primary, borderWidth: brutal.border, borderColor: colors.ink, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  stats: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: radius.md, borderWidth: brutal.border, borderColor: colors.transparent },
  statActive: { borderColor: colors.ink, backgroundColor: '#FFE68A' },
  tagsTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg, marginBottom: spacing.md },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.md, paddingLeft: 4 },
  tagHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  content: { paddingHorizontal: spacing.md, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
