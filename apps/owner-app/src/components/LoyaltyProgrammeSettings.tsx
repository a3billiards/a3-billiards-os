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

export function LoyaltyProgrammeSettings({
  clubId,
  minBillMinutes,
}: {
  clubId: Id<"clubs">;
  minBillMinutes: number;
}): React.JSX.Element {
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
      Alert.alert("Saved", activate ? "Loyalty programme is now active." : "Draft saved.");
    } catch (e) {
      Alert.alert("Could not save", parseConvexError(e as Error).message);
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
        Reward regulars at this club only — credits earned here cannot be used at other
        clubs. Example: play 300 minutes (5 hours) within 30 days → earn 1 free visit (up
        to {freeVisitMax || "60"} min table time). Min free-visit cap: {minBillMinutes}{" "}
        min.
      </Text>
      <Text style={styles.label}>Programme name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="A3 Regulars" />
      <Text style={styles.label}>Free visit max minutes</Text>
      <TextInput
        style={styles.input}
        value={freeVisitMax}
        onChangeText={setFreeVisitMax}
        keyboardType="number-pad"
      />
      <Text style={styles.label}>Rolling window (days)</Text>
      <TextInput
        style={styles.input}
        value={windowDays}
        onChangeText={setWindowDays}
        keyboardType="number-pad"
        placeholder="30"
      />
      <Text style={styles.label}>Play minutes needed for reward</Text>
      <TextInput
        style={styles.input}
        value={thresholdMinutes}
        onChangeText={setThresholdMinutes}
        keyboardType="number-pad"
        placeholder="300"
      />
      <Text style={styles.label}>Free visits earned</Text>
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
          <Text style={styles.secondaryText}>Save draft</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.primary]}
          disabled={busy}
          onPress={() => void save(true)}
        >
          <Text style={styles.primaryText}>{busy ? "Saving…" : "Activate"}</Text>
        </Pressable>
      </View>
      {settings.active ? (
        <Pressable
          style={[styles.btn, styles.secondary, { marginTop: spacing[2] }]}
          onPress={() => {
            Alert.alert(
              "Archive programme?",
              "No new credits will be awarded. Existing balances stay redeemable.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Archive",
                  onPress: () => {
                    void archiveProgramme({ programmeId: settings.active!._id }).catch((e) =>
                      Alert.alert("Failed", parseConvexError(e as Error).message),
                    );
                  },
                },
              ],
            );
          }}
        >
          <Text style={styles.secondaryText}>Archive active programme</Text>
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
