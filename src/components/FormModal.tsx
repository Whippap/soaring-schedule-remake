import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import type { ViewStyle, StyleProp } from 'react-native';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  contentContainerStyle: StyleProp<ViewStyle>;
}

/**
 * FormModal — 自定义 modal，延迟卸载子组件
 *
 * react-native-paper 的 Modal 在关闭时立即 return null 导致子组件被卸载，
 * 重新打开时 TextInput 需要重新测量 layout，产生 label 闪烁。
 *
 * FormModal 在关闭后延迟 500ms 再卸载子组件，使得短时间内重新打开时
 * 无需重新挂载。仅在首次挂载时有一次 layout 测量开销。
 */
export function FormModal({ visible, onDismiss, children, contentContainerStyle }: Props) {
  const dt = useDesignTokens();
  const insets = useSafeAreaInsets();
  const opacity = useMemo(() => new Animated.Value(0), []);
  const [mounted, setMounted] = useState(false);
  const unmountTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (visible) {
      // 清除待执行的卸载定时器
      if (unmountTimer.current) {
        clearTimeout(unmountTimer.current);
        unmountTimer.current = undefined;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
      // 关闭后延迟卸载，减少频繁开关时的重建开销
      unmountTimer.current = setTimeout(() => setMounted(false), 500);
    }

    return () => {
      if (unmountTimer.current) {
        clearTimeout(unmountTimer.current);
      }
    };
  }, [visible, mounted, opacity]);

  // Android 返回键处理
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onDismiss]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityViewIsModal={visible}
      accessibilityElementsHidden={!visible}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: dt.colors.overlay }]}
        onPress={onDismiss}
      />
      <View
        style={[
          styles.wrapper,
          { marginTop: insets.top, marginBottom: insets.bottom },
        ]}
        pointerEvents="box-none"
      >
        <View style={[contentContainerStyle]}>{children}</View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
});
