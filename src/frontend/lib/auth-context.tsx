import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/db/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CRITICAL: subscribe FIRST then read session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
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

  const signOut = async () => {
    try {
      const { notificationService } = await import("@/features/notifications");
      await notificationService.handleSignOut();
    } catch {}
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
