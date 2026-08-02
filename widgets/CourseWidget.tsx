'use no memo';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetDataSnapshot } from '@/utils/widgetData';
import { lightColors, darkColors, courseColors } from '@/design';

interface Props {
  snapshot: WidgetDataSnapshot;
  isDark: boolean;
}

export function CourseWidget({ snapshot, isDark }: Props) {
  const c = isDark ? darkColors : lightColors;
  const bgColor = c.bg;
  const textColor = c.text;
  const subColor = c.textSecondary;

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: bgColor,
        borderRadius: 16,
        padding: 14,
        flexDirection: 'column',
      }}
    >
      {snapshot.items.length === 0 ? (
        <FlexWidget style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget
            text="今天没有课了"
            style={{ fontSize: 16, color: subColor, textAlign: 'center' }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 8 }}>
          {snapshot.items.map((item) => (
            <FlexWidget key={item.id} style={{ flexDirection: 'row', flexGap: 8, alignItems: 'center' }}>
              <FlexWidget
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: (item.color ?? courseColors[0]) as `#${string}`,
                }}
              />
              <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
                <TextWidget
                  text={item.name}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize: 14, color: textColor, fontWeight: 'bold' }}
                />
                <TextWidget
                  text={`${item.sectionRange} ${item.startTime}-${item.endTime}`}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize: 11, color: subColor }}
                />
                {item.location ? (
                  <TextWidget
                    text={item.location}
                    truncate="END"
                    maxLines={1}
                    style={{ fontSize: 11, color: subColor }}
                  />
                ) : null}
              </FlexWidget>
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
