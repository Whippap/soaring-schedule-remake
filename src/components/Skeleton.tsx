import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6 }: Props) {
  const dt = useDesignTokens();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced ? 0.7 : 0.3);

  if (!reduced) {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: dt.colors.surfaceAlt,
        },
        animStyle,
      ]}
    />
  );
}

export function ScheduleSkeleton() {
  const rows = 10;

  return (
    <View style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <Skeleton width="30%" height={20} />
      </View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ marginBottom: 8 }}>
          <Skeleton height={56} />
        </View>
      ))}
      <View style={{ height: 80 }} />
    </View>
  );
}

export function CardListSkeleton() {
  const dt = useDesignTokens();

  return (
    <View style={{ padding: 16, gap: 8 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <View
          key={i}
          style={{
            height: 80,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: dt.colors.border,
            backgroundColor: dt.colors.surface,
            flexDirection: 'row',
            overflow: 'hidden',
          }}
        >
          <Skeleton width={4} height={80} borderRadius={0} />
          <View style={{ flex: 1, padding: 12, gap: 8 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    overflow: 'hidden',
  },
});
