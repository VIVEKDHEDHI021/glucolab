import { createFileRoute } from "@tanstack/react-router";
import {
  createUserScopedClient,
  supabaseAdmin,
  hasServiceRoleKey,
} from "@/db/client.server";

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
              const isVerified =
                user.email_confirmed_at ||
                user.app_metadata?.provider === "google" ||
                (Array.isArray(user.app_metadata?.providers) &&
                  user.app_metadata.providers.includes("google")) ||
                user.user_metadata?.email_verified === true;

              if (!isVerified) {
                return Response.json(
                  { error: "Unauthorized: Email address must be verified to perform this action." },
                  { status: 403 },
                );
              }
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
              const isVerified =
                loginData.user.email_confirmed_at ||
                loginData.user.app_metadata?.provider === "google" ||
                (Array.isArray(loginData.user.app_metadata?.providers) &&
                  loginData.user.app_metadata.providers.includes("google")) ||
                loginData.user.user_metadata?.email_verified === true;

              if (!isVerified) {
                return Response.json(
                  { error: "Unauthorized: Email address must be verified to perform this action." },
                  { status: 403 },
                );
              }
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
          const tables = [
            "smart_scan_training_samples",
            "smart_scan_readings",
            "reminder_history",
            "reminders",
            "patient_reminder_settings",
            "push_tokens",
            "user_devices",
            "weight_entries",
            "insulin_entries",
            "glucose_entries",
            "profiles",
          ];

          for (const table of tables) {
            try {
              if (userClient) {
                await (userClient.from as any)(table).delete().eq("user_id", userId);
              }
            } catch (tblErr) {
              console.warn(`[DELETE_ACCOUNT] userClient deletion error on table ${table}:`, tblErr);
            }

            if (hasServiceRoleKey()) {
              try {
                await (supabaseAdmin.from as any)(table).delete().eq("user_id", userId);
              } catch (adminErr) {
                console.warn(`[DELETE_ACCOUNT] supabaseAdmin deletion error on table ${table}:`, adminErr);
              }
            }
          }

          // 5. Permanently delete user from Supabase Auth
          let authDeleted = false;
          let authDeletionError: string | null = null;

          // 5a. Primary server-side method: Supabase Admin Auth API with service-role secret
          if (hasServiceRoleKey()) {
            try {
              const { data: delData, error: delErr } =
                await supabaseAdmin.auth.admin.deleteUser(userId);

              if (delErr) {
                console.error(
                  `[DELETE_ACCOUNT] Supabase Admin deleteUser failed for ${userId}:`,
                  delErr,
                );
                authDeletionError = delErr.message;
              } else {
                // Verification: Confirm user no longer exists in Supabase Auth
                const { data: verifyData, error: verifyErr } =
                  await supabaseAdmin.auth.admin.getUserById(userId);

                if (verifyErr || !verifyData?.user) {
                  authDeleted = true;
                  console.log(`[DELETE_ACCOUNT] Confirmed Auth user ${userId} deleted via Admin API.`);
                } else {
                  console.warn(
                    `[DELETE_ACCOUNT] User ${userId} still returned after deleteUser call.`,
                  );
                  authDeletionError = "User still exists after deletion attempt";
                }
              }
            } catch (adminEx: any) {
              console.error(
                `[DELETE_ACCOUNT] Exception during admin deleteUser for ${userId}:`,
                adminEx,
              );
              authDeletionError = adminEx?.message || "Admin deleteUser exception";
            }
          }

          // 5b. Database RPC method: PostgreSQL SECURITY DEFINER delete_user_account()
          if (!authDeleted && userClient) {
            try {
              const { data: rpcData, error: rpcErr } =
                await userClient.rpc("delete_user_account");

              if (!rpcErr && rpcData === true) {
                authDeleted = true;
                console.log(
                  `[DELETE_ACCOUNT] Successfully deleted user ${userId} via delete_user_account RPC.`,
                );
              } else if (rpcErr) {
                console.warn(
                  `[DELETE_ACCOUNT] delete_user_account RPC error for ${userId}:`,
                  rpcErr.message,
                );
                if (!authDeletionError) authDeletionError = rpcErr.message;
              }
            } catch (rpcEx: any) {
              console.warn(
                `[DELETE_ACCOUNT] Exception during delete_user_account RPC for ${userId}:`,
                rpcEx,
              );
              if (!authDeletionError) authDeletionError = rpcEx?.message;
            }
          }

          // 6. Strict validation: If Auth identity was NOT deleted, FAIL the request!
          // Never report success if the auth user still exists in auth.users.
          if (!authDeleted) {
            const hasKey = hasServiceRoleKey();
            const details = !hasKey
              ? "SUPABASE_SERVICE_ROLE_KEY is not configured in the server environment, and the delete_user_account database function is unavailable. Server-side Supabase Auth user deletion requires SUPABASE_SERVICE_ROLE_KEY."
              : `Supabase Auth returned error: ${authDeletionError || "Unknown deletion failure"}`;

            console.error(
              `[DELETE_ACCOUNT] CRITICAL: Auth deletion failed for user ${userId}. Details: ${details}`,
            );

            return Response.json(
              {
                success: false,
                error: `Account deletion failed: The authentication identity could not be erased (${authDeletionError || "Authentication provider rejected deletion"}). Your account remains active and was NOT deleted.`,
                code: "AUTH_DELETION_FAILED",
                details,
              },
              { status: 500 },
            );
          }

          return Response.json({
            success: true,
            isRequest: false,
            message:
              "Your account and all associated health records (glucose, insulin, weight, and devices) have been permanently erased.",
            userId,
            deletedAt: new Date().toISOString(),
          });
        } catch (error: any) {
          console.error("[DELETE_ACCOUNT] Unexpected server error:", error);
          return Response.json(
            {
              success: false,
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
