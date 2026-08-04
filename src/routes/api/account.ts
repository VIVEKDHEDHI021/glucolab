import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/db/client.server";
import type { Database } from "@/db/types";

export const Route = createFileRoute("/api/account")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        try {
          // --- STEP 1: Check Authorization header ---
          const authHeader = request.headers.get("authorization");
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return Response.json(
              { error: "Unauthorized: Missing or invalid authorization token." },
              { status: 401 }
            );
          }

          const token = authHeader.replace("Bearer ", "").trim();
          if (!token) {
            return Response.json(
              { error: "Unauthorized: Empty access token provided." },
              { status: 401 }
            );
          }

          // Fetch authenticated user from Supabase Auth
          const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
          if (userError || !userData?.user) {
            return Response.json(
              { error: "Unauthorized: Invalid or expired session. Please log in again." },
              { status: 401 }
            );
          }

          const user = userData.user;
          const userId = user.id;
          const userEmail = user.email;

          if (!userEmail) {
            return Response.json(
              { error: "Bad Request: User account has no associated email address." },
              { status: 400 }
            );
          }

          // --- STEP 2: Parse and Validate Request Payload ---
          const body = await request.json().catch(() => ({}));
          const password = body.password;

          if (!password || typeof password !== "string" || !password.trim()) {
            return Response.json(
              { error: "Current password is required to delete your account." },
              { status: 400 }
            );
          }

          // --- STEP 3: Verify Current Password ---
          const SUPABASE_URL =
            process.env.SUPABASE_URL ||
            process.env.VITE_SUPABASE_URL ||
            "https://yhvnfwyeippnrqtttxac.supabase.co";
          const SUPABASE_PUBLISHABLE_KEY =
            process.env.SUPABASE_PUBLISHABLE_KEY ||
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            "sb_publishable_dR2EoURRwH6sHIEQd8-3dQ_daz0Qn-j";

          const authVerifyClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          });

          const { error: passwordError } = await authVerifyClient.auth.signInWithPassword({
            email: userEmail,
            password: password,
          });

          if (passwordError) {
            return Response.json(
              { error: "Incorrect password. Please enter your correct current password." },
              { status: 401 }
            );
          }

          // --- STEP 4: Delete All User Data (Cascading & Table-by-Table Clean Up) ---
          console.log(`[DELETE /api/account] Initiating data deletion for user: ${userId.slice(0, 8)}...`);

          // 1. Delete push tokens
          await supabaseAdmin.from("push_tokens").delete().eq("user_id", userId);

          // 2. Delete glucose entries
          await supabaseAdmin.from("glucose_entries").delete().eq("user_id", userId);

          // 3. Delete insulin entries
          await supabaseAdmin.from("insulin_entries").delete().eq("user_id", userId);

          // 4. Delete weight entries
          await supabaseAdmin.from("weight_entries").delete().eq("user_id", userId);

          // 5. Delete smart scan readings
          await supabaseAdmin.from("smart_scan_readings").delete().eq("user_id", userId);

          // 6. Delete reminder history
          await supabaseAdmin.from("reminder_history").delete().eq("user_id", userId);

          // 7. Delete reminders
          await supabaseAdmin.from("reminders").delete().eq("user_id", userId);

          // 8. Delete patient dose logs
          await supabaseAdmin.from("patient_dose_logs").delete().eq("patient_id", userId);

          // 9. Delete prescriptions
          await supabaseAdmin.from("prescriptions").delete().eq("patient_id", userId);

          // 10. Delete doctor access records
          await supabaseAdmin
            .from("patient_doctor_access")
            .delete()
            .or(`patient_id.eq.${userId},doctor_id.eq.${userId}`);

          // 11. Delete doctor notes
          await supabaseAdmin
            .from("doctor_notes")
            .delete()
            .or(`patient_id.eq.${userId},doctor_id.eq.${userId}`);

          // 12. Delete notifications
          await supabaseAdmin
            .from("doctor_patient_notifications")
            .delete()
            .eq("recipient_id", userId);

          // 13. Delete doctor profile if user was a registered doctor
          await supabaseAdmin.from("doctor_profiles").delete().eq("id", userId);

          // 14. Delete user profile
          await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

          // 15. Delete auth user from Supabase Auth identity store
          const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (deleteUserError) {
            console.error(`[DELETE /api/account] Error deleting auth user ${userId}:`, deleteUserError);
            return Response.json(
              { error: `Failed to remove user account: ${deleteUserError.message}` },
              { status: 500 }
            );
          }

          // --- STEP 5: Security Audit Log (Non-sensitive) ---
          console.log(`[ACCOUNT DELETED] Successfully deleted user account and all personal data. Timestamp: ${new Date().toISOString()}`);

          return Response.json({
            success: true,
            message: "Account and all associated data have been permanently deleted.",
          });
        } catch (err: any) {
          console.error("[DELETE /api/account] Uncaught server error:", err);
          return Response.json(
            { error: err?.message || "An unexpected server error occurred." },
            { status: 500 }
          );
        }
      },
    },
  },
});
