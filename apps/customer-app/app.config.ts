// Single source of truth. JS-parseable for EAS (no param type annotations).
// Asset references (icon, splash, adaptiveIcon) intentionally omitted until
// real assets are added under ./assets/images/.
export default () => ({
  name: "A3 Billiards",
  slug: "a3-billiards-customer",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "a3customer",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  owner: "a3333",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.a3billiards.customerapp",
    // googleServicesFile: "./GoogleService-Info.plist",
  },
  android: {
    package: "com.a3billiards.customerapp",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    // googleServicesFile: "./google-services.json",
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
  extra: {
    router: {},
    eas: {
      projectId: "b66e7417-e0e5-4276-9552-75e7c06b4138",
    },
  },
});
