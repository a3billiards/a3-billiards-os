import { useEffect } from "react";
import { Stack } from "expo-router";
import {
  ConvexReactClient,
  useConvexAuth,
  useQuery,
} from "convex/react";
import { ConvexAuthProvider, type TokenStorage } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
import { StatusBar } from "expo-status-bar";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
} from "react-native";
import { api } from "@a3/convex/_generated/api";
import { colors, typography } from "@a3/ui/theme";

// Keep splash screen visible until the auth gate decides where to route.
// Wrapped in try/catch because hot reload can call this twice in dev.
try {
  void SplashScreen.preventAutoHideAsync();
} catch {}

// Initialize Sentry once at module load. The plugin in app.config.ts only
// configures the native build — Sentry.init must run at runtime to capture errors.
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
const RENEW_URL = "https://register.a3billiards.com/renew";

// Lazily create the client only if the URL is present so a missing env var
// surfaces as a clear error screen instead of a white-screen crash.
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

function FrozenScreen({ renewUrl }: { renewUrl: string }) {
  return (
    <View style={frozenStyles.root} accessibilityRole="none">
      <Text style={frozenStyles.lock} accessibilityLabel="Locked">
        🔒
      </Text>
      <Text style={frozenStyles.heading}>Subscription Ended</Text>
      <Text style={frozenStyles.body}>
        Your A3 Billiards OS subscription has expired. Renew to restore full access.
        All your data, settings, and history are intact.
      </Text>
      <Pressable
        style={({ pressed }) => [
          frozenStyles.cta,
          pressed && frozenStyles.ctaPressed,
        ]}
        onPress={() => {
          void Linking.openURL(renewUrl);
        }}
      >
        <Text style={frozenStyles.ctaText}>Renew Subscription</Text>
      </Pressable>
      <Text style={frozenStyles.support}>
        Questions? Contact support at support@a3billiards.com
      </Text>
    </View>
  );
}

function GraceSubscriptionBanner({ renewUrl }: { renewUrl: string }) {
  return (
    <View style={graceStyles.wrap}>
      <Text style={graceStyles.line}>
        ⚠ Your subscription expires soon. Renew now to avoid interruption.{" "}
        <Text
          style={graceStyles.link}
          onPress={() => {
            void Linking.openURL(renewUrl);
          }}
        >
          Renew
        </Text>
      </Text>
    </View>
  );
}

function OwnerSubscriptionShell() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const dashboard = useQuery(
    api.slotManagement.getSlotDashboard,
    isAuthenticated && user?.role === "owner" ? {} : "skip",
  );
  const clubId = dashboard?.clubId;
  const subStatus = useQuery(
    api.subscriptions.getSubscriptionStatus,
    clubId ? { clubId } : "skip",
  );

  // Hide splash once the auth state is resolved (success or anonymous).
  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (
    isAuthenticated &&
    user?.role === "owner" &&
    clubId !== undefined &&
    subStatus?.isFrozen
  ) {
    return <FrozenScreen renewUrl={RENEW_URL} />;
  }

  const showGraceBanner =
    isAuthenticated &&
    user?.role === "owner" &&
    clubId !== undefined &&
    subStatus?.isGrace === true;

  return (
    <View style={shellStyles.flex}>
      {showGraceBanner ? (
        <GraceSubscriptionBanner renewUrl={RENEW_URL} />
      ) : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.primary },
          animation: "fade",
        }}
      />
    </View>
  );
}

function RootLayout() {
  if (!convex) {
    return <MissingConfigScreen />;
  }
  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <StatusBar style="light" />
      <OwnerSubscriptionShell />
    </ConvexAuthProvider>
  );
}

export default Sentry.wrap(RootLayout);

const shellStyles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg.primary },
});

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

const frozenStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  lock: {
    fontSize: 56,
    marginBottom: 20,
  },
  heading: {
    ...typography.heading2,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 28,
  },
  cta: {
    backgroundColor: colors.accent.green,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    marginBottom: 24,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  support: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: "center",
  },
});

const graceStyles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(245, 127, 23, 0.18)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.accent.amber,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  line: {
    color: colors.accent.amberLight,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  link: {
    color: colors.accent.amberLight,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
