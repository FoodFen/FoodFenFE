// Mascot art registry: mascot id -> action -> one static visual. `default` is bundled raster art (one pose for every
// action); the other mascots are SVG placeholders tinted per id.
import { Image } from 'expo-image';
import type { ReactElement, ReactNode } from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import type { MascotAction } from '@/lib/mascot';
import type { ThemeColors } from '@/theme/colors';

export type MascotId = 'default' | 'sprout' | 'berry' | 'chili';

export interface MascotVisualProps {
  size: number;
  colors: ThemeColors;
}

type MascotVisual = (props: MascotVisualProps) => ReactElement;

function Face({ size, colors, children }: MascotVisualProps & { children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {children}
    </Svg>
  );
}

const STROKE = { strokeWidth: 4, strokeLinecap: 'round', fill: 'none' } as const;

const dotEyes = (ink: string, y = 42) => (
  <>
    <Circle cx={36} cy={y} r={5} fill={ink} />
    <Circle cx={64} cy={y} r={5} fill={ink} />
  </>
);

const happyEyes = (ink: string) => (
  <>
    <Path d="M30 46 Q36 36 42 46" stroke={ink} {...STROKE} />
    <Path d="M58 46 Q64 36 70 46" stroke={ink} {...STROKE} />
  </>
);

const drop = (x: number, y: number, fill: string) => (
  <Path
    d={`M${x} ${y} Q${x + 6} ${y + 9} ${x} ${y + 15} Q${x - 6} ${y + 9} ${x} ${y}`}
    fill={fill}
  />
);

const idle: MascotVisual = (p) => (
  <Face {...p}>
    {dotEyes(p.colors.brand)}
    <Path d="M36 62 Q50 74 64 62" stroke={p.colors.brand} {...STROKE} />
  </Face>
);

const hungry: MascotVisual = (p) => (
  <Face {...p}>
    {dotEyes(p.colors.brand)}
    <Ellipse cx={50} cy={68} rx={7} ry={9} fill={p.colors.brand} />
    {drop(62, 72, p.colors.fat)}
  </Face>
);

const thirsty: MascotVisual = (p) => (
  <Face {...p}>
    {dotEyes(p.colors.brand)}
    <Path d="M38 68 H62" stroke={p.colors.brand} {...STROKE} />
    {drop(80, 20, p.colors.fat)}
  </Face>
);

const eating: MascotVisual = (p) => (
  <Face {...p}>
    {happyEyes(p.colors.brand)}
    <Ellipse cx={50} cy={68} rx={10} ry={8} fill={p.colors.brand} />
    <Circle cx={80} cy={70} r={8} fill={p.colors.carbs} />
  </Face>
);

const drinking: MascotVisual = (p) => (
  <Face {...p}>
    {dotEyes(p.colors.brand)}
    <Circle cx={42} cy={68} r={4} fill={p.colors.brand} />
    <Rect x={70} y={46} width={4} height={18} fill={p.colors.brand} />
    <Rect x={58} y={60} width={26} height={28} rx={4} fill={p.colors.fat} />
  </Face>
);

const exercising: MascotVisual = (p) => (
  <Face {...p}>
    <Path d="M8 34 Q50 18 92 34 L90 42 Q50 28 10 42 Z" fill={p.colors.danger} />
    {dotEyes(p.colors.brand, 52)}
    <Path d="M36 68 Q50 80 64 68" stroke={p.colors.brand} {...STROKE} />
    {drop(86, 52, p.colors.fat)}
  </Face>
);

const thinking: MascotVisual = (p) => (
  <Face {...p}>
    {dotEyes(p.colors.brand, 38)}
    <Path d="M42 68 H58" stroke={p.colors.brand} {...STROKE} />
    <Circle cx={88} cy={14} r={3.5} fill={p.colors.fgMuted} />
    <Circle cx={95} cy={5} r={2.5} fill={p.colors.fgMuted} />
  </Face>
);

const happy: MascotVisual = (p) => (
  <Face {...p}>
    {happyEyes(p.colors.brand)}
    <Path d="M32 60 Q50 84 68 60 Z" fill={p.colors.brand} />
    <Circle cx={24} cy={62} r={5} fill={p.colors.protein} opacity={0.5} />
    <Circle cx={76} cy={62} r={5} fill={p.colors.protein} opacity={0.5} />
  </Face>
);

const confused: MascotVisual = (p) => (
  <Face {...p}>
    <Circle cx={36} cy={42} r={6} fill={p.colors.brand} />
    <Circle cx={64} cy={44} r={3} fill={p.colors.brand} />
    <Path d="M56 32 L72 27" stroke={p.colors.brand} {...STROKE} />
    <Path d="M34 68 Q42 60 50 68 T66 68" stroke={p.colors.brand} {...STROKE} />
  </Face>
);

const FACE_ACTIONS: Record<MascotAction, MascotVisual> = {
  idle,
  hungry,
  thirsty,
  eating,
  drinking,
  exercising,
  thinking,
  happy,
  confused,
};

function tinted(body: string): Record<MascotAction, MascotVisual> {
  return Object.fromEntries(
    Object.entries(FACE_ACTIONS).map(([action, visual]) => [
      action,
      (p: MascotVisualProps) => visual({ ...p, colors: { ...p.colors, brand: body } as ThemeColors }),
    ]),
  ) as Record<MascotAction, MascotVisual>;
}

const FEN_IMAGE = require('../../../assets/mascot-default.png') as number;

const fen: MascotVisual = ({ size }) => (
  <Image source={FEN_IMAGE} style={{ width: size, height: size }} contentFit="contain" />
);

const DEFAULT_ACTIONS = Object.fromEntries(
  Object.keys(FACE_ACTIONS).map((action) => [action, fen]),
) as Record<MascotAction, MascotVisual>;

export const MASCOT_BODY_COLORS: Partial<Record<MascotId, string>> = {
  sprout: '#14B8A6',
  berry: '#8B5CF6',
  chili: '#F97316',
};

export const MASCOT_VISUALS: Record<MascotId, Record<MascotAction, MascotVisual>> = {
  default: DEFAULT_ACTIONS,
  sprout: tinted(MASCOT_BODY_COLORS.sprout as string),
  berry: tinted(MASCOT_BODY_COLORS.berry as string),
  chili: tinted(MASCOT_BODY_COLORS.chili as string),
};

export function hasMascotArt(id: string): id is MascotId {
  return Object.prototype.hasOwnProperty.call(MASCOT_VISUALS, id);
}

export function mascotArtId(id: string): MascotId {
  return hasMascotArt(id) ? id : 'default';
}
