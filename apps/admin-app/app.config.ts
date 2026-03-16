import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  name: "A3 Billiards Admin",
  slug: "a3-billiards-admin",
  version: "1.0.0",

  orientation: "portrait",
  scheme: "a3admin",


  ios: {
    bundleIdentifier: "com.a3billiards.adminapp",
    googleServicesFile: "./GoogleService-Info.plist",
  },

  android: {
    package: "com.a3billiards.adminapp",
    googleServicesFile: "./google-services.json",
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    "@sentry/react-native/expo"
  ],

  experiments: {
    typedRoutes: true,
    newArchEnabled: true

  }
});

