import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors } from "@a3/ui/theme";

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

    if (user === null || user.role !== "owner") {
      router.replace("/login");
      return;
    }

    if (!user.phoneVerified && user.phone) {
      router.replace({
        pathname: "/verify-phone",
        params: { phone: user.phone },
      });
      return;
    }

    if (!user.settingsPasscodeSet) {
      router.replace("/passcode-setup");
      return;
    }

    router.replace("/(tabs)/slots");
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent.green} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
