import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import { supabaseAdmin } from "../../db/client.server";

let isFirebaseAdminInitialized = false;

/**
 * Initialize Firebase Admin SDK using secure server-side credentials
 */
function initFirebaseAdmin() {
  if (isFirebaseAdminInitialized || getApps().length > 0) {
    isFirebaseAdminInitialized = true;
    return true;
  }

  try {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID || "glucolab";

    if (serviceAccountEnv) {
      let serviceAccount: any;
      try {
        serviceAccount = JSON.parse(serviceAccountEnv);
      } catch {
        // Handle Base64-encoded service account string
        const decoded = Buffer.from(serviceAccountEnv, "base64").toString("utf-8");
        serviceAccount = JSON.parse(decoded);
      }
      initializeApp({
        credential: cert(serviceAccount),
      });
      isFirebaseAdminInitialized = true;
      console.log("[FCM Server] Firebase Admin SDK initialized with FIREBASE_SERVICE_ACCOUNT.");
      return true;
    } else if (privateKey && clientEmail) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
      isFirebaseAdminInitialized = true;
      console.log("[FCM Server] Firebase Admin SDK initialized with Private Key & Client Email.");
      return true;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({
        credential: applicationDefault(),
      });
      isFirebaseAdminInitialized = true;
      console.log("[FCM Server] Firebase Admin SDK initialized with applicationDefault credentials.");
      return true;
    }

    console.warn(
      "[FCM Server] Firebase Admin credentials not found in environment. Running in simulation mode.",
    );
    return false;
  } catch (err) {
    console.error("[FCM Server] Failed to initialize Firebase Admin SDK:", err);
    return false;
  }
}

export interface FCMPushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FCMPushResult {
  success: boolean;
  sentCount: number;
  failureCount: number;
  tokensCount: number;
  simulated?: boolean;
  error?: string;
}

export const fcmServiceServer = {
  /**
   * Send FCM push notification to all active devices of a user
   */
  async sendToUser(
    userId: string,
    payload: FCMPushPayload,
    client?: any,
  ): Promise<FCMPushResult> {
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

      // 1. Fetch active devices/tokens for this user from user_devices table
      let tokens: string[] = [];
      const { data: devices, error: dbError } = await db
        .from("user_devices")
        .select("device_token")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!dbError && devices && devices.length > 0) {
        tokens = devices.map((d: any) => d.device_token).filter(Boolean);
      } else {
        // Fallback to push_tokens table
        const { data: legacyTokens } = await db
          .from("push_tokens")
          .select("token")
          .eq("user_id", userId);

        if (legacyTokens) {
          tokens = legacyTokens.map((d: any) => d.token).filter(Boolean);
        }
      }

      if (tokens.length === 0) {
        console.log(`[FCM Server] No active tokens registered for user ${userId}.`);
        return {
          success: true,
          sentCount: 0,
          failureCount: 0,
          tokensCount: 0,
        };
      }

      // 2. Initialize Firebase Admin SDK
      const isInitialized = initFirebaseAdmin();

      if (!isInitialized) {
        console.log(
          `[FCM Server] Simulated push delivery for user ${userId} to ${tokens.length} token(s). Title: "${payload.title}"`,
        );
        return {
          success: true,
          sentCount: tokens.length,
          failureCount: 0,
          tokensCount: tokens.length,
          simulated: true,
        };
      }

      // 3. Dispatch FCM multicast message via Firebase Admin SDK
      const message: MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: "high",
          notification: {
            channelId: "default",
            sound: "default",
            priority: "high",
          },
        },
      };

      console.log(
        `[FCM Server] Sending FCM push notification to ${tokens.length} device(s) for user ${userId}...`,
      );

      const response = await getMessaging().sendEachForMulticast(message);

      console.log(
        `[FCM Server] Multicast result: ${response.successCount} succeeded, ${response.failureCount} failed.`,
      );

      // 4. Clean up invalid/unregistered tokens
      if (response.failureCount > 0) {
        const tokensToDeactivate: string[] = [];
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === "messaging/registration-token-not-registered" ||
              errorCode === "messaging/invalid-registration-token"
            ) {
              tokensToDeactivate.push(tokens[idx]);
            }
          }
        });

        if (tokensToDeactivate.length > 0) {
          console.log(
            `[FCM Server] Deactivating ${tokensToDeactivate.length} invalid/unregistered token(s)...`,
          );
          try {
            await db
              .from("user_devices")
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .in("device_token", tokensToDeactivate);
          } catch (cleanupErr) {
            console.warn("[FCM Server] Token cleanup warning:", cleanupErr);
          }
        }
      }

      return {
        success: response.successCount > 0 || response.failureCount === 0,
        sentCount: response.successCount,
        failureCount: response.failureCount,
        tokensCount: tokens.length,
      };
    } catch (err: any) {
      console.error("[FCM Server] sendToUser error:", err);
      return {
        success: false,
        sentCount: 0,
        failureCount: 0,
        tokensCount: 0,
        error: err?.message || "Internal FCM Server Error",
      };
    }
  },
};
