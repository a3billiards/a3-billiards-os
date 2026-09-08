import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { GlassPageBackground } from "@a3/ui/components";
import { glass } from "@a3/ui/theme";
import { useAuthUserSettled } from "@a3/ui/hooks";

export default function AuthGate() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const nullUserExpired = useAuthUserSettled(isAuthenticated, user);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (user === undefined) return;

    if (user === null) {
      if (!nullUserExpired) return;
      router.replace("/login");
      return;
    }

    if (user.role !== "customer") {
      router.replace("/login");
      return;
    }

    if (user.isFrozen) {
      router.replace({
        pathname: "/account-blocked",
        params: { reason: "frozen" },
      });
      return;
    }

    if (user.deletionRequestedAt !== undefined) {
      router.replace({
        pathname: "/account-blocked",
        params: { reason: "deletion" },
      });
      return;
    }

    if (!user.phoneVerified) {
      router.replace({
        pathname: "/verify-phone",
        params: { phone: user.phone ?? "" },
      });
      return;
    }

    router.replace("/(tabs)/home");
  }, [isLoading, isAuthenticated, user, nullUserExpired, router]);

  return (
    <GlassPageBackground>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={glass.ctaBg} />
      </View>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
});
