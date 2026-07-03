import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';

interface HeaderAction {
  icon: IconName;
  onPress: () => void;
  label?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  leftAction?: HeaderAction;
  rightActions?: HeaderAction[];
}

export function ScreenHeader({ title, subtitle, leftAction, rightActions }: Props) {
  const dt = useDesignTokens();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: dt.colors.surface,
          borderBottomColor: dt.colors.border,
        },
      ]}
    >
      <View style={styles.inner}>
        {leftAction ? (
          <HeaderActionButton action={leftAction} color={dt.colors.text} />
        ) : (
          <View style={styles.spacer} />
        )}
        <View style={styles.titleGroup}>
          <Text
            variant="titleLarge"
            style={{
              fontWeight: dt.fontWeight.heading,
              fontSize: dt.fontSize.subheading,
              color: dt.colors.text,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              variant="bodySmall"
              style={{ color: dt.colors.textSecondary, marginTop: 2 }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          {rightActions?.map((action, i) => (
            <HeaderActionButton key={i} action={action} color={dt.colors.primary} />
          ))}
          {(!rightActions || rightActions.length === 0) ? (
            <View style={styles.spacer} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function HeaderActionButton({
  action,
  color,
}: {
  action: HeaderAction;
  color: string;
}) {
  return (
    <Text
      style={[styles.actionBtn, { color }]}
      onPress={action.onPress}
      suppressHighlighting
    >
      {action.icon ? (
        <View style={styles.actionIcon}>
          <Icon name={action.icon} size={20} color={color} />
        </View>
      ) : null}
      {action.label ? (
        <Text style={{ color, fontSize: 13 }}>{action.label}</Text>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
  },
  titleGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 40,
  },
  actions: {
    minWidth: 40,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    marginRight: 2,
  },
});

export type { HeaderAction };
