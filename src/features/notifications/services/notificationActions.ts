import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type ActionPerformed } from "@capacitor/local-notifications";
import { ACTION_IDS, NOTIFICATION_CHANNELS, ACTION_TYPES } from "../constants";
import { notificationScheduler } from "./notificationScheduler";
import { pendingDoseService } from "@/features/pending-insulin/services/pendingDoseService";
import { insulinScheduleService } from "@/features/pending-insulin/services/insulinScheduleService";
import type { ClinicalSlotId } from "@/features/pending-insulin/types";
import { format } from "date-fns";

const inFlightActions = new Set<string>();

export const notificationActions = {
  /**
   * Setup event listeners for notification actions and clicks
   */
  initialize(onOpenGlucoseDialog?: (readingType?: string) => void): () => void {
    if (!Capacitor.isNativePlatform()) {
      return () => {};
    }

    let sub: { remove: () => void } | null = null;

    LocalNotifications.addListener(
      "localNotificationActionPerformed",
      async (notificationAction: ActionPerformed) => {
        try {
          const actionId = notificationAction.actionId;
          const notification = notificationAction.notification;
          const extra = notification.extra || {};
          const notifId = notification.id;

          console.log(`[NotificationAction] Action performed: ${actionId} on notification: ${notifId}`);

          // Idempotency check: prevent duplicate rapid taps from executing multiple times
          const idempotencyKey = `${notifId}_${actionId}_${Date.now() - (Date.now() % 5000)}`;
          if (inFlightActions.has(idempotencyKey)) {
            console.warn(`[NotificationAction] Duplicate in-flight action ignored: ${idempotencyKey}`);
            return;
          }
          inFlightActions.add(idempotencyKey);
          setTimeout(() => inFlightActions.delete(idempotencyKey), 10000);

          // 1. DISMISS Action
          if (actionId === ACTION_IDS.DISMISS) {
            console.log("[NotificationAction] Notification dismissed without action.");
            return;
          }

          // 2. SNOOZE / REMIND LATER Action
          if (actionId === ACTION_IDS.REMIND_LATER) {
            const channelId = notification.channelId || NOTIFICATION_CHANNELS.GLUCOSE.id;
            const actionTypeId = notification.actionTypeId || ACTION_TYPES.GLUCOSE_ACTION;
            await notificationScheduler.snoozeNotification(
              notifId,
              notification.title,
              notification.body,
              channelId,
              actionTypeId,
              extra.category || "glucose",
              extra,
              15
            );
            return;
          }

          // 3. LOG READING Action (or user tapped notification body)
          if (actionId === ACTION_IDS.LOG_READING || actionId === "tap") {
            const readingType = extra.readingType || (extra.category === "meals" ? "AB" : "BB");

            // Dispatch global event for in-app listeners
            window.dispatchEvent(
              new CustomEvent("glucolab:open_glucose_dialog", {
                detail: { readingType, category: extra.category },
              })
            );

            // Store in session storage in case app was just cold-booted
            try {
              sessionStorage.setItem(
                "glucolab_pending_action",
                JSON.stringify({ type: "OPEN_GLUCOSE_DIALOG", readingType, category: extra.category })
              );
            } catch {}

            if (onOpenGlucoseDialog) {
              onOpenGlucoseDialog(readingType);
            }
            return;
          }

          // 4. TAKEN Action (Explicit medication dose confirmation)
          if (actionId === ACTION_IDS.TAKEN) {
            const userId = extra.userId;
            const slotId = extra.slotId as ClinicalSlotId;

            if (userId && slotId) {
              const todayStr = format(new Date(), "yyyy-MM-dd");
              const dbColumn = insulinScheduleService.mapSlotToDbColumn(slotId);

              // Record confirmation safely via pendingDoseService
              const scheduledSlot = {
                id: `${todayStr}_${slotId}`,
                date: todayStr,
                displayDate: "Today",
                slotId,
                dbColumn,
                slotName: slotId.charAt(0).toUpperCase() + slotId.slice(1),
                time: extra.scheduledTime || "08:00",
                displayTime: extra.scheduledTime || "08:00 AM",
                scheduledDateTime: new Date(),
                status: "pending" as const,
              };

              // Use configured units or default to 1 unit confirmation
              const units = Number(extra.doseUnits) > 0 ? Number(extra.doseUnits) : 1;
              const result = await pendingDoseService.saveDose(userId, scheduledSlot, units, "Confirmed via notification action");

              if (result.success) {
                console.log(`[NotificationAction] Successfully recorded taken dose for ${slotId}`);
                window.dispatchEvent(new CustomEvent("glucolab:dose_recorded", { detail: { slotId } }));
              } else {
                console.warn(`[NotificationAction] Failed to record dose:`, result.error);
              }
            }
            return;
          }

          // 5. OPEN REPORTS Action
          if (actionId === ACTION_IDS.OPEN_REPORTS) {
            window.location.hash = "#/reports";
            return;
          }
        } catch (error) {
          console.error("[NotificationAction] Error handling notification action:", error);
        }
      }
    ).then((handle) => {
      sub = handle;
    });

    return () => {
      if (sub) {
        sub.remove();
      }
    };
  },
};
