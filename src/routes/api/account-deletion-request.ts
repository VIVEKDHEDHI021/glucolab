import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/db/client.server";

export const Route = createFileRoute("/api/account-deletion-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const email = body.email;
          const reason = body.reason || "No reason specified";

          if (!email || typeof email !== "string" || !email.includes("@")) {
            return Response.json(
              { error: "A valid email address is required to process an account deletion request." },
              { status: 400 }
            );
          }

          const cleanEmail = email.trim().toLowerCase();

          // Search if user exists in Supabase Auth via admin client
          const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          
          let targetUserId: string | null = null;
          if (!listError && users?.users) {
            const foundUser = users.users.find(
              (u) => u.email?.toLowerCase() === cleanEmail
            );
            if (foundUser) {
              targetUserId = foundUser.id;
            }
          }

          // Log security audit for the public deletion request
          console.log(
            `[ACCOUNT DELETION REQUEST] Request received for email: ${cleanEmail}. Target User ID: ${
              targetUserId || "Unknown/Not found"
            }. Reason: ${reason}. Timestamp: ${new Date().toISOString()}`
          );

          return Response.json({
            success: true,
            message: `Account deletion request received for ${cleanEmail}. Requests are processed within 1–3 business days. If your account is active, you will receive a confirmation email once deletion is complete.`,
            requestId: `REQ-${Date.now().toString(36).toUpperCase()}`,
            userFound: !!targetUserId,
          });
        } catch (err: any) {
          console.error("[ACCOUNT DELETION REQUEST] Server error:", err);
          return Response.json(
            { error: err?.message || "An unexpected error occurred while processing your request." },
            { status: 500 }
          );
        }
      },
    },
  },
});
