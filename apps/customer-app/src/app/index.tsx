import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { GlassPageBackground } from "@a3/ui/components";
import { glass } from "@a3/ui/theme";

export default function AuthGate() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (user === undefined) return;

    if (user === null || user.role !== "customer") {
      router.replace("/login");
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
  }, [isLoading, isAuthenticated, user, router]);

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
