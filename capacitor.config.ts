import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vioraa.glucolab",
  appName: "GlucoLab",
  webDir: "dist/client",
  server: {
    cleartext: true,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "LIGHT",
      backgroundColor: "#ffffff",
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      showSpinner: false,
      splashImmersive: false,
      splashFullScreen: false,
    },
  },
};

export default config;
