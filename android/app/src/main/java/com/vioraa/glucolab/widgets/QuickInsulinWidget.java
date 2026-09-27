package com.vioraa.glucolab.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Log;
import android.widget.RemoteViews;
import com.vioraa.glucolab.MainActivity;
import com.vioraa.glucolab.R;

public class QuickInsulinWidget extends AppWidgetProvider {

    private static final String TAG = "GlucoLabWidget_QuickInsulin";

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        Log.d(TAG, "onEnabled: QuickInsulinWidget added to home screen.");
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        Log.d(TAG, "onDisabled: QuickInsulinWidget removed from home screen.");
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
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_insulin);

            int p1 = WidgetDataStore.getPreset(context, 1, 4);
            int p2 = WidgetDataStore.getPreset(context, 2, 6);
            int p3 = WidgetDataStore.getPreset(context, 3, 8);
            int p4 = WidgetDataStore.getPreset(context, 4, 10);

            views.setTextViewText(R.id.btn_preset_1, p1 + " U");
            views.setTextViewText(R.id.btn_preset_2, p2 + " U");
            views.setTextViewText(R.id.btn_preset_3, p3 + " U");
            views.setTextViewText(R.id.btn_preset_4, p4 + " U");

            SharedPreferences prefs = WidgetDataStore.getPrefs(context);
            String lastSaved = prefs.getString("last_saved_insulin_str", "No insulin recorded");
            views.setTextViewText(R.id.tv_last_saved, "Last Saved: " + lastSaved);

            // Bind preset buttons to QuickInsulinReceiver
            bindPresetButton(context, views, R.id.btn_preset_1, p1, 201);
            bindPresetButton(context, views, R.id.btn_preset_2, p2, 202);
            bindPresetButton(context, views, R.id.btn_preset_3, p3, 203);
            bindPresetButton(context, views, R.id.btn_preset_4, p4, 204);

            appWidgetManager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "Successfully updated QuickInsulinWidget ID: " + appWidgetId);
        } catch (Throwable t) {
            Log.e(TAG, "Critical error updating QuickInsulinWidget ID: " + appWidgetId + ", rendering fallback UI", t);
            renderFallbackUI(context, appWidgetManager, appWidgetId);
        }
    }

    private static void bindPresetButton(Context context, RemoteViews views, int buttonId, int units, int requestCode) {
        try {
            Intent intent = new Intent(context, QuickInsulinReceiver.class);
            intent.setAction(QuickInsulinReceiver.ACTION_LOG_INSULIN);
            intent.putExtra(QuickInsulinReceiver.EXTRA_UNITS, units);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(buttonId, pendingIntent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to bind preset button ID: " + buttonId + " for units: " + units, e);
        }
    }

    private static void renderFallbackUI(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.widget_quick_insulin);
            fallback.setTextViewText(R.id.tv_last_saved, "No Readings Available • Tap to Open");

            Intent mainIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.vioraa.glucolab://dashboard"), context, MainActivity.class);
            mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent mainPendingIntent = PendingIntent.getActivity(
                    context, 200, mainIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            fallback.setOnClickPendingIntent(R.id.widget_quick_insulin_root, mainPendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, fallback);
        } catch (Throwable t) {
            Log.e(TAG, "Fatal failure rendering QuickInsulinWidget fallback UI:", t);
        }
    }

    public static void refreshAllWidgets(Context context) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, QuickInsulinWidget.class));
            if (ids != null && ids.length > 0) {
                Log.d(TAG, "Refreshing " + ids.length + " QuickInsulinWidget instances.");
                for (int id : ids) {
                    updateWidget(context, manager, id);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in refreshAllWidgets:", e);
        }
    }
}
