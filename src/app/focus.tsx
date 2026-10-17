import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, Icon, IconButton, Text } from '../components/ui';
import { listFocusSaves, markSeen, setSavePinned, type Save } from '../db/repo';
import { haptic } from '../lib/haptics';
import { imageUri } from '../lib/images';
import { hostname } from '../lib/url';
import { brutal, colors, spacing } from '../theme';

const SWIPE_THRESHOLD = 110;

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function FocusCard({ save, width }: { save: Save; width: number }) {
  const preview = save.kind === 'image' ? imageUri(save.image_path) : save.thumbnail;
  return (
    <View style={[styles.card, brutal.shadow, { width }]}>
      <View style={styles.cardImage}>
        {preview ? (
          <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.cardPlaceholder}>
            <Icon name={save.kind === 'image' ? 'image' : 'link'} size={48} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text weight="bold" size="lg" numberOfLines={3}>
          {save.title || save.url}
        </Text>
        {save.description ? (
          <Text size="sm" color={colors.inkMuted} numberOfLines={3}>
            {save.description}
          </Text>
        ) : null}
        {save.kind === 'link' ? (
          <Text size="xs" weight="semibold" color={colors.inkMuted}>
            {(save.site_name || hostname(save.url)).toUpperCase()}
          </Text>
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
  const cardWidth = Math.min(width - spacing.lg * 2, 460);

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

  const rotate = position.x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-12deg', '0deg', '12deg'] });
  const done = queue !== null && index >= queue.length;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.top}>
        <IconButton icon="x" accessibilityLabel="Exit Focus Mode" onPress={() => router.back()} />
        <View style={styles.progress}>
          <Text weight="bold">Focus Mode</Text>
          {queue && queue.length > 0 ? (
            <Text size="sm" color={colors.inkMuted}>
              {Math.min(index + 1, queue.length)} / {queue.length}
            </Text>
          ) : null}
        </View>
        <IconButton
          icon="shuffle"
          accessibilityLabel="Shuffle remaining saves"
          onPress={() => setQueue((q) => (q ? [...q.slice(0, index), ...shuffle(q.slice(index))] : q))}
        />
      </View>

      <View style={styles.stage}>
        {queue === null ? (
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <ActivityIndicator color={colors.ink} />
            <Text>Preparing Focus…</Text>
          </View>
        ) : queue.length === 0 ? (
          <EmptyState
            emoji="🎉"
            title={scope === 'new' ? 'All caught up!' : 'Nothing to review'}
            message={scope === 'new' ? 'You have opened every save. New ones will show up here.' : 'Save something first.'}
            action={<Button title="Back" variant="plain" onPress={() => router.back()} />}
          />
        ) : done ? (
          <EmptyState
            emoji="🏁"
            title="Great job."
            message={`You reviewed ${queue.length} ${queue.length === 1 ? 'save' : 'saves'}.`}
            action={
              <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
                <Button title="Back to last card" variant="plain" onPress={() => setIndex(queue.length - 1)} />
                <Button title="Exit" onPress={() => router.back()} />
              </View>
            }
          />
        ) : (
          <>
            {next ? (
              <View style={[styles.behind, { transform: [{ scale: 0.94 }, { translateY: 18 }] }]}>
                <FocusCard save={next} width={cardWidth} />
              </View>
            ) : null}
            {current ? (
              <Animated.View
                {...responder.panHandlers}
                style={{ transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }}
              >
                <FocusCard save={current} width={cardWidth} />
              </Animated.View>
            ) : null}
          </>
        )}
      </View>

      {current && !done ? (
        <View style={styles.controls}>
          <IconButton icon="chevron-left" accessibilityLabel="Previous" size={52} onPress={() => setIndex((i) => Math.max(0, i - 1))} />
          <IconButton
            icon="map-pin"
            accessibilityLabel={current.pinned ? 'Unpin' : 'Pin'}
            color={current.pinned ? colors.primary : colors.white}
            size={52}
            onPress={async () => {
              await setSavePinned(db, current.id, !current.pinned);
              setQueue((q) => q?.map((s) => (s.id === current.id ? { ...s, pinned: s.pinned ? 0 : 1 } : s)) ?? q);
            }}
          />
          <Button title={current.kind === 'link' ? 'Open' : 'View'} icon="external-link" size="lg" variant="accent" onPress={openCurrent} style={{ flex: 1 }} />
          <IconButton icon="chevron-right" accessibilityLabel="Next" size={52} onPress={() => advance(1)} />
        </View>
      ) : null}
      {current && !done ? (
        <Text size="xs" color={colors.inkMuted} style={{ textAlign: 'center', marginTop: spacing.sm }}>
          Swipe to move on · tap Open to read now
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { alignItems: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  behind: { position: 'absolute', opacity: 0.85 },
  card: { backgroundColor: colors.card, borderWidth: brutal.border, borderColor: colors.ink, borderRadius: 20, overflow: 'hidden' },
  cardImage: { aspectRatio: 1.1, backgroundColor: '#F1EADB', borderBottomWidth: brutal.border, borderColor: colors.ink },
  cardPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: spacing.md, gap: spacing.sm, minHeight: 120 },
  controls: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
