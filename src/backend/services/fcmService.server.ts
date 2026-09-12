import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import { supabaseAdmin } from "../../db/client.server";
import fs from "node:fs";

let isFirebaseAdminInitialized = false;

/**
 * Initialize Firebase Admin SDK using secure server-side credentials
 */
function initFirebaseAdmin(): boolean {
  if (isFirebaseAdminInitialized || getApps().length > 0) {
    isFirebaseAdminInitialized = true;
    return true;
  }

  try {
    let serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

    // Fallback: Read from local .env if not yet injected into process.env
    if (!serviceAccountEnv) {
      try {
        if (fs.existsSync(".env")) {
          const envContent = fs.readFileSync(".env", "utf8");
          const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT=(?:'([\s\S]*?)'|"([\s\S]*?)"|({[\s\S]*?}))(?:\r?\n|$)/);
          if (match) {
            serviceAccountEnv = match[1] || match[2] || match[3];
          }
        }
      } catch (e) {
        // Ignore filesystem read errors in non-node/worker environments
      }
    }

    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID || "glucolab-1ad86";

    if (serviceAccountEnv) {
      let serviceAccount: any;
      let raw = serviceAccountEnv.trim();
      // Strip leading and trailing single/double quotes if wrapped
      if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
        raw = raw.slice(1, -1).trim();
      }

      try {
        serviceAccount = JSON.parse(raw);
      } catch {
        // Handle Base64-encoded service account string
        try {
          const decoded = Buffer.from(raw, "base64").toString("utf-8");
          serviceAccount = JSON.parse(decoded);
        } catch (parseErr) {
          console.error("[FCM Server] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", parseErr);
        }
      }

      if (serviceAccount && serviceAccount.client_email && serviceAccount.private_key) {
        initializeApp({
          credential: cert(serviceAccount),
        });
        isFirebaseAdminInitialized = true;
        console.log("[FCM Server] Firebase Admin SDK initialized with service account:", serviceAccount.client_email);
        return true;
      }
    }

    if (privateKey && clientEmail) {
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
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
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
   * Send FCM multicast push notification directly to specified device tokens.
   */
  async sendToTokens(
    tokens: string[],
    payload: FCMPushPayload,
    client?: any,
  ): Promise<FCMPushResult> {
    try {
      if (!tokens || tokens.length === 0) {
        return {
          success: true,
          sentCount: 0,
          failureCount: 0,
          tokensCount: 0,
        };
      }

      const db = client || supabaseAdmin;
      const isInitialized = initFirebaseAdmin();

      if (!isInitialized) {
        console.log(
          `[FCM Server] Simulated push delivery to ${tokens.length} token(s). Title: "${payload.title}"`,
        );
        return {
          success: true,
          sentCount: tokens.length,
          failureCount: 0,
          tokensCount: tokens.length,
          simulated: true,
        };
      }

      const message: MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          ...(payload.data || {}),
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: "high",
          notification: {
            title: payload.title,
            body: payload.body,
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
                title: payload.title,
                body: payload.body,
              },
              sound: "default",
              badge: 1,
            },
          },
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: "/logo.png",
            badge: "/icon/icon.png",
          },
          fcmOptions: {
            link: "/",
          },
        },
      };

      console.log(
        `[FCM Server] Dispatching high-priority FCM multicast to ${tokens.length} device token(s)...`,
      );

      const response = await getMessaging().sendEachForMulticast(message);

      console.log(
        `[FCM Server] Multicast result: ${response.successCount} succeeded, ${response.failureCount} failed.`,
      );

      // Clean up dead/unregistered tokens
      if (response.failureCount > 0) {
        const tokensToDeactivate: string[] = [];
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            console.warn(`[FCM Server] Token delivery failed (code: ${errorCode}):`, resp.error?.message);
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
      console.error("[FCM Server] sendToTokens error:", err);
      return {
        success: false,
        sentCount: 0,
        failureCount: tokens.length,
        tokensCount: tokens.length,
        error: err?.message || "Internal FCM Server Error",
      };
    }
  },

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

      // Fetch active devices/tokens for this user from user_devices table
      let tokens: string[] = [];
      const { data: devices, error: dbError } = await db
        .from("user_devices")
        .select("device_token")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!dbError && devices && devices.length > 0) {
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

      return await this.sendToTokens(tokens, payload, client);
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
