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
  const androidJsonPath =
    process.env.GOOGLE_SERVICES_JSON ?? "./customer-google-services.json";

  const ios: Record<string, unknown> = {
    supportsTablet: true,
    bundleIdentifier: "com.a3billiards.customerapp",
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
    package: "com.a3billiards.customerapp",
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: "pan",
  };
  if (typeof androidJsonPath === "string" && androidJsonPath.length > 0) {
    android.googleServicesFile = androidJsonPath;
  }

  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const sentryEnabled =
    typeof sentryDsn === "string" &&
    sentryDsn.startsWith("https://") &&
    !sentryDsn.includes("xxxx");

  const isDevClientBuild = process.env.EAS_BUILD_PROFILE === "development";

  const plugins: (string | [string, Record<string, unknown>])[] = [
    ...(isDevClientBuild ? (["expo-dev-client"] as const) : []),
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0D1117",
        image: "./assets/images/icon.png",
        imageWidth: 200,
      },
    ],
    "expo-router",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow A3 Billiards to use your location to find clubs near you.",
      },
    ],
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 31,
        },
      },
    ],
    "@react-native-google-signin/google-signin",
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#43A047",
        defaultChannel: "default",
      },
    ],
  ];
  if (sentryEnabled) {
    plugins.splice(5, 0, "@sentry/react-native/expo");
  }

  return {
    name: "A3 Billiards",
    slug: "a3-billiards-customer",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "a3customer",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    owner: "a3333",
    icon: "./assets/images/icon.png",
    splash: {
      image: "./assets/images/icon.png",
      resizeMode: "contain",
      backgroundColor: "#0D1117",
    },
    ios,
    android: {
      ...android,
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#0D1117",
      },
    },
    plugins,
    experiments: {
      typedRoutes: false,
    },
    extra: {
      router: {},
      eas: {
        projectId: "b66e7417-e0e5-4276-9552-75e7c06b4138",
      },
    },
  };
};
