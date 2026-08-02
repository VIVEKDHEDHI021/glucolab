import React, { createContext, useContext, useEffect, useRef } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { useAuth } from "@/frontend/lib/auth-context";
import { supabase } from "@/db/client";
import { showLocalNotification } from "@/services/notificationService";
import { toast } from "sonner";
import { READING_LABELS, type ReadingType } from "@/frontend/lib/types";
import { Capacitor } from "@capacitor/core";

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
    // Only request permission/register token once when the user is logged in
    if (user && !initializedRef.current && typeof window !== "undefined") {
      initializedRef.current = true;
      notifications.initNotifications().then(async (token) => {
        if (token) {
          const activePlatform = Capacitor.isNativePlatform()
            ? Capacitor.getPlatform()
            : "web";
          console.log(`[NotificationProvider] Saving FCM ${activePlatform} token to database...`);
          const { error } = await supabase.from("push_tokens").upsert(
            {
              user_id: user.id,
              token: token,
              platform: activePlatform,
              device_name: navigator.userAgent.substring(0, 100),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,token" },
          );
          if (error) {
            console.error("[NotificationProvider] Error saving FCM token:", error);
          } else {
            console.log(
              `[NotificationProvider] ${activePlatform.toUpperCase()} FCM token successfully registered in database.`,
            );
          }
        }
      });
    }
  }, [user, notifications]);

  // Real-Time Multi-Device Reading Notification & Sync Subscription
  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    console.log("[NotificationProvider] Setting up Realtime multi-device listener for user:", user.id);

    const channel = supabase
      .channel(`realtime-readings-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "glucose_entries",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const rec = payload.new as any;
          const typeLabel = READING_LABELS[rec.reading_type as ReadingType] || rec.reading_type;
          const title = "🩸 New Blood Glucose Reading";
          const body = `Glucose level of ${rec.glucose} mg/dL (${typeLabel}) was logged on your account.`;

          toast.info(title, { description: body });
          showLocalNotification(title, body);

          window.dispatchEvent(new Event("health-data-updated"));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "insulin_entries",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const rec = payload.new as any;
          const total = (rec.morning || 0) + (rec.lunch || 0) + (rec.afternoon || 0) + (rec.evening || 0) + (rec.night || 0);
          const title = "💉 New Insulin Dosage Logged";
          const body = `Insulin schedule (${total} units total) was logged for ${rec.entry_date} on your account.`;

          toast.info(title, { description: body });
          showLocalNotification(title, body);

          window.dispatchEvent(new Event("health-data-updated"));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "weight_entries",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const rec = payload.new as any;
          const title = "⚖️ New Weight Reading Logged";
          const body = `Weight entry of ${rec.weight_kg} kg was logged for ${rec.entry_date} on your account.`;

          toast.info(title, { description: body });
          showLocalNotification(title, body);

          window.dispatchEvent(new Event("health-data-updated"));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "smart_scan_readings",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const rec = payload.new as any;
          const title = `📷 New ${rec.device_type} Scan Saved`;
          const body = `Smart device scan reading was saved on your account.`;

          toast.info(title, { description: body });
          showLocalNotification(title, body);

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
