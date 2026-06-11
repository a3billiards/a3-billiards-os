import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { GlassPageBackground } from "@a3/ui/components";
import { colors, typography, spacing, layout, glass } from "@a3/ui/theme";

const ONBOARDING_URL = "https://register.a3billiards.com";

/**
 * Shown when `getSlotDashboard` is `null` (owner signed in but no `clubs` row yet).
 */
export function OwnerNoClubPlaceholder() {
  return (
    <GlassPageBackground>
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>Complete venue setup</Text>
          <Text style={styles.body}>
            Your owner account is active, but no club is linked yet. Create your venue on
            the onboarding site, then return to this app.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => {
              void Linking.openURL(ONBOARDING_URL);
            }}
            accessibilityRole="link"
            accessibilityLabel="Open owner onboarding in browser"
          >
            <Text style={styles.buttonText}>Open onboarding</Text>
          </Pressable>
        </View>
      </View>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: layout.screenPadding,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    borderRadius: glass.cardRadiusSmall,
    padding: spacing[5],
  },
  title: {
    ...typography.heading2,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing[3],
  },
  body: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing[6],
  },
  button: {
    backgroundColor: glass.ctaBg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: 12,
  },
  buttonText: {
    ...typography.label,
    color: glass.ctaText,
    textAlign: "center",
  },
  pressed: { opacity: 0.88 },
});
