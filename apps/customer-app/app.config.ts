import { ConfigContext } from "expo/config";

export default ({ config }: ConfigContext) => ({
  ...config,
  name: "A3 Billiards",
  slug: "a3-billiards-customer",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "a3customer",
  newArchEnabled: true,
  ios: {
    bundleIdentifier: "com.a3billiards.customerapp",
    googleServicesFile: "./GoogleService-Info.plist",
  },
  android: {
    package: "com.a3billiards.customerapp",
    googleServicesFile: "./google-services.json",
  },
  plugins: [
    "expo-router",
    "expo-location",
    "expo-secure-store",
    "@react-native-google-signin/google-signin",
    "@sentry/react-native/expo",
  ],
  experiments: {
    typedRoutes: false,
  },
});