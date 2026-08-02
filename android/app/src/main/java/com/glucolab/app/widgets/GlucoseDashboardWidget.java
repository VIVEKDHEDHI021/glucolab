package com.glucolab.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.util.Log;
import android.widget.RemoteViews;
import com.glucolab.app.MainActivity;
import com.glucolab.app.R;
import java.util.List;

public class GlucoseDashboardWidget extends AppWidgetProvider {

    private static final String TAG = "GlucoLabWidget_Dashboard";

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        Log.d(TAG, "onEnabled: GlucoseDashboardWidget added to home screen.");
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        Log.d(TAG, "onDisabled: GlucoseDashboardWidget removed from home screen.");
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : "null";
        Log.d(TAG, "onReceive action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_DATE_CHANGED.equals(action) ||
            Intent.ACTION_TIME_CHANGED.equals(action) ||
            Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            refreshAllWidgets(context);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        Log.d(TAG, "onUpdate called for " + (appWidgetIds != null ? appWidgetIds.length : 0) + " widget instances.");
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        Log.d(TAG, "Updating widget instance ID: " + appWidgetId);

        try {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_glucose_dashboard);
            SharedPreferences prefs = WidgetDataStore.getPrefs(context);

            String glucoseStr = prefs.getString("latest_glucose", null);
            String unitStr = prefs.getString("glucose_unit", "mg/dL");
            String lastInsulinStr = prefs.getString("last_insulin", "-- Units");
            String updatedTimeStr = prefs.getString("updated_time", "Today • --:--");
            int todayCount = prefs.getInt("readings_today_count", 0);

            // Fallback content if no readings recorded yet
            if (glucoseStr == null || glucoseStr.equals("--") || glucoseStr.isEmpty()) {
                views.setTextViewText(R.id.tv_glucose_value, "No Data");
                views.setTextViewText(R.id.tv_glucose_unit, unitStr);
                views.setTextViewText(R.id.tv_last_insulin, "No Readings Available");
                views.setTextViewText(R.id.tv_updated_time, "Tap to Open App");
                views.setTextViewText(R.id.tv_today_count, "Today: 0");
            } else {
                views.setTextViewText(R.id.tv_glucose_value, glucoseStr);
                views.setTextViewText(R.id.tv_glucose_unit, unitStr);
                views.setTextViewText(R.id.tv_last_insulin, lastInsulinStr.contains("U") ? lastInsulinStr : lastInsulinStr + " Units");
                views.setTextViewText(R.id.tv_updated_time, "Updated: " + updatedTimeStr);
                views.setTextViewText(R.id.tv_today_count, "Today: " + todayCount);

                try {
                    double val = Double.parseDouble(glucoseStr);
                    int color = WidgetDataStore.getGlucoseColor(val);
                    views.setTextColor(R.id.tv_glucose_value, color);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to parse glucose string for color: " + glucoseStr, e);
                }
            }

            // Draw Sparkline Graph safely
            try {
                List<Double> sparklinePoints = WidgetDataStore.parseSparklineData(context);
                Bitmap sparklineBitmap = WidgetDataStore.generateSparkline(context, sparklinePoints, 200, 70);
                if (sparklineBitmap != null) {
                    views.setImageViewBitmap(R.id.iv_sparkline, sparklineBitmap);
                }
            } catch (Throwable t) {
                Log.e(TAG, "Error generating sparkline bitmap:", t);
            }

            // PendingIntents for Deep Links
            try {
                // 1. Glucose block click -> History Screen
                Intent historyIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.glucolab.app://history?type=glucose"), context, MainActivity.class);
                historyIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent historyPendingIntent = PendingIntent.getActivity(
                        context, 101, historyIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                views.setOnClickPendingIntent(R.id.ll_glucose_block, historyPendingIntent);

                // 2. Insulin block click -> Insulin History
                Intent insulinIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.glucolab.app://history?type=insulin"), context, MainActivity.class);
                insulinIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent insulinPendingIntent = PendingIntent.getActivity(
                        context, 102, insulinIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                views.setOnClickPendingIntent(R.id.ll_insulin_block, insulinPendingIntent);

                // 3. Background click -> Dashboard
                Intent mainIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.glucolab.app://dashboard"), context, MainActivity.class);
                mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent mainPendingIntent = PendingIntent.getActivity(
                        context, 100, mainIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                views.setOnClickPendingIntent(R.id.widget_dashboard_root, mainPendingIntent);
            } catch (Exception e) {
                Log.e(TAG, "Error binding deep link intents:", e);
            }

            appWidgetManager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "Successfully updated GlucoseDashboardWidget ID: " + appWidgetId);
        } catch (Throwable t) {
            Log.e(TAG, "Critical error updating GlucoseDashboardWidget ID: " + appWidgetId + ", rendering fallback UI", t);
            renderFallbackUI(context, appWidgetManager, appWidgetId);
        }
    }

    private static void renderFallbackUI(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.widget_glucose_dashboard);
            fallback.setTextViewText(R.id.tv_app_title, "🩸 GlucoLab");
            fallback.setTextViewText(R.id.tv_glucose_value, "No Data");
            fallback.setTextViewText(R.id.tv_glucose_unit, "mg/dL");
            fallback.setTextViewText(R.id.tv_last_insulin, "No Readings Available");
            fallback.setTextViewText(R.id.tv_updated_time, "Tap to Open App");
            fallback.setTextViewText(R.id.tv_today_count, "Today: 0");

            Intent mainIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.glucolab.app://dashboard"), context, MainActivity.class);
            mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent mainPendingIntent = PendingIntent.getActivity(
                    context, 100, mainIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            fallback.setOnClickPendingIntent(R.id.widget_dashboard_root, mainPendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, fallback);
        } catch (Throwable t) {
            Log.e(TAG, "Fatal failure rendering fallback UI:", t);
        }
    }

    public static void refreshAllWidgets(Context context) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, GlucoseDashboardWidget.class));
            if (ids != null && ids.length > 0) {
                Log.d(TAG, "Refreshing " + ids.length + " GlucoseDashboardWidget instances.");
                for (int id : ids) {
                    updateWidget(context, manager, id);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in refreshAllWidgets:", e);
        }
    }
}
