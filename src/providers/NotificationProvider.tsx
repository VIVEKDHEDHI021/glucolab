import React, { createContext, useContext, useEffect, useRef } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { useAuth } from "@/frontend/lib/auth-context";
import { supabase } from "@/db/client";
import { showLocalNotification, handleNotificationNavigation } from "@/services/notificationService";
import { deviceService } from "@/services/deviceService";
import { toast } from "sonner";
import { READING_LABELS, type ReadingType } from "@/frontend/lib/types";
import { Capacitor } from "@capacitor/core";
import { messaging } from "@/lib/firebase";
import { onMessage } from "firebase/messaging";

interface NotificationContextType {
  token: string | null;
  permission: NotificationPermission | "unsupported";
  loading: boolean;
  initNotifications: () => Promise<string | null>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const notifications = useNotifications();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Register device token with backend once user is authenticated
    if (user && !initializedRef.current && typeof window !== "undefined") {
      initializedRef.current = true;
      notifications.initNotifications().then(async (token) => {
        if (token) {
          const activePlatform = Capacitor.isNativePlatform()
            ? Capacitor.getPlatform()
            : "web";
          const deviceName = typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 100) : "GlucoLab Client";

          console.log(`[NotificationProvider] Registering ${activePlatform} device token with backend...`);
          await deviceService.registerDevice(token, activePlatform, deviceName);
        }
      });
    }

    if (!user) {
      initializedRef.current = false;
    }
  }, [user, notifications]);

  // Foreground FCM Push Notification Listener (Web)
  useEffect(() => {
    if (typeof window === "undefined" || Capacitor.isNativePlatform() || !messaging) return;

    try {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log("[NotificationProvider] Foreground FCM push received:", payload);
        const title = payload.notification?.title || "GlucoLab Update";
        const body = payload.notification?.body || "A new update was recorded on your account.";
        toast.info(title, { description: body });
        showLocalNotification(title, body);
        window.dispatchEvent(new Event("health-data-updated"));
      });
      return () => {
        unsubscribe();
      };
    } catch (err) {
      console.warn("[NotificationProvider] onMessage registration warning:", err);
    }
  }, []);

  // Real-Time Multi-Device Reading Notification & Sync Subscription
  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    console.log("[NotificationProvider] Setting up Realtime multi-device listener for user:", user.id);

    const channel = supabase
      .channel(`realtime-readings-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "glucose_entries",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const rec = (payload.new || payload.old) as any;
          if (!rec) return;
          const isUpdate = payload.eventType === "UPDATE";
          const typeLabel = READING_LABELS[rec.reading_type as ReadingType] || rec.reading_type;
          const glucose = Number(rec.glucose) || 0;

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

          let title = isUpdate
            ? `🩸 Glucose Reading Updated: ${glucose} mg/dL`
            : `🩸 New Glucose Reading: ${glucose} mg/dL`;
          let body = isUpdate
            ? `Glucose reading of ${glucose} mg/dL (${typeLabel}) was updated on your account.`
            : `Glucose level of ${glucose} mg/dL (${typeLabel}) was logged on your account.`;

          if (glucose > 0 && glucose < lowTarget) {
            title = isUpdate
              ? `🚨 CRITICAL LOW SUGAR WARNING (UPDATED): ${glucose} mg/dL`
              : `🚨 CRITICAL LOW SUGAR WARNING: ${glucose} mg/dL`;
            body = `URGENT: Blood sugar reading of ${glucose} mg/dL (${typeLabel}) is LOW (< ${lowTarget} mg/dL). Please consume 15g of fast-acting sugar immediately!`;
            toast.error(title, { description: body, duration: 15000 });
          } else if (glucose > highTarget) {
            title = isUpdate
              ? `⚠️ HIGH SUGAR ALERT (UPDATED): ${glucose} mg/dL`
              : `⚠️ HIGH SUGAR ALERT: ${glucose} mg/dL`;
            body = `WARNING: Blood sugar reading of ${glucose} mg/dL (${typeLabel}) exceeds target (${highTarget} mg/dL). Consider checking your insulin or drinking water.`;
            toast.warning(title, { description: body, duration: 15000 });
          } else {
            toast.info(title, { description: body });
          }

          showLocalNotification(title, body);
          window.dispatchEvent(new Event("health-data-updated"));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "insulin_entries",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const rec = (payload.new || payload.old) as any;
          if (!rec) return;
          const isUpdate = payload.eventType === "UPDATE";
          const total = (rec.morning || 0) + (rec.lunch || 0) + (rec.afternoon || 0) + (rec.evening || 0) + (rec.night || 0);
          const title = isUpdate
            ? "💉 Insulin Dosage Updated"
            : "💉 New Insulin Dosage Logged";
          const body = isUpdate
            ? `Insulin schedule (${total} units total) was updated for ${rec.entry_date} on your account.`
            : `Insulin schedule (${total} units total) was logged for ${rec.entry_date} on your account.`;

          toast.info(title, { description: body });
          showLocalNotification(title, body);

          window.dispatchEvent(new Event("health-data-updated"));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "weight_entries",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const rec = (payload.new || payload.old) as any;
          if (!rec) return;
          const isUpdate = payload.eventType === "UPDATE";
          const title = isUpdate
            ? "⚖️ Weight Reading Updated"
            : "⚖️ New Weight Reading Logged";
          const body = isUpdate
            ? `Weight entry of ${rec.weight_kg} kg was updated for ${rec.entry_date} on your account.`
            : `Weight entry of ${rec.weight_kg} kg was logged for ${rec.entry_date} on your account.`;

          toast.info(title, { description: body });
          showLocalNotification(title, body);

          window.dispatchEvent(new Event("health-data-updated"));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "smart_scan_readings",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const rec = (payload.new || payload.old) as any;
          if (!rec) return;
          const title = `📷 New ${rec.device_type} Scan Saved`;
          const body = `Smart device scan reading was saved on your account.`;

          toast.info(title, { description: body });
          showLocalNotification(title, body);

          window.dispatchEvent(new Event("health-data-updated"));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("[NotificationProvider] Profile changed in Realtime, dispatching health-data-updated");
          window.dispatchEvent(new Event("health-data-updated"));
        },
      )
      .subscribe((status) => {
        console.log("[NotificationProvider] Realtime channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <NotificationContext.Provider value={notifications}>{children}</NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return context;
}
