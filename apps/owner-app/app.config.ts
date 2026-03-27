import { ConfigContext } from "expo/config";

export default ({ config }: ConfigContext) => ({
  ...config,
  name: "A3 Billiards Owner",
  slug: "a3-billiards-owner",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "a3owner",
  newArchEnabled: true,
  ios: {
    bundleIdentifier: "com.a3billiards.ownerapp",
    googleServicesFile: "./GoogleService-Info.plist",
  },
  android: {
    package: "com.a3billiards.ownerapp",
    googleServicesFile: "./google-services.json",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "@react-native-google-signin/google-signin",
    "@sentry/react-native/expo",
  ],
  experiments: {
    typedRoutes: true,
  },
});