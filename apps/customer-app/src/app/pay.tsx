import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { GlassPageBackground } from "@a3/ui/components";
import { colors, typography, spacing, radius, glass } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";
import { consumePendingCheckoutUrl } from "../lib/pendingCheckout";

type PayOutcome = "success" | "dismiss" | "failed" | "error" | null;

export default function PayScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url?: string }>();
  const [checkoutUrl] = useState(() => {
    const fromMemory = consumePendingCheckoutUrl();
    if (fromMemory) return fromMemory;
    const raw = Array.isArray(url) ? url[0] : url;
    return raw ? decodeURIComponent(raw) : "";
  });

  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<PayOutcome>(null);
  const [failReason, setFailReason] = useState<string | null>(null);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(e.nativeEvent.data) as {
        type: "success" | "dismiss" | "failed" | "error";
        reason?: string;
      };
      setOutcome(payload.type);
      if (payload.reason) setFailReason(payload.reason);
    } catch {
      // ignore malformed messages
    }
  }, []);

  if (!checkoutUrl) {
    return (
      <GlassPageBackground>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.center}>
            <Text style={styles.muted}>{t("customerApp.bookingDetail.payOpenFailed")}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
              <Text style={styles.primaryBtnText}>{t("customerApp.clubProfile.back")}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </GlassPageBackground>
    );
  }

  return (
    <GlassPageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.navBtn}>
            <Text style={styles.navBtnText}>{"<"}</Text>
          </Pressable>
          <Text style={styles.navTitle}>{t("customerApp.bookingDetail.payOpenedTitle")}</Text>
          <View style={styles.navBtn} />
        </View>

        {outcome === "success" ? (
          <View style={styles.center}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.resultTitle}>{t("customerApp.bookingDetail.paymentPaid")}</Text>
            <Text style={styles.muted}>{t("customerApp.bookingDetail.payOpenedBody")}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
              <Text style={styles.primaryBtnText}>{t("common.done")}</Text>
            </Pressable>
          </View>
        ) : outcome === "dismiss" || outcome === "failed" || outcome === "error" ? (
          <View style={styles.center}>
            <Text style={styles.failIcon}>✕</Text>
            <Text style={styles.resultTitle}>{t("customerApp.bookingDetail.payFailedTitle")}</Text>
            {failReason ? <Text style={styles.muted}>{failReason}</Text> : null}
            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                setOutcome(null);
                setFailReason(null);
                setLoading(true);
                webviewRef.current?.reload();
              }}
            >
              <Text style={styles.primaryBtnText}>{t("customerApp.bookingDetail.tryAgain")}</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={styles.secondaryBtnText}>{t("common.done")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.webviewWrap}>
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={glass.ctaBg} size="large" />
              </View>
            ) : null}
            <WebView
              ref={webviewRef}
              source={{ uri: checkoutUrl }}
              style={styles.webview}
              onMessage={onMessage}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setOutcome("error");
                setFailReason(t("customerApp.bookingDetail.payOpenFailed"));
              }}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={["https://*", "http://*"]}
              startInLoadingState
              mixedContentMode="always"
            />
          </View>
        )}
      </SafeAreaView>
    </GlassPageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  navBtn: { width: 40 },
  navBtnText: { ...typography.heading3, color: glass.ctaBg },
  navTitle: { ...typography.heading4, color: colors.text.primary },
  webviewWrap: { flex: 1 },
  webview: { flex: 1, backgroundColor: "transparent" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    backgroundColor: glass.pageBgBottom,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
    gap: spacing[3],
  },
  successIcon: { fontSize: 48, color: colors.accent.green },
  failIcon: { fontSize: 48, color: colors.status.error },
  resultTitle: { ...typography.heading3, color: colors.text.primary, textAlign: "center" },
  muted: { ...typography.body, color: colors.text.secondary, textAlign: "center" },
  primaryBtn: {
    marginTop: spacing[4],
    backgroundColor: glass.ctaBg,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
  },
  primaryBtnText: { ...typography.buttonLarge, color: glass.ctaText },
  secondaryBtn: {
    marginTop: spacing[2],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
  secondaryBtnText: { ...typography.button, color: colors.text.secondary },
});
