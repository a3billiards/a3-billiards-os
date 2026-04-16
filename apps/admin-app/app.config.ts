// JS-parseable for EAS (no param type annotations). Not included in app `tsc` — Expo validates at prebuild.
export default ({ config }) => ({
  ...config,
  name: "A3 Billiards Admin",
  slug: "a3-billiards-admin",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "a3admin",
  newArchEnabled: true,
  ios: {
    bundleIdentifier: "com.a3billiards.adminapp",
    googleServicesFile: "./GoogleService-Info.plist",
  },
  android: {
    package: "com.a3billiards.adminapp",
    googleServicesFile: "./admin-google-services.json",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "@sentry/react-native/expo",
  ],
  experiments: {
    typedRoutes: false,
  },
});
