import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { haptic } from '../lib/haptics';
import { Illustration, type IllustrationName } from './Illustrations';
import { brutal, colors, fonts, fontSize, radius, spacing, themed } from '../theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color ?? colors.text} />;
}

type Weight = keyof typeof fonts;

export function Text({
  weight = 'regular',
  size = 'base',
  color,
  style,
  ...rest
}: TextProps & { weight?: Weight; size?: keyof typeof fontSize; color?: string }) {
  return <RNText {...rest} style={[{ fontFamily: fonts[weight], fontSize: fontSize[size], color: color ?? colors.text }, style]} />;
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text weight="bold" size="xs" color={colors.inkMuted} style={[styles.label, style]}>
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'accent' | 'danger' | 'plain' | 'ghost';

function variantBg(variant: ButtonVariant): string {
  return { primary: colors.primary, accent: colors.accent, danger: colors.danger, plain: colors.surface, ghost: colors.transparent }[variant];
}

// Content on yellow/green/red fills stays dark in both schemes; on surfaces it follows the theme.
export function contentOn(background: string): string {
  return background === colors.surface || background === colors.card || background === colors.paper || background === colors.transparent
    ? colors.text
    : colors.ink;
}

export function Button({
  title,
  icon,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  fullWidth,
  style,
  onPress,
  ...rest
}: Omit<PressableProps, 'style'> & {
  title?: string;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const pad = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
  const ghost = variant === 'ghost';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(e) => {
        haptic.tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: variantBg(variant), paddingVertical: pad, paddingHorizontal: pad + 6 },
        ghost ? styles.ghost : pressed ? styles.pressed : brutal.shadow,
        fullWidth && { alignSelf: 'stretch' },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={contentOn(variantBg(variant))} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={contentOn(variantBg(variant))} /> : null}
          {title ? (
            <Text weight="bold" size={size === 'lg' ? 'md' : size === 'sm' ? 'sm' : 'base'} color={contentOn(variantBg(variant))}>
              {title}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  accessibilityLabel,
  size = 40,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  accessibilityLabel: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, backgroundColor: color ?? colors.surface },
        pressed ? styles.pressed : brutal.shadowSmall,
      ]}
    >
      <Icon name={icon} size={size * 0.48} color={contentOn(color ?? colors.surface)} />
    </Pressable>
  );
}

export function Card({
  children,
  style,
  color = colors.card,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  color?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (!onPress && !onLongPress) {
    return <View style={[styles.card, brutal.shadow, { backgroundColor: color }, style]}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, { backgroundColor: color }, pressed ? styles.pressed : brutal.shadow, style]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color = colors.primary,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        haptic.select();
        onPress?.();
      }}
      style={[styles.chip, { backgroundColor: active ? color : colors.surface }, active ? brutal.shadowSmall : null]}
    >
      {icon ? <Icon name={icon} size={14} color={active ? colors.ink : colors.text} /> : null}
      <Text weight={active ? 'bold' : 'medium'} size="sm" color={active ? colors.ink : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { multiline?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.inkLight}
      {...props}
      style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, props.style]}
    />
  );
}

export function EmptyState({
  art,
  title,
  message,
  action,
}: {
  art: IllustrationName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Illustration name={art} size={110} />
      <Text weight="bold" size="lg" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {message ? (
        <Text color={colors.inkMuted} style={{ textAlign: 'center', maxWidth: 280 }}>
          {message}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Label>{title}</Label>
      {right}
    </View>
  );
}

export const styles = themed(() =>
  StyleSheet.create({
    label: { letterSpacing: 1.2, textTransform: 'uppercase' },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderWidth: brutal.border,
      borderColor: colors.ink,
      borderRadius: radius.md,
    },
    ghost: { borderColor: colors.transparent },
    pressed: { transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: '1px 1px 0px #111111' },
    iconButton: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: brutal.border,
      borderColor: colors.ink,
      borderRadius: radius.md,
    },
    card: {
      borderWidth: brutal.border,
      borderColor: colors.ink,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: brutal.borderThin,
      borderColor: colors.ink,
      borderRadius: radius.full,
    },
    input: {
      borderWidth: brutal.border,
      borderColor: colors.ink,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: fonts.medium,
      fontSize: fontSize.md,
      color: colors.text,
    },
    empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
    emptyBadge: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: colors.primary,
      borderWidth: brutal.border,
      borderColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
  }),
);
