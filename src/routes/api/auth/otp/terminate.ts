import { createFileRoute } from "@tanstack/react-router";
import { otpService, type OtpPurpose } from "@/backend/services/otpService.server";

const VALID_PURPOSES: OtpPurpose[] = ["email_verification", "login_verification", "password_reset"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/auth/otp/terminate")({
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

          if (email && purpose && VALID_PURPOSES.includes(purpose)) {
            otpService.terminateOtp(email, purpose);
          }

          return Response.json(
            {
              success: true,
              message: "Verification request has been terminated.",
            },
            { status: 200, headers: corsHeaders },
          );
        } catch {
          return Response.json(
            { success: true, message: "Verification request terminated." },
            { status: 200, headers: corsHeaders },
          );
        }
      },
    },
  },
});
