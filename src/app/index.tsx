import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSaveSheet } from '../components/AddSaveSheet';
import { collectionMenu, saveMenu } from '../components/actions';
import { CollectionCard } from '../components/CollectionCard';
import { CollectionForm } from '../components/CollectionForm';
import { useGrid } from '../components/grid';
import { MoveSheet } from '../components/MoveSheet';
import { SaveCard } from '../components/SaveCard';
import { Button, EmptyState, Icon, IconButton, Text } from '../components/ui';
import { getStats, listCollections, listRecentSaves, type Collection, type CollectionSort, type Save } from '../db/repo';
import { haptic } from '../lib/haptics';
import { saveLink } from '../lib/saving';
import { useSettings } from '../lib/settings';
import { extractUrl, normalizeUrl } from '../lib/url';
import { useQuery } from '../lib/useQuery';
import { brutal, colors, fonts, fontSize, radius, spacing } from '../theme';

const SORT_LABELS: Record<CollectionSort, string> = { oldest: 'Oldest', newest: 'Newest', name: 'Name', recent: 'Recently saved' };

// Saves the typed link straight to the Inbox; the "+" opens the full sheet when the field is empty.
function QuickSave({ onOpenSheet }: { onOpenSheet: () => void }) {
  const db = useSQLiteContext();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function paste() {
    const text = await Clipboard.getStringAsync();
    const url = extractUrl(text) ?? normalizeUrl(text);
    if (url) setValue(url);
    else Alert.alert('Nothing to paste', 'Copy a link first, then tap paste.');
  }

  async function save() {
    if (!normalizeUrl(value)) {
      Alert.alert('Invalid link', 'Please enter a valid http or https link.');
      return;
    }
    setBusy(true);
    try {
      const res = await saveLink(db, value);
      haptic.success();
      setValue('');
      if (res.duplicate) Alert.alert('Already saved', 'This link is already in your library.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.quickRow}>
      <View style={[styles.quickInput, brutal.shadowSmall]}>
        <Text weight="bold" color={colors.inkMuted}>
          #
        </Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Paste link to quick save"
          placeholderTextColor={colors.inkLight}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={() => value.trim() && save()}
          style={styles.quickText}
        />
        <Pressable onPress={paste} hitSlop={8} accessibilityRole="button" accessibilityLabel="Paste link">
          <Icon name="clipboard" size={18} color={colors.inkMuted} />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value.trim() ? 'Save link' : 'Save a link or image'}
        disabled={busy}
        onPress={() => {
          haptic.tap();
          if (value.trim()) void save();
          else onOpenSheet();
        }}
        style={({ pressed }) => [styles.quickButton, pressed ? styles.pressed : brutal.shadowSmall, busy && { opacity: 0.5 }]}
      >
        <Icon name="plus" size={24} />
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const { itemWidth, gap } = useGrid(150);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [moving, setMoving] = useState<Save | null>(null);
  const sort = settings.collectionSort;

  const { data: stats } = useQuery(() => getStats(db), [db]);
  const { data: collections } = useQuery(() => listCollections(db, null, sort), [db, sort]);
  const { data: recent } = useQuery(() => listRecentSaves(db, 12), [db]);

  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  function pickSort() {
    Alert.alert('Sort collections', undefined, [
      ...(Object.keys(SORT_LABELS) as CollectionSort[]).map((key) => ({
        text: `${key === sort ? '✓ ' : ''}${SORT_LABELS[key]}`,
        onPress: () => update({ collectionSort: key }),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}
      >
        <View style={styles.toolbar}>
          <IconButton icon="settings" accessibilityLabel="Settings" size={38} onPress={() => router.push('/settings')} />
          <Image source={require('../../assets/logo.png')} style={styles.logo} contentFit="contain" accessibilityLabel="SaveMe" />
          <View style={styles.toolbarRight}>
            <IconButton icon="folder-plus" accessibilityLabel="Create collection" size={38} onPress={() => setCreating(true)} />
            <IconButton icon="search" accessibilityLabel="Search" size={38} onPress={() => router.push('/search')} />
          </View>
        </View>

        <Text weight="heavy" size="huge" style={styles.headline}>
          {'Save it now.\nFind it later.'}
        </Text>

        <QuickSave onOpenSheet={() => setAdding(true)} />

        {stats && stats.unseen > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review unseen saves in Focus Mode"
            onPress={() => {
              haptic.tap();
              router.push('/focus?scope=new');
            }}
            style={({ pressed }) => [styles.waiting, pressed ? styles.pressed : brutal.shadowSmall]}
          >
            <View style={styles.waitingIcon}>
              <Icon name="bell" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="bold">
                {stats.unseen} new {stats.unseen === 1 ? 'save' : 'saves'} waiting
              </Text>
              <Text size="xs" color={colors.inkMuted}>
                Review now
              </Text>
            </View>
            <Icon name="chevron-right" />
          </Pressable>
        ) : null}

        <View style={styles.sectionRow}>
          <Text weight="heavy" size="lg">
            My Collections
          </Text>
          <Pressable onPress={pickSort} hitSlop={8} style={styles.sortButton} accessibilityRole="button" accessibilityLabel="Sort collections">
            <Text size="xs" weight="semibold" color={colors.inkMuted}>
              {SORT_LABELS[sort]}
            </Text>
            <Icon name="chevron-down" size={14} color={colors.inkMuted} />
          </Pressable>
        </View>

        {collections && collections.length > 0 ? (
          <View style={[styles.grid, { columnGap: gap, rowGap: gap + 4 }]}>
            {collections.map((c) => (
              <CollectionCard
                key={c.id}
                collection={c}
                width={itemWidth}
                hasNew={c.unseen_count > 0}
                onLongPress={() => collectionMenu(db, c, () => setEditing(c))}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.sectionRow}>
          <Text weight="heavy" size="lg">
            Recently saved
          </Text>
          {recent && recent.length > 0 ? (
            <Pressable onPress={() => router.push('/collection/all')} hitSlop={8} accessibilityRole="button">
              <Text size="xs" weight="semibold" color={colors.inkMuted}>
                See all
              </Text>
            </Pressable>
          ) : null}
        </View>
        {recent && recent.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap, paddingRight: spacing.md, paddingBottom: 6 }}
            style={styles.recent}
          >
            {recent.map((s) => (
              <SaveCard key={s.id} save={s} width={itemWidth} onLongPress={() => saveMenu(db, s, () => setMoving(s))} />
            ))}
          </ScrollView>
        ) : (
          <EmptyState
            emoji="📌"
            title="Nothing saved yet"
            message="Share a link from any app to SaveMe, or paste one above."
            action={<Button title="How it works" variant="plain" onPress={() => router.push('/how-to')} />}
          />
        )}
      </ScrollView>

      <AddSaveSheet visible={adding} onClose={() => setAdding(false)} />
      <CollectionForm
        visible={creating || !!editing}
        editing={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <MoveSheet save={moving} onClose={() => setMoving(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolbarRight: { flexDirection: 'row', gap: spacing.sm },
  logo: { width: 30, height: 38 },
  headline: { marginTop: spacing.lg, marginBottom: spacing.md, lineHeight: 40, letterSpacing: -0.8 },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  quickRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  quickInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  quickText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.ink, paddingVertical: 10 },
  quickButton: {
    width: 48,
    backgroundColor: colors.primary,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.sm + 4,
    backgroundColor: colors.card,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
  waitingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  recent: { marginHorizontal: -spacing.md, paddingLeft: spacing.md, overflow: 'visible' },
});
