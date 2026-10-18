// Hand-drawn style SVG illustrations (thick ink outlines, flat fills) used instead of emojis.
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

const INK = '#111111';
const YELLOW = '#FFD23F';
const BLUE = '#86BEF4';
const MINT = '#3BCEAC';
const PINK = '#F06EAA';
const ORANGE = '#FF7A1A';
const PURPLE = '#B79CED';
const WHITE = '#FFFFFF';

const line = { stroke: INK, strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export type IllustrationName =
  | 'saves'
  | 'link'
  | 'image'
  | 'pin'
  | 'search'
  | 'missing'
  | 'celebrate'
  | 'finish'
  | 'scattered'
  | 'share'
  | 'organized'
  | 'focus'
  | 'free';

function Blob({ color }: { color: string }) {
  return <Circle cx={60} cy={62} r={50} fill={color} {...line} />;
}

const SMALL: Record<Exclude<IllustrationName, 'scattered' | 'share' | 'organized' | 'focus' | 'free'>, () => React.JSX.Element> = {
  saves: () => (
    <G>
      <Blob color={YELLOW} />
      <Path d="M44 34 H80 Q84 34 84 38 V88 L62 76 L40 88 V38 Q40 34 44 34 Z" fill={WHITE} {...line} />
      <Line x1={52} y1={50} x2={72} y2={50} {...line} />
      <Line x1={52} y1={60} x2={66} y2={60} {...line} />
    </G>
  ),
  link: () => (
    <G>
      <Blob color={BLUE} />
      <Rect x={28} y={50} width={36} height={22} rx={11} fill={WHITE} {...line} transform="rotate(-30 46 61)" />
      <Rect x={56} y={50} width={36} height={22} rx={11} fill={YELLOW} {...line} transform="rotate(-30 74 61)" />
    </G>
  ),
  image: () => (
    <G>
      <Blob color={MINT} />
      <Rect x={30} y={36} width={60} height={50} rx={6} fill={WHITE} {...line} />
      <Circle cx={74} cy={50} r={6} fill={YELLOW} {...line} />
      <Path d="M32 82 L52 60 L66 74 L74 66 L88 82 Z" fill={BLUE} {...line} />
    </G>
  ),
  pin: () => (
    <G>
      <Blob color={PINK} />
      <Path d="M60 92 C44 72 38 62 38 50 A22 22 0 0 1 82 50 C82 62 76 72 60 92 Z" fill={YELLOW} {...line} />
      <Circle cx={60} cy={50} r={8} fill={WHITE} {...line} />
    </G>
  ),
  search: () => (
    <G>
      <Blob color={YELLOW} />
      <Circle cx={54} cy={54} r={20} fill={WHITE} {...line} />
      <Line x1={69} y1={69} x2={86} y2={86} stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <Path d="M46 48 Q50 42 56 42" fill="none" {...line} />
    </G>
  ),
  missing: () => (
    <G>
      <Blob color={PURPLE} />
      <Rect x={36} y={30} width={48} height={60} rx={8} fill={WHITE} {...line} strokeDasharray="7 6" />
      <Path d="M52 52 Q52 44 60 44 Q68 44 68 51 Q68 56 62 59 Q60 60 60 64" fill="none" {...line} />
      <Circle cx={60} cy={74} r={2.5} fill={INK} />
    </G>
  ),
  celebrate: () => (
    <G>
      <Blob color={MINT} />
      <Path d="M60 30 L68 50 L90 52 L73 66 L78 88 L60 76 L42 88 L47 66 L30 52 L52 50 Z" fill={YELLOW} {...line} />
      <Circle cx={60} cy={60} r={3} fill={INK} />
      <Line x1={24} y1={30} x2={30} y2={36} {...line} />
      <Line x1={96} y1={30} x2={90} y2={36} {...line} />
      <Line x1={100} y1={70} x2={92} y2={70} {...line} />
    </G>
  ),
  finish: () => (
    <G>
      <Blob color={YELLOW} />
      <Line x1={40} y1={30} x2={40} y2={92} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <Path d="M40 32 H86 L78 46 L86 60 H40 Z" fill={WHITE} {...line} />
      <Rect x={40} y={32} width={12} height={14} fill={INK} />
      <Rect x={64} y={32} width={12} height={14} fill={INK} />
      <Rect x={52} y={46} width={12} height={14} fill={INK} />
    </G>
  ),
};

function Card({ x, y, r, color, children }: { x: number; y: number; r: number; color: string; children?: React.ReactNode }) {
  return (
    <G transform={`rotate(${r} ${x + 28} ${y + 34})`}>
      <Rect x={x + 4} y={y + 4} width={56} height={68} rx={8} fill={INK} />
      <Rect x={x} y={y} width={56} height={68} rx={8} fill={color} {...line} />
      {children}
    </G>
  );
}

const SCENES: Record<'scattered' | 'share' | 'organized' | 'focus' | 'free', () => React.JSX.Element> = {
  scattered: () => (
    <G>
      <Card x={24} y={40} r={-14} color={PINK}>
        <Circle cx={52} cy={74} r={10} fill={WHITE} {...line} />
      </Card>
      <Card x={110} y={30} r={12} color={BLUE}>
        <Path d="M130 56 L146 66 L130 76 Z" fill={WHITE} {...line} />
      </Card>
      <Card x={66} y={92} r={-4} color={YELLOW}>
        <Line x1={78} y1={110} x2={110} y2={110} {...line} />
        <Line x1={78} y1={122} x2={100} y2={122} {...line} />
      </Card>
      <Card x={130} y={112} r={18} color={MINT} />
      <Path d="M18 150 Q30 140 26 128" fill="none" {...line} />
      <Path d="M176 30 l6 -6 M170 18 l0 -8 M184 40 l8 0" fill="none" {...line} />
    </G>
  ),
  share: () => (
    <G>
      <Rect x={44} y={20} width={72} height={130} rx={14} fill={WHITE} {...line} />
      <Rect x={54} y={36} width={52} height={40} rx={6} fill={BLUE} {...line} />
      <Line x1={56} y1={88} x2={100} y2={88} {...line} />
      <Line x1={56} y1={100} x2={88} y2={100} {...line} />
      <Path d="M120 70 Q160 70 160 110" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <Path d="M150 102 L160 114 L170 102" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M128 128 H192 L184 172 H136 Z" fill={YELLOW} {...line} />
      <Path d="M144 128 Q160 144 176 128" fill="none" {...line} />
    </G>
  ),
  organized: () => (
    <G>
      {[
        { y: 120, c: MINT },
        { y: 88, c: BLUE },
        { y: 56, c: ORANGE },
      ].map((f) => (
        <G key={f.y}>
          <Path d={`M40 ${f.y} Q40 ${f.y - 10} 50 ${f.y - 10} H82 L90 ${f.y} Z`} fill={f.c} {...line} />
          <Rect x={40} y={f.y} width={124} height={52} rx={8} fill={WHITE} {...line} />
          <Rect x={52} y={f.y + 12} width={22} height={22} rx={5} fill={f.c} {...line} />
          <Line x1={84} y1={f.y + 18} x2={140} y2={f.y + 18} {...line} />
          <Line x1={84} y1={f.y + 30} x2={120} y2={f.y + 30} {...line} />
        </G>
      ))}
    </G>
  ),
  focus: () => (
    <G>
      <Card x={70} y={40} r={10} color={PURPLE} />
      <Card x={62} y={44} r={4} color={BLUE} />
      <G>
        <Rect x={58} y={56} width={76} height={96} rx={10} fill={INK} />
        <Rect x={54} y={52} width={76} height={96} rx={10} fill={WHITE} {...line} />
        <Rect x={62} y={60} width={60} height={44} rx={6} fill={YELLOW} {...line} />
        <Line x1={64} y1={118} x2={118} y2={118} {...line} />
        <Line x1={64} y1={130} x2={100} y2={130} {...line} />
      </G>
      <Path d="M150 100 H180 M170 90 L180 100 L170 110" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </G>
  ),
  free: () => (
    <G>
      <Path d="M70 86 V60 A30 30 0 0 1 130 60 V64" fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
      <Rect x={50} y={86} width={100} height={78} rx={14} fill={YELLOW} {...line} />
      <Path d="M100 140 C84 128 80 120 80 113 A10 10 0 0 1 100 108 A10 10 0 0 1 120 113 C120 120 116 128 100 140 Z" fill={PINK} {...line} />
      <Path d="M30 50 l8 4 M26 74 h9 M168 46 l-8 5 M174 72 h-9" fill="none" {...line} />
    </G>
  ),
};

export function Illustration({ name, size = 96 }: { name: IllustrationName; size?: number }) {
  if (name in SCENES) {
    const Scene = SCENES[name as keyof typeof SCENES];
    return (
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Scene />
      </Svg>
    );
  }
  const Small = SMALL[name as keyof typeof SMALL];
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Small />
    </Svg>
  );
}
