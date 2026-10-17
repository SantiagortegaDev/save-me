import { useWindowDimensions } from 'react-native';

import { spacing } from '../theme';

// Column width for a responsive card grid (2 columns on phones, more on tablets).
export function useGrid(minItemWidth = 160, gap = spacing.md - 4) {
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 1000) - spacing.md * 2;
  const columns = Math.max(2, Math.min(5, Math.floor((inner + gap) / (minItemWidth + gap))));
  const itemWidth = Math.floor((inner - gap * (columns - 1)) / columns);
  return { columns, itemWidth, gap };
}
