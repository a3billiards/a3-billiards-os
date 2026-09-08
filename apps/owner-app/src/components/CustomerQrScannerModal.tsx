import { useCallback, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors, spacing, typography, radius, layout } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";

export type CustomerQrScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onScan: (payload: string) => void;
};

export function CustomerQrScannerModal({
  visible,
  onClose,
  onScan,
}: CustomerQrScannerModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [requesting, setRequesting] = useState(false);

  const ensurePermission = useCallback(async () => {
    if (permission?.granted) return true;
    setRequesting(true);
    try {
      const res = await requestPermission();
      return res.granted;
    } finally {
      setRequesting(false);
    }
  }, [permission?.granted, requestPermission]);

  const handleBarcode = useCallback(
    (data: string) => {
      const trimmed = data.trim();
      if (!trimmed || scannedRef.current) return;
      scannedRef.current = true;
      onScan(trimmed);
      onClose();
    },
    [onClose, onScan],
  );

  const onShow = useCallback(() => {
    scannedRef.current = false;
    void ensurePermission();
  }, [ensurePermission]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onShow={onShow}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("ownerApp.slots.qrScannerTitle")}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeText}>{t("ownerApp.slots.cancel")}</Text>
          </Pressable>
        </View>

        {requesting || permission === null ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent.green} />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.hint}>{t("ownerApp.slots.qrCameraPermission")}</Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => void ensurePermission()}
            >
              <Text style={styles.primaryBtnText}>{t("ownerApp.slots.qrAllowCamera")}</Text>
            </Pressable>
            {permission.canAskAgain === false ? (
              <Pressable
                style={styles.linkBtn}
                onPress={() => void Linking.openSettings()}
              >
                <Text style={styles.linkText}>{t("ownerApp.livestream.openSettings")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => handleBarcode(data)}
            />
            <View style={styles.frame} pointerEvents="none" />
            <Text style={styles.scanHint}>{t("ownerApp.slots.qrScannerHint")}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const frameSize = 240;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[12],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  title: { ...typography.heading3, color: colors.text.primary, flex: 1 },
  closeBtn: { minHeight: layout.touchTarget, justifyContent: "center" },
  closeText: { color: colors.accent.green, fontWeight: "600" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
    gap: spacing[4],
  },
  hint: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: colors.accent.green,
    borderRadius: radius.md,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    minHeight: layout.touchTarget,
    justifyContent: "center",
  },
  primaryBtnText: { ...typography.button, color: colors.bg.primary },
  linkBtn: { padding: spacing[3] },
  linkText: { color: colors.accent.green },
  cameraWrap: {
    flex: 1,
    margin: spacing[4],
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  camera: { flex: 1 },
  frame: {
    position: "absolute",
    top: "50%",
    start: "50%",
    width: frameSize,
    height: frameSize,
    marginStart: -frameSize / 2,
    marginTop: -frameSize / 2,
    borderWidth: 2,
    borderColor: colors.accent.green,
    borderRadius: radius.md,
  },
  scanHint: {
    position: "absolute",
    bottom: spacing[6],
    start: spacing[4],
    end: spacing[4],
    textAlign: "center",
    color: "#fff",
    ...typography.bodySmall,
  },
});
