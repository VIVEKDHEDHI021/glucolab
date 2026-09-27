package com.vioraa.glucolab.widgets;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.widget.Toast;

public class QuickInsulinReceiver extends BroadcastReceiver {

    private static final String TAG = "GlucoLabWidget_Receiver";
    public static final String ACTION_LOG_INSULIN = "com.vioraa.glucolab.ACTION_LOG_INSULIN";
    public static final String EXTRA_UNITS = "extra_units";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String action = intent.getAction();
        Log.d(TAG, "QuickInsulinReceiver onReceive action: " + action);

        if (!ACTION_LOG_INSULIN.equals(action)) return;

        try {
            int units = intent.getIntExtra(EXTRA_UNITS, 0);
            Log.d(TAG, "QuickInsulinReceiver received log action for units: " + units);

            if (units <= 0) {
                Log.w(TAG, "Invalid units value: " + units);
                return;
            }

            int safetyLimit = WidgetDataStore.getSafetyLimit(context);

            if (units > safetyLimit) {
                Log.d(TAG, "Units (" + units + ") exceed safety limit (" + safetyLimit + "). Launching confirmation dialog.");
                Intent confirmIntent = new Intent(context, QuickInsulinConfirmActivity.class);
                confirmIntent.putExtra(EXTRA_UNITS, units);
                confirmIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                context.startActivity(confirmIntent);
            } else {
                performInsulinSave(context, units);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling QuickInsulinReceiver onReceive:", e);
        }
    }

    public static void performInsulinSave(Context context, int units) {
        if (context == null) return;
        try {
            Log.d(TAG, "performInsulinSave: saving " + units + " units...");
            WidgetDataStore.logQuickInsulin(context, units);

            Toast.makeText(context, units + " Units Saved", Toast.LENGTH_SHORT).show();

            QuickInsulinWidget.refreshAllWidgets(context);
            GlucoseDashboardWidget.refreshAllWidgets(context);
            Log.d(TAG, "performInsulinSave completed & widgets refreshed successfully.");
        } catch (Exception e) {
            Log.e(TAG, "Error in performInsulinSave:", e);
        }
    }
}
