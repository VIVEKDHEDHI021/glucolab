import { supabase } from "@/db/client";
import { Capacitor } from "@capacitor/core";
import type { Session, User } from "@supabase/supabase-js";

export type OtpPurpose = "email_verification" | "login_verification" | "password_reset";

export function getApiUrl(path: string): string {
  const isMobile = typeof window !== "undefined" && Capacitor.isNativePlatform();
  if (isMobile) {
    const baseUrl =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
      "https://glucolab.vioraa.workers.dev";
    return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  }
  return path;
}

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

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: "select_account",
          access_type: "offline",
        },
      },
    });

    if (error) throw error;

    if (data?.url) {
      if (isMobile) {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({
          url: data.url,
          windowName: "_blank",
          presentationStyle: "popover",
        });
      } else if (typeof window !== "undefined") {
        const width = 500;
        const height = 650;
        const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
        const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
        const popup = window.open(
          data.url,
          "google-oauth-popup",
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
        );
        if (!popup || popup.closed || typeof popup.closed === "undefined") {
          window.location.href = data.url;
        }
      }
    }
    return { data, error: null };
  },

  /**
   * Unified OTP dispatch service.
   * Sends 6-digit OTP through server-side rate-limited engine and transactional mailer.
   */
  async sendOtp(
    email: string,
    purpose: OtpPurpose,
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const targetUrl = getApiUrl("/api/auth/otp/send");
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, purpose }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            error: data.error || "Too many requests. Please wait a moment before trying again.",
          };
        }
        return {
          success: false,
          error: data.error || "We couldn't send your verification code. Please try again.",
        };
      }

      return {
        success: true,
        message: data.message || "Your verification code is on its way! Please check your inbox.",
      };
    } catch {
      return {
        success: false,
        error: "Connection issue. Please check your internet and try again.",
      };
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
      fetch(getApiUrl("/api/auth/otp/verify"), {
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
      const response = await fetch(getApiUrl("/api/auth/otp/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, purpose, code: cleanToken }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        // Mark confirmed state in client metadata if session is active
        try {
          await supabase.auth.updateUser({
            data: { email_otp_verified: true, email_verified: true },
          });
        } catch {}

        return { success: true };
      }

      let error = data.error || "That code doesn't look right. Please check and try again.";
      if (response.status === 429) {
        error = "Too many requests. Please wait a moment before trying again.";
      }
      return {
        success: false,
        error,
      };
    } catch {
      return {
        success: false,
        error: "Connection issue. Please check your internet and try again.",
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
      return { data: { user: null, session: null }, error: new Error(res.error || "That code doesn't look right. Please check and try again.") };
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
   * Terminates an active OTP verification session, clears pending storage flags,
   * invalidates backend OTP record, and safely signs out any unverified session.
   */
  async terminateOtp(email?: string, purpose?: OtpPurpose): Promise<{ success: boolean }> {
    const cleanEmail = email ? email.trim().toLowerCase() : "";
    try {
      if (cleanEmail && purpose) {
        fetch(getApiUrl("/api/auth/otp/terminate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, purpose }),
        }).catch(() => {});
      }
    } catch {}

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pending_otp_verification");
      sessionStorage.removeItem("pending_otp_purpose");
      sessionStorage.removeItem("login_otp_pending");
      sessionStorage.removeItem("otp_request_expires_at");
      sessionStorage.removeItem("otp_request_email");
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user && !this.isEmailVerified(data.session.user)) {
        await supabase.auth.signOut();
      }
    } catch {}

    return { success: true };
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

  /**
   * Helper to check whether an account is an already-registered user who has logged in before,
   * or has existing profile records/health logs, versus a brand new user needing onboarding.
   */
  isReturningUser(user: User | null, profile?: any): boolean {
    if (!user) return false;

    // 1. Explicit metadata flags indicating the user has already logged in or completed setup
    if (
      user.user_metadata?.has_logged_in_before === true ||
      user.user_metadata?.onboarding_completed === true
    ) {
      return true;
    }

    // 2. Profile object indicates completed onboarding or existing clinical details
    if (
      profile?.onboarding_completed === true ||
      Boolean(profile?.diabetes_type) ||
      (profile?.age !== null && profile?.age !== undefined) ||
      (profile?.weight_kg !== null && profile?.weight_kg !== undefined)
    ) {
      return true;
    }

    // 3. Persistent device storage flag
    if (typeof window !== "undefined") {
      try {
        const hasLoggedInLocal = localStorage.getItem(`glucolab_has_logged_in_${user.id}`);
        const onboardingLocal = localStorage.getItem(`glucolab_onboarding_completed_${user.id}`);
        if (hasLoggedInLocal === "true" || onboardingLocal === "true") {
          return true;
        }
      } catch {}
    }

    // 4. Account timestamp history in Supabase Auth:
    // If account was created more than 45 seconds ago, it is an already registered account logging in.
    if (user.created_at) {
      const createdTime = new Date(user.created_at).getTime();
      const now = Date.now();
      const lastSignInTime = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;

      if (!isNaN(createdTime) && now - createdTime > 45 * 1000) {
        return true;
      }

      if (lastSignInTime > 0 && !isNaN(lastSignInTime) && lastSignInTime - createdTime > 15 * 1000) {
        return true;
      }
    }

    return false;
  },

  /**
   * Marks a user as having logged in before in both local storage and Supabase Auth metadata.
   */
  markUserAsLoggedIn(user: User | null) {
    if (!user) return;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`glucolab_has_logged_in_${user.id}`, "true");
        localStorage.setItem(`glucolab_onboarding_completed_${user.id}`, "true");
      } catch {}
    }
    try {
      supabase.auth
        .updateUser({
          data: {
            has_logged_in_before: true,
            onboarding_completed: true,
          },
        })
        .catch(() => {});
    } catch {}
  },

  async resetPassword(email: string, redirectTo?: string) {
    return supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  },

  async updatePassword(password: string) {
    return supabase.auth.updateUser({ password });
  },

  async signOut() {
    try {
      if (typeof window !== "undefined") {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
        document.body.removeAttribute("data-scroll-locked");
        sessionStorage.clear();
      }
      return await Promise.race([
        supabase.auth.signOut({ scope: "local" }),
        new Promise<{ error: null }>((resolve) =>
          setTimeout(() => resolve({ error: null }), 1500),
        ),
      ]);
    } catch {
      return { error: null };
    }
  },

  async getSession() {
    return supabase.auth.getSession();
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
