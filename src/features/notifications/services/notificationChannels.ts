import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { NOTIFICATION_CHANNELS, ACTION_TYPES, ACTION_IDS } from "../constants";

export const notificationChannels = {
  /**
   * Initialize notification channels and register action types on Android
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      // 1. Create all 6 distinct Android notification channels
      const channels = Object.values(NOTIFICATION_CHANNELS);
      for (const ch of channels) {
        await LocalNotifications.createChannel({
          id: ch.id,
          name: ch.name,
          description: ch.description,
          importance: ch.importance,
          visibility: 1, // VISIBILITY_PUBLIC
          sound: ch.sound,
          vibration: ch.vibration,
          lights: true,
          lightColor: "#0284C7",
        });
      }

      // 2. Register Action Types for heads-up and drawer notifications
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: ACTION_TYPES.GLUCOSE_ACTION,
            actions: [
              {
                id: ACTION_IDS.LOG_READING,
                title: "Log Reading",
                foreground: true,
              },
              {
                id: ACTION_IDS.REMIND_LATER,
                title: "Remind Later",
                foreground: false,
              },
              {
                id: ACTION_IDS.DISMISS,
                title: "Dismiss",
                destructive: true,
                foreground: false,
              },
            ],
          },
          {
            id: ACTION_TYPES.MEDICATION_ACTION,
            actions: [
              {
                id: ACTION_IDS.TAKEN,
                title: "Taken",
                foreground: false,
              },
              {
                id: ACTION_IDS.REMIND_LATER,
                title: "Remind Later",
                foreground: false,
              },
              {
                id: ACTION_IDS.DISMISS,
                title: "Dismiss",
                destructive: true,
                foreground: false,
              },
            ],
          },
          {
            id: ACTION_TYPES.MEAL_ACTION,
            actions: [
              {
                id: ACTION_IDS.LOG_READING,
                title: "Log Meal",
                foreground: true,
              },
              {
                id: ACTION_IDS.REMIND_LATER,
                title: "Remind Later",
                foreground: false,
              },
              {
                id: ACTION_IDS.DISMISS,
                title: "Dismiss",
                destructive: true,
                foreground: false,
              },
            ],
          },
          {
            id: ACTION_TYPES.HYDRATION_ACTION,
            actions: [
              {
                id: ACTION_IDS.REMIND_LATER,
                title: "Snooze",
                foreground: false,
              },
              {
                id: ACTION_IDS.DISMISS,
                title: "Drink Logged",
                destructive: false,
                foreground: false,
              },
            ],
          },
          {
            id: ACTION_TYPES.SUMMARY_ACTION,
            actions: [
              {
                id: ACTION_IDS.OPEN_REPORTS,
                title: "View Trends",
                foreground: true,
              },
              {
                id: ACTION_IDS.DISMISS,
                title: "Dismiss",
                foreground: false,
              },
            ],
          },
        ],
      });

      console.log("[NotificationChannels] Android notification channels and action types initialized successfully.");
    } catch (error) {
      console.warn("[NotificationChannels] Failed to register channels or action types:", error);
    }
  },
};
