import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.glucolab.app",
  appName: "GlucoLab",
  webDir: "dist/client",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      iconColor: "#0284c7",
    },
  },
};

export default config;
