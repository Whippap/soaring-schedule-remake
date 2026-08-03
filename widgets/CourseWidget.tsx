'use no memo';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';
import type { WidgetDataSnapshot, WidgetCourseItem } from '@/utils/widgetData';
import { lightColors, darkColors, courseColors } from '@/design';

interface Props {
  snapshot: WidgetDataSnapshot;
  isDark: boolean;
  variant?: 'small' | 'large';
}

export function CourseWidget({ snapshot, isDark, variant = 'large' }: Props) {
  const c = isDark ? darkColors : lightColors;
  const bgColor = c.bg;
  const textColor = c.text;
  const subColor = c.textSecondary;

  if (variant === 'small') {
    return (
      <FlexWidget
        clickAction="WIDGET_REFRESH"
        style={{
          width: 'match_parent',
          height: 'match_parent',
          backgroundColor: bgColor,
          borderRadius: 12,
          padding: 10,
          flexDirection: 'column',
        }}
      >
        <CourseList items={snapshot.today} emptyText="今天没有课了" fontSize={13} subFontSize={10} textColor={textColor} subColor={subColor} />
      </FlexWidget>
    );
  }

  // large variant: today + tomorrow with vertical divider
  return (
    <FlexWidget
      clickAction="WIDGET_REFRESH"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: bgColor,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
      }}
    >
      <FlexWidget style={{ width: 0, flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text="今天"
          style={{ fontSize: 12, color: subColor, fontWeight: 'bold', marginBottom: 4 }}
        />
        <CourseList items={snapshot.today} emptyText="没有课" fontSize={13} subFontSize={10} textColor={textColor} subColor={subColor} />
      </FlexWidget>
      <FlexWidget style={{ width: 16, height: 'match_parent', alignItems: 'center' }}>
        <FlexWidget
          style={{
            width: 1,
            height: 'match_parent',
            backgroundColor: c.border as ColorProp,
          }}
        />
      </FlexWidget>
      <FlexWidget style={{ width: 0, flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text="明天"
          style={{ fontSize: 12, color: subColor, fontWeight: 'bold', marginBottom: 4 }}
        />
        <CourseList items={snapshot.tomorrow} emptyText="没有课" fontSize={13} subFontSize={10} textColor={textColor} subColor={subColor} />
      </FlexWidget>
    </FlexWidget>
  );
}

interface CourseListProps {
  items: WidgetCourseItem[];
  emptyText: string;
  fontSize: number;
  subFontSize: number;
  textColor: ColorProp;
  subColor: ColorProp;
}

function CourseList({ items, emptyText, fontSize, subFontSize, textColor, subColor }: CourseListProps) {
  return (
    <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
      {items.length === 0 ? (
        <FlexWidget style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget
            text={emptyText}
            style={{ fontSize, color: subColor, textAlign: 'center' }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 6 }}>
          {items.map((item) => (
            <FlexWidget key={item.id} style={{ flexDirection: 'row', flexGap: 6, alignItems: 'flex-start' }}>
              <FlexWidget
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  marginTop: 3,
                  backgroundColor: (item.color ?? courseColors[0]) as `#${string}`,
                }}
              />
              <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
                <TextWidget
                  text={item.name}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize, color: textColor, fontWeight: 'bold' }}
                />
                <TextWidget
                  text={`${item.sectionRange} ${item.startTime}-${item.endTime}`}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize: subFontSize, color: subColor }}
                />
                {item.location ? (
                  <TextWidget
                    text={item.location}
                    truncate="END"
                    maxLines={1}
                    style={{ fontSize: subFontSize, color: subColor }}
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
