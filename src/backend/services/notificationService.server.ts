import { supabaseAdmin } from "@/db/client.server";

// Server-side OneSignal configuration (kept securely in backend environment variables)
const ONESIGNAL_APP_ID =
  process.env.ONESIGNAL_APP_ID ||
  process.env.VITE_ONESIGNAL_APP_ID ||
  "YOUR_ONESIGNAL_APP_ID";

const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || "";

export interface NotificationPayload {
  title: string;
  body: string;
}

export interface NotificationSendOptions {
  excludeDeviceToken?: string;
  data?: Record<string, string>;
}

export interface NotificationResult {
  success: boolean;
  sentCount: number;
  failureCount: number;
  tokensCount: number;
  error?: string;
  simulated?: boolean;
  message?: string;
}

/**
 * Server-side notification service for GlucoLab using OneSignal REST API.
 * Dispatches multi-device Android & Web push notifications targeting user identities/subscriptions
 * with source device exclusion.
 */
export const notificationServiceServer = {
  /**
   * Send push notification to all active devices of a user via OneSignal,
   * with optional exclusion of the originating device.
   */
  async sendToUser(
    userId: string,
    notification: NotificationPayload,
    options: NotificationSendOptions = {},
    client?: any,
  ): Promise<NotificationResult> {
    try {
      if (!userId) {
        return {
          success: false,
          sentCount: 0,
          failureCount: 0,
          tokensCount: 0,
          error: "userId is required",
        };
      }

      const db = client || supabaseAdmin;

      // 1. Fetch active devices/subscriptions for this user from database
      let tokens: string[] = [];
      const { data: devices, error: dbError } = await db
        .from("user_devices")
        .select("device_token")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!dbError && devices) {
        tokens = devices.map((d: any) => d.device_token).filter(Boolean);
      } else {
        const { data: legacyTokens } = await db
          .from("push_tokens")
          .select("token")
          .eq("user_id", userId);

        if (legacyTokens) {
          tokens = legacyTokens.map((d: any) => d.token).filter(Boolean);
        }
      }

      // 2. Filter target tokens (excluding source device)
      if (options.excludeDeviceToken) {
        const sourceToken = options.excludeDeviceToken.trim();
        tokens = tokens.filter((t) => t !== sourceToken);
      }

      // 3. Check for OneSignal server credentials
      if (!ONESIGNAL_REST_API_KEY || ONESIGNAL_REST_API_KEY === "YOUR_ONESIGNAL_REST_API_KEY") {
        console.log(
          `[OneSignal Server] ONESIGNAL_REST_API_KEY not configured in environment. Running in simulation mode for user ${userId}.`,
        );
        return {
          success: true,
          sentCount: Math.max(tokens.length, 1),
          failureCount: 0,
          tokensCount: tokens.length,
          simulated: true,
          message: "OneSignal REST API key is not configured in .env. Delivery simulated.",
        };
      }

      // 4. Build OneSignal REST API payload
      const requestPayload: any = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: notification.title },
        contents: { en: notification.body },
        data: {
          ...(options.data || {}),
          timestamp: new Date().toISOString(),
        },
        priority: 10,
        android_channel_id: "default",
        android_accent_color: "0284C7",
        small_icon: "ic_notification",
      };

      // Target by specific subscription IDs if available (for exact source exclusion)
      // Otherwise target all subscriptions associated with the external user identity
      if (tokens.length > 0) {
        requestPayload.include_subscription_ids = tokens;
        requestPayload.include_player_ids = tokens;
      } else {
        requestPayload.include_aliases = {
          external_id: [userId],
        };
        requestPayload.include_external_user_ids = [userId];
      }

      console.log(
        `[OneSignal Server] Dispatching push notification to user ${userId} (target tokens: ${tokens.length})...`,
      );

      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify(requestPayload),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error("[OneSignal Server] REST API dispatch failed:", response.status, responseData);
        return {
          success: false,
          sentCount: 0,
          failureCount: Math.max(tokens.length, 1),
          tokensCount: tokens.length,
          error: responseData?.errors?.[0] || `OneSignal API error ${response.status}`,
        };
      }

      const recipients = Number(responseData?.recipients) || tokens.length || 1;
      console.log(
        `[OneSignal Server] Push dispatched successfully (ID: ${responseData?.id}, recipients: ${recipients}).`,
      );

      // Handle invalid subscriptions cleanup if reported by OneSignal
      if (responseData?.errors?.invalid_player_ids?.length > 0) {
        const invalidIds = responseData.errors.invalid_player_ids;
        console.log(`[OneSignal Server] Deactivating ${invalidIds.length} invalid OneSignal player IDs...`);
        try {
          await db
            .from("user_devices")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .in("device_token", invalidIds);
        } catch (e) {}
      }

      return {
        success: true,
        sentCount: recipients,
        failureCount: 0,
        tokensCount: tokens.length,
      };
    } catch (err: any) {
      console.error("[OneSignal Server] Unexpected error in sendToUser:", err);
      return {
        success: false,
        sentCount: 0,
        failureCount: 0,
        tokensCount: 0,
        error: err?.message || "Internal OneSignal server error",
      };
    }
  },
};

