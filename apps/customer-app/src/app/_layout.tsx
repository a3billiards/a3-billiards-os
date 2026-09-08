import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { ConvexAuthProvider, type TokenStorage } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
import { StatusBar } from "expo-status-bar";
import { colors, typography, glass } from "@a3/ui/theme";
import { ensureI18nInitialized, useTranslation } from "@a3/i18n";
import { I18nConvexBridge } from "../lib/I18nConvexBridge";

ensureI18nInitialized();
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
  const { t } = useTranslation();
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={configErrorStyles.root}>
      <Text style={configErrorStyles.icon}>⚠️</Text>
      <Text style={configErrorStyles.heading}>{t("common.config.missingConvexTitle")}</Text>
      <Text style={configErrorStyles.body}>{t("common.config.missingConvexBody")}</Text>
    </View>
  );
}

function SplashHider() {
  const { isLoading } = useConvexAuth();
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);
  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);
  useEffect(() => {
    const t = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, []);
  return null;
}

const sentryReady =
  Boolean(SENTRY_DSN) &&
  !SENTRY_DSN.includes("xxxx") &&
  SENTRY_DSN.startsWith("https://");

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
        <I18nConvexBridge>
          <SplashHider />
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: glass.pageBgBottom },
              animation: "fade",
            }}
          />
        </I18nConvexBridge>
      </ConvexAuthProvider>
    </SafeAreaProvider>
  );
}

export default sentryReady ? Sentry.wrap(RootLayout) : RootLayout;

const configErrorStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: glass.pageBgBottom,
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
