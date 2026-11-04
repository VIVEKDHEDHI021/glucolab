import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "@/db/types";
import { supabase } from "@/db/client";
import { authService } from "@/backend/services/authService";
import { dashboardCacheService } from "@/frontend/services/dashboardCacheService";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null | undefined;
  profileLoading: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: (userId?: string, explicitUser?: User | null) => Promise<Profile | null>;
}

let isSigningOutGlobal = false;
const pendingProfileFetches = new Map<string, Promise<Profile | null>>();

function getLocalProfileCache(uid: string): Profile | null {
  if (typeof window === "undefined" || !uid) return null;
  try {
    const raw = localStorage.getItem(`glucolab_profile_cache_${uid}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setLocalProfileCache(uid: string, prof: Profile): void {
  if (typeof window === "undefined" || !uid || !prof) return;
  try {
    localStorage.setItem(`glucolab_profile_cache_${uid}`, JSON.stringify(prof));
  } catch {}
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const lastProfileFetchIdRef = useRef<string | null>(null);

  const refreshProfile = useCallback(async (userId?: string, explicitUser?: User | null): Promise<Profile | null> => {
    let activeUser = explicitUser || user;
    if (!activeUser && !userId) {
      setProfile(null);
      setProfileLoading(false);
      return null;
    }

    if (!activeUser) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) activeUser = userData.user;
      } catch {}
    }

    const targetId = userId || activeUser?.id;
    if (!targetId) {
      setProfile(null);
      setProfileLoading(false);
      return null;
    }

    // Fast Path: Immediate local cache retrieval
    const cached = getLocalProfileCache(targetId);
    if (cached) {
      setProfile(cached);
    }

    // Deduplicate concurrent profile fetches for the same targetId
    if (pendingProfileFetches.has(targetId)) {
      return pendingProfileFetches.get(targetId)!;
    }

    const fetchPromise = (async () => {
      setProfileLoading(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", targetId)
          .maybeSingle();

        const meta = (activeUser?.user_metadata || {}) as any;
        const localCompleted =
          typeof window !== "undefined" &&
          (localStorage.getItem(`glucolab_onboarding_completed_${targetId}`) === "true" ||
           localStorage.getItem(`glucolab_has_logged_in_${targetId}`) === "true");

        const isReturning =
          authService.isReturningUser(activeUser, data) ||
          Boolean(data?.onboarding_completed) ||
          Boolean(meta.onboarding_completed) ||
          Boolean(meta.has_logged_in_before) ||
          localCompleted;

        const mergedProfile: Profile = {
          id: data?.id || targetId,
          user_id: targetId,
          email: data?.email || activeUser?.email || null,
          phone: data?.phone || null,
          name: data?.name || meta.full_name || meta.name || null,
          age: data?.age ?? (meta.age ? Number(meta.age) : null),
          diabetes_type: data?.diabetes_type || meta.diabetes_type || null,
          weight_kg: data?.weight_kg ?? (meta.weight_kg ? Number(meta.weight_kg) : null),
          height_cm: data?.height_cm ?? (meta.height_cm ? Number(meta.height_cm) : null),
          onboarding_completed: isReturning,
          created_at: data?.created_at || new Date().toISOString(),
          updated_at: data?.updated_at || new Date().toISOString(),
        };

        if (isReturning && activeUser) {
          authService.markUserAsLoggedIn(activeUser);
        }

        setLocalProfileCache(targetId, mergedProfile);
        setProfile(mergedProfile);
        return mergedProfile;
      } catch (err: any) {
        console.warn("[Auth] Failed to load full profile, falling back safely:", err);
        const meta = (activeUser?.user_metadata || {}) as any;
        const isReturning =
          authService.isReturningUser(activeUser, null) ||
          Boolean(meta.onboarding_completed) ||
          Boolean(meta.has_logged_in_before);

        const fallback: Profile = {
          id: targetId,
          user_id: targetId,
          email: activeUser?.email || null,
          phone: null,
          name: meta.full_name || meta.name || null,
          age: meta.age ? Number(meta.age) : null,
          diabetes_type: meta.diabetes_type || null,
          weight_kg: meta.weight_kg ? Number(meta.weight_kg) : null,
          height_cm: meta.height_cm ? Number(meta.height_cm) : null,
          onboarding_completed: isReturning,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (isReturning && activeUser) {
          authService.markUserAsLoggedIn(activeUser);
        }

        setProfile(fallback);
        return fallback;
      } finally {
        setProfileLoading(false);
        pendingProfileFetches.delete(targetId);
      }
    })();

    pendingProfileFetches.set(targetId, fetchPromise);
    return fetchPromise;
  }, [user]);

  useEffect(() => {
    // CRITICAL: subscribe FIRST then read session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (isSigningOutGlobal) {
        if (!s) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
        return;
      }
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user?.id) {
        lastProfileFetchIdRef.current = s.user.id;
        refreshProfile(s.user.id, s.user);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (isSigningOutGlobal) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user?.id) {
        // Prevent duplicate simultaneous fetch if onAuthStateChange already initiated it
        if (lastProfileFetchIdRef.current !== s.user.id) {
          lastProfileFetchIdRef.current = s.user.id;
          refreshProfile(s.user.id, s.user);
        }
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
    isSigningOutGlobal = true;
    try {
      // 1. Immediately clean up document body locks & purge storage tokens
      if (typeof window !== "undefined") {
        try {
          document.body.style.pointerEvents = "";
          document.body.style.overflow = "";
          document.body.removeAttribute("data-scroll-locked");
          sessionStorage.clear();
          for (const key of Object.keys(localStorage)) {
            if (
              (key.startsWith("sb-") && key.endsWith("-auth-token")) ||
              key.includes("supabase.auth")
            ) {
              localStorage.removeItem(key);
            }
          }
        } catch {}
      }

      // 2. Clear user-specific local storage caches & state immediately
      if (user?.id) {
        dashboardCacheService.clearAllUserCaches(user.id);
      }
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

      // 4. Perform Supabase logout with race condition protection (max 1s timeout)
      try {
        await Promise.race([
          supabase.auth.signOut({ scope: "local" }),
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ]);
      } catch (err) {
        console.warn("[Auth] Supabase signOut warning:", err);
      }
    } finally {
      setTimeout(() => {
        isSigningOutGlobal = false;
      }, 500);
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
