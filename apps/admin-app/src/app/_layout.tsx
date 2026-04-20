import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Stack, Redirect, useRouter, useSegments } from "expo-router";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider, useAuthActions, type TokenStorage } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
import { StatusBar } from "expo-status-bar";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, layout, radius } from "@a3/ui/theme";

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
    <View style={styles.boot}>
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

function AdminAuthShell(): React.JSX.Element {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
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
    if (isLoading) return;
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
      if (!onPublicAuthRoute) {
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
  ]);

  if (isLoading || (isAuthenticated && user === undefined)) {
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
            contentStyle: { backgroundColor: colors.bg.primary },
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
        <Text style={styles.deniedTitle}>Access Denied</Text>
        <Text style={styles.deniedBody}>
          This application is only available to A3 Billiards OS administrators.
        </Text>
        <Pressable
          style={styles.deniedBtn}
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          <Text style={styles.deniedBtnText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (!user.adminMfaVerifiedAt) {
    if (!onPublicAuthRoute) {
      return <Redirect href="/mfa" />;
    }
    return (
      <>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg.primary },
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
          contentStyle: { backgroundColor: colors.bg.primary },
          animation: "fade",
        }}
      />
    </>
  );
}

function RootLayout() {
  if (!convex) {
    return <MissingConfigScreen />;
  }
  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <AdminAuthShell />
    </ConvexAuthProvider>
  );
}

export default Sentry.wrap(RootLayout);

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
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  denied: {
    flex: 1,
    backgroundColor: colors.bg.primary,
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
