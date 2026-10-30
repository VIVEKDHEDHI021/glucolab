import { createFileRoute } from "@tanstack/react-router";
import { otpService, type OtpPurpose } from "@/backend/services/otpService.server";
import { emailService } from "@/backend/services/emailService.server";
import { supabase } from "@/db/client";

const VALID_PURPOSES: OtpPurpose[] = ["email_verification", "login_verification", "password_reset"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/auth/otp/send")({
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
          const purpose = body.purpose as OtpPurpose;

          // 1. Email format validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email || !emailRegex.test(email)) {
            return Response.json(
              { error: "Please enter a valid email address." },
              { status: 400, headers: corsHeaders },
            );
          }

          // 2. Validate Purpose
          if (!purpose || !VALID_PURPOSES.includes(purpose)) {
            return Response.json(
              { error: "Invalid verification purpose." },
              { status: 400, headers: corsHeaders },
            );
          }

          // 3. Extract client IP for rate limiting
          const forwarded = request.headers.get("x-forwarded-for");
          const realIp = request.headers.get("x-real-ip");
          const clientIp = (forwarded ? forwarded.split(",")[0].trim() : realIp) || "127.0.0.1";

          // 4. Rate limits & OTP generation
          const genResult = otpService.generateOtp(email, purpose, clientIp);
          if (!genResult.success) {
            return Response.json(
              {
                error: "Too many requests. Please wait a moment before trying again.",
                cooldownRemaining: genResult.cooldownRemaining,
              },
              { status: genResult.status || 429, headers: corsHeaders },
            );
          }

          const generatedOtp = genResult.otp!;

          // 5. Deliver OTP email via universal email service (Resend, Brevo, SendGrid, Postmark, SMTP, or Dev Simulation)
          const emailRes = await emailService.sendOtpEmail({
            to: email,
            code: generatedOtp,
            purpose,
          });

          if (emailRes.success) {
            return Response.json(
              {
                success: true,
                provider: emailRes.provider,
                message: "Your verification code is on its way! Please check your inbox.",
                cooldownSeconds: 60,
              },
              { status: 200, headers: corsHeaders },
            );
          }

          // 6. Fallback if primary email delivery failed:
          // In production without external email API, attempt Supabase Auth email dispatch
          console.warn("[AUTH OTP SEND] Email dispatch returned false, evaluating Supabase Auth fallback:", emailRes.error);

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
              const { error: resendErr } = await supabase.auth.resend({
                type: "signup",
                email,
              });
              if (resendErr) {
                if ((resendErr as any).code === "over_email_send_rate_limit" || resendErr.status === 429) {
                  isRateLimited = true;
                } else {
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
                error: "Too many requests. Please wait a moment before trying again.",
                cooldownRemaining: 60,
              },
              { status: 429, headers: corsHeaders },
            );
          }

          if (sbErrorMsg) {
            // User-friendly message hiding internal technical details or SMTP/provider secrets
            return Response.json(
              { error: "We couldn't send your verification code. Please try again." },
              { status: 502, headers: corsHeaders },
            );
          }

          return Response.json(
            {
              success: true,
              provider: "supabase",
              message: "Your verification code is on its way! Please check your inbox.",
              cooldownSeconds: 60,
            },
            { status: 200, headers: corsHeaders },
          );
        } catch (error: any) {
          console.error("[AUTH OTP SEND] Unexpected error:", error);
          return Response.json(
            { error: "We couldn't send your verification code. Please try again." },
            { status: 500, headers: corsHeaders },
          );
        }
      },
    },
  },
});
