package com.glucolab.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.glucolab.app.widgets.GlucoseDashboardWidget;
import com.glucolab.app.widgets.QuickInsulinWidget;
import com.glucolab.app.widgets.WidgetDataStore;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "WidgetPlugin")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        try {
            JSObject data = call.getData();
            if (data != null) {
                WidgetDataStore.saveWidgetData(getContext(), data);
                GlucoseDashboardWidget.refreshAllWidgets(getContext());
                QuickInsulinWidget.refreshAllWidgets(getContext());
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update widget data: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveQuickInsulinPresets(PluginCall call) {
        try {
            int p1 = call.getInt("preset1", 4);
            int p2 = call.getInt("preset2", 6);
            int p3 = call.getInt("preset3", 8);
            int p4 = call.getInt("preset4", 10);
            int safetyLimit = call.getInt("safetyLimit", 20);

            WidgetDataStore.savePresets(getContext(), p1, p2, p3, p4, safetyLimit);
            QuickInsulinWidget.refreshAllWidgets(getContext());

            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to save presets: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingQuickInsulin(PluginCall call) {
        try {
            String pendingStr = WidgetDataStore.getPendingInsulinQueue(getContext());
            JSONArray array = new JSONArray(pendingStr);
            JSObject ret = new JSObject();
            ret.put("pending", array);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to fetch pending quick insulin: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearPendingQuickInsulin(PluginCall call) {
        try {
            WidgetDataStore.clearPendingInsulinQueue(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear pending queue: " + e.getMessage());
        }
    }
}
