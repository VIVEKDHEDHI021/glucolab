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
      overlaysWebView: true,
    },
  },
};

export default config;
