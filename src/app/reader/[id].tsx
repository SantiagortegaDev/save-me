import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Favicon } from '../../components/Favicon';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button, EmptyState, IconButton, Text } from '../../components/ui';
import { getSave } from '../../db/repo';
import { Alert } from '../../lib/dialog';
import { saveArticleText } from '../../lib/offline';
import { detectPlatform } from '../../lib/platform';
import { parseBlocks, readingMinutes } from '../../lib/readability';
import { useTheme } from '../../lib/theme';
import { useQuery } from '../../lib/useQuery';
import { brutal, colors, fonts, radius, spacing, themed } from '../../theme';

const SIZES = [15, 17, 19, 22];

export default function ReaderScreen() {
  useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: save, loading } = useQuery(() => getSave(db, id), [db, id]);
  const [size, setSize] = useState(1);
  const [fetching, setFetching] = useState(false);

  if (!save) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper }}>
        <ScreenHeader title="Reader" />
        {loading ? null : <EmptyState art="missing" title="Save not found" />}
      </View>
    );
  }

  const parsed = save.article_text ? parseBlocks(save.article_text) : [];
  // The article's own headline repeats the title shown above it.
  const blocks = parsed[0]?.type === 'h' && parsed[0].text.trim().toLowerCase() === save.title.trim().toLowerCase() ? parsed.slice(1) : parsed;
  const fontSize = SIZES[size];

  async function download() {
    if (!save) return;
    setFetching(true);
    const text = await saveArticleText(db, save.id, save.url);
    setFetching(false);
    if (text === null) Alert.alert('Could not download', 'Check your connection and try again.');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader
        title="Reader"
        right={
          <IconButton icon="type" accessibilityLabel="Text size" size={38} onPress={() => setSize((s) => (s + 1) % SIZES.length)} />
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={styles.source}>
          <Favicon uri={save.favicon} size={20} />
          <Text size="xs" weight="bold">
            {save.site_name || detectPlatform(save.url).name}
          </Text>
          {save.article_text ? (
            <Text size="xs" color={colors.inkMuted}>
              · {readingMinutes(save.article_text)} min read · available offline
            </Text>
          ) : null}
        </View>
        <Text weight="heavy" style={{ fontSize: fontSize + 9, lineHeight: (fontSize + 9) * 1.25 }}>
          {save.title}
        </Text>

        {blocks.length ? (
          blocks.map((b, i) =>
            b.type === 'h' ? (
              <Text key={i} weight="bold" style={{ fontSize: fontSize + 3, lineHeight: (fontSize + 3) * 1.35, marginTop: spacing.sm }}>
                {b.text}
              </Text>
            ) : b.type === 'quote' ? (
              <View key={i} style={styles.quote}>
                <Text style={[styles.body, { fontSize, lineHeight: fontSize * 1.6, fontStyle: 'italic' }]}>{b.text}</Text>
              </View>
            ) : (
              <Text key={i} style={[styles.body, { fontSize, lineHeight: fontSize * 1.6 }]}>
                {b.type === 'li' ? `•  ${b.text}` : b.text}
              </Text>
            ),
          )
        ) : (
          <View style={styles.missing}>
            {fetching ? <ActivityIndicator color={colors.text} /> : null}
            <Text color={colors.inkMuted} style={{ textAlign: 'center' }}>
              {fetching
                ? 'Downloading the article…'
                : save.article_text === ''
                  ? 'This page has no readable article text (it may be a video, a social post or need a login).'
                  : 'The text has not been downloaded yet.'}
            </Text>
            {!fetching ? <Button title="Download text" icon="download" variant="plain" onPress={download} /> : null}
          </View>
        )}

        <Button title="Open original" icon="external-link" variant="plain" onPress={() => WebBrowser.openBrowserAsync(save.url)} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: { paddingHorizontal: spacing.lg, gap: spacing.md, maxWidth: 720, width: '100%', alignSelf: 'center' },
    source: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    body: { fontFamily: fonts.regular, color: colors.text },
    quote: { borderLeftWidth: 4, borderColor: colors.primary, paddingLeft: spacing.md },
    missing: {
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderWidth: brutal.border,
      borderColor: colors.ink,
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderStyle: 'dashed',
    },
  }),
);
