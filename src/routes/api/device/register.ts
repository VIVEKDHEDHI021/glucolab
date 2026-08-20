import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/db/client.server";

export const Route = createFileRoute("/api/device/register")({
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

          // 2. Parse and validate device payload
          const body = await request.json();
          const deviceToken = body?.device_token ? String(body.device_token).trim() : null;
          const deviceType = body?.device_type ? String(body.device_type).trim().toLowerCase() : "web";
          const deviceName = body?.device_name ? String(body.device_name).trim().substring(0, 150) : null;

          if (!deviceToken) {
            return Response.json(
              { error: "Bad Request: device_token is required." },
              { status: 400 },
            );
          }

          console.log(
            `[api/device/register] Registering device for user ${user.id} (type: ${deviceType}, name: ${deviceName})...`,
          );

          // 3. Upsert device token in user_devices table
          const { data: existing, error: findError } = await supabaseAdmin
            .from("user_devices")
            .select("id, user_id, is_active")
            .eq("device_token", deviceToken)
            .maybeSingle();

          if (findError) {
            console.error("[api/device/register] Error querying user_devices:", findError);
            return Response.json({ error: findError.message }, { status: 500 });
          }

          const now = new Date().toISOString();

          if (existing) {
            // Re-activate and safely re-associate with current user if needed
            const { data: updated, error: updateError } = await supabaseAdmin
              .from("user_devices")
              .update({
                user_id: user.id,
                device_type: deviceType,
                device_name: deviceName,
                is_active: true,
                last_used_at: now,
                updated_at: now,
              })
              .eq("id", existing.id)
              .select()
              .single();

            if (updateError) {
              console.error("[api/device/register] Error updating device:", updateError);
              return Response.json({ error: updateError.message }, { status: 500 });
            }

            console.log(`[api/device/register] Device ${existing.id} updated and activated successfully.`);
            return Response.json({ success: true, device: updated });
          } else {
            // Insert new device record
            const { data: created, error: insertError } = await supabaseAdmin
              .from("user_devices")
              .insert({
                user_id: user.id,
                device_token: deviceToken,
                device_type: deviceType,
                device_name: deviceName,
                is_active: true,
                last_used_at: now,
              })
              .select()
              .single();

            if (insertError) {
              console.error("[api/device/register] Error inserting device:", insertError);
              return Response.json({ error: insertError.message }, { status: 500 });
            }

            console.log(`[api/device/register] New device ${created.id} registered successfully.`);
            return Response.json({ success: true, device: created }, { status: 201 });
          }
        } catch (e: any) {
          console.error("[api/device/register] Uncaught error:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "Internal Server Error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
