import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, radius, spacing, typography } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";

export function LoyaltyProgrammeSettings({
  clubId,
  minBillMinutes,
}: {
  clubId: Id<"clubs">;
  minBillMinutes: number;
}): React.JSX.Element {
  const { t } = useTranslation();
  const settings = useQuery(api.loyalty.getProgrammeSettings, { clubId });
  const saveProgramme = useMutation(api.loyalty.saveProgramme);
  const archiveProgramme = useMutation(api.loyalty.archiveProgramme);

  const [name, setName] = useState("");
  const [freeVisitMax, setFreeVisitMax] = useState("60");
  const [windowDays, setWindowDays] = useState("30");
  const [thresholdMinutes, setThresholdMinutes] = useState("300");
  const [creditsAwarded, setCreditsAwarded] = useState("1");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<Id<"loyaltyProgrammes"> | undefined>();

  useEffect(() => {
    const p = settings?.active ?? settings?.drafts[0] ?? null;
    if (!p) return;
    setEditingId(p._id);
    setName(p.name);
    setFreeVisitMax(String(p.freeVisitMaxMinutes));
    const reward = p.reward;
    if (reward) {
      setWindowDays(String(reward.windowDays));
      setThresholdMinutes(String(reward.thresholdMinutes));
      setCreditsAwarded(String(reward.creditsAwarded));
    }
  }, [settings?.active?._id, settings?.drafts[0]?._id]);

  const save = async (activate: boolean) => {
    setBusy(true);
    try {
      await saveProgramme({
        clubId,
        programmeId: editingId,
        name,
        freeVisitMaxMinutes: Number(freeVisitMax),
        status: activate ? "active" : "draft",
        windowDays: Number(windowDays),
        thresholdMinutes: Number(thresholdMinutes),
        creditsAwarded: Number(creditsAwarded),
      });
      Alert.alert(
        t("ownerApp.settings.content.saved"),
        activate ? t("ownerApp.loyalty.savedActive") : t("ownerApp.loyalty.savedDraft"),
      );
    } catch (e) {
      Alert.alert(t("ownerApp.loyalty.couldNotSave"), parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (settings === undefined) {
    return <ActivityIndicator color={colors.accent.green} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        {t("ownerApp.loyalty.rewardHint", {
          freeVisitMax: freeVisitMax || "60",
          minBillMinutes,
        })}
      </Text>
      <Text style={styles.label}>{t("ownerApp.loyalty.programmeName")}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t("ownerApp.loyalty.programmeNamePlaceholder")}
      />
      <Text style={styles.label}>{t("ownerApp.loyalty.freeVisitMax")}</Text>
      <TextInput
        style={styles.input}
        value={freeVisitMax}
        onChangeText={setFreeVisitMax}
        keyboardType="number-pad"
      />
      <Text style={styles.label}>{t("ownerApp.loyalty.rollingWindow")}</Text>
      <TextInput
        style={styles.input}
        value={windowDays}
        onChangeText={setWindowDays}
        keyboardType="number-pad"
        placeholder="30"
      />
      <Text style={styles.label}>{t("ownerApp.loyalty.playMinutesNeeded")}</Text>
      <TextInput
        style={styles.input}
        value={thresholdMinutes}
        onChangeText={setThresholdMinutes}
        keyboardType="number-pad"
        placeholder="300"
      />
      <Text style={styles.label}>{t("ownerApp.loyalty.freeVisitsEarned")}</Text>
      <TextInput
        style={styles.input}
        value={creditsAwarded}
        onChangeText={setCreditsAwarded}
        keyboardType="number-pad"
        placeholder="1"
      />
      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.secondary]}
          disabled={busy}
          onPress={() => void save(false)}
        >
          <Text style={styles.secondaryText}>{t("ownerApp.loyalty.saveDraft")}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.primary]}
          disabled={busy}
          onPress={() => void save(true)}
        >
          <Text style={styles.primaryText}>
            {busy ? t("ownerApp.slots.saving") : t("ownerApp.loyalty.activate")}
          </Text>
        </Pressable>
      </View>
      {settings.active ? (
        <Pressable
          style={[styles.btn, styles.secondary, { marginTop: spacing[2] }]}
          onPress={() => {
            Alert.alert(
              t("ownerApp.loyalty.archiveTitle"),
              t("ownerApp.loyalty.archiveBody"),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("ownerApp.loyalty.archive"),
                  onPress: () => {
                    void archiveProgramme({ programmeId: settings.active!._id }).catch((e) =>
                      Alert.alert(t("ownerApp.loyalty.failed"), parseConvexError(e as Error).message),
                    );
                  },
                },
              ],
            );
          }}
        >
          <Text style={styles.secondaryText}>{t("ownerApp.loyalty.archiveActive")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2], marginTop: spacing[2] },
  hint: { ...typography.bodySmall, color: colors.text.secondary },
  label: { ...typography.labelSmall, color: colors.text.secondary, marginTop: spacing[1] },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing[2],
    color: colors.text.primary,
    backgroundColor: colors.bg.tertiary,
  },
  actions: { flexDirection: "row", gap: spacing[2], marginTop: spacing[2] },
  btn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: "center",
  },
  primary: { backgroundColor: colors.accent.green },
  secondary: { borderWidth: 1, borderColor: colors.border.default },
  primaryText: { ...typography.button, color: colors.bg.primary },
  secondaryText: { ...typography.button, color: colors.text.primary },
});
