import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import type {
  StyleProp,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { useDesignTokens } from '@/hooks/useDesignTokens';

type TextInputFocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];

interface AppTextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  helperText?: string;
  errorText?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function AppTextField({
  label,
  helperText,
  errorText,
  style,
  inputStyle,
  multiline,
  onBlur,
  onFocus,
  editable = true,
  ...inputProps
}: AppTextFieldProps) {
  const dt = useDesignTokens();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorText);
  const borderColor = hasError
    ? dt.colors.destructive
    : focused
      ? dt.colors.primary
      : dt.colors.border;

  const handleFocus = (event: TextInputFocusEvent) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event: TextInputFocusEvent) => {
    setFocused(false);
    onBlur?.(event);
  };

  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          styles.label,
          {
            color: hasError ? dt.colors.destructive : dt.colors.textSecondary,
            fontSize: dt.fontSize.caption,
            fontWeight: dt.fontWeight.label,
          },
        ]}
      >
        {label}
      </Text>
      <NativeTextInput
        {...inputProps}
        editable={editable}
        multiline={multiline}
        placeholderTextColor={dt.colors.textMuted}
        selectionColor={dt.colors.primary}
        cursorColor={dt.colors.primary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            borderColor,
            borderRadius: dt.borderRadius.md,
            backgroundColor: editable ? dt.colors.surface : dt.colors.surfaceAlt,
            color: dt.colors.text,
            fontSize: dt.fontSize.body,
          },
          inputStyle,
        ]}
      />
      {errorText || helperText ? (
        <Text
          style={[
            styles.helper,
            {
              color: hasError ? dt.colors.destructive : dt.colors.textMuted,
              fontSize: dt.fontSize.label,
            },
          ]}
        >
          {errorText || helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  label: {
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  helper: {
    marginTop: 4,
  },
});
