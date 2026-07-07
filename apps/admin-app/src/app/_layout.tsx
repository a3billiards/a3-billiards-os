import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Stack, Redirect, useRouter, useSegments } from "expo-router";
import {
  ConvexReactClient,
  useConvexAuth,
  useQuery,
} from "convex/react";
import { ConvexAuthProvider, useAuthActions, type TokenStorage } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
import { StatusBar } from "expo-status-bar";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, layout, radius, glass } from "@a3/ui/theme";
import { ensureI18nInitialized, useTranslation } from "@a3/i18n";
import { I18nConvexBridge } from "../lib/I18nConvexBridge";

ensureI18nInitialized();
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AdminAuthProvider, useAdminAuth } from "../lib/adminAuth";

try {
  void SplashScreen.preventAutoHideAsync();
} catch {}

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const SENTRY_ENABLED =
  SENTRY_DSN &&
  !SENTRY_DSN.includes("xxxx") &&
  SENTRY_DSN.startsWith("https://");

if (SENTRY_ENABLED) {
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
    <View style={styles.boot}>
      <Text style={configErrorStyles.icon}>⚠️</Text>
      <Text style={configErrorStyles.heading}>{t("auth.admin.shell.configErrorTitle")}</Text>
      <Text style={configErrorStyles.body}>{t("auth.admin.shell.configErrorBody")}</Text>
    </View>
  );
}

function AdminAuthShellInner(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const { isSigningOut, signOutAdmin } = useAdminAuth();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated && !isSigningOut ? {} : "skip",
  );
  const clearedNonAdmin = useRef(false);

  const firstSegment = segments[0] ?? "";
  const onPublicAuthRoute = firstSegment === "login" || firstSegment === "mfa";

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearedNonAdmin.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || user === undefined || user === null) return;
    if (user.role !== "admin" && !clearedNonAdmin.current) {
      clearedNonAdmin.current = true;
      void signOut();
    }
  }, [isAuthenticated, user, signOut]);

  useEffect(() => {
    if (isLoading || isSigningOut) return;
    if (!isAuthenticated) {
      if (!onPublicAuthRoute) {
        router.replace("/login");
      }
      return;
    }
    if (user === undefined) return;
    if (user === null || user.role !== "admin") {
      return;
    }
    if (!user.adminMfaVerifiedAt) {
      if (firstSegment !== "mfa") {
        router.replace("/mfa");
      }
      return;
    }
    if (onPublicAuthRoute) {
      router.replace("/(tabs)");
    }
  }, [
    isLoading,
    isAuthenticated,
    user,
    onPublicAuthRoute,
    router,
    firstSegment,
    isSigningOut,
  ]);

  if (isSigningOut || isLoading || (isAuthenticated && user === undefined)) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    );
  }

  if (!isAuthenticated) {
    if (!onPublicAuthRoute) {
      return <Redirect href="/login" />;
    }
    return (
      <>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: glass.pageBgBottom },
            animation: "fade",
          }}
        />
      </>
    );
  }

  if (user === undefined) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    );
  }

  if (user === null || user.role !== "admin") {
    return (
      <View style={styles.denied}>
        <Text style={styles.deniedTitle}>{t("auth.admin.shell.accessDeniedTitle")}</Text>
        <Text style={styles.deniedBody}>{t("auth.admin.shell.accessDeniedBody")}</Text>
        <Pressable
          style={styles.deniedBtn}
          onPress={() => {
            void signOutAdmin();
          }}
        >
          <Text style={styles.deniedBtnText}>{t("auth.admin.shell.signOut")}</Text>
        </Pressable>
      </View>
    );
  }

  if (!user.adminMfaVerifiedAt) {
    if (firstSegment !== "mfa") {
      return <Redirect href="/mfa" />;
    }
    return (
      <>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: glass.pageBgBottom },
            animation: "fade",
          }}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: glass.pageBgBottom },
          animation: "fade",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="live" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="user/[userId]" />
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="mfa" options={{ animation: "fade" }} />
      </Stack>
    </>
  );
}

function AdminAuthShell(): React.JSX.Element {
  return (
    <AdminAuthProvider>
      <AdminAuthShellInner />
    </AdminAuthProvider>
  );
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
        <I18nConvexBridge>
          <AdminAuthShell />
        </I18nConvexBridge>
      </ConvexAuthProvider>
    </SafeAreaProvider>
  );
}

export default SENTRY_ENABLED ? Sentry.wrap(RootLayout) : RootLayout;

const configErrorStyles = StyleSheet.create({
  icon: { fontSize: 48, marginBottom: 16 },
  heading: {
    ...typography.heading2,
    color: colors.status.error,
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 28,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
    textAlign: "center",
    paddingHorizontal: 28,
  },
});

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: glass.pageBgBottom,
    alignItems: "center",
    justifyContent: "center",
  },
  denied: {
    flex: 1,
    backgroundColor: glass.pageBgBottom,
    padding: layout.screenPadding,
    justifyContent: "center",
  },
  deniedTitle: {
    ...typography.heading2,
    color: colors.status.error,
    marginBottom: spacing[3],
  },
  deniedBody: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing[6],
  },
  deniedBtn: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  deniedBtnText: {
    ...typography.button,
    color: colors.text.primary,
  },
});
