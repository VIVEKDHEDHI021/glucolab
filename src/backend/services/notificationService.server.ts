import { supabaseAdmin } from "@/db/client.server";
import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging, type MulticastMessage, type SendResponse } from "firebase-admin/messaging";

// Lazy-initialized Firebase Admin app instance
let adminApp: App | null = null;
let adminInitialized = false;

function initFirebaseAdmin(): boolean {
  if (adminInitialized && adminApp) return true;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    adminInitialized = true;
    return true;
  }

  try {
    // 1. Check for complete service account JSON string
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountVar) {
      try {
        const serviceAccount = JSON.parse(serviceAccountVar);
        adminApp = initializeApp({
          credential: cert(serviceAccount),
        });
        adminInitialized = true;
        console.log("[Firebase Admin] Initialized successfully via FIREBASE_SERVICE_ACCOUNT JSON.");
        return true;
      } catch (jsonErr) {
        console.error("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", jsonErr);
      }
    }

    // 2. Check for individual environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      // Clean and format private key if necessary (replace literal \n with real newlines)
      const formattedKey = privateKey.replace(/\\n/g, "\n");
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedKey,
        }),
      });
      adminInitialized = true;
      console.log("[Firebase Admin] Initialized successfully via individual environment variables.");
      return true;
    }

    console.warn(
      "[Firebase Admin] Warning: No valid Firebase Admin credentials found (FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY). Push notifications will run in simulation mode.",
    );
    return false;
  } catch (err) {
    console.error("[Firebase Admin] Initialization error:", err);
    return false;
  }
}

export interface NotificationPayload {
  title: string;
  body: string;
}

export interface SendOptions {
  excludeDeviceToken?: string;
  data?: Record<string, string>;
}

export interface NotificationResult {
  success: boolean;
  sentCount: number;
  failureCount: number;
  tokensCount: number;
  simulated?: boolean;
  message?: string;
  error?: string;
}

// Error codes indicating a permanent token failure that warrants deactivation
const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/invalid-argument",
  "messaging/mismatched-credential",
]);

export const notificationServiceServer = {
  /**
   * Send push notification to all active devices of a user, excluding the originating device
   */
  async sendToUser(
    userId: string,
    notification: NotificationPayload,
    options: SendOptions = {},
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

      // 1. Fetch active devices from user_devices table
      let query = supabaseAdmin
        .from("user_devices")
        .select("device_token")
        .eq("user_id", userId)
        .eq("is_active", true);

      const { data: devices, error: dbError } = await query;

      if (dbError) {
        console.error("[NotificationService] Database query error fetching devices:", dbError);
        return {
          success: false,
          sentCount: 0,
          failureCount: 0,
          tokensCount: 0,
          error: dbError.message,
        };
      }

      // 2. Filter target tokens (excluding source device)
      let tokens = (devices || []).map((d) => d.device_token).filter(Boolean);

      if (options.excludeDeviceToken) {
        const sourceToken = options.excludeDeviceToken.trim();
        tokens = tokens.filter((t) => t !== sourceToken);
      }

      if (tokens.length === 0) {
        console.log(
          `[NotificationService] No eligible active devices to notify for user ${userId} (source excluded: ${Boolean(options.excludeDeviceToken)}).`,
        );
        return {
          success: true,
          sentCount: 0,
          failureCount: 0,
          tokensCount: 0,
          message: "No other active devices registered for this user.",
        };
      }

      // 3. Dispatch to device tokens
      return await this.sendToDevices(tokens, notification, options.data, userId);
    } catch (err: any) {
      console.error("[NotificationService] Unexpected error in sendToUser:", err);
      return {
        success: false,
        sentCount: 0,
        failureCount: 0,
        tokensCount: 0,
        error: err?.message || "Internal notification service error",
      };
    }
  },

  /**
   * Multicast push notification to specific device tokens
   */
  async sendToDevices(
    tokens: string[],
    notification: NotificationPayload,
    dataPayload?: Record<string, string>,
    userIdForCleanup?: string,
  ): Promise<NotificationResult> {
    try {
      if (!tokens || tokens.length === 0) {
        return {
          success: true,
          sentCount: 0,
          failureCount: 0,
          tokensCount: 0,
        };
      }

      const isFirebaseReady = initFirebaseAdmin();

      if (!isFirebaseReady) {
        console.log(
          `[NotificationService] Firebase Admin not configured. Simulated push to ${tokens.length} tokens.`,
        );
        return {
          success: true,
          sentCount: tokens.length,
          failureCount: 0,
          tokensCount: tokens.length,
          simulated: true,
          message: "Firebase Admin is not configured. Delivery simulated.",
        };
      }

      // Build privacy-conscious payload with explicit priorities and actions
      const messagePayload: MulticastMessage = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          ...(dataPayload || {}),
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: "high",
          notification: {
            title: notification.title,
            body: notification.body,
            channelId: "default",
            sound: "default",
            priority: "high",
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
          notification: {
            title: notification.title,
            body: notification.body,
            icon: "/logo.png",
          },
        },
      };

      console.log(
        `[NotificationService] Sending push notifications to ${tokens.length} device tokens...`,
      );
      const response = await getMessaging().sendEachForMulticast(messagePayload);

      console.log(
        `[NotificationService] Push results: ${response.successCount} success, ${response.failureCount} failed.`,
      );

      // Handle invalid/expired tokens by deactivating them
      if (response.failureCount > 0) {
        const tokensToDeactivate: string[] = [];

        response.responses.forEach((res: SendResponse, index: number) => {
          if (!res.success && res.error) {
            const errCode = res.error.code;
            if (INVALID_TOKEN_ERROR_CODES.has(errCode)) {
              tokensToDeactivate.push(tokens[index]);
              console.warn(
                `[NotificationService] Invalid token detected (${errCode}): ${tokens[index].substring(0, 15)}...`,
              );
            }
          }
        });

        if (tokensToDeactivate.length > 0) {
          console.log(
            `[NotificationService] Deactivating ${tokensToDeactivate.length} invalid device tokens...`,
          );
          let deactivationQuery = supabaseAdmin
            .from("user_devices")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .in("device_token", tokensToDeactivate);

          if (userIdForCleanup) {
            deactivationQuery = deactivationQuery.eq("user_id", userIdForCleanup);
          }

          const { error: deactError } = await deactivationQuery;
          if (deactError) {
            console.error("[NotificationService] Error deactivating invalid tokens:", deactError);
          }
        }
      }

      return {
        success: true,
        sentCount: response.successCount,
        failureCount: response.failureCount,
        tokensCount: tokens.length,
      };
    } catch (err: any) {
      console.error("[NotificationService] Error sending multicast push:", err);
      return {
        success: false,
        sentCount: 0,
        failureCount: tokens.length,
        tokensCount: tokens.length,
        error: err?.message || "Multicast dispatch error",
      };
    }
  },
};
