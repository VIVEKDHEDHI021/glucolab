import nodemailer from "nodemailer";

interface SendOtpEmailParams {
  to: string;
  code: string;
  purpose: "email_verification" | "login_verification" | "password_reset";
}

interface SendEmailResult {
  success: boolean;
  provider: "custom_smtp" | "supabase" | "none";
  messageId?: string;
  error?: string;
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"GlucoLab" <${user || "no-reply@glucolab.app"}>`;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && user && pass) {
    return { host, port, user, pass, from, secure };
  }
  return null;
}

let cachedTransporter: any = null;

function getTransporter() {
  const config = getSmtpConfig();
  if (!config) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }
  return { transporter: cachedTransporter, from: config.from };
}

export const emailService = {
  hasCustomSmtp(): boolean {
    return getSmtpConfig() !== null;
  },

  async sendOtpEmail({ to, code, purpose }: SendOtpEmailParams): Promise<SendEmailResult> {
    const smtp = getTransporter();
    if (!smtp) {
      return { success: false, provider: "none", error: "Custom SMTP not configured" };
    }

    const cleanEmail = to.trim().toLowerCase();
    const cleanCode = code.trim();

    let subject = "Your GlucoLab Verification Code";
    let title = "Verify Your Email";
    let actionDescription = "activate your GlucoLab account";

    if (purpose === "login_verification") {
      subject = "GlucoLab Login Verification Code";
      title = "Confirm Sign In";
      actionDescription = "complete your sign in to GlucoLab";
    } else if (purpose === "password_reset") {
      subject = "GlucoLab Password Reset Code";
      title = "Reset Your Password";
      actionDescription = "reset your GlucoLab account password";
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <div style="background: linear-gradient(135deg, #10b981, #059669); width: 40px; height: 40px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; text-align: center; line-height: 40px;">
        <span style="color: #ffffff; font-weight: bold; font-size: 20px;">G</span>
      </div>
      <span style="font-size: 20px; font-weight: 700; margin-left: 12px; color: #0f172a; letter-spacing: -0.5px;">GlucoLab</span>
    </div>

    <h2 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">${title}</h2>
    <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0 0 24px 0;">
      Please enter the following 8-digit verification code to ${actionDescription}.
    </p>

    <div style="background: #f1f5f9; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 24px; border: 1px dashed #cbd5e1;">
      <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #059669; display: inline-block;">${cleanCode}</span>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 16px 0;">
      ⏳ This code is valid for <strong>5 minutes</strong>. If you did not make this request, you can safely ignore this email.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
      &copy; ${new Date().getFullYear()} GlucoLab Health. Secure Diabetes Management.
    </p>
  </div>
</body>
</html>
    `;

    try {
      const info = await smtp.transporter.sendMail({
        from: smtp.from,
        to: cleanEmail,
        subject: `${cleanCode} is your ${subject}`,
        html,
        text: `Your GlucoLab verification code is: ${cleanCode}. Valid for 5 minutes.`,
      });

      return {
        success: true,
        provider: "custom_smtp",
        messageId: info.messageId,
      };
    } catch (err: any) {
      console.error("[EMAIL SERVICE] SMTP delivery error:", err.message);
      return {
        success: false,
        provider: "custom_smtp",
        error: err.message || "Failed to send email via SMTP.",
      };
    }
  },
};
