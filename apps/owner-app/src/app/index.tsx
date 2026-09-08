import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@a3/convex/_generated/api";
import { colors } from "@a3/ui/theme";
import { useAuthUserSettled } from "@a3/ui/hooks";

export default function AuthGate() {
  const router = useRouter();
  const { signOut } = useAuthActions();
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

    if (user.role !== "owner") {
      router.replace("/login");
      return;
    }

    if (user.isFrozen) {
      void signOut().finally(() => {
        router.replace({
          pathname: "/login",
          params: { frozen: "1" },
        });
      });
      return;
    }

    if (!user.settingsPasscodeSet) {
      router.replace("/passcode-setup");
      return;
    }

    router.replace("/(tabs)/home");
  }, [isLoading, isAuthenticated, user, nullUserExpired, router, signOut]);

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
