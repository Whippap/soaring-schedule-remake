import { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { Icon } from '@/components/Icon';

interface PickerFieldProps<T> {
  label: string;
  value: T;
  options: T[];
  displayValue: (v: T) => string;
  onSelect: (v: T) => void;
  dt: ReturnType<typeof useDesignTokens>;
}

/** 行内展开式下拉选择框(轻量替代原生 Picker,样式随设计 token) */
export function PickerField<T extends string | number>({
  label,
  value,
  options,
  displayValue,
  onSelect,
  dt,
}: PickerFieldProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: dt.colors.border,
          borderRadius: dt.borderRadius.md,
          backgroundColor: dt.colors.surface,
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: dt.fontSize.body, color: dt.colors.text }}>
          {label}: {displayValue(value)}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={dt.colors.textSecondary} />
      </TouchableOpacity>
      {open ? (
        <View
          style={{
            marginTop: 4,
            borderWidth: 1,
            borderColor: dt.colors.border,
            borderRadius: dt.borderRadius.md,
            backgroundColor: dt.colors.surface,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            style={{ maxHeight: 200 }}
          >
            {options.map((opt) => {
              const selected = value === opt;
              return (
                <TouchableOpacity
                  key={String(opt)}
                  onPress={() => {
                    onSelect(opt);
                    setOpen(false);
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: selected ? `${dt.colors.primary}14` : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: dt.fontSize.body,
                      color: selected ? dt.colors.primary : dt.colors.text,
                      fontWeight: selected ? dt.fontWeight.subheading : dt.fontWeight.body,
                    }}
                  >
                    {displayValue(opt)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
