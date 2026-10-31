import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "@/db/types";
import { supabase } from "@/db/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null | undefined;
  profileLoading: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: (userId?: string) => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (userId?: string): Promise<Profile | null> => {
    const targetId = userId || user?.id;
    if (!targetId) {
      setProfile(null);
      setProfileLoading(false);
      return null;
    }
    setProfileLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", targetId)
        .maybeSingle();
      const p = (data as Profile) || null;
      setProfile(p);
      return p;
    } catch (err) {
      console.warn("[Auth] Failed to fetch profile:", err);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    // CRITICAL: subscribe FIRST then read session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user?.id) {
        refreshProfile(s.user.id);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user?.id) {
        refreshProfile(s.user.id);
      } else {
        setProfile(null);
      }
    });

    // Handle deep link OAuth callback on Native Android (Capacitor)
    let appUrlListener: Promise<{ remove: () => void }> | null = null;

    import("@capacitor/core").then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        appUrlListener = import("@capacitor/app").then(({ App }) => {
          return App.addListener("appUrlOpen", async (event) => {
            if (!event.url) return;

            // Check if the URL is our auth callback scheme or contains auth params
            if (
              event.url.startsWith("com.vioraa.glucolab://auth-callback") ||
              event.url.includes("access_token=") ||
              event.url.includes("code=")
            ) {
              try {
                // Close in-app browser tab if open
                try {
                  const { Browser } = await import("@capacitor/browser");
                  await Browser.close();
                } catch {}

                // 1. Check for token in hash (#access_token=...&refresh_token=...)
                if (event.url.includes("#")) {
                  const hash = event.url.substring(event.url.indexOf("#") + 1);
                  const params = new URLSearchParams(hash);
                  const accessToken = params.get("access_token");
                  const refreshToken = params.get("refresh_token");

                  if (accessToken && refreshToken) {
                    const { data, error } = await supabase.auth.setSession({
                      access_token: accessToken,
                      refresh_token: refreshToken,
                    });
                    if (!error && data.session) {
                      setSession(data.session);
                      setUser(data.session.user);
                    }
                  }
                }

                // 2. Check for PKCE code in query (?code=...)
                if (event.url.includes("code=")) {
                  const query = event.url.substring(
                    event.url.indexOf("?") !== -1 ? event.url.indexOf("?") + 1 : event.url.indexOf("code=")
                  );
                  const params = new URLSearchParams(query);
                  const code = params.get("code");
                  if (code) {
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (!error && data.session) {
                      setSession(data.session);
                      setUser(data.session.user);
                    }
                  }
                }
              } catch (err) {
                console.error("[AUTH] Error processing OAuth callback deep link:", err);
              }
            }
          });
        });
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      if (appUrlListener) {
        appUrlListener.then((l) => l.remove());
      }
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      import("@/features/notifications").then(({ notificationService }) => {
        notificationService.initialize(user.id).catch((err) => {
          console.warn("[Auth] Notification service initialization deferred:", err);
        });
      });
    }
  }, [user?.id]);

  const signOut = useCallback(async () => {
    // 1. Immediately clean up document body locks (in case a Radix Dialog/Sheet was open)
    if (typeof window !== "undefined") {
      try {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
        document.body.removeAttribute("data-scroll-locked");
        sessionStorage.clear();
      } catch {}
    }

    // 2. Clear state immediately so UI updates instantaneously without waiting for network
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);

    // 3. Fire-and-forget notification cleanup in background (never block logout)
    try {
      import("@/features/notifications")
        .then(({ notificationService }) => {
          notificationService.handleSignOut().catch((err) => {
            console.warn("[Auth] Notification signout cleanup warning:", err);
          });
        })
        .catch(() => {});
    } catch {}

    // 4. Perform Supabase logout with race condition protection (max 1.5s timeout)
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: "local" }),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch (err) {
      console.warn("[Auth] Supabase signOut warning:", err);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, profile, profileLoading, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
