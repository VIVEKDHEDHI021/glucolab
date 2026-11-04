import React, { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import "./startup-splash.css";

// In-memory session state: ensures animation only plays once per fresh app launch
let hasCompletedStartupSplash = false;

export function isStartupSplashCompleted(): boolean {
  return hasCompletedStartupSplash;
}

export function resetStartupSplashForTesting(): void {
  hasCompletedStartupSplash = false;
}

export interface StartupSplashProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

export function StartupSplashAnimation({
  onComplete,
  minDurationMs = 1200,
}: StartupSplashProps) {
  const [completed, setCompleted] = useState(() => hasCompletedStartupSplash);
  const [hasStaticSplash, setHasStaticSplash] = useState(() => {
    return typeof document !== "undefined" && Boolean(document.getElementById("startup-splash"));
  });
  const isFinishedRef = useRef(false);

  const finishSplash = () => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;
    hasCompletedStartupSplash = true;

    if (typeof document !== "undefined") {
      const staticSplash = document.getElementById("startup-splash");
      if (staticSplash) {
        staticSplash.classList.add("splash-finished");
        setTimeout(() => {
          try {
            staticSplash.remove();
          } catch {}
        }, 300);
      }
      document.documentElement.style.overflowY = "auto";
      document.body.style.overflowY = "auto";
    }

    setCompleted(true);
    onComplete?.();
  };

  useEffect(() => {
    // If already finished in this app session (e.g. route transitions), clean up and return immediately
    if (hasCompletedStartupSplash) {
      finishSplash();
      return;
    }

    // Check if static splash exists in DOM and listen to its animationend event
    if (typeof document !== "undefined") {
      const staticSplash = document.getElementById("startup-splash");
      if (staticSplash) {
        setHasStaticSplash(true);
        const onStaticExit = (e: AnimationEvent) => {
          if (e.animationName.includes("splashExit")) {
            finishSplash();
          }
        };
        staticSplash.addEventListener("animationend", onStaticExit);
      }
    }

    // Seamlessly hide the native Android/iOS splash screen now that our React/HTML canvas is active
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/splash-screen")
        .then(({ SplashScreen }) => {
          SplashScreen.hide({ fadeOutDuration: 0 }).catch((err) => {
            console.warn("Capacitor SplashScreen.hide error:", err);
          });
        })
        .catch(() => {});
    }

    // Check for reduced motion preference
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const duration = prefersReducedMotion ? 400 : minDurationMs;

    // Safety fallback timer: guarantees splash always dismisses even if CSS events drop
    const timer = setTimeout(() => {
      finishSplash();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [minDurationMs]);

  if (completed || hasCompletedStartupSplash) {
    return null;
  }

  // If the static splash is already in index.html, we don't need a duplicate React DOM element
  if (hasStaticSplash) {
    return null;
  }

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.animationName.includes("splashExit")) {
      finishSplash();
    }
  };

  return (
    <div
      className="splash-screen"
      onAnimationEnd={handleAnimationEnd}
      role="status"
      aria-label="GlucoLab Pro"
    >
      <div className="logo-wrapper">
        <div className="word gluco">
          <span>G</span>
          <span>L</span>
          <span>U</span>
          <span>C</span>
          <span>O</span>
        </div>
        <span className="red-plus">+</span>
        <div className="word lab">
          <span>L</span>
          <span>A</span>
          <span>B</span>
        </div>
      </div>
    </div>
  );
}
