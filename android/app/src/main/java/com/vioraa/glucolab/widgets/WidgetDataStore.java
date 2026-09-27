package com.vioraa.glucolab.widgets;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class WidgetDataStore {

    private static final String TAG = "GlucoLabWidget_DataStore";
    private static final String PREF_NAME = "glucolab_widget_prefs";

    public static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    // Save Widget Data from Web/JS App
    public static void saveWidgetData(Context context, JSONObject data) {
        if (context == null || data == null) return;
        try {
            Log.d(TAG, "saveWidgetData called with keys: " + data.toString());
            SharedPreferences.Editor editor = getPrefs(context).edit();
            if (data.has("glucose")) editor.putString("latest_glucose", data.optString("glucose"));
            if (data.has("unit")) editor.putString("glucose_unit", data.optString("unit"));
            if (data.has("lastInsulin")) editor.putString("last_insulin", data.optString("lastInsulin"));
            if (data.has("todayCount")) editor.putInt("readings_today_count", data.optInt("todayCount"));
            if (data.has("sparkline") && data.optJSONArray("sparkline") != null) {
                editor.putString("glucose_sparkline_data", data.optJSONArray("sparkline").toString());
            }

            String timeStr = new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date());
            editor.putString("updated_time", "Today • " + timeStr);
            editor.apply();
            Log.d(TAG, "saveWidgetData successfully applied to SharedPreferences.");
        } catch (Exception e) {
            Log.e(TAG, "Error in saveWidgetData:", e);
        }
    }

    // Preset Preferences
    public static int getPreset(Context context, int index, int defaultValue) {
        if (context == null) return defaultValue;
        try {
            return getPrefs(context).getInt("preset_" + index, defaultValue);
        } catch (Exception e) {
            Log.e(TAG, "Error fetching preset_" + index, e);
            return defaultValue;
        }
    }

    public static void savePresets(Context context, int p1, int p2, int p3, int p4, int safetyLimit) {
        if (context == null) return;
        try {
            Log.d(TAG, String.format("savePresets: p1=%d, p2=%d, p3=%d, p4=%d, safetyLimit=%d", p1, p2, p3, p4, safetyLimit));
            getPrefs(context).edit()
                    .putInt("preset_1", p1)
                    .putInt("preset_2", p2)
                    .putInt("preset_3", p3)
                    .putInt("preset_4", p4)
                    .putInt("safety_limit", safetyLimit)
                    .apply();
        } catch (Exception e) {
            Log.e(TAG, "Error saving presets:", e);
        }
    }

    public static int getSafetyLimit(Context context) {
        if (context == null) return 20;
        try {
            return getPrefs(context).getInt("safety_limit", 20);
        } catch (Exception e) {
            return 20;
        }
    }

    // Save Quick Insulin Record
    public static void logQuickInsulin(Context context, int units) {
        if (context == null) return;
        try {
            Log.d(TAG, "logQuickInsulin: logging " + units + " units");
            SharedPreferences prefs = getPrefs(context);
            String dateStr = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
            String timeStr = new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date());
            String lastSavedStr = units + " U • Today • " + timeStr;

            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("last_insulin", units + " U");
            editor.putString("last_saved_insulin_str", lastSavedStr);

            String queueStr = prefs.getString("pending_insulin_queue", "[]");
            JSONArray queue;
            try {
                queue = new JSONArray(queueStr);
            } catch (Exception e) {
                queue = new JSONArray();
            }

            JSONObject entry = new JSONObject();
            entry.put("id", "widget_" + System.currentTimeMillis());
            entry.put("units", units);
            entry.put("entry_date", dateStr);
            entry.put("timestamp", System.currentTimeMillis());
            queue.put(entry);
            editor.putString("pending_insulin_queue", queue.toString());

            editor.apply();
            Log.d(TAG, "logQuickInsulin successfully recorded entry.");
        } catch (Exception e) {
            Log.e(TAG, "Error logging quick insulin:", e);
        }
    }

    public static String getPendingInsulinQueue(Context context) {
        if (context == null) return "[]";
        return getPrefs(context).getString("pending_insulin_queue", "[]");
    }

    public static void clearPendingInsulinQueue(Context context) {
        if (context == null) return;
        getPrefs(context).edit().remove("pending_insulin_queue").apply();
    }

    // Glucose Status Color Helper
    // Low (<70): Blue, Normal (70-180): Green, High (181-250): Orange, Very High (>250): Red
    public static int getGlucoseColor(double value) {
        if (value < 70) {
            return Color.parseColor("#0284C7"); // Blue
        } else if (value <= 180) {
            return Color.parseColor("#16A34A"); // Green
        } else if (value <= 250) {
            return Color.parseColor("#EA580C"); // Orange
        } else {
            return Color.parseColor("#DC2626"); // Red
        }
    }

    // Dynamically draw mini sparkline bitmap graph for widget
    public static Bitmap generateSparkline(Context context, List<Double> values, int width, int height) {
        if (width <= 0 || height <= 0) {
            width = 160;
            height = 60;
        }

        try {
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);

            if (values == null || values.size() < 2) {
                Paint paint = new Paint();
                paint.setColor(Color.parseColor("#94A3B8"));
                paint.setStrokeWidth(3f);
                canvas.drawLine(0, height / 2f, width, height / 2f, paint);
                return bitmap;
            }

            double min = Double.MAX_VALUE;
            double max = Double.MIN_VALUE;

            for (double v : values) {
                if (v < min) min = v;
                if (v > max) max = v;
            }

            if (max == min) {
                max += 10;
                min = Math.max(0, min - 10);
            }

            Paint pathPaint = new Paint();
            pathPaint.setColor(Color.parseColor("#0284C7"));
            pathPaint.setStrokeWidth(4f);
            pathPaint.setStyle(Paint.Style.STROKE);
            pathPaint.setAntiAlias(true);

            Paint dotPaint = new Paint();
            dotPaint.setColor(getGlucoseColor(values.get(values.size() - 1)));
            dotPaint.setStyle(Paint.Style.FILL);
            dotPaint.setAntiAlias(true);

            Path path = new Path();
            float stepX = (float) width / (values.size() - 1);
            float padding = 8f;
            float drawableHeight = height - (padding * 2);

            for (int i = 0; i < values.size(); i++) {
                double val = values.get(i);
                float x = i * stepX;
                float y = (float) (height - padding - ((val - min) / (max - min) * drawableHeight));

                if (i == 0) {
                    path.moveTo(x, y);
                } else {
                    path.lineTo(x, y);
                }

                if (i == values.size() - 1) {
                    canvas.drawCircle(x - padding, y, 6f, dotPaint);
                }
            }

            canvas.drawPath(path, pathPaint);
            return bitmap;
        } catch (Throwable t) {
            Log.e(TAG, "Error generating sparkline bitmap:", t);
            return null;
        }
    }

    public static List<Double> parseSparklineData(Context context) {
        List<Double> list = new ArrayList<>();
        if (context == null) return list;
        try {
            String jsonStr = getPrefs(context).getString("glucose_sparkline_data", "[]");
            JSONArray array = new JSONArray(jsonStr);
            for (int i = 0; i < array.length(); i++) {
                list.add(array.getDouble(i));
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to parse sparkline data, using defaults:", e);
            list.add(110.0);
            list.add(135.0);
            list.add(125.0);
            list.add(142.0);
        }
        return list;
    }
}
