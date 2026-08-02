import { useEffect } from "react";
import { supabase } from "@/db/client";
import { useAuth } from "@/frontend/lib/auth-context";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    console.log("[NOTIFICATIONS] Setting up realtime listener for user:", user.id);

    // 1. Request Local Notification permissions on mobile
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions();
    }

    // 2. Subscribe to new glucose entries for this user
    const channel = supabase
      .channel("glucose-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "glucose_entries",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newEntry = payload.new;
          console.log("[NOTIFICATIONS] New entry detected:", newEntry);
          const glucose = Number(newEntry.glucose) || 0;

          let lowTarget = 70;
          let highTarget = 180;
          try {
            const savedTargets = localStorage.getItem(`glucolab_targets_${user.id}`);
            if (savedTargets) {
              const parsed = JSON.parse(savedTargets);
              if (parsed.lowTarget) lowTarget = Number(parsed.lowTarget) || 70;
              if (parsed.highTarget) highTarget = Number(parsed.highTarget) || 180;
            }
          } catch (e) {}

          let title = `🩸 New Glucose Reading: ${glucose} mg/dL`;
          let body = `${glucose} mg/dL logged just now.`;

          if (glucose > 0 && glucose < lowTarget) {
            title = `🚨 CRITICAL LOW SUGAR WARNING: ${glucose} mg/dL`;
            body = `URGENT: Glucose reading of ${glucose} mg/dL is LOW (< ${lowTarget} mg/dL). Consume 15g fast-acting sugar immediately!`;
          } else if (glucose > highTarget) {
            title = `⚠️ HIGH SUGAR ALERT: ${glucose} mg/dL`;
            body = `WARNING: Glucose reading of ${glucose} mg/dL exceeds high target (${highTarget} mg/dL). Check your insulin or hydrate.`;
          }

          // 3. Show notification
          if (Capacitor.isNativePlatform()) {
            await LocalNotifications.schedule({
              notifications: [
                {
                  title,
                  body,
                  id: Math.floor(Math.random() * 100000),
                  schedule: { at: new Date(Date.now() + 100) }, // Almost immediate
                  sound: "default",
                  actionTypeId: "",
                  extra: null,
                },
              ],
            });
          } else {
            // Fallback for web
            toast.info(title, {
              description: body,
            });

            // Show real desktop notification if permission is granted
            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              try {
                new Notification(title, {
                  body: body,
                  icon: "/logo.png",
                });
              } catch (e) {
                console.error("Failed to show desktop notification:", e);
              }
            }
          }
        },
      )
      .subscribe();

    return () => {
      console.log("[NOTIFICATIONS] Cleaning up listener");
      supabase.removeChannel(channel);
    };
  }, [user]);
}
