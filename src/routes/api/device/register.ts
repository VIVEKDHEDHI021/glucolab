import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/db/client.server";

export const Route = createFileRoute("/api/device/register")({
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
          const deviceType = body.device_type?.trim() || "web";
          const deviceName = body.device_name?.trim() || null;

          if (!deviceToken) {
            return Response.json(
              { error: "device_token is required." },
              { status: 400 },
            );
          }

          const now = new Date().toISOString();

          // 3. Try to register in user_devices table
          let registeredInUserDevices = false;
          try {
            const { data: existing } = await supabaseAdmin
              .from("user_devices")
              .select("id, user_id, is_active")
              .eq("device_token", deviceToken)
              .maybeSingle();

            if (existing) {
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
                .eq("id", existing.id);
            } else {
              await supabaseAdmin
                .from("user_devices")
                .insert({
                  user_id: user.id,
                  device_token: deviceToken,
                  device_type: deviceType,
                  device_name: deviceName,
                  is_active: true,
                  last_used_at: now,
                });
            }
            registeredInUserDevices = true;
          } catch (e) {}

          // 4. Also register/upsert in push_tokens table for dual compatibility
          try {
            await supabaseAdmin.from("push_tokens").upsert(
              {
                user_id: user.id,
                token: deviceToken,
                platform: deviceType,
                device_name: deviceName,
                updated_at: now,
              },
              { onConflict: "user_id,token" },
            );
          } catch (e) {}

          console.log(`[api/device/register] Device token registered for user ${user.id}`);
          return Response.json({ success: true, message: "Device registered successfully." });
        } catch (err: any) {
          console.error("[api/device/register] Unexpected error:", err);
          return Response.json(
            { error: err?.message || "Internal server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
