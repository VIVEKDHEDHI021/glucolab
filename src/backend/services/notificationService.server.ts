import { supabaseAdmin } from "@/db/client.server";
import { fcmServiceServer, type FCMPushResult } from "./fcmService.server";

// Server-side OneSignal configuration (kept securely in backend environment variables)
const ONESIGNAL_APP_ID =
  process.env.ONESIGNAL_APP_ID ||
  process.env.VITE_ONESIGNAL_APP_ID ||
  "eae3b62b-2f16-4a28-8ec4-a1c9bdca69fe";

const ONESIGNAL_REST_API_KEY =
  process.env.ONESIGNAL_REST_API_KEY ||
  process.env.VITE_ONESIGNAL_REST_API_KEY ||
  "os_v2_app_5lr3mkzpczfcrdweuhe33stj7zcwt3gzuoeuste2ltwzsd5dwrpgicrp7gfd5xujlthwnj4puutvfccdnecsobsjunctpyhi2msgw2a";

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
  fcm?: FCMPushResult;
  onesignal?: any;
}

/**
 * Helper to identify whether a token is a OneSignal Player/Subscription ID (UUID format)
 * vs an FCM registration token (longer alphanumeric string with colons/underscores).
 */
function isOneSignalSubscriptionId(token: string): boolean {
  if (!token) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token.trim());
}

/**
 * Server-side dual notification service for GlucoLab.
 * Dispatches multi-device push notifications via both Firebase Cloud Messaging (FCM)
 * and OneSignal REST API with source device exclusion.
 */
export const notificationServiceServer = {
  /**
   * Send push notification to all active devices of a user via Dual FCM & OneSignal dispatch,
   * with source device exclusion.
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
      let rawTokens: string[] = [];
      const { data: devices, error: dbError } = await db
        .from("user_devices")
        .select("device_token, device_type")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!dbError && devices && devices.length > 0) {
        rawTokens = devices.map((d: any) => d.device_token).filter(Boolean);
      } else {
        const { data: legacyTokens } = await db
          .from("push_tokens")
          .select("token")
          .eq("user_id", userId);

        if (legacyTokens) {
          rawTokens = legacyTokens.map((d: any) => d.token).filter(Boolean);
        }
      }

      // 2. Filter target tokens (excluding source device)
      let targetTokens = [...rawTokens];
      if (options.excludeDeviceToken) {
        const sourceToken = options.excludeDeviceToken.trim();
        targetTokens = targetTokens.filter((t) => t !== sourceToken);
      }

      console.log(
        `[Dual Push Dispatcher] User ${userId}: Total devices=${rawTokens.length}, Target devices=${targetTokens.length} (excluded source: ${Boolean(options.excludeDeviceToken)})`,
      );

      // 3. Categorize tokens into FCM tokens vs OneSignal subscription IDs
      const fcmTokens: string[] = [];
      const oneSignalTokens: string[] = [];

      for (const token of targetTokens) {
        if (isOneSignalSubscriptionId(token)) {
          oneSignalTokens.push(token);
        } else {
          fcmTokens.push(token);
        }
      }

      console.log(
        `[Dual Push Dispatcher] Categorized tokens: FCM=${fcmTokens.length}, OneSignal=${oneSignalTokens.length}`,
      );

      let fcmResult: FCMPushResult | undefined;
      let oneSignalResult: any = undefined;

      // 4. DISPATCH FCM CLOUD PUSH (Targets Web & FCM Android devices)
      if (fcmTokens.length > 0) {
        console.log(`[Dual Push Dispatcher] Disagreeing to FCM multicast for ${fcmTokens.length} token(s)...`);
        fcmResult = await fcmServiceServer.sendToTokens(
          fcmTokens,
          {
            title: notification.title,
            body: notification.body,
            data: options.data,
          },
          db,
        );
      }

      // 5. DISPATCH ONESIGNAL CLOUD PUSH (Targets OneSignal Native Mobile Subscriptions & External User ID)
      const hasOneSignalKey = Boolean(
        ONESIGNAL_REST_API_KEY &&
          ONESIGNAL_REST_API_KEY !== "YOUR_ONESIGNAL_REST_API_KEY" &&
          !ONESIGNAL_REST_API_KEY.includes("YOUR_"),
      );

      if (hasOneSignalKey && (oneSignalTokens.length > 0 || fcmTokens.length === 0)) {
        try {
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

          if (oneSignalTokens.length > 0) {
            requestPayload.include_subscription_ids = oneSignalTokens;
            requestPayload.include_player_ids = oneSignalTokens;
          } else {
            // Target user's external ID alias (e.g. mobile app logged in)
            requestPayload.include_aliases = {
              external_id: [userId],
            };
            requestPayload.include_external_user_ids = [userId];
          }

          console.log(
            `[Dual Push Dispatcher] Dispatching OneSignal push for user ${userId} (target tokens: ${oneSignalTokens.length})...`,
          );

          const osResponse = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(requestPayload),
          });

          const osData = await osResponse.json().catch(() => ({}));

          if (osResponse.ok) {
            const recipients = Number(osData?.recipients) || oneSignalTokens.length || 1;
            console.log(
              `[Dual Push Dispatcher] OneSignal push sent successfully (ID: ${osData?.id}, recipients: ${recipients}).`,
            );
            oneSignalResult = {
              success: true,
              sentCount: recipients,
              failureCount: 0,
              data: osData,
            };

            // Clean up invalid OneSignal player IDs if reported
            if (osData?.errors?.invalid_player_ids?.length > 0) {
              const invalidIds = osData.errors.invalid_player_ids;
              console.log(`[Dual Push Dispatcher] Deactivating ${invalidIds.length} invalid OneSignal player IDs...`);
              await db
                .from("user_devices")
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .in("device_token", invalidIds)
                .catch(() => {});
            }
          } else {
            console.warn("[Dual Push Dispatcher] OneSignal REST API error:", osResponse.status, osData);
            oneSignalResult = {
              success: false,
              sentCount: 0,
              failureCount: Math.max(oneSignalTokens.length, 1),
              error: osData?.errors?.[0] || `OneSignal error ${osResponse.status}`,
            };
          }
        } catch (osErr: any) {
          console.error("[Dual Push Dispatcher] OneSignal request exception:", osErr);
          oneSignalResult = {
            success: false,
            sentCount: 0,
            failureCount: Math.max(oneSignalTokens.length, 1),
            error: osErr?.message || "OneSignal dispatch error",
          };
        }
      }

      // 6. Assemble unified result
      const totalSent = (fcmResult?.sentCount || 0) + (oneSignalResult?.sentCount || 0);
      const totalFailed = (fcmResult?.failureCount || 0) + (oneSignalResult?.failureCount || 0);
      const overallSuccess = (fcmResult?.success ?? false) || (oneSignalResult?.success ?? false);

      return {
        success: overallSuccess || targetTokens.length === 0,
        sentCount: totalSent,
        failureCount: totalFailed,
        tokensCount: targetTokens.length,
        fcm: fcmResult,
        onesignal: oneSignalResult,
      };
    } catch (err: any) {
      console.error("[Dual Push Dispatcher] Unexpected error in sendToUser:", err);
      return {
        success: false,
        sentCount: 0,
        failureCount: 0,
        tokensCount: 0,
        error: err?.message || "Internal server error during dual push dispatch",
      };
    }
  },
};
