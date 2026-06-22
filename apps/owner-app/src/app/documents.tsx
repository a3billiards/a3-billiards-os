import { useEffect, useMemo, useState, createElement } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { GlassPageBackground } from "@a3/ui/components";
import { colors, glass, layout, radius, spacing, typography } from "@a3/ui/theme";
import { parseConvexError } from "@a3/ui/errors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OwnerNoClubPlaceholder } from "../components/OwnerNoClubPlaceholder";
import { TabAccessDenied } from "../components/TabAccessDenied";
import { uploadLocalFileToConvexStorage } from "../lib/uploadConvexStorage";
import { useStaffRole, staffRoleQueryId } from "../lib/StaffRoleContext";
import { ownerTabBarTotalInset } from "../theme/ownerShell";

const PREDEFINED_LABELS = [
  "Trade License",
  "GST Registration",
  "Shop & Establishment",
  "Fire Safety Certificate",
  "Rent Agreement / Lease",
  "Insurance",
] as const;

const CUSTOM_LABEL = "__custom__";

type AddForm = {
  labelKey: string;
  customLabel: string;
  notes: string;
};

type ClubDocumentRow = {
  documentId: Id<"clubDocuments">;
  label: string;
  notes: string | null;
  fileUrl: string | null;
  imageUrl: string | null;
  isPdf: boolean;
  contentType: string;
};

type ViewerState = {
  label: string;
  fileUrl: string;
  isPdf: boolean;
};

async function pickPdfFile(): Promise<{ uri: string; mimeType: string } | null> {
  if (Platform.OS === "web") {
    return await new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/pdf,.pdf";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        resolve({
          uri: URL.createObjectURL(file),
          mimeType: file.type || "application/pdf",
        });
      };
      input.click();
    });
  }

  try {
    const DocumentPicker = await import("expo-document-picker");
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? "application/pdf" };
  } catch {
    Alert.alert(
      "PDF picker unavailable",
      "Install dependencies (pnpm install) and rebuild the dev client, then try again.",
    );
    return null;
  }
}

export default function DocumentsScreen() {
  const { roleId, canAccessTab } = useStaffRole();
  const dashboard = useQuery(api.slotManagement.getSlotDashboard);
  const insets = useSafeAreaInsets();
  const bottomPad = ownerTabBarTotalInset(insets.bottom);

  const documents = useQuery(
    api.clubDocuments.listClubDocuments,
    dashboard && roleId !== undefined
      ? { clubId: dashboard.clubId, roleId: staffRoleQueryId(roleId) }
      : "skip",
  ) as ClubDocumentRow[] | undefined;

  const generateUploadUrl = useMutation(api.clubDocuments.generateClubDocumentUploadUrl);
  const createDocument = useMutation(api.clubDocuments.createClubDocument);
  const deleteDocument = useMutation(api.clubDocuments.deleteClubDocument);

  const [addVisible, setAddVisible] = useState(false);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [pendingViewId, setPendingViewId] = useState<Id<"clubDocuments"> | null>(null);
  const [form, setForm] = useState<AddForm>({
    labelKey: PREDEFINED_LABELS[0],
    customLabel: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resolvedLabel = useMemo(() => {
    if (form.labelKey === CUSTOM_LABEL) {
      return form.customLabel.trim();
    }
    return form.labelKey;
  }, [form.customLabel, form.labelKey]);

  useEffect(() => {
    if (!pendingViewId || !documents) return;
    const doc = documents.find((row) => row.documentId === pendingViewId);
    const url = doc?.fileUrl ?? doc?.imageUrl;
    if (!doc || !url) return;
    setViewer((prev) =>
      prev
        ? {
            label: doc.label,
            fileUrl: url,
            isPdf: doc.isPdf,
          }
        : {
            label: doc.label,
            fileUrl: url,
            isPdf: doc.isPdf,
          },
    );
    setPendingViewId(null);
  }, [documents, pendingViewId]);

  const openViewer = (doc: ClubDocumentRow) => {
    const url = doc.fileUrl ?? doc.imageUrl;
    if (!url) {
      Alert.alert("Unavailable", "This file could not be loaded.");
      return;
    }
    setViewer({
      label: doc.label,
      fileUrl: url,
      isPdf: doc.isPdf,
    });
  };

  const openExternalFile = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Cannot open file", "No app on this device can open this file.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Cannot open file", "Try again later.");
    }
  };

  if (dashboard === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.centerText}>Loading documents...</Text>
      </View>
    );
  }

  if (dashboard === null) {
    return <OwnerNoClubPlaceholder />;
  }

  if (roleId !== undefined && !canAccessTab("documents")) {
    return <TabAccessDenied tabLabel="Documents" />;
  }

  if (documents === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent.green} />
        <Text style={styles.centerText}>Loading documents...</Text>
      </View>
    );
  }

  const openAdd = () => {
    setForm({
      labelKey: PREDEFINED_LABELS[0],
      customLabel: "",
      notes: "",
    });
    setFormError(null);
    setAddVisible(true);
  };

  const closeAdd = () => {
    if (busy) return;
    setAddVisible(false);
  };

  const uploadFile = async (uri: string, mimeType: string | null | undefined) => {
    const uploadUrl = await generateUploadUrl();
    const storageId = await uploadLocalFileToConvexStorage(uploadUrl, uri, mimeType);
    const contentType =
      mimeType === "application/pdf"
        ? "application/pdf"
        : mimeType?.startsWith("image/")
          ? mimeType
          : uri.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "image/jpeg";

    const { documentId } = await createDocument({
      clubId: dashboard.clubId,
      label: resolvedLabel,
      imageFileId: storageId,
      contentType,
      notes: form.notes.trim() || undefined,
      roleId: staffRoleQueryId(roleId),
    });

    setAddVisible(false);
    setPendingViewId(documentId);
    setViewer({
      label: resolvedLabel,
      fileUrl: uri,
      isPdf: contentType === "application/pdf",
    });
  };

  const pickAndUpload = async (source: "camera" | "library" | "pdf") => {
    if (busy) return;
    if (!resolvedLabel) {
      setFormError("Choose a label or enter a custom one.");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      if (source === "pdf") {
        const picked = await pickPdfFile();
        if (!picked) return;
        await uploadFile(picked.uri, picked.mimeType);
        return;
      }

      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          source === "camera"
            ? "Allow camera access to photograph a document."
            : "Allow photo library access to upload a document.",
        );
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              quality: 0.9,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              quality: 0.9,
            });

      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      await uploadFile(asset.uri, asset.mimeType);
    } catch (e) {
      setFormError(parseConvexError(e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (documentId: Id<"clubDocuments">, label: string) => {
    Alert.alert("Delete document?", `Remove "${label}" permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteDocument({
            documentId,
            roleId: staffRoleQueryId(roleId),
          }).catch((e) => {
            Alert.alert("Could not delete", parseConvexError(e as Error).message);
          });
        },
      },
    ]);
  };

  return (
    <GlassPageBackground>
      <View style={[styles.screen, { paddingBottom: bottomPad }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Documents</Text>
          <Text style={styles.subtitle}>
            Store club licenses and paperwork (photos or PDFs). Not visible to customers.
          </Text>
          <Pressable style={styles.addBtn} onPress={openAdd}>
            <MaterialIcons name="add" size={20} color="#000" />
            <Text style={styles.addBtnText}>Add Document</Text>
          </Pressable>
        </View>

        {documents.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="folder-open" size={48} color={colors.text.secondary} />
            <Text style={styles.emptyTitle}>No documents yet</Text>
            <Text style={styles.emptyBody}>
              Add photos or PDFs of trade licenses, GST certificates, and other club paperwork.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {documents.map((doc) => (
              <Pressable
                key={doc.documentId}
                style={styles.card}
                onPress={() => openViewer(doc)}
              >
                {doc.isPdf ? (
                  <View style={[styles.thumb, styles.pdfThumb]}>
                    <MaterialIcons name="picture-as-pdf" size={36} color={colors.status.error} />
                    <Text style={styles.pdfThumbText}>PDF</Text>
                  </View>
                ) : doc.fileUrl ?? doc.imageUrl ? (
                  <Image
                    source={{ uri: doc.fileUrl ?? doc.imageUrl! }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <MaterialIcons name="image-not-supported" size={28} color={colors.text.secondary} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardLabel}>{doc.label}</Text>
                  {doc.notes ? (
                    <Text style={styles.cardNotes} numberOfLines={3}>
                      {doc.notes}
                    </Text>
                  ) : null}
                  <View style={styles.cardActions}>
                    <Pressable style={styles.viewBtn} onPress={() => openViewer(doc)}>
                      <MaterialIcons name="visibility" size={18} color={glass.ctaBg} />
                      <Text style={styles.viewBtnText}>View</Text>
                    </Pressable>
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        confirmDelete(doc.documentId, doc.label);
                      }}
                    >
                      <MaterialIcons name="delete-outline" size={18} color={colors.status.error} />
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Modal visible={addVisible} animationType="slide" transparent onRequestClose={closeAdd}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing[4] }]}>
              <Text style={styles.modalTitle}>Add Document</Text>
              <Text style={styles.modalHint}>Label</Text>
              <View style={styles.chipWrap}>
                {PREDEFINED_LABELS.map((label) => {
                  const selected = form.labelKey === label;
                  return (
                    <Pressable
                      key={label}
                      style={[styles.chip, selected && styles.chipOn]}
                      onPress={() => setForm((f) => ({ ...f, labelKey: label }))}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.chip, form.labelKey === CUSTOM_LABEL && styles.chipOn]}
                  onPress={() => setForm((f) => ({ ...f, labelKey: CUSTOM_LABEL }))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      form.labelKey === CUSTOM_LABEL && styles.chipTextOn,
                    ]}
                  >
                    Custom label
                  </Text>
                </Pressable>
              </View>
              {form.labelKey === CUSTOM_LABEL ? (
                <TextInput
                  style={styles.input}
                  placeholder="Enter document label"
                  placeholderTextColor={colors.text.secondary}
                  value={form.customLabel}
                  onChangeText={(customLabel) => setForm((f) => ({ ...f, customLabel }))}
                  maxLength={80}
                />
              ) : null}
              <Text style={styles.modalHint}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Expiry date, registration number, etc."
                placeholderTextColor={colors.text.secondary}
                value={form.notes}
                onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
                multiline
                maxLength={500}
              />
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  disabled={busy}
                  onPress={() => void pickAndUpload("camera")}
                >
                  {busy ? (
                    <ActivityIndicator color={glass.ctaBg} />
                  ) : (
                    <>
                      <MaterialIcons name="photo-camera" size={18} color={glass.ctaBg} />
                      <Text style={styles.modalBtnSecondaryText}>Take photo</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  disabled={busy}
                  onPress={() => void pickAndUpload("library")}
                >
                  {busy ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <MaterialIcons name="photo-library" size={18} color="#000" />
                      <Text style={styles.modalBtnPrimaryText}>Choose image</Text>
                    </>
                  )}
                </Pressable>
              </View>
              <Pressable
                style={[styles.modalBtnFull, styles.modalBtnPdf]}
                disabled={busy}
                onPress={() => void pickAndUpload("pdf")}
              >
                {busy ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <>
                    <MaterialIcons name="picture-as-pdf" size={20} color={colors.text.primary} />
                    <Text style={styles.modalBtnPdfText}>Choose PDF</Text>
                  </>
                )}
              </Pressable>
              <Pressable style={styles.cancelLink} disabled={busy} onPress={closeAdd}>
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={viewer !== null}
          animationType="fade"
          onRequestClose={() => setViewer(null)}
        >
          <View style={[styles.viewerRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerTitle} numberOfLines={2}>
                {viewer?.label}
              </Text>
              <Pressable onPress={() => setViewer(null)} hitSlop={12} style={styles.viewerClose}>
                <MaterialIcons name="close" size={28} color={colors.text.primary} />
              </Pressable>
            </View>

            {viewer?.isPdf ? (
              Platform.OS === "web" ? (
                <View style={styles.pdfWebFrameWrap}>
                  {createElement("iframe", {
                    src: viewer.fileUrl,
                    title: viewer.label,
                    style: { flex: 1, width: "100%", border: "none", minHeight: 480 },
                  })}
                </View>
              ) : (
                <View style={styles.pdfViewerBody}>
                  <MaterialIcons name="picture-as-pdf" size={72} color={colors.status.error} />
                  <Text style={styles.pdfViewerText}>
                    Open this PDF in your device&apos;s viewer.
                  </Text>
                  <Pressable
                    style={styles.openPdfBtn}
                    onPress={() => viewer && void openExternalFile(viewer.fileUrl)}
                  >
                    <Text style={styles.openPdfBtnText}>Open PDF</Text>
                  </Pressable>
                </View>
              )
            ) : viewer?.fileUrl ? (
              <ScrollView
                style={styles.viewerScroll}
                contentContainerStyle={styles.viewerScrollContent}
                maximumZoomScale={Platform.OS === "ios" ? 4 : 1}
                minimumZoomScale={1}
                centerContent
              >
                <Image
                  source={{ uri: viewer.fileUrl }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </ScrollView>
            ) : null}
          </View>
        </Modal>
      </View>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
    backgroundColor: colors.bg.primary,
  },
  centerText: { ...typography.body, color: colors.text.secondary, marginTop: spacing[3] },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  title: { ...typography.heading2, color: colors.text.primary },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
  addBtn: {
    marginTop: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    backgroundColor: glass.ctaBg,
    borderRadius: radius.md,
    minHeight: 44,
    paddingHorizontal: spacing[4],
  },
  addBtnText: { ...typography.button, color: "#000", fontWeight: "700" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: layout.screenPadding,
  },
  emptyTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginTop: spacing[3],
  },
  emptyBody: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[2],
  },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  card: {
    flexDirection: "row",
    backgroundColor: glass.cardBg,
    borderWidth: 1,
    borderColor: glass.cardBorder,
    borderRadius: glass.cardRadiusSmall,
    overflow: "hidden",
  },
  thumb: { width: 96, height: 96, backgroundColor: colors.bg.tertiary },
  pdfThumb: { alignItems: "center", justifyContent: "center", gap: 2 },
  pdfThumbText: { ...typography.caption, color: colors.text.secondary, fontWeight: "700" },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, padding: spacing[3], gap: spacing[1] },
  cardLabel: { ...typography.label, color: colors.text.primary, fontWeight: "700" },
  cardNotes: { ...typography.caption, color: colors.text.secondary },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    marginTop: spacing[2],
  },
  viewBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewBtnText: { ...typography.caption, color: glass.ctaBg, fontWeight: "600" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  deleteBtnText: { ...typography.caption, color: colors.status.error, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[5],
    maxHeight: "90%",
  },
  modalTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing[3] },
  modalHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing[2],
    marginTop: spacing[2],
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: {
    borderWidth: 1,
    borderColor: glass.inputBorder,
    backgroundColor: glass.inputBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  chipOn: { borderColor: glass.ctaBg, backgroundColor: "rgba(245, 166, 35, 0.12)" },
  chipText: { ...typography.caption, color: colors.text.secondary },
  chipTextOn: { color: glass.ctaBg, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: glass.inputBorder,
    backgroundColor: glass.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    color: colors.text.primary,
    ...typography.body,
  },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
  formError: { ...typography.caption, color: colors.status.error, marginTop: spacing[2] },
  modalActions: { flexDirection: "row", gap: spacing[3], marginTop: spacing[4] },
  modalBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing[2],
  },
  modalBtnFull: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[3],
  },
  modalBtnPrimary: { backgroundColor: glass.ctaBg },
  modalBtnPrimaryText: { ...typography.button, color: "#000", fontWeight: "700" },
  modalBtnSecondary: {
    borderWidth: 1,
    borderColor: glass.ctaBg,
    backgroundColor: "transparent",
  },
  modalBtnSecondaryText: { ...typography.button, color: glass.ctaBg, fontWeight: "700" },
  modalBtnPdf: {
    borderWidth: 1,
    borderColor: glass.inputBorder,
    backgroundColor: glass.inputBg,
  },
  modalBtnPdfText: { ...typography.button, color: colors.text.primary, fontWeight: "700" },
  cancelLink: { alignItems: "center", paddingVertical: spacing[4] },
  cancelLinkText: { ...typography.body, color: colors.text.secondary },
  viewerRoot: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  viewerTitle: {
    ...typography.label,
    color: colors.text.primary,
    flex: 1,
    fontWeight: "700",
  },
  viewerClose: { padding: spacing[1] },
  viewerScroll: { flex: 1 },
  viewerScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing[2],
  },
  viewerImage: {
    width: "100%",
    height: "100%",
    minHeight: 320,
  },
  pdfViewerBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: layout.screenPadding,
    gap: spacing[4],
  },
  pdfWebFrameWrap: { flex: 1, width: "100%", padding: spacing[2] },
  pdfViewerText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
  },
  openPdfBtn: {
    backgroundColor: glass.ctaBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
  openPdfBtnText: { ...typography.button, color: "#000", fontWeight: "700" },
});
