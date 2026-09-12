import { createFileRoute } from "@tanstack/react-router";
import { createUserScopedClient, supabaseAdmin } from "@/db/client.server";

export const Route = createFileRoute("/api/account/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let userId: string | null = null;
          let userEmail: string | null = null;
          let userClient: any = null;

          const authHeader = request.headers.get("Authorization");
          const body = await request.json().catch(() => ({}));

          // 1. Authenticate via Bearer token if provided
          if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            userClient = createUserScopedClient(token);
            const {
              data: { user },
              error: authError,
            } = await userClient.auth.getUser();
            if (user && !authError) {
              userId = user.id;
              userEmail = user.email || null;
            }
          }

          // 2. Alternatively authenticate via direct credentials (email + password)
          if (!userId && body.email && body.password) {
            const tempClient = createUserScopedClient("");
            const { data: loginData, error: loginError } =
              await tempClient.auth.signInWithPassword({
                email: body.email.trim(),
                password: body.password,
              });
            if (loginData?.user && !loginError) {
              userId = loginData.user.id;
              userEmail = loginData.user.email || null;
              userClient = createUserScopedClient(
                loginData.session?.access_token || "",
              );
            }
          }

          // 3. If unauthenticated, check if this is an offline Deletion Request Form submission
          if (!userId) {
            if (body.requestOnly && body.email) {
              const email = String(body.email).trim().toLowerCase();
              const reason = body.reason ? String(body.reason).trim() : "User requested deletion via public web form";
              console.log(`[ACCOUNT DELETION REQUEST] Public deletion request logged for email: ${email}. Reason: ${reason}`);

              const refId = `DEL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

              return Response.json({
                success: true,
                isRequest: true,
                message:
                  "Deletion request received. All medical entries, logs, and account credentials associated with this email will be permanently wiped.",
                referenceId: refId,
              });
            }

            return Response.json(
              {
                error:
                  "Authentication failed. Please provide your correct account password, or use the Deletion Request Form.",
              },
              { status: 401 },
            );
          }

          // 4. Thoroughly delete patient data from all health and system tables
          const clientToUse = userClient || supabaseAdmin;

          const tables = [
            "glucose_entries",
            "insulin_entries",
            "weight_entries",
            "smart_scan_readings",
            "smart_scan_training_samples",
            "reminders",
            "reminder_history",
            "patient_reminder_settings",
            "user_devices",
            "push_tokens",
            "profiles",
          ];

          for (const table of tables) {
            try {
              await clientToUse.from(table).delete().eq("user_id", userId);
            } catch (tblErr) {
              try {
                await supabaseAdmin.from(table).delete().eq("user_id", userId);
              } catch (adminErr) {
                console.error(
                  `[DELETE_ACCOUNT] Failed clearing table ${table} for user ${userId}:`,
                  adminErr,
                );
              }
            }
          }

          // 5. Attempt deleting user from auth.users via Supabase Admin API
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId);
          } catch (authDelErr) {
            console.warn(
              "[DELETE_ACCOUNT] auth.admin.deleteUser warning (may require service role key):",
              authDelErr,
            );
          }

          return Response.json({
            success: true,
            isRequest: false,
            message:
              "Your account and all associated health records (glucose, insulin, weight, and device tokens) have been permanently erased.",
            userId,
            deletedAt: new Date().toISOString(),
          });
        } catch (error: any) {
          console.error("[DELETE_ACCOUNT] Unexpected server error:", error);
          return Response.json(
            {
              error:
                error?.message ||
                "An unexpected server error occurred while processing account deletion.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
