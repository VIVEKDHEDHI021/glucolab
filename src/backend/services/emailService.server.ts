import nodemailer from "nodemailer";

export interface SendOtpEmailParams {
  to: string;
  code: string;
  purpose: "email_verification" | "login_verification" | "password_reset";
}

export interface SendEmailResult {
  success: boolean;
  provider: "resend" | "brevo" | "sendgrid" | "postmark" | "custom_smtp" | "dev_simulation" | "none";
  messageId?: string;
  error?: string;
}

export interface DispatchedEmailRecord {
  timestamp: number;
  to: string;
  subject: string;
  code: string;
  purpose: string;
  provider: string;
  html: string;
  text: string;
}

// In-memory audit log for verifying email delivery across tests & diagnostics
const dispatchedEmails: DispatchedEmailRecord[] = [];
let simulatedFailureState: { shouldFail: boolean; message?: string } = { shouldFail: false };

function getSenderInfo() {
  const fromName = process.env.EMAIL_FROM_NAME || "GlucoLab";
  const fromEmail =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    (process.env.RESEND_API_KEY ? "onboarding@resend.dev" : "no-reply@glucolab.app");
  
  // Format as "Name <email@domain.com>"
  const fullFrom = fromEmail.includes("<") ? fromEmail : `"${fromName}" <${fromEmail}>`;
  const cleanEmail = fromEmail.replace(/^.*<([^>]+)>.*$/, "$1").trim();
  return { fullFrom, fromName, cleanEmail };
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && user && pass) {
    return { host, port, user, pass, secure };
  }
  return null;
}

let cachedTransporter: any = null;

function getSmtpTransporter() {
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
  return cachedTransporter;
}

/**
 * Generates the clean, responsive GlucoLab branded HTML and plain-text email templates.
 */
function buildOtpEmailTemplate({
  code,
  purpose,
}: {
  code: string;
  purpose: "email_verification" | "login_verification" | "password_reset";
}) {
  const cleanCode = code.trim();
  let subject = `${cleanCode} is your GlucoLab verification code`;
  let title = "Verify Your Email";
  let actionDescription = "activate your GlucoLab account";

  if (purpose === "login_verification") {
    subject = `${cleanCode} is your GlucoLab sign-in code`;
    title = "Confirm Sign In";
    actionDescription = "complete your sign in to GlucoLab";
  } else if (purpose === "password_reset") {
    subject = `${cleanCode} is your GlucoLab password reset code`;
    title = "Reset Your Password";
    actionDescription = "reset your GlucoLab account password";
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
    .brand-icon { background: linear-gradient(135deg, #2563eb, #1d4ed8); width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; text-align: center; line-height: 44px; color: #ffffff; font-weight: 800; font-size: 22px; }
    .brand-title { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .heading { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; }
    .lead { font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; }
    .code-box { background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 16px; padding: 22px 16px; text-align: center; margin: 24px 0; }
    .code-text { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #1d4ed8; display: inline-block; }
    .notice { font-size: 13px; color: #475569; line-height: 1.5; margin: 0 0 16px 0; }
    .security-box { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px 16px; font-size: 12px; color: #92400e; line-height: 1.5; margin-bottom: 24px; }
    .footer { border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="brand-icon">G</div>
      <span class="brand-title">GlucoLab</span>
    </div>

    <h2 class="heading">${title}</h2>
    <p class="lead">
      Please enter the following 6-digit verification code to ${actionDescription}.
    </p>

    <div class="code-box">
      <span class="code-text">${cleanCode}</span>
    </div>

    <p class="notice">
      ⏳ <strong>This code is valid for 5 minutes.</strong> For your security, never share this code with anyone.
    </p>

    <div class="security-box">
      <strong>🔒 Security Warning:</strong> GlucoLab staff will never ask for your verification code. If you did not make this request, you can safely ignore this email.
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">&copy; ${new Date().getFullYear()} GlucoLab Health. Secure Diabetes Management.</p>
      <p style="margin: 0;">Designed with privacy and patient safety in mind.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
GlucoLab - ${title}
=======================================

Your 6-digit verification code is: ${cleanCode}

Enter this code to ${actionDescription}.

⏳ Validity: This code is valid for 5 minutes.
🔒 Security Notice: Never share this code with anyone. GlucoLab staff will never ask for your code.
If you did not request this verification, you can safely ignore this email.

(c) ${new Date().getFullYear()} GlucoLab Health.
  `.trim();

  return { subject, html, text };
}

export const emailService = {
  /**
   * Checks whether a transactional email delivery service is configured.
   */
  hasEmailProvider(): boolean {
    return Boolean(
      process.env.RESEND_API_KEY ||
      process.env.BREVO_API_KEY ||
      process.env.SENDGRID_API_KEY ||
      process.env.POSTMARK_SERVER_TOKEN ||
      getSmtpConfig() !== null
    );
  },

  hasCustomSmtp(): boolean {
    return getSmtpConfig() !== null;
  },

  getProviderName(): string {
    if (process.env.RESEND_API_KEY) return "resend";
    if (process.env.BREVO_API_KEY) return "brevo";
    if (process.env.SENDGRID_API_KEY) return "sendgrid";
    if (process.env.POSTMARK_SERVER_TOKEN) return "postmark";
    if (getSmtpConfig()) return "custom_smtp";
    return "dev_simulation";
  },

  /**
   * For testing: get all dispatched emails.
   */
  getAllDispatchedEmails(): readonly DispatchedEmailRecord[] {
    return dispatchedEmails;
  },

  /**
   * For testing: get the most recently dispatched email.
   */
  getLastDispatchedEmail(): DispatchedEmailRecord | undefined {
    return dispatchedEmails[dispatchedEmails.length - 1];
  },

  /**
   * For testing: clear dispatched email audit records.
   */
  clearDispatchedEmails(): void {
    dispatchedEmails.length = 0;
  },

  /**
   * For testing: configure simulated email provider failure.
   */
  setSimulatedFailure(shouldFail: boolean, message?: string): void {
    simulatedFailureState = { shouldFail, message };
  },

  /**
   * Sends the 6-digit OTP email using the best available email transport:
   * 1. Resend HTTP API (recommended for Cloudflare Workers / serverless)
   * 2. Brevo HTTP API
   * 3. SendGrid HTTP API
   * 4. Postmark HTTP API
   * 5. SMTP via Nodemailer
   * 6. Development Simulation (when no provider is configured, safe testing mode)
   */
  async sendOtpEmail({ to, code, purpose }: SendOtpEmailParams): Promise<SendEmailResult> {
    const cleanEmail = to.trim().toLowerCase();
    const cleanCode = code.trim();
    const sender = getSenderInfo();
    const { subject, html, text } = buildOtpEmailTemplate({ code: cleanCode, purpose });

    // 0. Check simulated failure override (used in automated testing)
    if (simulatedFailureState.shouldFail) {
      return {
        success: false,
        provider: "dev_simulation",
        error: simulatedFailureState.message || "Simulated email provider network failure",
      };
    }

    // 1. Resend HTTP API
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: sender.fullFrom,
            to: [cleanEmail],
            subject,
            html,
            text,
          }),
        });

        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error("[EMAIL SERVICE] Resend API error:", data.message || res.statusText);
          return {
            success: false,
            provider: "resend",
            error: data.message || `Resend delivery failed with status ${res.status}`,
          };
        }

        const record: DispatchedEmailRecord = {
          timestamp: Date.now(),
          to: cleanEmail,
          subject,
          code: cleanCode,
          purpose,
          provider: "resend",
          html,
          text,
        };
        dispatchedEmails.push(record);

        return {
          success: true,
          provider: "resend",
          messageId: data.id,
        };
      } catch (err: any) {
        console.error("[EMAIL SERVICE] Resend network error:", err.message);
        return {
          success: false,
          provider: "resend",
          error: "Failed to connect to email provider.",
        };
      }
    }

    // 2. Brevo HTTP API
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) {
      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoKey.trim(),
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: { name: sender.fromName, email: sender.cleanEmail },
            to: [{ email: cleanEmail }],
            subject,
            htmlContent: html,
            textContent: text,
          }),
        });

        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error("[EMAIL SERVICE] Brevo API error:", data.message || res.statusText);
          return {
            success: false,
            provider: "brevo",
            error: data.message || `Brevo delivery failed with status ${res.status}`,
          };
        }

        const record: DispatchedEmailRecord = {
          timestamp: Date.now(),
          to: cleanEmail,
          subject,
          code: cleanCode,
          purpose,
          provider: "brevo",
          html,
          text,
        };
        dispatchedEmails.push(record);

        return {
          success: true,
          provider: "brevo",
          messageId: data.messageId,
        };
      } catch (err: any) {
        console.error("[EMAIL SERVICE] Brevo network error:", err.message);
        return {
          success: false,
          provider: "brevo",
          error: "Failed to connect to email provider.",
        };
      }
    }

    // 3. SendGrid HTTP API
    const sendgridKey = process.env.SENDGRID_API_KEY;
    if (sendgridKey) {
      try {
        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendgridKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: cleanEmail }] }],
            from: { name: sender.fromName, email: sender.cleanEmail },
            subject,
            content: [
              { type: "text/plain", value: text },
              { type: "text/html", value: html },
            ],
          }),
        });

        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          console.error("[EMAIL SERVICE] SendGrid API error:", errData);
          return {
            success: false,
            provider: "sendgrid",
            error: "SendGrid delivery failed.",
          };
        }

        const record: DispatchedEmailRecord = {
          timestamp: Date.now(),
          to: cleanEmail,
          subject,
          code: cleanCode,
          purpose,
          provider: "sendgrid",
          html,
          text,
        };
        dispatchedEmails.push(record);

        return {
          success: true,
          provider: "sendgrid",
          messageId: res.headers.get("x-message-id") || undefined,
        };
      } catch (err: any) {
        console.error("[EMAIL SERVICE] SendGrid network error:", err.message);
        return {
          success: false,
          provider: "sendgrid",
          error: "Failed to connect to email provider.",
        };
      }
    }

    // 4. Postmark HTTP API
    const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
    if (postmarkToken) {
      try {
        const res = await fetch("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: {
            "X-Postmark-Server-Token": postmarkToken.trim(),
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            From: sender.fullFrom,
            To: cleanEmail,
            Subject: subject,
            HtmlBody: html,
            TextBody: text,
          }),
        });

        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error("[EMAIL SERVICE] Postmark API error:", data.Message || res.statusText);
          return {
            success: false,
            provider: "postmark",
            error: data.Message || `Postmark delivery failed with status ${res.status}`,
          };
        }

        const record: DispatchedEmailRecord = {
          timestamp: Date.now(),
          to: cleanEmail,
          subject,
          code: cleanCode,
          purpose,
          provider: "postmark",
          html,
          text,
        };
        dispatchedEmails.push(record);

        return {
          success: true,
          provider: "postmark",
          messageId: data.MessageID,
        };
      } catch (err: any) {
        console.error("[EMAIL SERVICE] Postmark network error:", err.message);
        return {
          success: false,
          provider: "postmark",
          error: "Failed to connect to email provider.",
        };
      }
    }

    // 5. Custom SMTP via Nodemailer
    const smtpTransporter = getSmtpTransporter();
    if (smtpTransporter) {
      try {
        const info = await smtpTransporter.sendMail({
          from: sender.fullFrom,
          to: cleanEmail,
          subject,
          html,
          text,
        });

        const record: DispatchedEmailRecord = {
          timestamp: Date.now(),
          to: cleanEmail,
          subject,
          code: cleanCode,
          purpose,
          provider: "custom_smtp",
          html,
          text,
        };
        dispatchedEmails.push(record);

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
          error: "Failed to send email via SMTP.",
        };
      }
    }

    // 6. Development Simulation & Audit Dispatch
    // When no external transactional email API or SMTP server is configured,
    // securely log dispatch and record in memory for diagnostic testing.
    console.info(`[GLUCOLAB EMAIL DISPATCH] Provider: dev_simulation | To: ${cleanEmail} | Subject: ${subject} | Code: [${cleanCode}]`);

    const record: DispatchedEmailRecord = {
      timestamp: Date.now(),
      to: cleanEmail,
      subject,
      code: cleanCode,
      purpose,
      provider: "dev_simulation",
      html,
      text,
    };
    dispatchedEmails.push(record);

    return {
      success: true,
      provider: "dev_simulation",
      messageId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  },
};
