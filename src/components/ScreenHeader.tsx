import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme';
import { IconButton, Text } from './ui';

export function ScreenHeader({ title, right, back = true }: { title?: string; right?: ReactNode; back?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.side}>
        {back ? (
          <IconButton
            icon="arrow-left"
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        ) : null}
      </View>
      <Text weight="bold" size="lg" numberOfLines={1} style={styles.title}>
        {title ?? ''}
      </Text>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.paper,
    gap: spacing.sm,
  },
  side: { minWidth: 40, flexDirection: 'row', gap: spacing.sm },
  title: { flex: 1, textAlign: 'center' },
});
