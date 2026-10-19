import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { haptic } from '../lib/haptics';
import { brutal, colors, spacing, themed } from '../theme';
import { Icon, Text, type IconName } from './ui';

export function SettingsGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  toggle,
  danger,
  right,
  iconColor = colors.primary,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  danger?: boolean;
  right?: ReactNode;
  iconColor?: string;
}) {
  const content = (
    <>
      <View style={[styles.icon, { backgroundColor: danger ? colors.danger : iconColor }]}>
        <Icon name={icon} size={18} color={colors.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight="semibold" color={danger ? colors.danger : colors.text}>
          {title}
        </Text>
        {subtitle ? (
          <Text size="sm" color={colors.inkMuted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={(v) => {
            haptic.select();
            toggle.onChange(v);
          }}
          trackColor={{ true: colors.ink, false: colors.track }}
          thumbColor={colors.white}
        />
      ) : (
        right ?? (onPress ? <Icon name="chevron-right" color={colors.inkMuted} /> : null)
      )}
    </>
  );
  if (!onPress) return <View style={[styles.row, brutal.shadowSmall]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : brutal.shadowSmall]}
    >
      {content}
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    group: { gap: spacing.sm + 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderWidth: brutal.border,
      borderColor: colors.ink,
      borderRadius: 10,
    },
    pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
    icon: {
      width: 34,
      height: 34,
      borderRadius: 9,
      borderWidth: brutal.borderThin,
      borderColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
