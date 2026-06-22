import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@a3/convex/_generated/api";
import { GlassPageBackground } from "@a3/ui/components";
import { glass, typography, spacing } from "@a3/ui/theme";
import { usePushRegistration } from "../lib/usePushRegistration";

const FROZEN_MESSAGE = "Your account is frozen.";

export default function PostLoginGate() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getCurrentUser);
  usePushRegistration();

  useEffect(() => {
    if (user === undefined) return;

    if (user === null) {
      router.replace("/login");
      return;
    }

    if (user.role !== "customer") {
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

    if (!user.phoneVerified) {
      router.replace({
        pathname: "/verify-phone",
        params: { phone: user.phone ?? "" },
      });
      return;
    }

    router.replace("/(tabs)/home");
  }, [user, router, signOut]);

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
