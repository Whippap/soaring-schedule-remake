import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';

interface Props {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = 'calendar-check', title, description, action }: Props) {
  const dt = useDesignTokens();

  return (
    <View style={styles.container}>
      <Icon name={icon} size={48} color={dt.colors.textMuted} />
      <Text
        style={{
          fontSize: dt.fontSize.body,
          color: dt.colors.textSecondary,
          marginTop: dt.spacing.lg,
          fontWeight: dt.fontWeight.subheading,
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            fontSize: dt.fontSize.caption,
            color: dt.colors.textMuted,
            marginTop: dt.spacing.xs,
            textAlign: 'center',
          }}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: dt.spacing.lg }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
});
