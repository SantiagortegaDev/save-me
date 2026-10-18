import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '../components/ui';
import { listAllCollections, listFocusSaves, listTagsForSave, markSeen, setSavePinned, type Save } from '../db/repo';
import { haptic } from '../lib/haptics';
import { imageUri } from '../lib/images';
import { hostname } from '../lib/url';
import { useQuery } from '../lib/useQuery';
import { brutal, colors, radius, spacing } from '../theme';

const SWIPE_THRESHOLD = 110;
const MAX_SEGMENTS = 12;

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function FocusCard({ save, width, collection }: { save: Save; width: number; collection?: { name: string; color: string } }) {
  const db = useSQLiteContext();
  const { data: tags } = useQuery(() => listTagsForSave(db, save.id), [db, save.id]);
  const preview = save.kind === 'image' ? imageUri(save.image_path) : save.thumbnail;
  return (
    <View style={[styles.card, { width }]}>
      {save.kind === 'link' ? (
        <View style={styles.source}>
          <View style={styles.sourceIcon}>
            {save.favicon ? <Image source={{ uri: save.favicon }} style={{ width: 14, height: 14 }} /> : <Icon name="globe" size={12} />}
          </View>
          <Text size="xs" weight="bold" numberOfLines={1} style={{ flex: 1 }}>
            {save.site_name || hostname(save.url)}
          </Text>
        </View>
      ) : null}
      <View style={styles.cardImage}>
        {preview ? (
          <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.cardPlaceholder}>
            <Icon name={save.kind === 'image' ? 'image' : 'link'} size={44} />
          </View>
        )}
        {collection ? (
          <View style={styles.collectionChip}>
            <View style={[styles.dot, { backgroundColor: collection.color }]} />
            <Text size="xxs" weight="bold" numberOfLines={1}>
              {collection.name}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text weight="heavy" size="lg" numberOfLines={3} style={{ lineHeight: 23 }}>
          {save.title || save.url}
        </Text>
        {save.description ? (
          <Text size="sm" color={colors.inkMuted} numberOfLines={3}>
            {save.description}
          </Text>
        ) : null}
        {tags && tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.slice(0, 3).map((t) => (
              <View key={t.id} style={styles.tag}>
                <Text size="xxs" weight="bold">
                  #{t.name}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function FocusScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ collectionId?: string; scope?: 'new' | 'all' }>();
  const scope = params.scope === 'all' ? 'all' : 'new';
  const [queue, setQueue] = useState<Save[] | null>(null);
  const [index, setIndex] = useState(0);
  const [position] = useState(() => new Animated.ValueXY());
  const cardWidth = Math.min(width - spacing.lg * 2, 440);
  const { data: collections } = useQuery(() => listAllCollections(db), [db]);
  const collectionById = useMemo(() => new Map((collections ?? []).map((c) => [c.id, c])), [collections]);

  useEffect(() => {
    listFocusSaves(db, { collectionId: params.collectionId ?? null, scope }).then(setQueue).catch(() => setQueue([]));
  }, [db, params.collectionId, scope]);

  const current = queue?.[index];
  const next = queue?.[index + 1];

  // A card counts as seen once it has been shown.
  useEffect(() => {
    if (current && !current.seen) void markSeen(db, current.id);
  }, [db, current]);

  const advance = useCallback(
    (direction: 1 | -1) => {
      Animated.timing(position, { toValue: { x: direction * width * 1.4, y: 0 }, duration: 200, useNativeDriver: false }).start(() => {
        position.setValue({ x: 0, y: 0 });
        setIndex((i) => i + 1);
      });
    },
    [position, width],
  );

  async function openCurrent() {
    if (!current) return;
    haptic.tap();
    if (current.kind === 'link') {
      await WebBrowser.openBrowserAsync(current.url).catch(() => {});
    } else {
      router.push(`/save/${current.id}`);
    }
  }

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
        onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > SWIPE_THRESHOLD) {
            haptic.select();
            advance(g.dx > 0 ? 1 : -1);
          } else {
            Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
          }
        },
      }),
    [position, advance],
  );

  const rotate = position.x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-10deg', '0deg', '10deg'] });
  const total = queue?.length ?? 0;
  const done = queue !== null && index >= total;
  const segments = Math.min(total, MAX_SEGMENTS);
  const filled = total ? Math.ceil((Math.min(index + 1, total) / total) * segments) : 0;
  const collectionOf = (s: Save) => collectionById.get(s.collection_id);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <View>
          <Text size="xxs" weight="bold" color="#9A9A9A" style={{ letterSpacing: 1 }}>
            {scope === 'new' ? 'NEW SAVES' : 'FOCUS MODE'}
          </Text>
          {total > 0 ? (
            <Text weight="heavy" size="xl" color={colors.white}>
              {pad(Math.min(index + 1, total))}
              <Text size="sm" weight="semibold" color="#9A9A9A">
                {' '}
                / {pad(total)}
              </Text>
            </Text>
          ) : null}
        </View>
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Shuffle remaining saves"
            hitSlop={8}
            onPress={() => {
              haptic.tap();
              setQueue((q) => (q ? [...q.slice(0, index), ...shuffle(q.slice(index))] : q));
            }}
            style={styles.darkButton}
          >
            <Icon name="shuffle" size={18} color={colors.white} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Exit Focus Mode" hitSlop={8} onPress={() => router.back()} style={styles.darkButton}>
            <Icon name="x" size={20} color={colors.white} />
          </Pressable>
        </View>
      </View>

      {segments > 0 ? (
        <View style={styles.progress}>
          {Array.from({ length: segments }, (_, i) => (
            <View key={i} style={[styles.segment, { backgroundColor: i < filled ? colors.primary : '#3A3A3A' }]} />
          ))}
        </View>
      ) : null}

      <View style={styles.stage}>
        {queue === null ? (
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <ActivityIndicator color={colors.white} />
            <Text color={colors.white}>Preparing Focus…</Text>
          </View>
        ) : total === 0 ? (
          <View style={styles.message}>
            <Text style={{ fontSize: 48 }}>🎉</Text>
            <Text weight="heavy" size="xl" color={colors.white}>
              {scope === 'new' ? 'All caught up!' : 'Nothing to review'}
            </Text>
            <Text color="#BDBDBD" style={{ textAlign: 'center' }}>
              {scope === 'new' ? 'You have opened every save. New ones will show up here.' : 'Save something first.'}
            </Text>
            <Button title="Back" variant="primary" onPress={() => router.back()} />
          </View>
        ) : done ? (
          <View style={styles.message}>
            <Text style={{ fontSize: 48 }}>🏁</Text>
            <Text weight="heavy" size="xl" color={colors.white}>
              Great job.
            </Text>
            <Text color="#BDBDBD">
              You reviewed {total} {total === 1 ? 'save' : 'saves'}.
            </Text>
            <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
              <Button title="Back to last card" variant="plain" onPress={() => setIndex(total - 1)} />
              <Button title="Exit" onPress={() => router.back()} />
            </View>
          </View>
        ) : (
          <>
            {next ? (
              <View style={[styles.behind, { transform: [{ scale: 0.94 }, { translateY: 22 }] }]}>
                <FocusCard save={next} width={cardWidth} collection={collectionOf(next)} />
              </View>
            ) : null}
            {current ? (
              <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }}>
                <FocusCard save={current} width={cardWidth} collection={collectionOf(current)} />
              </Animated.View>
            ) : null}
          </>
        )}
      </View>

      {current && !done ? (
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous" onPress={() => setIndex((i) => Math.max(0, i - 1))} style={styles.navButton}>
            <Icon name="arrow-left" size={20} color={colors.white} />
          </Pressable>
          <Button
            title={current.kind === 'link' ? 'Open link  ↗' : 'View  ↗'}
            size="lg"
            onPress={openCurrent}
            style={{ flex: 1 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={current.pinned ? 'Unpin' : 'Pin'}
            onPress={async () => {
              haptic.tap();
              await setSavePinned(db, current.id, !current.pinned);
              setQueue((q) => q?.map((s) => (s.id === current.id ? { ...s, pinned: s.pinned ? 0 : 1 } : s)) ?? q);
            }}
            style={[styles.navButton, current.pinned ? { backgroundColor: colors.primary } : null]}
          >
            <Icon name="map-pin" size={18} color={current.pinned ? colors.ink : colors.white} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next" onPress={() => advance(1)} style={styles.navButton}>
            <Icon name="arrow-right" size={20} color={colors.white} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night, paddingHorizontal: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', gap: spacing.sm },
  darkButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: brutal.borderThin,
    borderColor: '#4A4A4A',
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flexDirection: 'row', gap: 4, marginTop: spacing.md },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  behind: { position: 'absolute', opacity: 0.55 },
  card: {
    backgroundColor: colors.card,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.lg,
    overflow: 'hidden',
    boxShadow: '0px 6px 0px #000000',
  },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 10 },
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
  cardImage: {
    aspectRatio: 1.15,
    marginHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    overflow: 'hidden',
    backgroundColor: '#F1EADB',
  },
  cardPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  collectionChip: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '70%',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  dot: { width: 10, height: 10, borderRadius: 3, borderWidth: 1, borderColor: colors.ink },
  cardBody: { padding: spacing.md, gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.mint, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  controls: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    borderWidth: brutal.border,
    borderColor: '#4A4A4A',
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
