import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '../lib/haptics';
import { brutal, colors } from '../theme';
import { Text } from './ui';

export const TAG_COLORS = ['#FF7A1A', '#3D7BFF', '#8B5CF6', '#F06EAA', '#FFC21A', '#2FB86A', '#EE4266', '#22B5E8', '#111111', '#B07A4F'];

// Stable color per tag name.
export function tagColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

function textOn(bg: string): string {
  const n = parseInt(bg.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? colors.ink : colors.white;
}

const POINT = 13;

// A luggage-tag shaped label: pointed left end with a punched hole, optional count bubble.
export function TagChip({
  name,
  count,
  tilt = 0,
  size = 'md',
  onPress,
  onLongPress,
}: {
  name: string;
  count?: number;
  tilt?: number;
  size?: 'sm' | 'md';
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const bg = tagColor(name);
  const fg = textOn(bg);
  const h = size === 'sm' ? 26 : 32;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tag ${name}${count !== undefined ? `, ${count} saves` : ''}`}
      onPress={() => {
        haptic.select();
        onPress?.();
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.root, { height: h, transform: [{ rotate: `${tilt}deg` }] }, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.point, { width: h * 0.72, height: h * 0.72, left: POINT - h * 0.36 - 1, backgroundColor: bg }]} />
      <View style={[styles.body, { height: h, backgroundColor: bg, marginLeft: POINT }, brutal.shadowSmall]}>
        <View style={styles.hole} />
        <Text size={size === 'sm' ? 'xs' : 'sm'} weight="heavy" color={fg}>
          #{name}
        </Text>
        {count !== undefined ? (
          <View style={styles.count}>
            <Text size="xxs" weight="heavy">
              {count}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center' },
  point: {
    position: 'absolute',
    borderLeftWidth: brutal.border,
    borderBottomWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 6,
    borderTopWidth: brutal.border,
    borderBottomWidth: brutal.border,
    borderRightWidth: brutal.border,
    borderColor: colors.ink,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  hole: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.white },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
