import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { ConvexAuthProvider, type TokenStorage } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
import { StatusBar } from "expo-status-bar";
import { colors, typography } from "@a3/ui/theme";
import { SafeAreaProvider } from "react-native-safe-area-context";

try {
  void SplashScreen.preventAutoHideAsync();
} catch {}

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (
  SENTRY_DSN &&
  !SENTRY_DSN.includes("xxxx") &&
  SENTRY_DSN.startsWith("https://")
) {
  Sentry.init({
    dsn: SENTRY_DSN,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
  });
}

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

const secureStorage: TokenStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

function MissingConfigScreen() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={configErrorStyles.root}>
      <Text style={configErrorStyles.icon}>⚠️</Text>
      <Text style={configErrorStyles.heading}>Configuration Error</Text>
      <Text style={configErrorStyles.body}>
        EXPO_PUBLIC_CONVEX_URL is missing from this build. The app cannot
        connect to the backend. Please reinstall the latest build or contact
        support at support@a3billiards.com.
      </Text>
    </View>
  );
}

function SplashHider() {
  const { isLoading } = useConvexAuth();
  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);
  return null;
}

function RootLayout() {
  if (!convex) {
    return (
      <SafeAreaProvider>
        <MissingConfigScreen />
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <ConvexAuthProvider client={convex} storage={secureStorage}>
        <SplashHider />
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg.primary },
            animation: "fade",
          }}
        />
      </ConvexAuthProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);

const configErrorStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  heading: {
    ...typography.heading2,
    color: colors.status.error,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
