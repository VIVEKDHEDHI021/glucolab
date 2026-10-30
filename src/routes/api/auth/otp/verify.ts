import { createFileRoute } from "@tanstack/react-router";
import { otpService, type OtpPurpose } from "@/backend/services/otpService.server";
import { supabaseAdmin } from "@/db/client.server";
import { supabase } from "@/db/client";

const VALID_PURPOSES: OtpPurpose[] = ["email_verification", "login_verification", "password_reset"];

export const Route = createFileRoute("/api/auth/otp/verify")({
  server: {
    handlers: {
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
              { error: "Invalid email format. Please provide a valid email address." },
              { status: 400 },
            );
          }

          // 2. Code format validation: exactly 6 digits
          if (!code || !/^[0-9]{6}$/.test(code)) {
            return Response.json(
              { error: "Invalid verification code format. Must be a 6-digit number." },
              { status: 400 },
            );
          }

          // 3. Validate Purpose
          if (!purpose || !VALID_PURPOSES.includes(purpose)) {
            return Response.json(
              { error: "Invalid verification purpose." },
              { status: 400 },
            );
          }

          // 4. Extract client IP for attempt rate limiting
          const forwarded = request.headers.get("x-forwarded-for");
          const realIp = request.headers.get("x-real-ip");
          const clientIp = (forwarded ? forwarded.split(",")[0].trim() : realIp) || "127.0.0.1";

          // 5. Verify via server otpService
          const verifyResult = otpService.verifyOtp(email, purpose, code, clientIp);

          if (!verifyResult.success) {
            return Response.json(
              {
                error: verifyResult.error || "Invalid verification code. Please check and try again.",
                attemptsRemaining: verifyResult.attemptsRemaining,
              },
              { status: verifyResult.status || 400 },
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

          return Response.json({
            success: true,
            verified: true,
            purpose,
            message:
              purpose === "password_reset"
                ? "Code verified successfully. You may now reset your password."
                : "Email verified successfully. Your account is active.",
          });
        } catch (error: any) {
          console.error("[AUTH OTP VERIFY] Unexpected error:", error);
          return Response.json(
            { error: "An unexpected error occurred while verifying the code." },
            { status: 500 },
          );
        }
      },
    },
  },
});
