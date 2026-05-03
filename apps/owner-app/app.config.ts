// Single source of truth. JS-parseable for EAS (no param type annotations).
// Asset references (icon, splash, adaptiveIcon) intentionally omitted until
// real assets are added under ./assets/images/.

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

export default () => {
  const googleSchemes = googleIosUrlSchemes();
  const plistPath = process.env.GOOGLE_SERVICE_INFO_PLIST;
  const androidJsonPath = process.env.GOOGLE_SERVICES_JSON;

  const ios: Record<string, unknown> = {
    supportsTablet: true,
    bundleIdentifier: "com.a3billiards.ownerapp",
  };
  if (typeof plistPath === "string" && plistPath.length > 0) {
    ios.googleServicesFile = plistPath;
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
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  };
  if (typeof androidJsonPath === "string" && androidJsonPath.length > 0) {
    android.googleServicesFile = androidJsonPath;
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
  };
};
