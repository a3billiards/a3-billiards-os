import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, typography, spacing, radius, glass } from "../theme";
import { LiquidGlassCard } from "./LiquidGlassCard";
import {
  SUPPORT_CATEGORIES,
  buildSupportMailtoUrl,
  type SupportCategory,
} from "@a3/utils/supportContact";
import { parseConvexError } from "../errors/errorCodes";

export type HelpSupportRequestRow = {
  _id: string;
  category: string;
  subject: string;
  status: string;
  createdAt: number;
  adminNotes?: string | null;
};

export type HelpSupportPanelProps = {
  audience: "customer" | "owner";
  faqIds: readonly string[];
  /** i18n prefix, e.g. `customerApp.help.faq` */
  faqKeyPrefix: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  supportEmail: string;
  onSubmitRequest: (args: {
    category: string;
    subject: string;
    message: string;
  }) => Promise<void>;
  myRequests?: HelpSupportRequestRow[] | undefined;
  bottomInset?: number;
};

function formatWhen(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

const MIN_SUBJECT = 3;
const MAX_SUBJECT = 120;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 2000;

function validateSupportForm(
  subject: string,
  message: string,
  baseKey: string,
  t: HelpSupportPanelProps["t"],
): string | null {
  const sub = subject.trim();
  const msg = message.trim();
  if (sub.length < MIN_SUBJECT || sub.length > MAX_SUBJECT) {
    return t(`${baseKey}.subjectInvalid`);
  }
  if (msg.length < MIN_MESSAGE || msg.length > MAX_MESSAGE) {
    return t(`${baseKey}.messageInvalid`);
  }
  return null;
}

function supportSubmitErrorMessage(
  error: unknown,
  baseKey: string,
  t: HelpSupportPanelProps["t"],
): string {
  const fallback = t(`${baseKey}.requestFailed`);
  if (!(error instanceof Error)) return fallback;
  const appError = parseConvexError(error);
  if (appError.code === "SUPPORT_001") return t(`${baseKey}.subjectInvalid`);
  if (appError.code === "SUPPORT_002") return t(`${baseKey}.messageInvalid`);
  if (appError.code === "AUTH_002" || appError.code === "AUTH_006") {
    return appError.message;
  }
  if (appError.code !== "UNKNOWN") return appError.message;
  return fallback;
}

export function HelpSupportPanel({
  audience,
  faqIds,
  faqKeyPrefix,
  t,
  supportEmail,
  onSubmitRequest,
  myRequests,
  bottomInset = spacing[8],
}: HelpSupportPanelProps): React.JSX.Element {
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<SupportCategory>("other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const baseKey = faqKeyPrefix.replace(/\.faq$/, "");

  const openEmail = () => {
    const url = buildSupportMailtoUrl({
      subject: t(`${baseKey}.emailSubject`, {
        app: audience === "customer" ? "Customer" : "Owner",
      }),
    });
    void Linking.openURL(url).catch(() => {
      Alert.alert(t(`${baseKey}.emailFailedTitle`), supportEmail);
    });
  };

  const submit = async () => {
    const validationError = validateSupportForm(subject, message, baseKey, t);
    if (validationError) {
      Alert.alert(t("common.error"), validationError);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitRequest({ category, subject, message });
      setSubject("");
      setMessage("");
      setCategory("other");
      setShowForm(false);
      Alert.alert(
        t(`${baseKey}.requestSentTitle`),
        t(`${baseKey}.requestSentBody`),
      );
    } catch (e) {
      Alert.alert(t("common.error"), supportSubmitErrorMessage(e, baseKey, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset }]}>
      <LiquidGlassCard style={styles.heroCard}>
        <View style={styles.heroIconWrap}>
          <MaterialIcons name="support-agent" size={28} color={glass.ctaBg} />
        </View>
        <Text style={styles.heroTitle}>{t(`${baseKey}.heroTitle`)}</Text>
        <Text style={styles.heroBody}>{t(`${baseKey}.heroBody`)}</Text>
        <Text style={styles.hours}>{t(`${baseKey}.hours`)}</Text>
        <Text style={styles.response}>{t(`${baseKey}.responseTime`)}</Text>
      </LiquidGlassCard>

      <Text style={styles.sectionTitle}>{t(`${baseKey}.contactTitle`)}</Text>
      <LiquidGlassCard padding="none">
        <Pressable style={styles.contactRow} onPress={openEmail}>
          <MaterialIcons name="email" size={22} color={glass.ctaBg} />
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>{t(`${baseKey}.emailLabel`)}</Text>
            <Text style={styles.contactValue}>{supportEmail}</Text>
          </View>
          <MaterialIcons name="open-in-new" size={18} color={colors.text.secondary} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.contactRow} onPress={() => setShowForm((v) => !v)}>
          <MaterialIcons name="chat" size={22} color={glass.ctaBg} />
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>{t(`${baseKey}.messageLabel`)}</Text>
            <Text style={styles.contactHint}>{t(`${baseKey}.messageHint`)}</Text>
          </View>
          <MaterialIcons
            name={showForm ? "expand-less" : "chevron-right"}
            size={22}
            color={colors.text.secondary}
          />
        </Pressable>
      </LiquidGlassCard>

      {showForm ? (
        <LiquidGlassCard style={styles.formCard}>
          <Text style={styles.formTitle}>{t(`${baseKey}.formTitle`)}</Text>
          <Text style={styles.fieldLabel}>{t(`${baseKey}.categoryLabel`)}</Text>
          <View style={styles.chipRow}>
            {SUPPORT_CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                  {t(`${baseKey}.categories.${c}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>{t(`${baseKey}.subjectLabel`)}</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder={t(`${baseKey}.subjectPlaceholder`)}
            placeholderTextColor={colors.text.tertiary}
            maxLength={120}
          />
          <Text style={styles.fieldLabel}>{t(`${baseKey}.messageFieldLabel`)}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder={t(`${baseKey}.messagePlaceholder`)}
            placeholderTextColor={colors.text.tertiary}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            disabled={submitting}
            onPress={() => void submit()}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitBtnText}>{t(`${baseKey}.submit`)}</Text>
            )}
          </Pressable>
        </LiquidGlassCard>
      ) : null}

      <Text style={styles.sectionTitle}>{t(`${baseKey}.faqTitle`)}</Text>
      {faqIds.map((id) => {
        const open = openFaq === id;
        return (
          <LiquidGlassCard key={id} padding="none" style={styles.faqCard}>
            <Pressable
              style={styles.faqHead}
              onPress={() => setOpenFaq(open ? null : id)}
            >
              <Text style={styles.faqQ}>{t(`${faqKeyPrefix}.${id}.q`)}</Text>
              <MaterialIcons
                name={open ? "expand-less" : "expand-more"}
                size={22}
                color={colors.text.secondary}
              />
            </Pressable>
            {open ? (
              <View style={styles.faqBody}>
                <Text style={styles.faqA}>{t(`${faqKeyPrefix}.${id}.a`)}</Text>
              </View>
            ) : null}
          </LiquidGlassCard>
        );
      })}

      {myRequests !== undefined ? (
        <>
          <Text style={styles.sectionTitle}>{t(`${baseKey}.myRequestsTitle`)}</Text>
          {myRequests.length === 0 ? (
            <Text style={styles.emptyRequests}>{t(`${baseKey}.myRequestsEmpty`)}</Text>
          ) : (
            myRequests.map((r) => (
              <LiquidGlassCard key={r._id} style={styles.requestCard}>
                <View style={styles.requestTop}>
                  <Text style={styles.requestSubject} numberOfLines={2}>
                    {r.subject}
                  </Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>
                      {t(`${baseKey}.status.${r.status}`)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.requestMeta}>
                  {(SUPPORT_CATEGORIES as readonly string[]).includes(r.category)
                    ? t(`${baseKey}.categories.${r.category as SupportCategory}`)
                    : r.category}{" "}
                  · {formatWhen(r.createdAt, "en")}
                </Text>
                {r.adminNotes ? (
                  <Text style={styles.adminReply}>
                    {t(`${baseKey}.adminReply`, { note: r.adminNotes })}
                  </Text>
                ) : null}
              </LiquidGlassCard>
            ))
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3], paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  heroCard: { gap: spacing[2] },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(245, 166, 35, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { ...typography.heading3, color: colors.text.primary },
  heroBody: { ...typography.body, color: colors.text.secondary },
  hours: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[1] },
  response: { ...typography.caption, color: glass.ctaBg },
  sectionTitle: {
    ...typography.sectionHeader,
    color: colors.text.secondary,
    marginTop: spacing[4],
    marginBottom: spacing[1],
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
  },
  contactText: { flex: 1, gap: 2 },
  contactLabel: { ...typography.label, color: colors.text.primary },
  contactValue: { ...typography.body, color: glass.ctaBg },
  contactHint: { ...typography.caption, color: colors.text.secondary },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: glass.cardBorder,
    marginHorizontal: spacing[4],
  },
  formCard: { gap: spacing[2], marginTop: spacing[2] },
  formTitle: { ...typography.heading4, color: colors.text.primary },
  fieldLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[2],
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[1] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: glass.inputBorder,
    backgroundColor: glass.inputBg,
  },
  chipActive: { borderColor: glass.ctaBg, backgroundColor: "rgba(245, 166, 35, 0.12)" },
  chipText: { ...typography.caption, color: colors.text.secondary },
  chipTextActive: { color: glass.ctaBg, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: glass.inputBorder,
    backgroundColor: glass.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    ...typography.body,
    color: colors.text.primary,
    marginTop: spacing[1],
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  submitBtn: {
    marginTop: spacing[3],
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: glass.ctaBg,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: { ...typography.buttonLarge, color: "#000", fontWeight: "700" },
  faqCard: { marginBottom: spacing[2] },
  faqHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    padding: spacing[4],
  },
  faqQ: { ...typography.body, color: colors.text.primary, fontWeight: "600", flex: 1 },
  faqBody: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: glass.cardBorder,
  },
  faqA: { ...typography.body, color: colors.text.secondary, lineHeight: 22 },
  emptyRequests: { ...typography.body, color: colors.text.secondary },
  requestCard: { gap: spacing[2], marginBottom: spacing[2] },
  requestTop: { flexDirection: "row", gap: spacing[2], alignItems: "flex-start" },
  requestSubject: { ...typography.body, color: colors.text.primary, fontWeight: "600", flex: 1 },
  statusPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: glass.inputBg,
    borderWidth: 1,
    borderColor: glass.inputBorder,
  },
  statusText: { ...typography.caption, color: colors.text.secondary, fontSize: 10 },
  requestMeta: { ...typography.caption, color: colors.text.tertiary },
  adminReply: { ...typography.bodySmall, color: colors.accent.green, marginTop: spacing[1] },
});
