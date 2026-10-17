import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { Card, Label, Text } from '../components/ui';
import { brutal, colors, spacing } from '../theme';

const SHARE_STEPS = [
  'Open a post, video or page in Chrome, Instagram, TikTok, YouTube, X, Reddit or any other app.',
  "Tap the app's Share button.",
  'Choose SaveMe from the list. If you do not see it, scroll or tap "More" — you can also pin SaveMe to the top of the share sheet.',
  'Pick a collection, optionally pin it, and tap Save. The preview is fetched for you.',
];

const TIPS = [
  { title: 'Paste quickly', body: 'Copy a link, open SaveMe and tap +. The link is filled in from your clipboard.' },
  { title: 'Long-press for actions', body: 'Long-press any collection or save to pin, move, share or delete it.' },
  { title: 'Focus Mode', body: 'Review saves one card at a time. Swipe to move on, tap Open to read now, shuffle for variety.' },
  { title: 'Sub-collections', body: 'Open a collection and tap "+ New" under Sub-collections to nest folders as deep as you like.' },
  { title: 'Bring your old bookmarks', body: 'Settings → Backup & import accepts Pocket, Raindrop, Instapaper and browser exports.' },
];

export default function HowToScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="How to" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Label style={styles.label}>Save links from any app</Label>
        {SHARE_STEPS.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.number, brutal.shadowSmall]}>
              <Text weight="bold">{i + 1}</Text>
            </View>
            <Text style={{ flex: 1 }}>{step}</Text>
          </View>
        ))}
        <Label style={styles.label}>Tips</Label>
        {TIPS.map((tip) => (
          <Card key={tip.title} style={styles.tip}>
            <Text weight="bold">{tip.title}</Text>
            <Text size="sm" color={colors.inkMuted}>
              {tip.body}
            </Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, gap: spacing.sm, maxWidth: 760, width: '100%', alignSelf: 'center' },
  label: { marginTop: spacing.lg, marginBottom: spacing.xs },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: spacing.xs },
  number: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tip: { padding: spacing.md, gap: 4 },
});
