import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors } from "@a3/ui/theme";

export default function PostLoginGate() {
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);

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

    if (!user.phoneVerified) {
      router.replace({
        pathname: "/verify-phone",
        params: { phone: user.phone ?? "" },
      });
      return;
    }

    router.replace("/(tabs)/discover");
  }, [user, router]);

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
