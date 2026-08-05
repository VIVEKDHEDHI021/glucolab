import { Capacitor } from "@capacitor/core";

export const APP_CONFIG = {
  name: "GlucoLab",
  version: "3.0.0",
  build: "3",
};

export async function getAppVersionInfo(): Promise<{ version: string; build: string }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      if (info?.version) {
        return {
          version: info.version,
          build: info.build || APP_CONFIG.build,
        };
      }
    } catch (err) {
      console.warn("[APP_CONFIG] Could not fetch native Capacitor app info:", err);
    }
  }

  return {
    version: APP_CONFIG.version,
    build: APP_CONFIG.build,
  };
}
