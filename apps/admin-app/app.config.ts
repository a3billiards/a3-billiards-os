// Single source of truth. JS-parseable for EAS (no param type annotations).

export default () => {
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const sentryEnabled =
    typeof sentryDsn === "string" &&
    sentryDsn.startsWith("https://") &&
    !sentryDsn.includes("xxxx");

  const isDevClientBuild = process.env.EAS_BUILD_PROFILE === "development";

  const plugins: (string | [string, Record<string, unknown>])[] = [
    ...(isDevClientBuild ? (["expo-dev-client"] as const) : []),
    "expo-router",
    "expo-secure-store",
  ];
  if (sentryEnabled) {
    plugins.push("@sentry/react-native/expo");
  }

  return {
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
    },
    android: {
      package: "com.a3billiards.adminapp",
      edgeToEdgeEnabled: false,
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: "pan",
    },
    plugins,
    experiments: {
      typedRoutes: false,
    },
    extra: {
      router: {},
      eas: {
        projectId: "ac5e67de-bfa8-4b67-966c-74858b42b695",
      },
    },
  };
};
