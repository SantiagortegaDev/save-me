import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../theme';
import { Icon, type IconName } from './ui';

// Site icon in a small bordered tile; falls back to a vector icon when the site has none.
export function Favicon({ uri, size = 18, fallback = 'globe' }: { uri?: string | null; size?: number; fallback?: IconName }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.tile, { width: size, height: size }]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={{ width: size - 4, height: size - 4 }} onError={() => setFailed(true)} />
      ) : (
        <Icon name={fallback} size={size * 0.6} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
