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
        console.log("[Firebase Admin] Initialized with FIREBASE_SERVICE_ACCOUNT credentials.");
        return true;
      } catch (parseErr) {
        console.warn("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", parseErr);
      }
    }

    // 2. Check for individual environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (projectId && clientEmail && privateKey) {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      adminInitialized = true;
      console.log(`[Firebase Admin] Initialized for project ${projectId}.`);
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
 * Server-side notification service for GlucoLab.
 * Handles device discovery, exclusions, FCM HTTP v1 multicast dispatch,
 * and automatic cleanup of expired/invalid registration tokens.
 */
export const notificationServiceServer = {
  /**
   * Send push notification to all active devices of a user,
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

      // 1. Fetch active devices from user_devices table or push_tokens table
      let tokens: string[] = [];

      const { data: devices, error: dbError } = await db
        .from("user_devices")
        .select("device_token")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!dbError && devices) {
        tokens = devices.map((d: any) => d.device_token).filter(Boolean);
      } else {
        // Fallback to push_tokens table
        const { data: legacyTokens, error: legacyErr } = await db
          .from("push_tokens")
          .select("token")
          .eq("user_id", userId);

        if (!legacyErr && legacyTokens) {
          tokens = legacyTokens.map((d: any) => d.token).filter(Boolean);
        } else if (legacyErr && dbError) {
          console.error("[NotificationService] Database query error fetching devices:", dbError);
          return {
            success: false,
            sentCount: 0,
            failureCount: 0,
            tokensCount: 0,
            error: dbError.message,
          };
        }
      }

      // 2. Filter target tokens (excluding source device)
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
            clickAction: "OPEN_ACTIVITY",
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              sound: "default",
              badge: 1,
            },
          },
        },
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            icon: "/logo.png",
            badge: "/icon/icon.png",
          },
          fcmOptions: {
            link: "/",
          },
        },
      };

      const messaging = getMessaging(adminApp!);
      const response = await messaging.sendEachForMulticast(messagePayload);

      console.log(
        `[NotificationService] Multicast completed: ${response.successCount} sent, ${response.failureCount} failed out of ${tokens.length} tokens.`,
      );

      // Handle token cleanup for invalid / uninstalled devices
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];

        response.responses.forEach((res: SendResponse, idx: number) => {
          if (!res.success && res.error) {
            const errorCode = res.error.code;
            console.warn(`[NotificationService] Failed to send to token [${tokens[idx]?.substring(0, 15)}...]: ${errorCode} - ${res.error.message}`);
            
            // FCM error codes that indicate a token is no longer valid
            if (
              errorCode === "messaging/invalid-registration-token" ||
              errorCode === "messaging/registration-token-not-registered" ||
              errorCode === "messaging/invalid-argument"
            ) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          console.log(`[NotificationService] Deactivating ${invalidTokens.length} expired / invalid device tokens...`);
          // Try deactivating in user_devices
          try {
            await supabaseAdmin
              .from("user_devices")
              .update({
                is_active: false,
                updated_at: new Date().toISOString(),
              })
              .in("device_token", invalidTokens);
          } catch (e) {}

          // Also delete from push_tokens
          try {
            await supabaseAdmin
              .from("push_tokens")
              .delete()
              .in("token", invalidTokens);
          } catch (e) {}
        }
      }

      return {
        success: true,
        sentCount: response.successCount,
        failureCount: response.failureCount,
        tokensCount: tokens.length,
      };
    } catch (err: any) {
      console.error("[NotificationService] Multicast dispatch error:", err);
      return {
        success: false,
        sentCount: 0,
        failureCount: tokens.length,
        tokensCount: tokens.length,
        error: err?.message || "Firebase multicast dispatch failed",
      };
    }
  },
};
