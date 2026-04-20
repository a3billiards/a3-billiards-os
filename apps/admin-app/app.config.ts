// Single source of truth. JS-parseable for EAS (no param type annotations).
// Asset references (icon, splash, adaptiveIcon) intentionally omitted until
// real assets are added under ./assets/images/.
export default () => ({
  name: "A3 Billiards Admin",
  slug: "a3-billiards-admin",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "a3admin",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  owner: "a3333",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.a3billiards.adminapp",
    // googleServicesFile: "./GoogleService-Info.plist",
  },
  android: {
    package: "com.a3billiards.adminapp",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    // googleServicesFile: "./admin-google-services.json",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "@sentry/react-native/expo",
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    router: {},
    eas: {
      projectId: "ac5e67de-bfa8-4b67-966c-74858b42b695",
    },
  },
});
