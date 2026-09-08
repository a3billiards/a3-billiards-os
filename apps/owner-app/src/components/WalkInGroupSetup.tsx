import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  ScrollView,
} from "react-native";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, radius } from "@a3/ui/theme";

export type PlayerSide = "sideA" | "sideB";

export type GroupPlayer = {
  key: string;
  customerId: Id<"users">;
  displayName: string;
  phone: string;
  side: PlayerSide;
};

type TFn = (key: string, opts?: Record<string, unknown>) => string;

type Props = {
  players: GroupPlayer[];
  primaryCustomerId: Id<"users"> | null;
  playMode: "casual" | "versus";
  losersPay: boolean;
  onPlayModeChange: (next: "casual" | "versus") => void;
  onLosersPayChange: (next: boolean) => void;
  onSideChange: (customerId: Id<"users">, side: PlayerSide) => void;
  onRemove: (customerId: Id<"users">) => void;
  onAddTeammate: () => void;
  onRegisterTeammate: () => void;
  onStart: () => void;
  onBack: () => void;
  startDisabled?: boolean;
  validationError?: string | null;
  t: TFn;
};

export function WalkInGroupSetup({
  players,
  primaryCustomerId,
  playMode,
  losersPay,
  onPlayModeChange,
  onLosersPayChange,
  onSideChange,
  onRemove,
  onAddTeammate,
  onRegisterTeammate,
  onStart,
  onBack,
  startDisabled,
  validationError,
  t,
}: Props): React.JSX.Element {
  const teammates = players.filter((p) => p.customerId !== primaryCustomerId);

  return (
    <ScrollView
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <Text style={styles.title}>{t("ownerApp.slots.groupSetupTitle")}</Text>
      <Text style={styles.hint}>{t("ownerApp.slots.groupSetupHint")}</Text>

      <Text style={styles.sectionLabel}>{t("ownerApp.slots.primaryPlayer")}</Text>
      {players
        .filter((p) => p.customerId === primaryCustomerId)
        .map((p) => (
          <View key={p.key} style={styles.playerRow}>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{p.displayName}</Text>
              <Text style={styles.playerPhone}>{p.phone}</Text>
            </View>
            {playMode === "versus" ? (
              <View style={styles.sideRow}>
                {(["sideA", "sideB"] as const).map((side) => (
                  <Pressable
                    key={side}
                    style={[
                      styles.sideChip,
                      p.side === side && styles.sideChipOn,
                    ]}
                    onPress={() => onSideChange(p.customerId, side)}
                  >
                    <Text
                      style={[
                        styles.sideChipText,
                        p.side === side && styles.sideChipTextOn,
                      ]}
                    >
                      {side === "sideA"
                        ? t("ownerApp.slots.sideA")
                        : t("ownerApp.slots.sideB")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}

      {teammates.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionGap]}>
            {t("ownerApp.slots.teammates")}
          </Text>
          {teammates.map((p) => (
            <View key={p.key} style={styles.playerRow}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{p.displayName}</Text>
                <Text style={styles.playerPhone}>{p.phone}</Text>
              </View>
              {playMode === "versus" ? (
                <View style={styles.sideRow}>
                  {(["sideA", "sideB"] as const).map((side) => (
                    <Pressable
                      key={side}
                      style={[
                        styles.sideChip,
                        p.side === side && styles.sideChipOn,
                      ]}
                      onPress={() => onSideChange(p.customerId, side)}
                    >
                      <Text
                        style={[
                          styles.sideChipText,
                          p.side === side && styles.sideChipTextOn,
                        ]}
                      >
                        {side === "sideA"
                          ? t("ownerApp.slots.sideA")
                          : t("ownerApp.slots.sideB")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Pressable onPress={() => onRemove(p.customerId)} hitSlop={8}>
                <Text style={styles.removeText}>{t("ownerApp.slots.removePlayer")}</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      <View style={styles.actionStack}>
        <Pressable
          style={({ pressed }) => [
            styles.btnSecondary,
            pressed && styles.pressed,
          ]}
          onPress={onAddTeammate}
        >
          <Text style={styles.btnSecondaryText}>{t("ownerApp.slots.addTeammate")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.btnSecondary,
            pressed && styles.pressed,
          ]}
          onPress={onRegisterTeammate}
        >
          <Text style={styles.btnSecondaryText}>
            {t("ownerApp.slots.registerTeammateWhatsApp")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleCopy}>
          <Text style={styles.toggleTitle}>{t("ownerApp.slots.playVersus")}</Text>
          <Text style={styles.toggleHint}>{t("ownerApp.slots.playVersusHint")}</Text>
        </View>
        <Switch
          value={playMode === "versus"}
          onValueChange={(on) => onPlayModeChange(on ? "versus" : "casual")}
          trackColor={{ false: colors.bg.tertiary, true: colors.accent.green }}
        />
      </View>

      {playMode === "versus" ? (
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>{t("ownerApp.slots.losersPay")}</Text>
            <Text style={styles.toggleHint}>{t("ownerApp.slots.losersPayHint")}</Text>
          </View>
          <Switch
            value={losersPay}
            onValueChange={onLosersPayChange}
            trackColor={{ false: colors.bg.tertiary, true: colors.accent.green }}
          />
        </View>
      ) : null}

      {validationError ? (
        <Text style={styles.err}>{validationError}</Text>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.btnPrimary,
          (startDisabled || pressed) && styles.pressed,
          startDisabled && styles.btnDisabled,
        ]}
        disabled={startDisabled}
        onPress={onStart}
      >
        <Text style={styles.btnPrimaryText}>{t("ownerApp.slots.startSession")}</Text>
      </Pressable>

      <View style={styles.footerRow}>
        <Pressable
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
          onPress={onBack}
        >
          <Text style={styles.btnSecondaryText}>{t("ownerApp.slots.back")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  hint: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[4],
  },
  sectionLabel: {
    ...typography.label,
    color: colors.text.muted,
    marginBottom: spacing[2],
  },
  sectionGap: { marginTop: spacing[3] },
  playerRow: {
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  playerInfo: { gap: spacing[1] },
  playerName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: "600",
  },
  playerPhone: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  sideRow: { flexDirection: "row", gap: spacing[2] },
  sideChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  sideChipOn: {
    backgroundColor: colors.accent.green,
    borderColor: colors.accent.green,
  },
  sideChipText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  sideChipTextOn: { color: "#000", fontWeight: "600" },
  removeText: {
    ...typography.caption,
    color: colors.status.error,
  },
  actionStack: { gap: spacing[2], marginVertical: spacing[4] },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  toggleCopy: { flex: 1 },
  toggleTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: "600",
  },
  toggleHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  err: {
    ...typography.bodySmall,
    color: colors.status.error,
    marginBottom: spacing[3],
  },
  btnPrimary: {
    backgroundColor: colors.accent.green,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    alignItems: "center",
    marginTop: spacing[2],
  },
  btnPrimaryText: {
    ...typography.button,
    color: "#000",
    fontWeight: "700",
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    alignItems: "center",
  },
  btnSecondaryText: {
    ...typography.button,
    color: colors.text.primary,
  },
  footerRow: { marginTop: spacing[3] },
  pressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
});
