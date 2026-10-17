import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionCard } from '../components/CollectionCard';
import { useGrid } from '../components/grid';
import { SaveCard } from '../components/SaveCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { Chip, EmptyState, Input, SectionHeader, Text } from '../components/ui';
import { deleteTag, listSaves, listTags, search, type TagWithCount } from '../db/repo';
import { useQuery } from '../lib/useQuery';
import { colors, spacing } from '../theme';

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
      <ScreenHeader title="Search" />
      <View style={styles.searchBox}>
        <Input
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setTag(null);
          }}
          placeholder="Find collections, saves, notes or #tags…"
          autoFocus={params.tab !== 'tags'}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
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
                  <View style={styles.wrap}>
                    {results.tags.map((t) => (
                      <Chip
                        key={t.id}
                        label={`#${t.name} · ${t.save_count}`}
                        color={colors.lilac}
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
            <SectionHeader
              title={`#${tag.name}`}
              right={
                <Text weight="bold" size="sm" onPress={() => setTag(null)}>
                  All tags
                </Text>
              }
            />
            <View style={[styles.grid, { gap }]}>
              {(tagSaves ?? []).map((s) => (
                <SaveCard key={s.id} save={s} width={itemWidth} />
              ))}
            </View>
          </>
        ) : (
          <>
            <SectionHeader title="Browse by tag" />
            {tags && tags.length > 0 ? (
              <View style={styles.wrap}>
                {tags.map((t) => (
                  <Chip key={t.id} label={`#${t.name} · ${t.save_count}`} color={colors.lilac} onPress={() => setTag(t)} />
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
  searchBox: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  content: { paddingHorizontal: spacing.md, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
