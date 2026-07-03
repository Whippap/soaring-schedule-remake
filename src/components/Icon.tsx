import type { StyleProp, ViewStyle, ColorValue } from 'react-native';
import {
  CalendarDots,
  ListBullets,
  GearSix,
  Plus,
  CaretLeft,
  CaretRight,
  DotsThreeVertical,
  PencilSimple,
  Trash,
  DownloadSimple,
  UploadSimple,
  MoonStars,
  SunDim,
  WarningCircle,
  Info,
  FloppyDisk,
  X,
  Check,
  ArrowsClockwise,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  Funnel,
  ArrowLeft,
  MapPin,
  ChalkboardTeacher,
  GraduationCap,
  BookOpen,
  Clock,
  CalendarCheck,
  CirclesThreePlus,
  ArrowCounterClockwise,
} from 'phosphor-react-native';

const iconMap = {
  'calendar-month': CalendarDots,
  'view-list': ListBullets,
  'cog': GearSix,
  'plus': Plus,
  'chevron-left': CaretLeft,
  'chevron-right': CaretRight,
  'dots-vertical': DotsThreeVertical,
  'pencil': PencilSimple,
  'delete': Trash,
  'export': UploadSimple,
  'import': DownloadSimple,
  'theme-light-dark': MoonStars,
  'moon-stars': MoonStars,
  'sun-dim': SunDim,
  'alert': WarningCircle,
  'info': Info,
  'check': Check,
  'close': X,
  'save': FloppyDisk,
  'refresh': ArrowsClockwise,
  'eye': Eye,
  'eye-off': EyeSlash,
  'search': MagnifyingGlass,
  'filter': Funnel,
  'arrow-left': ArrowLeft,
  'location': MapPin,
  'teacher': ChalkboardTeacher,
  'semester': GraduationCap,
  'course': BookOpen,
  'time': Clock,
  'calendar-check': CalendarCheck,
  'import-course': CirclesThreePlus,
  'reset': ArrowCounterClockwise,
} as const;

export type IconName = keyof typeof iconMap;

interface Props {
  name: IconName;
  size?: number;
  color?: ColorValue;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  style?: StyleProp<ViewStyle>;
}

export function Icon({ name, size = 24, color, weight = 'regular', style }: Props) {
  const PhosphorComponent = iconMap[name];
  if (!PhosphorComponent) {
    return null;
  }
  return (
    <PhosphorComponent
      size={size}
      color={color as string | undefined}
      weight={weight}
      style={style}
    />
  );
}

export { iconMap };
export default Icon;
