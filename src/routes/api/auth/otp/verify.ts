import { createFileRoute } from "@tanstack/react-router";
import { otpService, type OtpPurpose } from "@/backend/services/otpService.server";
import { supabaseAdmin, hasServiceRoleKey } from "@/db/client.server";

const VALID_PURPOSES: OtpPurpose[] = ["email_verification", "login_verification", "password_reset"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/auth/otp/verify")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
          const code = typeof body.code === "string" ? body.code.trim() : "";
          const purpose = body.purpose as OtpPurpose;

          // 1. Email format validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email || !emailRegex.test(email)) {
            return Response.json(
              { error: "Please enter a valid email address." },
              { status: 400, headers: corsHeaders },
            );
          }

          // 2. Code format validation: exactly 6 digits
          if (!code || !/^[0-9]{6}$/.test(code)) {
            return Response.json(
              { error: "That code doesn't look right. Please check and try again." },
              { status: 400, headers: corsHeaders },
            );
          }

          // 3. Validate Purpose
          if (!purpose || !VALID_PURPOSES.includes(purpose)) {
            return Response.json(
              { error: "Invalid verification purpose." },
              { status: 400, headers: corsHeaders },
            );
          }

          // 4. Extract client IP for attempt rate limiting
          const forwarded = request.headers.get("x-forwarded-for");
          const realIp = request.headers.get("x-real-ip");
          const clientIp = (forwarded ? forwarded.split(",")[0].trim() : realIp) || "127.0.0.1";

          // 5. Verify via server otpService
          const verifyResult = otpService.verifyOtp(email, purpose, code, clientIp);

          if (!verifyResult.success) {
            const rawErr = (verifyResult.error || "").toLowerCase();
            let friendlyError = "That code doesn't look right. Please check and try again.";

            if (verifyResult.status === 429 || rawErr.includes("too many") || rawErr.includes("rate limit")) {
              friendlyError = "Too many requests. Please wait a moment before trying again.";
            } else if (rawErr.includes("expired")) {
              friendlyError = "This code has expired. Request a new verification code.";
            }

            return Response.json(
              {
                error: friendlyError,
                attemptsRemaining: verifyResult.attemptsRemaining,
              },
              { status: verifyResult.status || 400, headers: corsHeaders },
            );
          }

          // 6. On successful email_verification or login_verification:
          // Ensure user's email is marked as confirmed and email_otp_verified in Supabase
          if (purpose === "email_verification" || purpose === "login_verification") {
            try {
              if (hasServiceRoleKey()) {
                const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
                const matchedUser = userData?.users?.find(
                  (u) => u.email?.toLowerCase() === email,
                );
                if (matchedUser) {
                  await supabaseAdmin.auth.admin.updateUserById(matchedUser.id, {
                    email_confirm: true,
                    user_metadata: {
                      ...matchedUser.user_metadata,
                      email_otp_verified: true,
                      email_verified: true,
                    },
                  });
                }
              }
            } catch (adminErr) {
              console.warn("[AUTH OTP VERIFY] admin confirmation note:", adminErr);
            }
          }

          return Response.json(
            {
              success: true,
              verified: true,
              purpose,
              message:
                purpose === "password_reset"
                  ? "Code verified successfully. You may now reset your password."
                  : "Email verified successfully. Your account is active.",
            },
            { status: 200, headers: corsHeaders },
          );
        } catch (error: any) {
          console.error("[AUTH OTP VERIFY] Unexpected error:", error);
          return Response.json(
            { error: "Connection issue. Please check your internet and try again." },
            { status: 500, headers: corsHeaders },
          );
        }
      },
    },
  },
});
