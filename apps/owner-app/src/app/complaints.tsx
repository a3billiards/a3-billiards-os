import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { getActiveRoleId } from "../lib/activeRoleStorage";

type ComplaintType =
  | "violent_behaviour"
  | "theft"
  | "runaway_without_payment"
  | "late_credit_payment";

const TYPE_ORDER: ComplaintType[] = [
  "violent_behaviour",
  "theft",
  "runaway_without_payment",
  "late_credit_payment",
];

const TYPE_LABELS: Record<ComplaintType, string> = {
  violent_behaviour: "Violent Behaviour",
  theft: "Theft",
  runaway_without_payment: "Runaway Without Payment",
  late_credit_payment: "Late Credit Payment",
};

const TYPE_SUB: Record<ComplaintType, string> = {
  violent_behaviour: "Physical altercation or threatening conduct",
  theft: "Suspected or confirmed theft of property",
  runaway_without_payment: "Left without settling the bill",
  late_credit_payment: "Outstanding credit balance not settled",
};

function badgeStyle(t: ComplaintType): { bg: string; fg: string } {
  switch (t) {
    case "violent_behaviour":
      return { bg: colors.status.error, fg: colors.text.primary };
    case "theft":
      return { bg: colors.accent.amber, fg: colors.bg.primary };
    case "runaway_without_payment":
      return { bg: colors.accent.amberLight, fg: colors.bg.primary };
    case "late_credit_payment":
      return { bg: colors.status.info, fg: colors.text.primary };
    default:
      return { bg: colors.status.disabled, fg: colors.text.primary };
  }
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0]! + p[p.length - 1]![0]!).toUpperCase();
}

function formatSessionDate(endTime: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(endTime));
}

function formatRelativeTime(createdAt: number): string {
  const sec = Math.floor((Date.now() - createdAt) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 60) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.floor(day / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

type EnrichedComplaint = {
  _id: Id<"complaints">;
  type: ComplaintType;
  typeLabel: string;
  description: string;
  status: "active" | "retracted";
  createdAt: number;
  removedAt: number | null;
  dismissalReason: string | null;
  sessionId: Id<"sessions"> | null;
  customer: { _id: Id<"users"> | null; name: string; phone: string | null };
};

export default function ComplaintsScreen(): React.JSX.Element {
  const router = useRouter();
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const clubId = dashboard?.clubId;

  const [roleId, setRoleId] = useState<Id<"staffRoles"> | undefined>(undefined);
  useEffect(() => {
    void getActiveRoleId().then((v) => {
      if (v) setRoleId(v as Id<"staffRoles">);
    });
  }, []);

  const access = useQuery(
    api.complaints.getComplaintsTabAccess,
    clubId ? { clubId, roleId } : "skip",
  );

  const list = useQuery(
    api.complaints.getClubComplaints,
    clubId ? { clubId, roleId } : "skip",
  );

  const [segment, setSegment] = useState<"active" | "retracted">("active");
  const [fileOpen, setFileOpen] = useState(false);
  const [fileStep, setFileStep] = useState<1 | 2>(1);
  const [phoneInput, setPhoneInput] = useState("");
  const [debouncedPhone, setDebouncedPhone] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPhone(phoneInput.trim()), 300);
    return () => clearTimeout(t);
  }, [phoneInput]);

  const phoneReady = /^\+91\d{10}$/.test(debouncedPhone);
  const search = useQuery(
    api.complaints.searchCustomerByPhone,
    phoneReady ? { phone: debouncedPhone } : "skip",
  );

  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [complaintType, setComplaintType] = useState<ComplaintType | null>(null);
  const [details, setDetails] = useState("");
  const [linkSession, setLinkSession] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<
    Id<"sessions"> | undefined
  >(undefined);

  const recentSessions = useQuery(
    api.complaints.getRecentCustomerSessionsForComplaint,
    clubId && selectedUserId && linkSession
      ? { clubId, customerId: selectedUserId, roleId }
      : "skip",
  );

  const fileComplaint = useMutation(api.complaints.fileComplaint);
  const retractComplaint = useMutation(api.complaints.retractComplaint);

  const [retractTarget, setRetractTarget] = useState<EnrichedComplaint | null>(null);
  const [retractReason, setRetractReason] = useState("");
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const activeRows = useMemo(
    () => (list ?? []).filter((c) => c.status === "active") as EnrichedComplaint[],
    [list],
  );
  const retractedRows = useMemo(
    () => (list ?? []).filter((c) => c.status === "retracted") as EnrichedComplaint[],
    [list],
  );

  const rows = segment === "active" ? activeRows : retractedRows;

  const resetFileSheet = useCallback(() => {
    setFileStep(1);
    setPhoneInput("");
    setDebouncedPhone("");
    setSelectedUserId(null);
    setSelectedName("");
    setComplaintType(null);
    setDetails("");
    setLinkSession(false);
    setSelectedSessionId(undefined);
  }, []);

  const openFile = useCallback(() => {
    resetFileSheet();
    setFileOpen(true);
  }, [resetFileSheet]);

  const closeFile = useCallback(() => {
    setFileOpen(false);
    resetFileSheet();
  }, [resetFileSheet]);

  const onSubmitFile = useCallback(async () => {
    if (!clubId || !selectedUserId || !complaintType) return;
    const d = details.trim();
    if (!d) {
      Alert.alert("Missing details", "Please describe the incident.");
      return;
    }
    setSubmitting(true);
    try {
      await fileComplaint({
        clubId,
        userId: selectedUserId,
        type: complaintType,
        description: d,
        sessionId: linkSession ? selectedSessionId : undefined,
        roleId,
      });
      closeFile();
      Alert.alert("Done", `Complaint filed against ${selectedName}.`);
    } catch (e) {
      Alert.alert("Error", parseConvexError(e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [
    clubId,
    selectedUserId,
    complaintType,
    details,
    linkSession,
    selectedSessionId,
    roleId,
    fileComplaint,
    closeFile,
    selectedName,
  ]);

  const onConfirmRetract = useCallback(async () => {
    if (!retractTarget) return;
    const reason = retractReason.trim();
    if (reason.length > 500) {
      Alert.alert("Too long", "Reason must be at most 500 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await retractComplaint({
        complaintId: retractTarget._id,
        dismissalReason: reason.length > 0 ? reason : undefined,
        roleId,
      });
      setRetractTarget(null);
      setRetractReason("");
      Alert.alert("Done", "Complaint retracted.");
    } catch (e) {
      Alert.alert("Error", parseConvexError(e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [retractTarget, retractReason, roleId, retractComplaint]);

  if (dashboard === undefined || access === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  if (!clubId || !access.canView) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)/slots")
          }
          style={styles.backRow}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.deniedBox}>
          <MaterialIcons name="lock" size={48} color={colors.text.secondary} />
          <Text style={styles.deniedTitle}>
            Your current role does not have access to the Complaints tab.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const canFile = access.canFile;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Complaints</Text>
          <View style={styles.countRow}>
            <View style={[styles.pill, styles.pillActive]}>
              <Text style={styles.pillTxtActive}>{activeRows.length} Active</Text>
            </View>
            <View style={[styles.pill, styles.pillRetracted]}>
              <Text style={styles.pillTxtRetracted}>
                {retractedRows.length} Retracted
              </Text>
            </View>
          </View>
        </View>
        {canFile ? (
          <Pressable style={styles.fileBtn} onPress={openFile}>
            <Text style={styles.fileBtnTxt}>+ File Complaint</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.seg}>
        <Pressable
          style={[styles.segBtn, segment === "active" && styles.segBtnOn]}
          onPress={() => setSegment("active")}
        >
          <Text style={[styles.segTxt, segment === "active" && styles.segTxtOn]}>
            Active
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, segment === "retracted" && styles.segBtnOn]}
          onPress={() => setSegment("retracted")}
        >
          <Text
            style={[styles.segTxt, segment === "retracted" && styles.segTxtOn]}
          >
            Retracted
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {list === undefined ? (
          <ActivityIndicator color={colors.accent.green} style={{ marginTop: 24 }} />
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons
              name={segment === "active" ? "inbox" : "history"}
              size={40}
              color={colors.text.secondary}
            />
            <Text style={styles.emptyTxt}>
              {segment === "active"
                ? "No active complaints filed by your club."
                : "No retracted complaints."}
            </Text>
          </View>
        ) : (
          rows.map((c) => {
            const expanded = expandedDesc[c._id] === true;
            const muted = c.status === "retracted";
            const bs = muted
              ? { bg: colors.status.disabled, fg: colors.text.primary }
              : badgeStyle(c.type);
            return (
              <View key={c._id} style={styles.card}>
                <View style={[styles.typeBadge, { backgroundColor: bs.bg }]}>
                  <Text style={[styles.typeBadgeTxt, { color: bs.fg }]}>{c.typeLabel}</Text>
                </View>
                <View style={styles.cardRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTxt}>{initials(c.customer.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.custName}>{c.customer.name}</Text>
                    {c.customer.phone ? (
                      <Text style={styles.phone}>{c.customer.phone}</Text>
                    ) : null}
                  </View>
                </View>
                <Text
                  style={styles.desc}
                  numberOfLines={expanded ? undefined : 3}
                  ellipsizeMode="tail"
                >
                  {c.description}
                </Text>
                {c.description.length > 120 ? (
                  <Pressable onPress={() => setExpandedDesc((m) => ({ ...m, [c._id]: !expanded }))}>
                    <Text style={styles.more}>{expanded ? "Show less" : "Show more"}</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.filed}>Filed {formatRelativeTime(c.createdAt)}</Text>
                {c.status === "retracted" && c.removedAt != null ? (
                  <Text style={styles.filed}>
                    Retracted {formatRelativeTime(c.removedAt)}
                  </Text>
                ) : null}
                {c.dismissalReason ? (
                  <Text style={styles.reason}>
                    Reason: {c.dismissalReason}
                  </Text>
                ) : null}
                {c.status === "active" && canFile ? (
                  <View style={styles.retractRow}>
                    <Pressable
                      style={styles.retractBtn}
                      onPress={() => setRetractTarget(c)}
                    >
                      <Text style={styles.retractBtnTxt}>Retract</Text>
                    </Pressable>
                  </View>
                ) : c.status === "active" && !canFile ? (
                  <View style={styles.lockRow}>
                    <MaterialIcons name="lock" size={16} color={colors.text.secondary} />
                    <Text style={styles.lockTxt}>Owner only</Text>
                  </View>
                ) : (
                  <Text style={styles.retractedLbl}>Retracted</Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={fileOpen} transparent animationType="slide">
        <Pressable style={styles.scrim} onPress={closeFile}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.sheetTitle}>
              {fileStep === 1 ? "Find customer" : "Complaint details"}
            </Text>
            {fileStep === 1 ? (
              <>
                <Text style={styles.lbl}>Enter customer phone number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+91xxxxxxxxxx"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="phone-pad"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  autoCapitalize="none"
                />
                {search === undefined && phoneReady ? (
                  <ActivityIndicator color={colors.accent.green} />
                ) : search && !search.ok ? (
                  <Text style={styles.warn}>{search.message}</Text>
                ) : search?.ok ? (
                  <View style={styles.foundCard}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarTxt}>{initials(search.user.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.custName}>{search.user.name}</Text>
                      <Text style={styles.phone}>{search.user.phone}</Text>
                      {search.user.activeComplaintCount > 0 ? (
                        <Text style={styles.warnSmall}>
                          {"\u26A0"} {search.user.activeComplaintCount} existing complaint(s)
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                <Pressable
                  style={[
                    styles.primaryBtn,
                    (!search?.ok || !phoneReady) && styles.btnDisabled,
                  ]}
                  disabled={!search?.ok || !phoneReady}
                  onPress={() => {
                    if (search?.ok) {
                      setSelectedUserId(search.user._id);
                      setSelectedName(search.user.name);
                      setFileStep(2);
                    }
                  }}
                >
                  <Text style={styles.primaryBtnTxt}>Next</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.lbl}>Type</Text>
                <View style={styles.grid2}>
                  {TYPE_ORDER.map((t) => {
                    const sel = complaintType === t;
                    const b = badgeStyle(t);
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setComplaintType(t)}
                        style={[
                          styles.typeCard,
                          {
                            borderColor: sel ? b.bg : colors.border.default,
                            borderWidth: sel ? 2 : 1,
                          },
                        ]}
                      >
                        <Text style={styles.typeCardTitle}>{TYPE_LABELS[t]}</Text>
                        <Text style={styles.typeCardSub}>{TYPE_SUB[t]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.lbl}>Details</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Describe the incident..."
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  value={details}
                  onChangeText={setDetails}
                />
                <View style={styles.linkRow}>
                  <Text style={styles.lbl}>Link to a session?</Text>
                  <Switch value={linkSession} onValueChange={setLinkSession} />
                </View>
                {linkSession && selectedUserId && clubId ? (
                  recentSessions === undefined ? (
                    <ActivityIndicator color={colors.accent.green} />
                  ) : (
                    <View style={styles.sessionList}>
                      {recentSessions.map((s) => (
                        <Pressable
                          key={s.sessionId}
                          style={[
                            styles.sessionRow,
                            selectedSessionId === s.sessionId && styles.sessionRowOn,
                          ]}
                          onPress={() => setSelectedSessionId(s.sessionId)}
                        >
                          <Text style={styles.sessionTxt}>
                            {s.tableLabel} · {formatSessionDate(s.endTime)}
                            {s.billTotal != null
                              ? ` · ${s.currency} ${s.billTotal.toFixed(0)}`
                              : ""}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )
                ) : null}
                <View style={styles.sheetActions}>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => setFileStep(1)}
                  >
                    <Text style={styles.secondaryBtnTxt}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      (!complaintType || !details.trim() || submitting) && styles.btnDisabled,
                    ]}
                    disabled={!complaintType || !details.trim() || submitting}
                    onPress={() => void onSubmitFile()}
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.bg.primary} />
                    ) : (
                      <Text style={styles.primaryBtnTxt}>File Complaint</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
            <Pressable onPress={closeFile} style={styles.cancelTxtWrap}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={retractTarget !== null} transparent animationType="fade">
        <Pressable style={styles.scrim} onPress={() => !submitting && setRetractTarget(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.sheetTitle}>Retract Complaint?</Text>
            <Text style={styles.modalBody}>
              This will remove the {retractTarget?.typeLabel} flag from{" "}
              {retractTarget?.customer.name}&apos;s record. Other clubs will no longer see this
              complaint.
            </Text>
            <Text style={styles.lbl}>Reason (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Reason…"
              placeholderTextColor={colors.text.tertiary}
              multiline
              maxLength={500}
              value={retractReason}
              onChangeText={setRetractReason}
            />
            <Text style={styles.counter}>{retractReason.length}/500</Text>
            <View style={styles.sheetActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setRetractTarget(null)}
                disabled={submitting}
              >
                <Text style={styles.secondaryBtnTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.dangerBtn, submitting && styles.btnDisabled]}
                disabled={submitting}
                onPress={() => void onConfirmRetract()}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.dangerBtnTxt}>Confirm Retract</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    gap: spacing[2],
  },
  backText: { ...typography.body, color: colors.text.primary },
  deniedBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[8],
    gap: spacing[4],
  },
  deniedTitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    gap: spacing[3],
  },
  title: { ...typography.heading3, color: colors.text.primary },
  countRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[2] },
  pill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 999,
  },
  pillActive: { backgroundColor: colors.status.error },
  pillTxtActive: { ...typography.caption, color: colors.text.primary, fontWeight: "600" },
  pillRetracted: { backgroundColor: colors.status.disabled },
  pillTxtRetracted: { ...typography.caption, color: colors.text.primary },
  fileBtn: {
    backgroundColor: colors.accent.green,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    alignSelf: "center",
  },
  fileBtnTxt: { ...typography.labelSmall, color: colors.bg.primary, fontWeight: "700" },
  seg: {
    flexDirection: "row",
    marginHorizontal: spacing[6],
    marginTop: spacing[4],
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: 4,
  },
  segBtn: { flex: 1, paddingVertical: spacing[2], alignItems: "center", borderRadius: radius.sm },
  segBtnOn: { backgroundColor: colors.bg.tertiary },
  segTxt: { ...typography.labelSmall, color: colors.text.secondary },
  segTxtOn: { color: colors.text.primary, fontWeight: "600" },
  scroll: { padding: spacing[6], paddingBottom: spacing[16] },
  empty: { alignItems: "center", marginTop: spacing[10], gap: spacing[3] },
  emptyTxt: { ...typography.body, color: colors.text.secondary, textAlign: "center" },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm, marginBottom: spacing[3] },
  typeBadgeTxt: { ...typography.caption, fontWeight: "700" },
  cardRow: { flexDirection: "row", gap: spacing[3], marginBottom: spacing[2] },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { ...typography.label, color: colors.text.primary },
  custName: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  phone: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 2 },
  desc: { ...typography.body, color: colors.text.primary, marginTop: spacing[2] },
  more: { ...typography.caption, color: colors.status.info, marginTop: spacing[1] },
  filed: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[2] },
  reason: {
    ...typography.caption,
    color: colors.text.secondary,
    fontStyle: "italic",
    marginTop: spacing[1],
  },
  retractRow: { alignItems: "flex-end", marginTop: spacing[3] },
  retractBtn: {
    borderWidth: 1,
    borderColor: colors.status.error,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  retractBtnTxt: { ...typography.labelSmall, color: colors.status.error },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing[3] },
  lockTxt: { ...typography.caption, color: colors.text.secondary },
  retractedLbl: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[3],
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[6],
    maxHeight: "92%",
  },
  sheetTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing[4] },
  lbl: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing[1] },
  input: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  warn: { ...typography.bodySmall, color: colors.status.error, marginBottom: spacing[2] },
  warnSmall: { ...typography.caption, color: colors.accent.amber, marginTop: spacing[1] },
  foundCard: {
    flexDirection: "row",
    gap: spacing[3],
    backgroundColor: colors.bg.tertiary,
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[4],
  },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginBottom: spacing[3] },
  typeCard: {
    width: "48%",
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
    minHeight: 88,
  },
  typeCardTitle: { ...typography.labelSmall, color: colors.text.primary, fontWeight: "700" },
  typeCardSub: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[1] },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[2],
  },
  sessionList: { gap: spacing[2], marginBottom: spacing[3] },
  sessionRow: {
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sessionRowOn: { borderColor: colors.accent.green },
  sessionTxt: { ...typography.caption, color: colors.text.primary },
  sheetActions: { flexDirection: "row", gap: spacing[3], marginTop: spacing[4] },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.accent.green,
    borderRadius: radius.lg,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnTxt: { ...typography.buttonLarge, color: colors.bg.primary, fontWeight: "700" },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnTxt: { ...typography.buttonLarge, color: colors.text.primary },
  dangerBtn: {
    flex: 1,
    backgroundColor: colors.status.error,
    borderRadius: radius.lg,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtnTxt: { ...typography.buttonLarge, color: colors.text.primary, fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  cancelTxtWrap: { alignItems: "center", marginTop: spacing[3] },
  cancelTxt: { ...typography.body, color: colors.text.secondary },
  counter: { ...typography.caption, color: colors.text.secondary, alignSelf: "flex-end" },
  modalBody: { ...typography.body, color: colors.text.secondary, marginBottom: spacing[3] },
});
