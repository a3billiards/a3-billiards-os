import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { SafeLocationPicker } from "./SafeLocationPicker";
import { useRouter } from "expo-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Doc, Id } from "@a3/convex/_generated/dataModel";
import { colors, typography, spacing, radius, layout } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { getActiveRoleId, setActiveRoleId } from "../lib/activeRoleStorage";

const RENEW_URL = "https://renew.a3billiards.com";
const PREDEFINED_AMENITIES = ["AC", "Parking", "Cafe", "WiFi", "Lounge", "Restrooms"] as const;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const TAB_ORDER = ["slots", "snacks", "financials", "complaints", "bookings"] as const;
const TAB_LABEL: Record<(typeof TAB_ORDER)[number], string> = {
  slots: "Slots",
  snacks: "Snacks",
  financials: "Financials",
  complaints: "Complaints",
  bookings: "Bookings",
};
const SLOT_CHIPS: { min: number; label: string }[] = [
  { min: 30, label: "30 min" },
  { min: 60, label: "1 hour" },
  { min: 90, label: "1.5 hours" },
  { min: 120, label: "2 hours" },
  { min: 180, label: "3 hours" },
];
const DEFAULT_CENTER = { latitude: 28.6139, longitude: 77.209 };

type AccordionKey =
  | "tables"
  | "rates"
  | "staff"
  | "booking"
  | "profile"
  | "security";

function hhmmTo12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function formatSpecialWindow(start: string, end: string): string {
  return `${hhmmTo12h(start)} – ${hhmmTo12h(end)}`;
}

function dayAbbrevList(days: number[]): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order
    .filter((d) => days.includes(d))
    .map((d) => DAY_LABELS[d])
    .join(", ");
}

export default function OwnerSettingsContent(): React.JSX.Element {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getCurrentUser);
  const club = useQuery(
    api.clubProfile.getMyClubProfile,
    user?.role === "owner" ? {} : "skip",
  );
  const tables = useQuery(
    api.slots.listTablesForSettings,
    user?.role === "owner" ? {} : "skip",
  );
  const roles = useQuery(
    api.staffRoles.listStaffRoles,
    user?.role === "owner" ? {} : "skip",
  );
  const bookingPrecheck = useQuery(
    api.bookings.getBookingEnablePrecheck,
    club ? { clubId: club.clubId } : "skip",
  );

  const requestDataExport = useAction(api.ownerAccountActions.requestOwnerDataExport);

  const addTable = useMutation(api.slots.addTable);
  const renameTable = useMutation(api.slots.renameTable);
  const updateTableType = useMutation(api.slots.updateTableType);
  const disableTable = useMutation(api.slots.disableTable);
  const enableTable = useMutation(api.slots.enableTable);

  const updateBaseRate = useMutation(api.financials.updateBaseRate);
  const updateMinBillMinutes = useMutation(api.financials.updateMinBillMinutes);
  const updateCurrency = useMutation(api.financials.updateCurrency);
  const updateTimezone = useMutation(api.financials.updateTimezone);
  const addSpecialRate = useMutation(api.financials.addSpecialRate);
  const updateSpecialRate = useMutation(api.financials.updateSpecialRate);
  const deleteSpecialRate = useMutation(api.financials.deleteSpecialRate);

  const createRole = useMutation(api.staffRoles.createRole);
  const updateRole = useMutation(api.staffRoles.updateRole);
  const deleteRole = useMutation(api.staffRoles.deleteRole);
  const setActiveRoleMutation = useMutation(api.staffRoles.setActiveRole);

  const toggleBookingEnabled = useMutation(api.bookings.toggleBookingEnabled);
  const updateBookingSettings = useMutation(api.bookings.updateBookingSettings);

  const generateUploadUrl = useMutation(api.clubProfile.generateClubPhotoUploadUrl);
  const toggleDiscoverability = useMutation(api.clubProfile.toggleDiscoverability);
  const updateDescription = useMutation(api.clubProfile.updateClubDescription);
  const uploadClubPhoto = useMutation(api.clubProfile.uploadClubPhoto);
  const removeClubPhoto = useMutation(api.clubProfile.removeClubPhoto);
  const updateAmenities = useMutation(api.clubProfile.updateAmenities);
  const updateOperatingHours = useMutation(api.clubProfile.updateOperatingHours);
  const updateLocationPin = useMutation(api.clubProfile.updateLocationPin);

  const requestOwnerDeletion = useAction(api.deletionActions.requestOwnerDeletion);

  const [open, setOpen] = useState<Record<AccordionKey, boolean>>({
    tables: true,
    rates: true,
    staff: true,
    booking: true,
    profile: true,
    security: true,
  });

  const [activeRoleId, setActiveRoleIdState] = useState<Id<"staffRoles"> | null>(null);
  useEffect(() => {
    void getActiveRoleId().then((v) =>
      setActiveRoleIdState(v ? (v as Id<"staffRoles">) : null),
    );
  }, []);

  const activeRoleName = useMemo(() => {
    if (!activeRoleId || !roles) return null;
    return roles.find((r) => r._id === activeRoleId)?.name ?? null;
  }, [activeRoleId, roles]);

  const frozen = club?.subscriptionStatus === "frozen";

  const distinctActiveTableTypes = useMemo(() => {
    if (!tables) return [];
    const s = new Set<string>();
    for (const t of tables) {
      if (!t.isActive || !t.tableType) continue;
      s.add(t.tableType.trim().toLowerCase());
    }
    return [...s].sort();
  }, [tables]);

  const bookableTypesMismatch = useMemo(() => {
    if (!club || !tables) return false;
    const activeTypes = new Set(
      tables.filter((t) => t.isActive && t.tableType).map((t) => t.tableType!.toLowerCase()),
    );
    return (club.bookingSettings.bookableTableTypes ?? []).some(
      (bt) => !activeTypes.has(bt.toLowerCase()),
    );
  }, [club, tables]);

  // —— Table modals ——
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState("");
  const [newTableType, setNewTableType] = useState("");
  const [newTableFloor, setNewTableFloor] = useState("");

  const [renameOpen, setRenameOpen] = useState<Id<"tables"> | null>(null);
  const [renameLabel, setRenameLabel] = useState("");

  const [typeOpen, setTypeOpen] = useState<Id<"tables"> | null>(null);
  const [typeInput, setTypeInput] = useState("");

  // —— Special rate modal ——
  const [rateModal, setRateModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; id: string }
    | null
  >(null);
  const [srLabel, setSrLabel] = useState("");
  const [srRate, setSrRate] = useState("");
  const [srStart, setSrStart] = useState("22:00");
  const [srEnd, setSrEnd] = useState("02:00");
  const [srDays, setSrDays] = useState<number[]>([5, 6]);
  const [srError, setSrError] = useState<string | null>(null);

  // —— Role modal ——
  const [roleModal, setRoleModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; id: Id<"staffRoles"> }
    | null
  >(null);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [rName, setRName] = useState("");
  const [rTabs, setRTabs] = useState<string[]>(["slots"]);
  const [rAllTables, setRAllTables] = useState(true);
  const [rTableIds, setRTableIds] = useState<Id<"tables">[]>([]);
  const [rFileComplaints, setRFileComplaints] = useState(false);
  const [rDiscount, setRDiscount] = useState(false);
  const [rMaxDisc, setRMaxDisc] = useState("10");
  const [rTabErr, setRTabErr] = useState<string | null>(null);

  // —— Rates draft ——
  const [curDraft, setCurDraft] = useState("");
  const [baseDraft, setBaseDraft] = useState("");
  const [minBillDraft, setMinBillDraft] = useState("");
  const [tzDraft, setTzDraft] = useState("");
  const [tzFilter, setTzFilter] = useState("");
  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [] as string[];
    }
  }, []);
  const tzSuggestions = useMemo(() => {
    const q = tzFilter.trim().toLowerCase();
    if (!q) return timezones.slice(0, 40);
    return timezones.filter((t) => t.toLowerCase().includes(q)).slice(0, 60);
  }, [timezones, tzFilter]);

  // —— Booking drafts ——
  const [maxAdv, setMaxAdv] = useState("7");
  const [minAdv, setMinAdv] = useState("60");
  const [apprDead, setApprDead] = useState("60");
  const [cancelWin, setCancelWin] = useState("30");
  const [slotOpts, setSlotOpts] = useState<number[]>([30, 60, 90, 120]);
  const [bookTypes, setBookTypes] = useState<string[]>([]);
  const [bhOpen, setBhOpen] = useState("10:00");
  const [bhClose, setBhClose] = useState("22:00");
  const [bhDays, setBhDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [bookingErr, setBookingErr] = useState<string | null>(null);
  const [toggleBookingErr, setToggleBookingErr] = useState<string | null>(null);

  // —— Profile (club) local ——
  const [desc, setDesc] = useState("");
  const [amenitiesDraft, setAmenitiesDraft] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState("");
  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [opDays, setOpDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [markerCoord, setMarkerCoord] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [locationDirty, setLocationDirty] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);

  // —— Deletion ——
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!club) return;
    setCurDraft(club.currency);
    setBaseDraft(String(club.baseRatePerMin));
    setMinBillDraft(String(club.minBillMinutes));
    setTzDraft(club.timezone);
    setMaxAdv(String(club.bookingSettings.maxAdvanceDays));
    setMinAdv(String(club.bookingSettings.minAdvanceMinutes));
    setApprDead(String(club.bookingSettings.approvalDeadlineMin));
    setCancelWin(String(club.bookingSettings.cancellationWindowMin));
    setSlotOpts([...club.bookingSettings.slotDurationOptions]);
    setBookTypes([...club.bookingSettings.bookableTableTypes]);
    const bh = club.bookingSettings.bookableHours;
    if (bh) {
      setBhOpen(bh.open);
      setBhClose(bh.close);
      setBhDays([...bh.daysOfWeek]);
    }
    setDesc(club.description);
    setAmenitiesDraft([...(club.amenities ?? [])]);
    if (club.operatingHours) {
      setOpenTime(club.operatingHours.open);
      setCloseTime(club.operatingHours.close);
      setOpDays([...club.operatingHours.daysOfWeek]);
    }
    if (club.location) {
      setMarkerCoord({ latitude: club.location.lat, longitude: club.location.lng });
    } else {
      setMarkerCoord(DEFAULT_CENTER);
    }
    setLocationDirty(false);
  }, [club]);

  const mapRegion = useMemo(() => {
    const c = markerCoord ?? DEFAULT_CENTER;
    return { ...c, latitudeDelta: 0.02, longitudeDelta: 0.02 };
  }, [markerCoord]);

  const toggleAccordion = (k: AccordionKey) =>
    setOpen((o) => ({ ...o, [k]: !o[k] }));

  const onPickPhoto = useCallback(async () => {
    if (!club) return;
    if ((club.photos?.length ?? 0) >= 5) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo library access to upload club photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const resp = await fetch(result.assets[0].uri);
      const blob = await resp.blob();
      const upload = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob,
      });
      if (!upload.ok) throw new Error("Upload failed");
      const storageId = (await upload.text()).trim();
      await uploadClubPhoto({ clubId: club.clubId, storageId: storageId as Id<"_storage"> });
    } catch (e) {
      Alert.alert(parseConvexError(e as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }, [club, generateUploadUrl, uploadClubPhoto]);

  if (user === undefined || (user?.role === "owner" && club === undefined)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent.green} />
      </View>
    );
  }

  if (user?.role !== "owner" || !club) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Owner account required.</Text>
      </View>
    );
  }

  const currencySymbol = (() => {
    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: club.currency,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? club.currency;
    } catch {
      return club.currency;
    }
  })();

  const openSpecialModal = (mode: "add" | "edit", rate?: Doc<"clubs">["specialRates"][number]) => {
    setSrError(null);
    if (mode === "add") {
      setSrLabel("");
      setSrRate("");
      setSrStart("22:00");
      setSrEnd("02:00");
      setSrDays([5, 6]);
      setRateModal({ mode: "add" });
    } else if (rate) {
      setSrLabel(rate.label);
      setSrRate(String(rate.ratePerMin));
      setSrStart(rate.startTime);
      setSrEnd(rate.endTime);
      setSrDays([...rate.daysOfWeek]);
      setRateModal({ mode: "edit", id: rate.id });
    }
  };

  const saveSpecialRate = async () => {
    if (!club) return;
    setSrError(null);
    const rateNum = Number(srRate);
    try {
      if (rateModal?.mode === "add") {
        await addSpecialRate({
          clubId: club.clubId,
          label: srLabel,
          ratePerMin: rateNum,
          startTime: srStart,
          endTime: srEnd,
          daysOfWeek: srDays,
        });
      } else if (rateModal?.mode === "edit") {
        await updateSpecialRate({
          clubId: club.clubId,
          rateId: rateModal.id,
          label: srLabel,
          ratePerMin: rateNum,
          startTime: srStart,
          endTime: srEnd,
          daysOfWeek: srDays,
        });
      }
      setRateModal(null);
    } catch (e) {
      const msg = parseConvexError(e as Error).message;
      if (msg.includes("CLUB_001")) setSrError(msg.replace(/^CLUB_001:\s*/, ""));
      else Alert.alert(msg);
    }
  };

  const openRoleEditor = (mode: "add" | "edit", role?: Doc<"staffRoles">) => {
    setRTabErr(null);
    if (mode === "add") {
      setRName("");
      setRTabs(["slots"]);
      setRAllTables(true);
      setRTableIds([]);
      setRFileComplaints(false);
      setRDiscount(false);
      setRMaxDisc("10");
      setRoleModal({ mode: "add" });
    } else if (role) {
      setRName(role.name);
      setRTabs([...role.allowedTabs]);
      setRAllTables(!role.allowedTableIds || role.allowedTableIds.length === 0);
      setRTableIds(role.allowedTableIds ? [...role.allowedTableIds] : []);
      setRFileComplaints(role.canFileComplaints);
      setRDiscount(role.canApplyDiscount);
      setRMaxDisc(
        role.maxDiscountPercent != null ? String(role.maxDiscountPercent) : "10",
      );
      setRoleModal({ mode: "edit", id: role._id });
    }
  };

  const saveRole = async () => {
    if (!club) return;
    if (rTabs.length === 0) {
      setRTabErr("Select at least one tab.");
      return;
    }
    if (!rAllTables && rTableIds.length === 0) {
      Alert.alert("Select at least one table when using specific tables.");
      return;
    }
    try {
      const maxDisc = rDiscount
        ? rMaxDisc.trim() === ""
          ? undefined
          : Math.min(100, Math.max(0, Number(rMaxDisc)))
        : undefined;
      const allowedTableIds = rAllTables ? undefined : rTableIds;
      if (roleModal?.mode === "add") {
        await createRole({
          clubId: club.clubId,
          name: rName,
          allowedTabs: rTabs,
          allowedTableIds,
          canFileComplaints: rFileComplaints,
          canApplyDiscount: rDiscount,
          maxDiscountPercent: maxDisc,
        });
      } else if (roleModal?.mode === "edit") {
        await updateRole({
          roleId: roleModal.id,
          name: rName,
          allowedTabs: rTabs,
          allowedTableIds,
          canFileComplaints: rFileComplaints,
          canApplyDiscount: rDiscount,
          maxDiscountPercent: maxDisc,
        });
      }
      setRoleModal(null);
    } catch (e) {
      Alert.alert(parseConvexError(e as Error).message);
    }
  };

  const pickRole = async (roleId: Id<"staffRoles"> | null) => {
    if (!club) return;
    try {
      await setActiveRoleMutation({
        clubId: club.clubId,
        roleId: roleId ?? undefined,
      });
      await setActiveRoleId(roleId);
      setActiveRoleIdState(roleId);
      setRolePickerOpen(false);
    } catch (e) {
      Alert.alert(parseConvexError(e as Error).message);
    }
  };

  const onDeleteRole = (role: Doc<"staffRoles">) => {
    Alert.alert(
      `Delete ${role.name}?`,
      "If this role is currently active on the device, it will revert to Owner Mode.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRole({ roleId: role._id });
              const cur = await getActiveRoleId();
              if (cur === role._id) {
                await setActiveRoleId(null);
                setActiveRoleIdState(null);
              }
            } catch (e) {
              Alert.alert(parseConvexError(e as Error).message);
            }
          },
        },
      ],
    );
  };

  const accordionHeader = (key: AccordionKey, label: string) => (
    <Pressable style={styles.accHead} onPress={() => toggleAccordion(key)}>
      <Text style={styles.accTitle}>{label}</Text>
      <MaterialIcons
        name={open[key] ? "expand-less" : "expand-more"}
        size={24}
        color={colors.text.secondary}
      />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {frozen ? (
        <View style={styles.frozenBanner}>
          <Text style={styles.frozenText}>
            Your subscription has expired. Renew at{" "}
            <Text style={styles.link} onPress={() => void Linking.openURL(RENEW_URL)}>
              {RENEW_URL}
            </Text>{" "}
            to continue.
          </Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Tables */}
        <View style={styles.card}>
          {accordionHeader("tables", "Tables")}
          {open.tables ? (
            <View style={styles.accBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionHint}>Manage billiards tables</Text>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => setAddTableOpen(true)}
                  disabled={frozen}
                >
                  <Text style={styles.addBtnText}>+ Add Table</Text>
                </Pressable>
              </View>
              {tables?.map((t) => (
                <View key={t._id} style={styles.tableRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tableLabel}>{t.label}</Text>
                    <Text style={styles.tableMeta}>
                      {[t.tableType, t.floor].filter(Boolean).join(" · ") || "—"}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: t.isActive ? "#1B3D1F" : colors.bg.tertiary },
                      ]}
                    >
                      <Text
                        style={{
                          ...typography.caption,
                          color: t.isActive ? colors.accent.green : colors.text.secondary,
                        }}
                      >
                        {t.isActive ? "Active" : "Disabled"}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      const occupied = t.currentSessionId != null;
                      Alert.alert(t.label, undefined, [
                        {
                          text: "Rename",
                          onPress: () => {
                            setRenameLabel(t.label);
                            setRenameOpen(t._id);
                          },
                        },
                        {
                          text: "Set Table Type",
                          onPress: () => {
                            setTypeInput(t.tableType ?? "");
                            setTypeOpen(t._id);
                          },
                        },
                        ...(t.isActive
                          ? [
                              {
                                text: "Disable",
                                style: "destructive" as const,
                                onPress: () => {
                                  if (occupied) {
                                    Alert.alert(
                                      "Table in use",
                                      "End the active session first.",
                                    );
                                    return;
                                  }
                                  Alert.alert(
                                    `Disable ${t.label}?`,
                                    "This table will be hidden from the session grid. Historical sessions are preserved.",
                                    [
                                      { text: "Cancel", style: "cancel" },
                                      {
                                        text: "Disable",
                                        style: "destructive",
                                        onPress: async () => {
                                          try {
                                            await disableTable({ tableId: t._id });
                                          } catch (e) {
                                            Alert.alert(parseConvexError(e as Error).message);
                                          }
                                        },
                                      },
                                    ],
                                  );
                                },
                              },
                            ]
                          : [
                              {
                                text: "Re-enable",
                                onPress: async () => {
                                  try {
                                    await enableTable({ tableId: t._id });
                                  } catch (e) {
                                    Alert.alert(parseConvexError(e as Error).message);
                                  }
                                },
                              },
                            ]),
                        { text: "Close", style: "cancel" },
                      ]);
                    }}
                  >
                    <MaterialIcons name="more-vert" size={22} color={colors.text.secondary} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          {accordionHeader("rates", "Rates & Billing")}
          {open.rates ? (
            <View style={styles.accBody}>
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                  ℹ Rate is locked at session start. Sessions crossing a rate boundary are billed at
                  the rate in effect when the session started.
                </Text>
              </View>
              <Text style={styles.label}>Currency (ISO 4217)</Text>
              <TextInput
                style={styles.input}
                value={curDraft}
                onChangeText={setCurDraft}
                autoCapitalize="characters"
                editable={!frozen}
              />
              <Text style={styles.note}>
                Applied to all new sessions. Historical sessions are unaffected.
              </Text>
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  try {
                    await updateCurrency({ clubId: club.clubId, currency: curDraft });
                    Alert.alert("Saved");
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save currency</Text>
              </Pressable>

              <Text style={styles.label}>Base rate per minute</Text>
              <View style={styles.rowInput}>
                <Text style={styles.prefix}>{currencySymbol}</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="decimal-pad"
                  value={baseDraft}
                  onChangeText={setBaseDraft}
                  editable={!frozen}
                />
              </View>
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  try {
                    await updateBaseRate({
                      clubId: club.clubId,
                      baseRatePerMin: Number(baseDraft),
                    });
                    Alert.alert("Saved");
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save base rate</Text>
              </Pressable>

              <Text style={styles.label}>Minimum billable minutes</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={minBillDraft}
                onChangeText={setMinBillDraft}
                editable={!frozen}
              />
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  try {
                    await updateMinBillMinutes({
                      clubId: club.clubId,
                      minBillMinutes: Number(minBillDraft),
                    });
                    Alert.alert("Saved");
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save minimum minutes</Text>
              </Pressable>

              <Text style={styles.label}>Timezone (IANA)</Text>
              <TextInput
                style={styles.input}
                value={tzDraft}
                onChangeText={(t) => {
                  setTzDraft(t);
                  setTzFilter(t);
                }}
                placeholder="Asia/Kolkata"
                placeholderTextColor={colors.text.tertiary}
                editable={!frozen}
              />
              {!frozen && tzSuggestions.length > 0 ? (
                <View style={styles.tzList}>
                  {tzSuggestions.slice(0, 8).map((tz) => (
                    <Pressable key={tz} onPress={() => setTzDraft(tz)} style={styles.tzRow}>
                      <Text style={styles.tzRowText}>{tz}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Text style={styles.warnNote}>
                Changing timezone affects all future date calculations.
              </Text>
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  try {
                    await updateTimezone({ clubId: club.clubId, timezone: tzDraft });
                    Alert.alert("Saved");
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save timezone</Text>
              </Pressable>

              <View style={styles.rowBetween}>
                <Text style={styles.subSection}>Special Rates</Text>
                <Pressable style={styles.addBtn} onPress={() => openSpecialModal("add")} disabled={frozen}>
                  <Text style={styles.addBtnText}>+ Add Rate</Text>
                </Pressable>
              </View>
              {(club.specialRates ?? []).map((r) => (
                <View key={r.id} style={styles.rateCard}>
                  <Text style={styles.tableLabel}>{r.label}</Text>
                  <Text style={styles.tableMeta}>
                    {currencySymbol}
                    {r.ratePerMin}/min · {formatSpecialWindow(r.startTime, r.endTime)}
                  </Text>
                  <Text style={styles.tableMeta}>{dayAbbrevList(r.daysOfWeek)}</Text>
                  <View style={styles.iconRow}>
                    <Pressable onPress={() => openSpecialModal("edit", r)} disabled={frozen}>
                      <MaterialIcons name="edit" size={20} color={colors.status.info} />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        Alert.alert(`Delete ${r.label}?`, "This will not affect active sessions.", [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await deleteSpecialRate({ clubId: club.clubId, rateId: r.id });
                              } catch (e) {
                                Alert.alert(parseConvexError(e as Error).message);
                              }
                            },
                          },
                        ])
                      }
                      disabled={frozen}
                    >
                      <MaterialIcons name="delete" size={20} color={colors.status.error} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Staff */}
        <View style={styles.card}>
          {accordionHeader("staff", "Staff Roles")}
          {open.staff ? (
            <View style={styles.accBody}>
              <View style={styles.roleBanner}>
                <Text style={styles.roleBannerTitle}>
                  {activeRoleId
                    ? `Active Role: ${activeRoleName ?? "…"}`
                    : "Owner Mode (Unrestricted)"}
                </Text>
                <View style={styles.roleBtnRow}>
                  <Pressable style={styles.smallPrimary} onPress={() => setRolePickerOpen(true)}>
                    <Text style={styles.smallPrimaryText}>Switch Role</Text>
                  </Pressable>
                  {activeRoleId ? (
                    <Pressable
                      style={styles.smallGhost}
                      onPress={() => void pickRole(null)}
                    >
                      <Text style={styles.smallGhostText}>Exit to Owner Mode</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionHint}>Roles for staff devices</Text>
                <Pressable style={styles.addBtn} onPress={() => openRoleEditor("add")} disabled={frozen}>
                  <Text style={styles.addBtnText}>+ Add Role</Text>
                </Pressable>
              </View>
              {roles?.map((role) => (
                <View key={role._id} style={styles.roleCard}>
                  <Text style={styles.tableLabel}>{role.name}</Text>
                  <View style={styles.chipWrap}>
                    {TAB_ORDER.filter((t) => role.allowedTabs.includes(t)).map((t) => (
                      <View key={t} style={styles.chip}>
                        <Text style={styles.chipText}>{TAB_LABEL[t]}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.tableMeta}>
                    {!role.allowedTableIds || role.allowedTableIds.length === 0
                      ? "All tables"
                      : `${role.allowedTableIds.length} specific tables`}
                  </Text>
                  <View style={styles.chipWrap}>
                    {role.canFileComplaints ? (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>Can file complaints</Text>
                      </View>
                    ) : null}
                    {role.canApplyDiscount ? (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>
                          Can apply discount
                          {role.maxDiscountPercent != null
                            ? ` (max ${role.maxDiscountPercent}%)`
                            : ""}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.iconRow}>
                    <Pressable onPress={() => openRoleEditor("edit", role)} disabled={frozen}>
                      <MaterialIcons name="edit" size={20} color={colors.status.info} />
                    </Pressable>
                    <Pressable onPress={() => onDeleteRole(role)} disabled={frozen}>
                      <MaterialIcons name="delete" size={20} color={colors.status.error} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Online booking */}
        <View style={styles.card}>
          {accordionHeader("booking", "Online Booking")}
          {open.booking ? (
            <View style={styles.accBody}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tableLabel}>Accept Online Bookings</Text>
                  <Text style={styles.tableMeta}>
                    {club.bookingSettings.enabled
                      ? "Your club is accepting online bookings"
                      : "Customers cannot discover or book your club online"}
                  </Text>
                </View>
                <Switch
                  value={club.bookingSettings.enabled}
                  disabled={frozen}
                  onValueChange={async () => {
                    setToggleBookingErr(null);
                    try {
                      await toggleBookingEnabled({ clubId: club.clubId });
                    } catch (e) {
                      setToggleBookingErr(parseConvexError(e as Error).message);
                    }
                  }}
                  trackColor={{ false: colors.bg.tertiary, true: colors.accent.green }}
                />
              </View>
              {toggleBookingErr ? (
                <View style={styles.errCard}>
                  <Text style={styles.errCardText}>{toggleBookingErr}</Text>
                </View>
              ) : null}
              {bookingPrecheck && !bookingPrecheck.allOk && !club.bookingSettings.enabled ? (
                <View style={styles.warnCard}>
                  {bookingPrecheck.checks
                    .filter((c) => !c.ok)
                    .map((c) => (
                      <Text key={c.id} style={styles.warnCardText}>
                        • {c.message}
                      </Text>
                    ))}
                </View>
              ) : null}

              <Text style={styles.label}>Max advance days</Text>
              <Text style={styles.note}>How far ahead customers can book</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={maxAdv}
                onChangeText={setMaxAdv}
                editable={!frozen}
              />
              <Text style={styles.label}>Min advance minutes</Text>
              <Text style={styles.note}>Minimum lead time before booking start</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={minAdv}
                onChangeText={setMinAdv}
                editable={!frozen}
              />
              <Text style={styles.label}>Approval deadline (minutes)</Text>
              <Text style={styles.note}>Minutes to approve before booking expires</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={apprDead}
                onChangeText={setApprDead}
                editable={!frozen}
              />
              <Text style={styles.label}>Cancellation window (minutes)</Text>
              <Text style={styles.note}>Minutes before start time for late cancellation</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={cancelWin}
                onChangeText={setCancelWin}
                editable={!frozen}
              />
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  setBookingErr(null);
                  try {
                    await updateBookingSettings({
                      clubId: club.clubId,
                      settings: {
                        maxAdvanceDays: Number(maxAdv),
                        minAdvanceMinutes: Number(minAdv),
                        approvalDeadlineMin: Number(apprDead),
                        cancellationWindowMin: Number(cancelWin),
                      },
                    });
                    Alert.alert("Saved");
                  } catch (e) {
                    setBookingErr(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save booking rules</Text>
              </Pressable>
              {bookingErr ? <Text style={styles.errInline}>{bookingErr}</Text> : null}

              <Text style={styles.label}>Slot duration options</Text>
              <View style={styles.chipWrap}>
                {SLOT_CHIPS.map(({ min, label }) => {
                  const on = slotOpts.includes(min);
                  return (
                    <Pressable
                      key={min}
                      disabled={frozen}
                      onPress={() => {
                        setSlotOpts((prev) => {
                          if (prev.includes(min)) {
                            const next = prev.filter((x) => x !== min);
                            return next.length ? next : prev;
                          }
                          return [...prev, min].sort((a, b) => a - b);
                        });
                      }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  if (slotOpts.length === 0) {
                    Alert.alert("Select at least one slot duration.");
                    return;
                  }
                  try {
                    await updateBookingSettings({
                      clubId: club.clubId,
                      settings: { slotDurationOptions: slotOpts },
                    });
                    Alert.alert("Saved");
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save slot durations</Text>
              </Pressable>

              <Text style={styles.label}>Bookable table types</Text>
              <Text style={styles.note}>Only selected types appear in the customer booking flow.</Text>
              {bookableTypesMismatch ? (
                <View style={styles.warnCard}>
                  <Text style={styles.warnCardText}>
                    Some bookable table types have no active tables.
                  </Text>
                </View>
              ) : null}
              <View style={styles.chipWrap}>
                {distinctActiveTableTypes.map((tt) => {
                  const on = bookTypes.includes(tt);
                  return (
                    <Pressable
                      key={tt}
                      disabled={frozen}
                      onPress={() => {
                        setBookTypes((prev) =>
                          on ? prev.filter((x) => x !== tt) : [...prev, tt],
                        );
                      }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{tt}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  try {
                    await updateBookingSettings({
                      clubId: club.clubId,
                      settings: { bookableTableTypes: bookTypes },
                    });
                    Alert.alert("Saved");
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save bookable types</Text>
              </Pressable>

              <Text style={styles.label}>Bookable hours</Text>
              <Text style={styles.note}>Bookable hours must fall within your operating hours.</Text>
              <View style={styles.rowInput}>
                <TextInput style={[styles.input, { flex: 1 }]} value={bhOpen} onChangeText={setBhOpen} editable={!frozen} />
                <Text style={{ color: colors.text.secondary }}>to</Text>
                <TextInput style={[styles.input, { flex: 1 }]} value={bhClose} onChangeText={setBhClose} editable={!frozen} />
              </View>
              <View style={styles.chipWrap}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <Pressable
                    key={d}
                    disabled={frozen}
                    onPress={() =>
                      setBhDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))
                    }
                    style={[styles.chip, bhDays.includes(d) && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, bhDays.includes(d) && styles.chipTextOn]}>
                      {DAY_LABELS[d]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  setBookingErr(null);
                  try {
                    await updateBookingSettings({
                      clubId: club.clubId,
                      settings: {
                        bookableHours: { open: bhOpen, close: bhClose, daysOfWeek: bhDays },
                      },
                    });
                    Alert.alert("Saved");
                  } catch (e) {
                    const msg = parseConvexError(e as Error).message;
                    if (msg.includes("CLUB_004")) setBookingErr(msg);
                    else Alert.alert(msg);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save bookable hours</Text>
              </Pressable>
              {bookingErr?.includes("CLUB_004") ? (
                <Text style={styles.errInline}>{bookingErr}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Club profile */}
        <View style={styles.card}>
          {accordionHeader("profile", "Club Profile")}
          {open.profile ? (
            <View style={styles.accBody}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Show club in customer search</Text>
                  <Text style={styles.tableMeta}>
                    {club.isDiscoverable ? "Discoverable" : "Hidden"}
                  </Text>
                </View>
                <Switch
                  value={club.isDiscoverable}
                  disabled={frozen}
                  onValueChange={async () => {
                    try {
                      await toggleDiscoverability({ clubId: club.clubId });
                    } catch (e) {
                      Alert.alert(parseConvexError(e as Error).message);
                    }
                  }}
                  trackColor={{ false: colors.bg.tertiary, true: colors.accent.green }}
                />
              </View>
              <Text style={styles.label}>Description (max 500)</Text>
              <TextInput
                style={styles.multiline}
                multiline
                value={desc}
                onChangeText={setDesc}
                maxLength={500}
                editable={!frozen}
              />
              <Text style={styles.counter}>{desc.length}/500</Text>
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  try {
                    await updateDescription({ clubId: club.clubId, description: desc });
                    Alert.alert("Saved");
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save description</Text>
              </Pressable>

              <Text style={styles.label}>Photos</Text>
              <View style={styles.photoGrid}>
                {(club.photos ?? []).map((p) => (
                  <View key={p.storageId} style={styles.photoCell}>
                    {p.url ? <Image source={{ uri: p.url }} style={styles.photoThumb} /> : null}
                    <Pressable
                      style={styles.photoRemove}
                      disabled={frozen}
                      onPress={() => void removeClubPhoto({ clubId: club.clubId, storageId: p.storageId })}
                    >
                      <Text style={styles.photoRemoveText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              {(club.photos ?? []).length < 5 ? (
                <Pressable style={styles.secondaryBtn} disabled={frozen || photoBusy} onPress={onPickPhoto}>
                  <Text style={styles.secondaryBtnText}>{photoBusy ? "Uploading…" : "+ Add Photo"}</Text>
                </Pressable>
              ) : null}

              <Text style={styles.label}>Amenities</Text>
              <View style={styles.chipWrap}>
                {PREDEFINED_AMENITIES.map((a) => {
                  const on = amenitiesDraft.includes(a);
                  return (
                    <Pressable
                      key={a}
                      disabled={frozen}
                      onPress={() =>
                        setAmenitiesDraft((p) => (on ? p.filter((x) => x !== a) : [...p, a]))
                      }
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{a}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.rowInput}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={customAmenity}
                  onChangeText={setCustomAmenity}
                  placeholder="Custom amenity"
                  placeholderTextColor={colors.text.tertiary}
                  editable={!frozen}
                />
                <Pressable
                  style={styles.secondaryBtn}
                  disabled={frozen}
                  onPress={() => {
                    const t = customAmenity.trim();
                    if (!t) return;
                    setAmenitiesDraft((p) => (p.includes(t) ? p : [...p, t]));
                    setCustomAmenity("");
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Add</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  try {
                    await updateAmenities({ clubId: club.clubId, amenities: amenitiesDraft });
                    Alert.alert("Saved");
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save amenities</Text>
              </Pressable>

              <Text style={styles.label}>Operating hours (HH:MM)</Text>
              <View style={styles.rowInput}>
                <TextInput style={[styles.input, { flex: 1 }]} value={openTime} onChangeText={setOpenTime} editable={!frozen} />
                <Text style={{ color: colors.text.secondary }}>to</Text>
                <TextInput style={[styles.input, { flex: 1 }]} value={closeTime} onChangeText={setCloseTime} editable={!frozen} />
              </View>
              <View style={styles.chipWrap}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <Pressable
                    key={d}
                    disabled={frozen}
                    onPress={() =>
                      setOpDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))
                    }
                    style={[styles.chip, opDays.includes(d) && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, opDays.includes(d) && styles.chipTextOn]}>
                      {DAY_LABELS[d]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {hoursError ? <Text style={styles.errInline}>{hoursError}</Text> : null}
              <Pressable
                style={styles.secondaryBtn}
                disabled={frozen}
                onPress={async () => {
                  setHoursError(null);
                  try {
                    await updateOperatingHours({
                      clubId: club.clubId,
                      operatingHours: { open: openTime, close: closeTime, daysOfWeek: opDays },
                    });
                    Alert.alert("Saved");
                  } catch (e) {
                    const msg = parseConvexError(e as Error).message;
                    if (msg.includes("CLUB_004")) {
                      setHoursError(
                        "Bookable hours must fall within operating hours. Update bookable hours first.",
                      );
                    } else Alert.alert(msg);
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Save operating hours</Text>
              </Pressable>

              <Text style={styles.label}>Location pin</Text>
              <View style={styles.mapBox}>
                <SafeLocationPicker
                  initialRegion={mapRegion}
                  markerCoord={markerCoord}
                  draggable={!frozen}
                  onChange={(c) => {
                    setMarkerCoord(c);
                    setLocationDirty(true);
                  }}
                />
              </View>
              {locationDirty ? (
                <Pressable
                  style={styles.primaryBtn}
                  disabled={frozen || !markerCoord}
                  onPress={async () => {
                    if (!markerCoord) return;
                    try {
                      await updateLocationPin({
                        clubId: club.clubId,
                        lat: markerCoord.latitude,
                        lng: markerCoord.longitude,
                      });
                      setLocationDirty(false);
                      Alert.alert("Location saved");
                    } catch (e) {
                      Alert.alert(parseConvexError(e as Error).message);
                    }
                  }}
                >
                  <Text style={styles.primaryBtnText}>Save Location</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Security */}
        <View style={styles.card}>
          {accordionHeader("security", "Security")}
          {open.security ? (
            <View style={styles.accBody}>
              <Pressable style={styles.rowLink} onPress={() => router.push("/change-password")}>
                <Text style={styles.linkText}>Change account password</Text>
                <MaterialIcons name="chevron-right" size={22} color={colors.text.secondary} />
              </Pressable>
              <Pressable style={styles.rowLink} onPress={() => router.push("/change-passcode")}>
                <Text style={styles.linkText}>Change settings passcode</Text>
                <MaterialIcons name="chevron-right" size={22} color={colors.text.secondary} />
              </Pressable>
              <Pressable
                style={[styles.rowLink, (!user.email || frozen) && styles.rowDisabled]}
                disabled={!user.email || frozen}
                onPress={() => {
                  if (!user.email) return;
                  Alert.alert(
                    "Request data export?",
                    `Your data export (name, phone, email, club name, subscription history) will be sent to ${user.email} within 72 hours.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Confirm",
                        onPress: () => {
                          void (async () => {
                            try {
                              await requestDataExport({});
                              Alert.alert("Request submitted");
                            } catch (e) {
                              Alert.alert(parseConvexError(e as Error).message);
                            }
                          })();
                        },
                      },
                    ],
                  );
                }}
              >
                <Text style={styles.linkText}>Download my data</Text>
                {!user.email ? (
                  <Text style={styles.tableMeta}>Add email first</Text>
                ) : null}
              </Pressable>

              <Pressable
                style={styles.destructiveBox}
                disabled={frozen}
                onPress={() => {
                  setDeletePhrase("");
                  setDeleteOpen(true);
                }}
              >
                <Text style={styles.destructiveTitle}>Request account deletion</Text>
                <Text style={styles.tableMeta}>
                  Requires no active sessions, credits, or confirmed bookings.
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={{ height: spacing[10] }} />
      </ScrollView>

      <Modal visible={deleteOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete account</Text>
            <Text style={styles.tableMeta}>
              Your login will be blocked immediately. Pending bookings will be auto-cancelled. Your data
              will be permanently deleted after 30 days. Type DELETE to confirm.
            </Text>
            <TextInput
              style={styles.input}
              value={deletePhrase}
              onChangeText={setDeletePhrase}
              placeholder="DELETE"
              placeholderTextColor={colors.text.tertiary}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setDeleteOpen(false)} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  if (deletePhrase.trim() !== "DELETE") {
                    Alert.alert('Type "DELETE" to confirm.');
                    return;
                  }
                  void (async () => {
                    try {
                      await requestOwnerDeletion({});
                      setDeleteOpen(false);
                      await signOut();
                      router.replace("/login");
                    } catch (e) {
                      Alert.alert(parseConvexError(e as Error).message);
                    }
                  })();
                }}
              >
                <Text style={styles.primaryBtnText}>Confirm deletion</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={addTableOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add table</Text>
            <TextInput
              style={styles.input}
              placeholder="Label *"
              placeholderTextColor={colors.text.tertiary}
              value={newTableLabel}
              onChangeText={setNewTableLabel}
            />
            <TextInput
              style={styles.input}
              placeholder="Table type (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={newTableType}
              onChangeText={setNewTableType}
            />
            <TextInput
              style={styles.input}
              placeholder="Floor (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={newTableFloor}
              onChangeText={setNewTableFloor}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setAddTableOpen(false)}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={async () => {
                  try {
                    await addTable({
                      clubId: club.clubId,
                      label: newTableLabel,
                      tableType: newTableType || undefined,
                      floor: newTableFloor || undefined,
                    });
                    setAddTableOpen(false);
                    setNewTableLabel("");
                    setNewTableType("");
                    setNewTableFloor("");
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={renameOpen !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename table</Text>
            <TextInput style={styles.input} value={renameLabel} onChangeText={setRenameLabel} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRenameOpen(null)} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={async () => {
                  if (!renameOpen) return;
                  try {
                    await renameTable({ tableId: renameOpen, label: renameLabel });
                    setRenameOpen(null);
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={typeOpen !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Table type</Text>
            <TextInput style={styles.input} value={typeInput} onChangeText={setTypeInput} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setTypeOpen(null)} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={async () => {
                  if (!typeOpen) return;
                  try {
                    await updateTableType({ tableId: typeOpen, tableType: typeInput });
                    setTypeOpen(null);
                  } catch (e) {
                    Alert.alert(parseConvexError(e as Error).message);
                  }
                }}
              >
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rateModal !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {rateModal?.mode === "edit" ? "Edit special rate" : "Add special rate"}
            </Text>
            <TextInput style={styles.input} placeholder="Label" value={srLabel} onChangeText={setSrLabel} />
            <TextInput
              style={styles.input}
              placeholder="Rate per minute"
              keyboardType="decimal-pad"
              value={srRate}
              onChangeText={setSrRate}
            />
            <TextInput style={styles.input} value={srStart} onChangeText={setSrStart} placeholder="HH:MM start" />
            <TextInput style={styles.input} value={srEnd} onChangeText={setSrEnd} placeholder="HH:MM end" />
            <Text style={styles.note}>
              For midnight-crossing rates (e.g. 10 PM – 2 AM), set end time before start time.
            </Text>
            <View style={styles.chipWrap}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <Pressable
                  key={d}
                  onPress={() =>
                    setSrDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))
                  }
                  style={[styles.chip, srDays.includes(d) && styles.chipOn]}
                >
                  <Text style={[styles.chipText, srDays.includes(d) && styles.chipTextOn]}>
                    {DAY_LABELS[d]}
                  </Text>
                </Pressable>
              ))}
            </View>
            {srError ? <Text style={styles.errInline}>{srError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRateModal(null)} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => void saveSpecialRate()}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={roleModal !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {roleModal?.mode === "edit" ? "Edit role" : "Add role"}
            </Text>
            <TextInput style={styles.input} value={rName} onChangeText={setRName} placeholder="Name" />
            <Text style={styles.label}>Allowed tabs</Text>
            {TAB_ORDER.map((t) => {
              const on = rTabs.includes(t);
              return (
                <Pressable
                  key={t}
                  onPress={() =>
                    setRTabs((p) => (on ? p.filter((x) => x !== t) : [...p, t]))
                  }
                  style={[styles.chip, on && styles.chipOn, { marginBottom: spacing[1] }]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{TAB_LABEL[t]}</Text>
                </Pressable>
              );
            })}
            {rTabErr ? <Text style={styles.errInline}>{rTabErr}</Text> : null}
            <View style={styles.rowBetween}>
              <Text style={styles.tableMeta}>All tables</Text>
              <Switch value={rAllTables} onValueChange={setRAllTables} />
            </View>
            {!rAllTables && tables ? (
              <View style={{ marginTop: spacing[2] }}>
                {tables
                  .filter((t) => t.isActive)
                  .map((t) => {
                    const on = rTableIds.includes(t._id);
                    return (
                      <Pressable
                        key={t._id}
                        onPress={() =>
                          setRTableIds((p) =>
                            on ? p.filter((x) => x !== t._id) : [...p, t._id],
                          )
                        }
                        style={[styles.chip, on && styles.chipOn, { marginBottom: spacing[1] }]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
              </View>
            ) : null}
            <View style={styles.rowBetween}>
              <Text style={styles.tableMeta}>Can file complaints</Text>
              <Switch value={rFileComplaints} onValueChange={setRFileComplaints} />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.tableMeta}>Can apply discount</Text>
              <Switch value={rDiscount} onValueChange={setRDiscount} />
            </View>
            {rDiscount ? (
              <TextInput
                style={styles.input}
                placeholder="Max discount %"
                keyboardType="number-pad"
                value={rMaxDisc}
                onChangeText={setRMaxDisc}
              />
            ) : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRoleModal(null)} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => void saveRole()}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rolePickerOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Active Role</Text>
            <Text style={styles.note}>
              The selected role will be in effect until you switch again. Hand the device to staff after
              selecting.
            </Text>
            <Pressable style={styles.rowLink} onPress={() => void pickRole(null)}>
              <Text style={styles.linkText}>Owner Mode (Unrestricted)</Text>
            </Pressable>
            {roles?.map((role) => (
              <Pressable key={role._id} style={styles.rowLink} onPress={() => void pickRole(role._id)}>
                <View>
                  <Text style={styles.linkText}>{role.name}</Text>
                  <Text style={styles.tableMeta}>
                    {role.allowedTabs.map((t) => TAB_LABEL[t as keyof typeof TAB_LABEL] ?? t).join(", ")}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Pressable style={styles.secondaryBtn} onPress={() => setRolePickerOpen(false)}>
              <Text style={styles.secondaryBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pad: { padding: layout.screenPadding, paddingBottom: spacing[12] },
  screenTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing[3] },
  muted: { color: colors.text.secondary },
  frozenBanner: {
    backgroundColor: "rgba(244, 67, 54, 0.12)",
    padding: spacing[3],
    borderBottomWidth: 1,
    borderColor: colors.status.error,
  },
  frozenText: { ...typography.bodySmall, color: colors.text.primary },
  link: { color: colors.status.info, textDecorationLine: "underline" },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    marginBottom: spacing[3],
    overflow: "hidden",
  },
  accHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing[3],
    backgroundColor: colors.bg.tertiary,
  },
  accTitle: { ...typography.label, color: colors.text.primary },
  accBody: { padding: spacing[3] },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHint: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  addBtn: { paddingVertical: spacing[1], paddingHorizontal: spacing[2] },
  addBtnText: { ...typography.caption, color: colors.accent.green, fontWeight: "700" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tableLabel: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  tableMeta: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  badge: { alignSelf: "flex-start", marginTop: spacing[1], paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: 4 },
  infoBanner: {
    backgroundColor: "rgba(245, 127, 23, 0.12)",
    padding: spacing[2],
    borderRadius: radius.sm,
    marginBottom: spacing[3],
  },
  infoBannerText: { ...typography.caption, color: colors.accent.amber },
  label: { ...typography.label, color: colors.text.primary, marginTop: spacing[3] },
  note: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[1] },
  warnNote: { ...typography.caption, color: colors.accent.amber, marginTop: spacing[1] },
  input: {
    marginTop: spacing[2],
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.text.primary,
  },
  rowInput: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  prefix: { ...typography.body, color: colors.text.secondary, marginTop: spacing[2] },
  secondaryBtn: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { ...typography.button, color: colors.text.primary },
  tzList: {
    maxHeight: 160,
    marginTop: spacing[1],
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
  },
  tzRow: { padding: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  tzRowText: { ...typography.caption, color: colors.text.primary },
  subSection: { ...typography.label, color: colors.text.secondary, marginTop: spacing[2] },
  rateCard: {
    backgroundColor: colors.bg.tertiary,
    padding: spacing[3],
    borderRadius: radius.md,
    marginTop: spacing[2],
  },
  iconRow: { flexDirection: "row", gap: spacing[4], marginTop: spacing[2] },
  roleBanner: {
    backgroundColor: "rgba(67, 160, 71, 0.12)",
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[3],
  },
  roleBannerTitle: { ...typography.label, color: colors.accent.green, fontWeight: "700" },
  roleBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[2] },
  smallPrimary: {
    backgroundColor: colors.accent.green,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  smallPrimaryText: { ...typography.caption, color: "#0D1117", fontWeight: "700" },
  smallGhost: {
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  smallGhostText: { ...typography.caption, color: colors.text.primary },
  roleCard: {
    backgroundColor: colors.bg.tertiary,
    padding: spacing[3],
    borderRadius: radius.md,
    marginTop: spacing[2],
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing[1], marginTop: spacing[2] },
  chip: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  chipOn: { borderColor: colors.accent.amberLight, backgroundColor: "rgba(255, 193, 7, 0.12)" },
  chipText: { ...typography.caption, color: colors.text.primary },
  chipTextOn: { color: colors.accent.amberLight, fontWeight: "700" },
  errCard: {
    backgroundColor: "rgba(244, 67, 54, 0.1)",
    padding: spacing[2],
    borderRadius: radius.sm,
    marginTop: spacing[2],
  },
  errCardText: { ...typography.caption, color: colors.status.error },
  warnCard: {
    backgroundColor: "rgba(245, 127, 23, 0.12)",
    padding: spacing[2],
    borderRadius: radius.sm,
    marginTop: spacing[2],
  },
  warnCardText: { ...typography.caption, color: colors.accent.amber },
  errInline: { ...typography.caption, color: colors.status.error, marginTop: spacing[1] },
  rowLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  rowDisabled: { opacity: 0.45 },
  linkText: { ...typography.body, color: colors.text.primary },
  destructiveBox: {
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  destructiveTitle: { ...typography.label, color: colors.status.error },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.bg.secondary,
    padding: spacing[4],
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: 520,
  },
  modalTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing[2] },
  modalActions: { flexDirection: "row", gap: spacing[2], marginTop: spacing[3] },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.accent.green,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { ...typography.buttonLarge, color: "#0D1117" },
  multiline: {
    marginTop: spacing[2],
    minHeight: 100,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.text.primary,
    textAlignVertical: "top",
  },
  counter: { ...typography.caption, color: colors.text.secondary, alignSelf: "flex-end" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[2] },
  photoCell: { width: "48%", aspectRatio: 1 },
  photoThumb: { width: "100%", height: "100%", borderRadius: radius.md, backgroundColor: colors.bg.tertiary },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: { color: "#fff", fontSize: 18 },
  mapBox: { marginTop: spacing[2], height: 200, borderRadius: radius.md, overflow: "hidden" },
  map: { flex: 1 },
});
