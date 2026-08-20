import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/db/client.server";

export const Route = createFileRoute("/api/device/deactivate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Authenticate user from Bearer Token
          const authHeader = request.headers.get("Authorization");
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return Response.json(
              { error: "Unauthorized. Missing or invalid Bearer token." },
              { status: 401 },
            );
          }

          const token = authHeader.split(" ")[1];
          const {
            data: { user },
            error: authError,
          } = await supabaseAdmin.auth.getUser(token);

          if (authError || !user) {
            return Response.json(
              { error: "Unauthorized. Invalid authentication session." },
              { status: 401 },
            );
          }

          // 2. Parse and validate request body
          const body = await request.json();
          const deviceToken = body.device_token?.trim();

          if (!deviceToken) {
            return Response.json(
              { error: "device_token is required for targeted deactivation." },
              { status: 400 },
            );
          }

          const now = new Date().toISOString();

          // 3. Deactivate ONLY the specific device token in user_devices
          try {
            await supabaseAdmin
              .from("user_devices")
              .update({
                is_active: false,
                updated_at: now,
              })
              .eq("user_id", user.id)
              .eq("device_token", deviceToken);
          } catch (e) {}

          // 4. Remove from push_tokens for dual compatibility
          try {
            await supabaseAdmin
              .from("push_tokens")
              .delete()
              .eq("user_id", user.id)
              .eq("token", deviceToken);
          } catch (e) {}

          console.log(
            `[api/device/deactivate] Current device token deactivated for user ${user.id}`,
          );

          return Response.json({
            success: true,
            message: "Current device deactivated successfully.",
          });
        } catch (err: any) {
          console.error("[api/device/deactivate] Unexpected error:", err);
          return Response.json(
            { error: err?.message || "Internal server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
