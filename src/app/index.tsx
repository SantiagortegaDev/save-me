import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSaveSheet } from '../components/AddSaveSheet';
import { collectionMenu, saveMenu } from '../components/actions';
import { CollectionCard } from '../components/CollectionCard';
import { CollectionForm } from '../components/CollectionForm';
import { useGrid } from '../components/grid';
import { MoveSheet } from '../components/MoveSheet';
import { SaveCard } from '../components/SaveCard';
import { Button, Card, EmptyState, Icon, IconButton, SectionHeader, Text, type IconName } from '../components/ui';
import { getStats, listCollections, listRecentSaves, type Collection, type Save } from '../db/repo';
import { useSettings } from '../lib/settings';
import { useQuery } from '../lib/useQuery';
import { brutal, colors, spacing } from '../theme';

function StatTile({ label, value, icon, color, onPress }: { label: string; value: number; icon: IconName; color: string; onPress?: () => void }) {
  return (
    <Card color={color} onPress={onPress} style={styles.stat} accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} size={16} />
      <Text weight="bold" size="xl">
        {value}
      </Text>
      <Text weight="medium" size="xs">
        {label}
      </Text>
    </Card>
  );
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const { itemWidth, gap } = useGrid(150);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [moving, setMoving] = useState<Save | null>(null);

  const { data: stats } = useQuery(() => getStats(db), [db]);
  const { data: collections } = useQuery(() => listCollections(db), [db]);
  const { data: recent } = useQuery(() => listRecentSaves(db, 12), [db]);

  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} contentFit="contain" accessibilityLabel="SaveMe logo" />
            <View>
              <Text weight="bold" size="xxl">
                SaveMe
              </Text>
              <Text size="sm" color={colors.inkMuted}>
                Save it. Find it. Use it.
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <IconButton icon="search" accessibilityLabel="Search" onPress={() => router.push('/search')} />
            <IconButton icon="settings" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
          </View>
        </View>

        <SectionHeader title="Your library" />
        <View style={styles.stats}>
          <StatTile label="Collections" value={stats?.collections ?? 0} icon="folder" color={colors.primary} />
          <StatTile label="Saves" value={stats?.saves ?? 0} icon="bookmark" color={colors.accent} onPress={() => router.push('/collection/all')} />
          <StatTile label="Pinned" value={stats?.pinned ?? 0} icon="map-pin" color={colors.peach} onPress={() => router.push('/collection/all?filter=pinned')} />
          <StatTile label="Tags" value={stats?.tags ?? 0} icon="tag" color={colors.lilac} onPress={() => router.push('/search?tab=tags')} />
        </View>

        {stats && stats.unseen > 0 ? (
          <Card color={colors.white} style={styles.focusBanner} onPress={() => router.push('/focus?scope=new')} accessibilityLabel="Review unseen saves in Focus Mode">
            <View style={[styles.focusIcon, { backgroundColor: colors.accent }]}>
              <Icon name="layers" size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="bold" size="md">
                {stats.unseen} {stats.unseen === 1 ? 'save is' : 'saves are'} waiting
              </Text>
              <Text size="sm" color={colors.inkMuted}>
                Review them one at a time in Focus Mode.
              </Text>
            </View>
            <Icon name="chevron-right" />
          </Card>
        ) : null}

        <SectionHeader
          title="My collections"
          right={
            <Pressable onPress={() => setCreating(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Create collection">
              <Text weight="bold" size="sm">
                + New
              </Text>
            </Pressable>
          }
        />
        {collections && collections.length > 0 ? (
          <View style={[styles.grid, { gap }]}>
            {collections.map((c) => (
              <CollectionCard key={c.id} collection={c} width={itemWidth} onLongPress={() => collectionMenu(db, c, () => setEditing(c))} />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create collection"
              onPress={() => setCreating(true)}
              style={[styles.newCollection, { width: itemWidth }]}
            >
              <Icon name="plus" size={26} />
              <Text weight="bold">New collection</Text>
            </Pressable>
          </View>
        ) : null}

        <SectionHeader title="Recently saved" />
        {recent && recent.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap, paddingRight: spacing.md, paddingBottom: 6 }} style={styles.recent}>
            {recent.map((s) => (
              <SaveCard key={s.id} save={s} width={itemWidth} onLongPress={() => saveMenu(db, s, () => setMoving(s))} />
            ))}
          </ScrollView>
        ) : (
          <EmptyState
            emoji="📌"
            title="Nothing saved yet"
            message="Share a link from any app to SaveMe, or tap the + button to paste one."
            action={<Button title="How it works" variant="plain" onPress={() => router.push('/how-to')} />}
          />
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save a link or image"
        onPress={() => setAdding(true)}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + spacing.lg }, pressed ? { transform: [{ translateX: 2 }, { translateY: 2 }] } : brutal.shadow]}
      >
        <Icon name="plus" size={30} />
      </Pressable>

      <AddSaveSheet visible={adding} onClose={() => setAdding(false)} />
      <CollectionForm visible={creating || !!editing} editing={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      <MoveSheet save={moving} onClose={() => setMoving(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 40, height: 50 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, padding: spacing.sm + 2, gap: 2 },
  focusBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginTop: spacing.md },
  focusIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  newCollection: {
    minHeight: 120,
    borderWidth: brutal.border,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  recent: { marginHorizontal: -spacing.md, paddingLeft: spacing.md, overflow: 'visible' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
