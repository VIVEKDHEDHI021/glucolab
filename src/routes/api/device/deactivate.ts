import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/db/client.server";

export const Route = createFileRoute("/api/device/deactivate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Authenticate the request via Supabase Bearer token
          const authHeader = request.headers.get("authorization");
          const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

          if (!token) {
            return Response.json(
              { error: "Unauthorized: Missing authentication token." },
              { status: 401 },
            );
          }

          const {
            data: { user },
            error: authError,
          } = await supabaseAdmin.auth.getUser(token);

          if (authError || !user) {
            return Response.json(
              { error: "Unauthorized: Invalid or expired session." },
              { status: 401 },
            );
          }

          // 2. Parse and validate device token to deactivate
          const body = await request.json();
          const deviceToken = body?.device_token ? String(body.device_token).trim() : null;

          if (!deviceToken) {
            return Response.json(
              { error: "Bad Request: device_token is required for deactivation." },
              { status: 400 },
            );
          }

          console.log(
            `[api/device/deactivate] Deactivating device token for user ${user.id} on logout...`,
          );

          // 3. Mark ONLY the current device as inactive for this user
          const { error: updateError } = await supabaseAdmin
            .from("user_devices")
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id)
            .eq("device_token", deviceToken);

          if (updateError) {
            console.error("[api/device/deactivate] Database error:", updateError);
            return Response.json({ error: updateError.message }, { status: 500 });
          }

          console.log(`[api/device/deactivate] Device token successfully deactivated.`);
          return Response.json({ success: true, message: "Device successfully deactivated on logout." });
        } catch (e: any) {
          console.error("[api/device/deactivate] Uncaught error:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "Internal Server Error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
