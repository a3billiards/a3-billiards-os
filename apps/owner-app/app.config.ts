// Single source of truth. JS-parseable for EAS (no param type annotations).
// Place app icons under ./assets/images/ (icon.png, notification-icon.png).

import fs from "fs";
import path from "path";

/** iOS URL scheme required by Google Sign-In when not using GoogleService-Info.plist. */
function googleIosUrlSchemes(): string[] {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (
    typeof iosClientId !== "string" ||
    !iosClientId.endsWith(".apps.googleusercontent.com")
  ) {
    return [];
  }
  const prefix = iosClientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return [`com.googleusercontent.apps.${prefix}`];
}

function resolveGoogleServicesJsonPath(): string | undefined {
  const candidates = [
    process.env.GOOGLE_SERVICES_JSON,
    path.join(__dirname, "owner-google-services.json"),
  ].filter((c): c is string => typeof c === "string" && c.trim().length > 0);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function resolveAsset(relativePath: string): string | undefined {
  const absolutePath = path.join(__dirname, relativePath);
  return fs.existsSync(absolutePath) ? relativePath : undefined;
}

export default () => {
  const googleSchemes = googleIosUrlSchemes();
  const plistPath = process.env.GOOGLE_SERVICE_INFO_PLIST;
  const androidJsonPath = resolveGoogleServicesJsonPath();
  /** Embed Google Maps SDK keys (EAS secrets). Required for `react-native-maps` MapView. */
  const googleMapsAndroidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const googleMapsIosKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  const isDevClientBuild = process.env.EAS_BUILD_PROFILE === "development";
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const sentryEnabled =
    typeof sentryDsn === "string" &&
    sentryDsn.startsWith("https://") &&
    !sentryDsn.includes("xxxx");
  const appIcon = resolveAsset("assets/images/icon.png");
  const notificationIcon = resolveAsset("assets/images/notification-icon.png");

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
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 31,
          softwareKeyboardLayoutMode: "resize",
        },
      },
    ],
    "./plugins/withIvsBroadcastPermissions.js",
    "@react-native-google-signin/google-signin",
    [
      "expo-camera",
      {
        cameraPermission:
          "A3 Billiards needs camera access to scan customer check-in QR codes and broadcast live games.",
        microphonePermission:
          "A3 Billiards needs microphone access to include audio in live broadcasts.",
        recordAudioAndroid: true,
      },
    ],
    [
      "expo-notifications",
      {
        ...(notificationIcon ? { icon: notificationIcon } : {}),
        color: "#43A047",
        defaultChannel: "default",
      },
    ],
  ];
  if (sentryEnabled) {
    plugins.push("@sentry/react-native/expo");
  }

  const ios: Record<string, unknown> = {
    supportsTablet: true,
    bundleIdentifier: "com.a3billiards.ownerapp",
  };
  if (typeof plistPath === "string" && plistPath.length > 0) {
    ios.googleServicesFile = plistPath;
  }
  if (typeof googleMapsIosKey === "string" && googleMapsIosKey.trim().length >= 8) {
    ios.config = { googleMapsApiKey: googleMapsIosKey.trim() };
  }
  if (googleSchemes.length > 0) {
    ios.infoPlist = {
      ...(ios.infoPlist as Record<string, unknown> | undefined),
      CFBundleURLTypes: [
        {
          CFBundleTypeRole: "Editor",
          CFBundleURLSchemes: googleSchemes,
        },
      ],
      NSCameraUsageDescription:
        "A3 Billiards needs camera access to scan customer check-in QR codes and broadcast live games.",
      NSMicrophoneUsageDescription:
        "A3 Billiards needs microphone access to include audio in live broadcasts.",
    };
  } else {
    ios.infoPlist = {
      ...(ios.infoPlist as Record<string, unknown> | undefined),
      NSCameraUsageDescription:
        "A3 Billiards needs camera access to scan customer check-in QR codes and broadcast live games.",
      NSMicrophoneUsageDescription:
        "A3 Billiards needs microphone access to include audio in live broadcasts.",
    };
  }

  const android: Record<string, unknown> = {
    package: "com.a3billiards.ownerapp",
    edgeToEdgeEnabled: false,
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: "pan",
    permissions: [
      "CAMERA",
      "RECORD_AUDIO",
      "MODIFY_AUDIO_SETTINGS",
    ],
  };
  if (androidJsonPath) {
    android.googleServicesFile = androidJsonPath;
  }
  if (
    typeof googleMapsAndroidKey === "string" &&
    googleMapsAndroidKey.trim().length >= 8
  ) {
    android.config = {
      googleMaps: { apiKey: googleMapsAndroidKey.trim() },
    };
  }

  return {
    name: "A3 Billiards Owner",
    slug: "a3-billiards-owner",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "a3owner",
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
    ios,
    android: {
      ...android,
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
        projectId: "4a582a61-eb81-487b-994c-3a305c88a2d5",
      },
    },
  };
};
