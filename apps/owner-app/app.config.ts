// Single source of truth. JS-parseable for EAS (no param type annotations).
// Asset references (icon, splash, adaptiveIcon) intentionally omitted until
// real assets are added under ./assets/images/.

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

export default () => {
  const googleSchemes = googleIosUrlSchemes();
  const plistPath = process.env.GOOGLE_SERVICE_INFO_PLIST;
  const androidJsonPath = resolveGoogleServicesJsonPath();
  /** Embed Google Maps SDK keys (EAS secrets). Required for `react-native-maps` MapView. */
  const googleMapsAndroidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const googleMapsIosKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  const isDevClientBuild = process.env.EAS_BUILD_PROFILE === "development";

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
      CFBundleURLTypes: [
        {
          CFBundleTypeRole: "Editor",
          CFBundleURLSchemes: googleSchemes,
        },
      ],
    };
  }

  const android: Record<string, unknown> = {
    package: "com.a3billiards.ownerapp",
    edgeToEdgeEnabled: false,
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: "pan",
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
    ios,
    android,
    plugins: [
      ...(isDevClientBuild ? (["expo-dev-client"] as const) : []),
      "expo-router",
      "expo-secure-store",
      "@react-native-google-signin/google-signin",
      [
        "expo-notifications",
        {
          color: "#43A047",
          defaultChannel: "default",
        },
      ],
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
  };
};
