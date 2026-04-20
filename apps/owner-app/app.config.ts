// Single source of truth. JS-parseable for EAS (no param type annotations).
// Asset references (icon, splash, adaptiveIcon) intentionally omitted until
// real assets are added under ./assets/images/.
export default () => ({
  name: "A3 Billiards Owner",
  slug: "a3-billiards-owner",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "a3owner",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  owner: "a3333",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.a3billiards.ownerapp",
    // googleServicesFile: "./GoogleService-Info.plist",
  },
  android: {
    package: "com.a3billiards.ownerapp",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    // googleServicesFile: "./google-services.json",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "@react-native-google-signin/google-signin",
    "@sentry/react-native/expo",
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    router: {},
    eas: {
      projectId: "4a582a61-eb81-487b-994c-3a305c88a2d5",
    },
  },
});
