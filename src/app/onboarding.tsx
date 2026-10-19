import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Illustration, type IllustrationName } from '../components/Illustrations';
import { Button, Text } from '../components/ui';
import { useSettings } from '../lib/settings';
import { brutal, colors, spacing, themed } from '../theme';
import { useTheme } from '../lib/theme';

const STEPS = [
  {
    art: 'scattered' as IllustrationName,
    color: colors.peach,
    title: 'Saved everywhere,\nfound nowhere.',
    body: 'Reels, articles, recipes and threads end up scattered across a dozen apps and forgotten.',
  },
  {
    art: 'share' as IllustrationName,
    color: colors.primary,
    title: 'Share it.\nSaveMe keeps it.',
    body: 'Tap Share in any app, pick SaveMe, choose a collection. Title, preview and source are filled in for you.',
  },
  {
    art: 'organized' as IllustrationName,
    color: colors.accent,
    title: 'Everything,\norganized.',
    body: 'Collections, sub-collections, tags, pins and notes. Search finds anything in a second.',
  },
  {
    art: 'focus' as IllustrationName,
    color: colors.lilac,
    title: 'Actually use\nwhat you save.',
    body: 'Focus Mode serves your saves one card at a time, and a gentle daily reminder brings you back.',
  },
  {
    art: 'free' as IllustrationName,
    color: colors.info,
    title: 'Free. Open.\nYours.',
    body: 'Every feature is free, forever. No account, no ads, no tracking. Your library stays on your device.',
  },
];

export default function OnboardingScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { update } = useSettings();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  async function finish() {
    await update({ onboarded: true });
    router.replace('/');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.top}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        {!last ? (
          <Text weight="bold" onPress={finish} accessibilityRole="button">
            Skip
          </Text>
        ) : null}
      </View>

      <View style={styles.center}>
        <View style={[styles.art, brutal.shadow, { backgroundColor: current.color }]}>
          <Illustration name={current.art} size={176} />
        </View>
        <Text weight="bold" size="xxl" style={styles.title}>
          {current.title}
        </Text>
        <Text size="md" color={colors.inkMuted} style={styles.body}>
          {current.body}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button title={last ? 'Start my library' : 'Continue'} size="lg" onPress={() => (last ? finish() : setStep(step + 1))} />
        {step > 0 ? <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: spacing.lg },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.surface },
    dotActive: { width: 26, backgroundColor: colors.text },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
    art: {
      width: 200,
      height: 200,
      borderRadius: 36,
      borderWidth: brutal.border,
      borderColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate: '-4deg' }],
    },
    title: { textAlign: 'center', lineHeight: 36 },
    body: { textAlign: 'center', maxWidth: 340 },
  }),
);
