import { supabase } from "@/db/client";
import { Capacitor } from "@capacitor/core";
import type { Session, User } from "@supabase/supabase-js";

export type OtpPurpose = "email_verification" | "login_verification" | "password_reset";

export const authService = {
  async signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  },

  async signUp(email: string, password: string, name?: string) {
    const cleanEmail = email.trim().toLowerCase();
    return supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: name || undefined,
          email_otp_verified: false,
          email_verified: false,
        },
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
      },
    });
  },

  async signInWithGoogle() {
    const isMobile = typeof window !== "undefined" && Capacitor.isNativePlatform();
    const redirectTo = isMobile
      ? "com.vioraa.glucolab://auth-callback"
      : `${window.location.origin}/dashboard`;

    if (isMobile) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: data.url, windowName: "_self" });
      }
      return { data, error: null };
    } else {
      return supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
    }
  },

  /**
   * Unified OTP dispatch service.
   * Sends 6-digit OTP through server-side rate-limited engine and transactional mailer.
   */
  async sendOtp(email: string, purpose: OtpPurpose): Promise<{ success: boolean; message?: string; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, purpose }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Unable to send verification code." };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      // Fallback for native platform or network fetch issues: invoke direct Supabase auth methods
      if (purpose === "password_reset") {
        const res = await supabase.auth.resetPasswordForEmail(cleanEmail);
        return { success: !res.error, error: res.error?.message };
      } else if (purpose === "login_verification") {
        const res = await supabase.auth.signInWithOtp({ email: cleanEmail, options: { shouldCreateUser: false } });
        return { success: !res.error, error: res.error?.message };
      } else {
        const res = await supabase.auth.resend({ type: "signup", email: cleanEmail });
        if (res.error) {
          const otpRes = await supabase.auth.signInWithOtp({ email: cleanEmail, options: { shouldCreateUser: false } });
          return { success: !otpRes.error, error: otpRes.error?.message || res.error?.message };
        }
        return { success: true };
      }
    }
  },

  /**
   * Unified OTP verification service.
   * Verifies 6-digit code with authentication provider and server-side engine,
   * establishing authenticated session upon successful verification.
   */
  async verifyOtp(
    email: string,
    purpose: OtpPurpose,
    token: string,
  ): Promise<{ success: boolean; session?: Session | null; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    // 1. First attempt verification against Supabase Auth provider in browser
    let sbSuccess = false;
    let sbSession: Session | null = null;
    let sbErrorMsg: string | undefined;

    try {
      if (purpose === "password_reset") {
        const { data, error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: "recovery",
        });
        if (!error) {
          sbSuccess = true;
          sbSession = data.session;
        } else {
          sbErrorMsg = error.message;
        }
      } else if (purpose === "login_verification") {
        const { data, error: emailOtpErr } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: "email",
        });
        if (!emailOtpErr) {
          sbSuccess = true;
          sbSession = data.session;
        } else {
          const { data: signupData, error: signupErr } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanToken,
            type: "signup",
          });
          if (!signupErr) {
            sbSuccess = true;
            sbSession = signupData.session;
          } else {
            sbErrorMsg = signupErr.message || emailOtpErr.message;
          }
        }
      } else if (purpose === "email_verification") {
        const { data, error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: "signup",
        });
        if (!error) {
          sbSuccess = true;
          sbSession = data.session;
        } else {
          // If signup token failed or was sent via email OTP, try type: "email"
          const { data: emailData, error: emailErr } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanToken,
            type: "email",
          });
          if (!emailErr) {
            sbSuccess = true;
            sbSession = emailData.session;
          } else {
            sbErrorMsg = emailErr.message || error.message;
          }
        }
      }
    } catch (err: any) {
      sbErrorMsg = err?.message;
    }

    if (sbSuccess) {
      // Notify server-side verification record asynchronously
      fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, purpose, code: cleanToken }),
      }).catch(() => {});

      // Synchronize confirmed state in user metadata
      try {
        await supabase.auth.updateUser({
          data: { email_otp_verified: true, email_verified: true },
        });
      } catch {}

      return { success: true, session: sbSession };
    }

    // 2. Fallback to server-side OTP engine (HMAC-SHA256, 5-min TTL, attempt limiter)
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, purpose, code: cleanToken }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        // Mark confirmed state in client metadata if session is active
        try {
          await supabase.auth.updateUser({
            data: { email_otp_verified: true, email_verified: true },
          });
        } catch {}

        return { success: true };
      }

      return {
        success: false,
        error: data.error || sbErrorMsg || "Invalid verification code. Please check and try again.",
      };
    } catch (err: any) {
      return {
        success: false,
        error: sbErrorMsg || err?.message || "Verification failed. Please try again.",
      };
    }
  },

  async requestPasswordResetOtp(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const serverResult = await this.sendOtp(cleanEmail, "password_reset");
    if (!serverResult.success) {
      return supabase.auth.resetPasswordForEmail(cleanEmail);
    }
    return { data: {}, error: null };
  },

  async verifyPasswordResetOtp(email: string, token: string) {
    const res = await this.verifyOtp(email, "password_reset", token);
    if (!res.success) {
      return { data: { user: null, session: null }, error: new Error(res.error || "Invalid code") };
    }
    return { data: {}, error: null };
  },

  async sendEmailVerificationOtp(email: string) {
    return this.sendOtp(email, "email_verification");
  },

  async verifyEmailOtp(email: string, token: string) {
    return this.verifyOtp(email, "email_verification", token);
  },

  /**
   * Helper to check whether user has verified their email address.
   * Google OAuth accounts are pre-verified by Google's trusted provider.
   * Email/password users must not have pending OTP flags and must have verified status.
   */
  isEmailVerified(user: User | null): boolean {
    if (!user) return false;

    // 1. Google OAuth accounts are pre-verified by Google
    const isGoogle =
      user.app_metadata?.provider === "google" ||
      (Array.isArray(user.app_metadata?.providers) &&
        user.app_metadata.providers.includes("google"));
    if (isGoogle) return true;

    // 2. Check if signup OTP verification is still actively pending in the current browser session
    if (typeof window !== "undefined") {
      const pendingSignupEmail = sessionStorage.getItem("pending_otp_verification");
      if (
        pendingSignupEmail &&
        user.email &&
        pendingSignupEmail.toLowerCase() === user.email.toLowerCase()
      ) {
        return false;
      }
    }

    // 3. Explicit unverified state persisted in user_metadata:
    // When a user signs up, email_otp_verified is set to false.
    // It remains false across app restarts and logins until the 6-digit OTP is verified.
    if (user.user_metadata?.email_otp_verified === false) {
      return false;
    }
    if (user.user_metadata?.email_verified === false) {
      return false;
    }

    // 4. If user has explicitly verified OTP
    if (user.user_metadata?.email_otp_verified === true) {
      return true;
    }

    // 5. For existing verified accounts (legacy accounts created before this fix),
    // if email_confirmed_at is set and email_otp_verified is not false, preserve access
    if (user.email_confirmed_at && user.user_metadata?.email_otp_verified !== false) {
      return true;
    }

    return false;
  },

  async resetPassword(email: string, redirectTo?: string) {
    return supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  },

  async updatePassword(password: string) {
    return supabase.auth.updateUser({ password });
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  async getSession() {
    return supabase.auth.getSession();
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
