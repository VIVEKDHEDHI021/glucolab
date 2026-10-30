import { createFileRoute } from "@tanstack/react-router";
import { otpService, type OtpPurpose } from "@/backend/services/otpService.server";
import { emailService } from "@/backend/services/emailService.server";
import { supabase } from "@/db/client";

const VALID_PURPOSES: OtpPurpose[] = ["email_verification", "login_verification", "password_reset"];

export const Route = createFileRoute("/api/auth/otp/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
          const purpose = body.purpose as OtpPurpose;

          // 1. Email format validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email || !emailRegex.test(email)) {
            return Response.json(
              { error: "Invalid email format. Please provide a valid email address." },
              { status: 400 },
            );
          }

          // 2. Validate Purpose
          if (!purpose || !VALID_PURPOSES.includes(purpose)) {
            return Response.json(
              { error: "Invalid OTP purpose. Must be email_verification, login_verification, or password_reset." },
              { status: 400 },
            );
          }

          // 3. Extract client IP for rate limiting
          const forwarded = request.headers.get("x-forwarded-for");
          const realIp = request.headers.get("x-real-ip");
          const clientIp = (forwarded ? forwarded.split(",")[0].trim() : realIp) || "127.0.0.1";

          // 4. Rate limits & OTP generation for custom SMTP / fallback
          const genResult = otpService.generateOtp(email, purpose, clientIp);
          if (!genResult.success) {
            return Response.json(
              {
                error: genResult.error || "Unable to send verification code right now. Please wait a moment.",
                cooldownRemaining: genResult.cooldownRemaining,
              },
              { status: genResult.status || 429 },
            );
          }

          const generatedOtp = genResult.otp!;

          // 5. Option A: Deliver via Custom SMTP if configured
          if (emailService.hasCustomSmtp()) {
            const smtpRes = await emailService.sendOtpEmail({
              to: email,
              code: generatedOtp,
              purpose,
            });

            if (!smtpRes.success) {
              return Response.json(
                { error: `Email delivery failed via SMTP: ${smtpRes.error}` },
                { status: 502 },
              );
            }

            return Response.json({
              success: true,
              provider: "custom_smtp",
              message: "A 6-digit verification code has been sent to your email.",
              cooldownSeconds: 60,
            });
          }

          // 6. Option B: Deliver via Supabase Auth Email Service
          let sbErrorMsg: string | null = null;
          let isRateLimited = false;

          try {
            if (purpose === "password_reset") {
              const { error } = await supabase.auth.resetPasswordForEmail(email);
              if (error) {
                sbErrorMsg = error.message;
                if ((error as any).code === "over_email_send_rate_limit" || error.status === 429) {
                  isRateLimited = true;
                }
              }
            } else if (purpose === "login_verification") {
              const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: false },
              });
              if (error) {
                sbErrorMsg = error.message;
                if ((error as any).code === "over_email_send_rate_limit" || error.status === 429) {
                  isRateLimited = true;
                }
              }
            } else if (purpose === "email_verification") {
              // Attempt signup resend first (works if email confirmation is enabled in Supabase)
              const { error: resendErr } = await supabase.auth.resend({
                type: "signup",
                email,
              });

              if (resendErr) {
                if ((resendErr as any).code === "over_email_send_rate_limit" || resendErr.status === 429) {
                  isRateLimited = true;
                  sbErrorMsg = resendErr.message;
                } else {
                  // Fallback to signInWithOtp which reliably triggers email delivery
                  const { error: otpErr } = await supabase.auth.signInWithOtp({
                    email,
                    options: { shouldCreateUser: false },
                  });
                  if (otpErr) {
                    sbErrorMsg = otpErr.message;
                    if ((otpErr as any).code === "over_email_send_rate_limit" || otpErr.status === 429) {
                      isRateLimited = true;
                    }
                  }
                }
              }
            }
          } catch (deliveryErr: any) {
            sbErrorMsg = deliveryErr?.message || "Email provider connection error.";
          }

          if (isRateLimited) {
            return Response.json(
              {
                error: "For security, verification emails can only be requested once per minute. Please wait before retrying.",
                cooldownRemaining: 60,
              },
              { status: 429 },
            );
          }

          if (sbErrorMsg && !sbErrorMsg.toLowerCase().includes("rate limit")) {
            return Response.json(
              { error: `Unable to deliver verification email: ${sbErrorMsg}` },
              { status: 400 },
            );
          }

          return Response.json({
            success: true,
            provider: "supabase",
            message: "A verification code has been sent to your email address.",
            cooldownSeconds: 60,
          });
        } catch (error: any) {
          console.error("[AUTH OTP SEND] Unexpected error:", error);
          return Response.json(
            { error: "An unexpected error occurred while sending the verification code. Please try again." },
            { status: 500 },
          );
        }
      },
    },
  },
});
