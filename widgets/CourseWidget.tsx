'use no memo';
import { FlexWidget, TextWidget, ListWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';
import type { WidgetDataSnapshot, WidgetCourseItem } from '@/utils/widgetData';
import { filterUpcomingCourses } from '@/utils/widgetData';
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
    return <SmallWidget snapshot={snapshot} textColor={textColor} subColor={subColor} bgColor={bgColor} />;
  }

  return (
    <LargeWidget
      snapshot={snapshot}
      textColor={textColor}
      subColor={subColor}
      bgColor={bgColor}
      borderColor={c.border as ColorProp}
    />
  );
}

/* ──────────── Small Widget ──────────── */

const SMALL_MAX_VISIBLE = 3;

function SmallWidget({
  snapshot,
  textColor,
  subColor,
  bgColor,
}: {
  snapshot: WidgetDataSnapshot;
  textColor: ColorProp;
  subColor: ColorProp;
  bgColor: ColorProp;
}) {
  const upcoming = filterUpcomingCourses(snapshot.allToday);
  const visible = upcoming.slice(0, SMALL_MAX_VISIBLE);
  const remaining = upcoming.length - visible.length;

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
      <TextWidget
        text="今日课程"
        style={{ fontSize: 12, color: subColor, fontWeight: 'bold', marginBottom: 6 }}
      />
      {upcoming.length === 0 ? (
        <FlexWidget style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget
            text="今天没有课了"
            style={{ fontSize: 13, color: subColor, textAlign: 'center' }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 6 }}>
          {visible.map((item) => (
            <CourseRow key={item.id} item={item} textColor={textColor} subColor={subColor} />
          ))}
          {remaining > 0 ? (
            <TextWidget
              text={`+${remaining}`}
              style={{ fontSize: 12, color: subColor, textAlign: 'center' }}
            />
          ) : null}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

/* ──────────── Large Widget ──────────── */

function LargeWidget({
  snapshot,
  textColor,
  subColor,
  bgColor,
  borderColor,
}: {
  snapshot: WidgetDataSnapshot;
  textColor: ColorProp;
  subColor: ColorProp;
  bgColor: ColorProp;
  borderColor: ColorProp;
}) {
  const maxRows = Math.max(snapshot.allToday.length, snapshot.allTomorrow.length, 1);

  return (
    <FlexWidget
      clickAction="WIDGET_REFRESH"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: bgColor,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'column',
      }}
    >
      {/* Fixed header */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginBottom: 4 }}>
        <FlexWidget style={{ width: 0, flex: 1 }}>
          <TextWidget
            text="今天"
            style={{ fontSize: 12, color: subColor, fontWeight: 'bold' }}
          />
        </FlexWidget>
        <FlexWidget style={{ width: 16 }} />
        <FlexWidget style={{ width: 0, flex: 1 }}>
          <TextWidget
            text="明天"
            style={{ fontSize: 12, color: subColor, fontWeight: 'bold' }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Scrollable course list */}
      <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
        <ListWidget>
          {Array.from({ length: maxRows }, (_, i) => (
            <FlexWidget
              key={i}
              style={{
                width: 'match_parent',
                flexDirection: 'row',
                paddingVertical: 4,
              }}
            >
              {/* Today column */}
              <FlexWidget style={{ width: 0, flex: 1, flexDirection: 'column' }}>
                {snapshot.allToday[i] ? (
                  <CourseRow
                    item={snapshot.allToday[i]}
                    textColor={textColor}
                    subColor={subColor}
                  />
                ) : (
                  <FlexWidget style={{ height: 1 }} />
                )}
              </FlexWidget>

              {/* Divider */}
              <FlexWidget
                style={{
                  width: 16,
                  height: 'match_parent',
                  alignItems: 'center',
                }}
              >
                <FlexWidget
                  style={{
                    width: 2,
                    height: 'match_parent',
                    backgroundColor: borderColor,
                  }}
                />
              </FlexWidget>

              {/* Tomorrow column */}
              <FlexWidget style={{ width: 0, flex: 1, flexDirection: 'column' }}>
                {snapshot.allTomorrow[i] ? (
                  <CourseRow
                    item={snapshot.allTomorrow[i]}
                    textColor={textColor}
                    subColor={subColor}
                  />
                ) : (
                  <FlexWidget style={{ height: 1 }} />
                )}
              </FlexWidget>
            </FlexWidget>
          ))}
        </ListWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/* ──────────── Shared: single course row ──────────── */

function CourseRow({
  item,
  textColor,
  subColor,
}: {
  item: WidgetCourseItem;
  textColor: ColorProp;
  subColor: ColorProp;
}) {
  return (
    <FlexWidget style={{ flexDirection: 'row', flexGap: 4, alignItems: 'flex-start' }}>
      <FlexWidget
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          marginTop: 4,
          backgroundColor: (item.color ?? courseColors[0]) as `#${string}`,
        }}
      />
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text={item.name}
          truncate="END"
          maxLines={1}
          style={{ fontSize: 11, color: textColor, fontWeight: 'bold' }}
        />
        <TextWidget
          text={`${item.sectionRange} ${item.startTime}-${item.endTime}`}
          truncate="END"
          maxLines={1}
          style={{ fontSize: 10, color: subColor }}
        />
        {item.location ? (
          <TextWidget
            text={item.location}
            truncate="END"
            maxLines={1}
            style={{ fontSize: 10, color: subColor }}
          />
        ) : null}
      </FlexWidget>
    </FlexWidget>
  );
}
