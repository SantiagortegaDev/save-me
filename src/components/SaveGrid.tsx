import { StyleSheet, View } from 'react-native';

import type { Save } from '../db/repo';
import { useSettings } from '../lib/settings';
import { CARD_FILL_RATIO, SaveCard } from './SaveCard';
import { mediaRatio } from './SaveMedia';

// Masonry layout: each card goes to the currently shortest column, so tall and wide cards pack tightly.
export function SaveGrid({
  saves,
  columns,
  itemWidth,
  gap,
  onLongPress,
}: {
  saves: Save[];
  columns: number;
  itemWidth: number;
  gap: number;
  onLongPress?: (save: Save) => void;
}) {
  const { settings } = useSettings();
  const cols: Save[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);
  for (const s of saves) {
    const shortest = heights.indexOf(Math.min(...heights));
    cols[shortest].push(s);
    // Media height plus an estimate for the text block below it.
    heights[shortest] += itemWidth / mediaRatio(s, settings.imageFit, CARD_FILL_RATIO) + 80 + gap;
  }
  return (
    <View style={[styles.row, { gap }]}>
      {cols.map((list, i) => (
        <View key={i} style={{ width: itemWidth, gap }}>
          {list.map((s) => (
            <SaveCard key={s.id} save={s} width={itemWidth} onLongPress={onLongPress ? () => onLongPress(s) : undefined} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'flex-start' } });
