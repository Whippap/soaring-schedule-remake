import type { ReactNode } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '@/hooks/useDesignTokens';

interface Props {
  children: ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
}

export function ScreenContainer({
  children,
  scrollable = false,
  refreshing = false,
  onRefresh,
  padded = true,
}: Props) {
  const dt = useDesignTokens();
  const bg = { backgroundColor: dt.colors.bg };
  const padding = padded ? styles.padded : undefined;

  if (scrollable) {
    return (
      <SafeAreaView style={[styles.flex, bg]} edges={['bottom']}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={padding}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, bg]} edges={['bottom']}>
      <View style={[styles.flex, padding]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  padded: {
    padding: 16,
  },
});
