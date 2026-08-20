import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/db/client.server";

export const Route = createFileRoute("/api/device/refresh")({
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

          // 2. Parse payload
          const body = await request.json();
          const oldToken = body?.old_token ? String(body.old_token).trim() : null;
          const newToken = body?.new_token ? String(body.new_token).trim() : null;
          const deviceType = body?.device_type ? String(body.device_type).trim().toLowerCase() : "web";
          const deviceName = body?.device_name ? String(body.device_name).trim().substring(0, 150) : null;

          if (!newToken) {
            return Response.json(
              { error: "Bad Request: new_token is required for token refresh." },
              { status: 400 },
            );
          }

          console.log(`[api/device/refresh] Refreshing token for user ${user.id}...`);
          const now = new Date().toISOString();

          // 3. If oldToken provided, update that specific record
          if (oldToken && oldToken !== newToken) {
            const { data: updatedOld, error: oldUpdateError } = await supabaseAdmin
              .from("user_devices")
              .update({
                device_token: newToken,
                is_active: true,
                device_type: deviceType,
                device_name: deviceName,
                last_used_at: now,
                updated_at: now,
              })
              .eq("user_id", user.id)
              .eq("device_token", oldToken)
              .select();

            if (!oldUpdateError && updatedOld && updatedOld.length > 0) {
              console.log("[api/device/refresh] Old token successfully rotated to new token.");
              return Response.json({ success: true, message: "Token rotated successfully." });
            }
          }

          // 4. Fallback: Upsert new token record
          const { data: existingNew } = await supabaseAdmin
            .from("user_devices")
            .select("id")
            .eq("device_token", newToken)
            .maybeSingle();

          if (existingNew) {
            await supabaseAdmin
              .from("user_devices")
              .update({
                user_id: user.id,
                device_type: deviceType,
                device_name: deviceName,
                is_active: true,
                last_used_at: now,
                updated_at: now,
              })
              .eq("id", existingNew.id);
          } else {
            await supabaseAdmin.from("user_devices").insert({
              user_id: user.id,
              device_token: newToken,
              device_type: deviceType,
              device_name: deviceName,
              is_active: true,
              last_used_at: now,
            });
          }

          return Response.json({ success: true, message: "New token registered successfully." });
        } catch (e: any) {
          console.error("[api/device/refresh] Uncaught error:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "Internal Server Error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
