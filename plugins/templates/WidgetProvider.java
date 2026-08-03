package {{PACKAGE}}.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.reactnativeandroidwidget.RNWidgetProvider;

import java.util.Calendar;

public class {{CLASS_NAME}} extends RNWidgetProvider {
    private static final String ACTION_HOURLY_UPDATE = "{{PACKAGE}}.HOURLY_UPDATE";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        super.onUpdate(context, appWidgetManager, appWidgetIds);
        scheduleNextHourlyUpdate(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_HOURLY_UPDATE.equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName componentName = new ComponentName(context, {{CLASS_NAME}}.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);

            if (appWidgetIds != null && appWidgetIds.length > 0) {
                this.onUpdate(context, appWidgetManager, appWidgetIds);
            }
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        super.onDeleted(context, appWidgetIds);

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, {{CLASS_NAME}}.class);
        if (appWidgetManager.getAppWidgetIds(componentName).length == 0) {
            cancelHourlyUpdate(context);
        }
    }

    private void scheduleNextHourlyUpdate(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        Intent intent = new Intent(context, {{CLASS_NAME}}.class);
        intent.setAction(ACTION_HOURLY_UPDATE);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_MUTABLE
        );

        alarmManager.cancel(pendingIntent);

        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        calendar.add(Calendar.HOUR_OF_DAY, 1);

        alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC,
                calendar.getTimeInMillis(),
                pendingIntent
        );
    }

    private void cancelHourlyUpdate(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, {{CLASS_NAME}}.class);
        intent.setAction(ACTION_HOURLY_UPDATE);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        alarmManager.cancel(pendingIntent);
    }
}
