import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAction } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { colors, typography, spacing, radius } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";

export default function ChangePasscodeScreen(): React.JSX.Element {
  const router = useRouter();
  const reset = useAction(api.passcodeActions.resetPasscodeViaEmail);
  const [loading, setLoading] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.pad}>
        <Text style={styles.title}>Change settings passcode</Text>
        <Text style={styles.body}>
          To change your 6-digit settings PIN, request a reset link by email. Your current passcode will
          be cleared; you will set a new one the next time you open Settings after signing in again.
        </Text>
        <Pressable
          style={styles.primary}
          disabled={loading}
          onPress={() => {
            void (async () => {
              setLoading(true);
              try {
                await reset({});
                Alert.alert(
                  "Check your email",
                  "We sent a reset link. After resetting, set a new passcode when you open Settings.",
                  [{ text: "OK", onPress: () => router.back() }],
                );
              } catch (e) {
                Alert.alert(parseConvexError(e as Error).message);
              } finally {
                setLoading(false);
              }
            })();
          }}
        >
          {loading ? (
            <ActivityIndicator color="#0D1117" />
          ) : (
            <Text style={styles.primaryText}>Email me a reset link</Text>
          )}
        </Pressable>
        <Text style={styles.linkNote}>Forgot passcode? Use the button above — same flow.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  pad: { padding: spacing[4] },
  title: { ...typography.heading3, color: colors.text.primary },
  body: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing[3] },
  primary: {
    marginTop: spacing[6],
    backgroundColor: colors.accent.green,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { ...typography.buttonLarge, color: "#0D1117" },
  linkNote: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing[4] },
});
