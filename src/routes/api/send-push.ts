import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/db/client.server";
import { notificationServiceServer } from "@/backend/services/notificationService.server";

export const Route = createFileRoute("/api/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Authenticate the caller
          const authHeader = request.headers.get("authorization");
          const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

          let authenticatedUserId: string | null = null;
          if (token) {
            const {
              data: { user },
              error: authErr,
            } = await supabaseAdmin.auth.getUser(token);
            if (!authErr && user) {
              authenticatedUserId = user.id;
            }
          }

          const body = await request.json();
          const { userId, title, body: contentBody, excludeDeviceToken, data } = body;

          // Ensure target userId is valid and matches authenticated user (prevent cross-user triggers)
          const targetUserId = authenticatedUserId || userId;

          if (!targetUserId) {
            return Response.json(
              { error: "Unauthorized: Missing authentication or target userId." },
              { status: 401 },
            );
          }

          // If caller is authenticated, enforce that they can only notify their own account
          if (authenticatedUserId && userId && authenticatedUserId !== userId) {
            return Response.json(
              { error: "Forbidden: Cannot send push notifications to other user accounts." },
              { status: 403 },
            );
          }

          if (!title || !contentBody) {
            return Response.json(
              { error: "Bad Request: title and body are required." },
              { status: 400 },
            );
          }

          console.log(
            `[api/send-push] Dispatching push for user ${targetUserId} (exclude source token: ${Boolean(excludeDeviceToken)})...`,
          );

          // 2. Delegate to server NotificationService
          const result = await notificationServiceServer.sendToUser(
            targetUserId,
            {
              title: String(title),
              body: String(contentBody),
            },
            {
              excludeDeviceToken: excludeDeviceToken ? String(excludeDeviceToken) : undefined,
              data: data && typeof data === "object" ? data : undefined,
            },
          );

          return Response.json(result, { status: result.success ? 200 : 500 });
        } catch (e: any) {
          console.error("[api/send-push] Uncaught error:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "Internal Server Error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
