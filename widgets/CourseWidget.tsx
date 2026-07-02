import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetDataSnapshot } from '@/utils/widgetData';

interface Props {
  snapshot: WidgetDataSnapshot;
  isDark: boolean;
}

export function CourseWidget({ snapshot, isDark }: Props) {
  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#333333';
  const subColor = isDark ? '#bbbbbb' : '#888888';

  return (
    <FlexWidget
      style={{
        width: 280,
        height: 180,
        backgroundColor: bgColor,
        borderRadius: 12,
        padding: 12,
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
                    backgroundColor: (item.color ?? '#3498db') as `#${string}`,
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
