// Single source of truth. JS-parseable for EAS (no param type annotations).
// Place app icons under ./assets/images/ (icon.png).

import fs from "fs";
import path from "path";

function resolveAsset(relativePath: string): string | undefined {
  const absolutePath = path.join(__dirname, relativePath);
  return fs.existsSync(absolutePath) ? relativePath : undefined;
}

export default () => {
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const sentryEnabled =
    typeof sentryDsn === "string" &&
    sentryDsn.startsWith("https://") &&
    !sentryDsn.includes("xxxx");
  const isDevClientBuild = process.env.EAS_BUILD_PROFILE === "development";
  const appIcon = resolveAsset("assets/images/icon.png");

  const plugins: (string | [string, Record<string, unknown>])[] = [
    ...(isDevClientBuild ? (["expo-dev-client"] as const) : []),
    ...(appIcon
      ? ([
          [
            "expo-splash-screen",
            {
              backgroundColor: "#0D1117",
              image: appIcon,
              imageWidth: 200,
            },
          ],
        ] as const)
      : []),
    "expo-router",
    "expo-localization",
    "expo-secure-store",
  ];
  if (sentryEnabled) {
    plugins.push("@sentry/react-native/expo");
  }

  return {
    name: "A3 Billiards Admin",
    slug: "a3-billiards-admin",
    version: "1.0.1",
    orientation: "portrait",
    scheme: "a3admin",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    owner: "a3333",
    ...(appIcon
      ? {
          icon: appIcon,
          splash: {
            image: appIcon,
            resizeMode: "contain",
            backgroundColor: "#0D1117",
          },
        }
      : {}),
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.a3billiards.adminapp",
    },
    android: {
      package: "com.a3billiards.adminapp",
      versionCode: 2,
      edgeToEdgeEnabled: false,
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: "pan",
      ...(appIcon
        ? {
            adaptiveIcon: {
              foregroundImage: appIcon,
              backgroundColor: "#0D1117",
            },
          }
        : {}),
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
