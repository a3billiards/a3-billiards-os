import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors, typography, spacing, radius, glass } from "../theme";
import { changeLanguage, getCurrentLanguage, isAppLocale, type AppLocale } from "@a3/i18n";

const LANGS = [
  { code: "en", name: "English" },
  { code: "ar", name: "العربية" },
  { code: "hi", name: "हिंदी" },
  { code: "kn", name: "ಕನ್ನಡ" },
  { code: "ml", name: "മലയാളം" },
  { code: "te", name: "తెలుగు" },
  { code: "ta", name: "தமிழ்" },
  { code: "fr", name: "Français" },
  { code: "nl", name: "Nederlands" },
] as const;

export function LanguageSelector(): React.JSX.Element {
  const { i18n } = useTranslation();
  const current = isAppLocale(i18n.language) ? i18n.language : getCurrentLanguage();

  return (
    <View style={styles.card}>
      {LANGS.map((l) => {
        const selected = current === l.code;
        return (
          <Pressable
            key={l.code}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              if (!isAppLocale(l.code)) return;
              void changeLanguage(l.code as AppLocale);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{l.name}</Text>
            {selected ? (
              <MaterialIcons name="check" size={22} color={colors.accent.green} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glass.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  row: {
    minHeight: 52,
    paddingHorizontal: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  rowPressed: { opacity: 0.86 },
  label: { ...typography.body, color: colors.text.primary },
  labelSelected: { fontWeight: "700" },
});
