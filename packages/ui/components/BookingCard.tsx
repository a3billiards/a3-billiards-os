import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { spacing, radius, layout } from "../theme/spacing";

/** Booking list card — Figma `31:1521` / `31:1546` / `31:1572` (node 33-8218). */
const FIGMA = {
  cardRadius: 24,
  cardBorder: "rgba(255,255,255,0.1)" as const,
  cardPad: 16,
  titleSize: 20,
  titleLine: 28,
  metaSize: 14,
  metaLine: 20,
  chipMinH: 24,
  chipPadH: 12,
  chipPadV: 4,
  chipTextSize: 12,
  chipLine: 16,
  chipConfirmed: "#4A9EFF",
  chipAwaiting: "#5B7DB1",
  chipCompleted: "#3ECF8E",
  priceColor: "#4A9EFF",
  metaGap: 8,
  afterTitleGap: 12,
  rowGap: 8,
} as const;

export type BookingCardMode =
  | "owner-pending"
  | "owner-upcoming"
  | "owner-history"
  | "customer";

export type BookingCardData = {
  _id: string;
  customerName?: string;
  customerPhone?: string;
  tableType: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedDurationMin: number;
  status: string;
  estimatedCost?: number;
  currency?: string;
  notes?: string;
  rejectionReason?: string;
  confirmedTableLabel?: string;
  createdAt?: number;
};

export interface BookingCardProps {
  log?: {
    bookingId: string;
    clubName: string;
    tableType: string;
    requestedDate: string;
    requestedStartTime: string;
    requestedDurationMin: number;
    status: string;
    estimatedCost?: number;
    currency: string;
    confirmedTableLabel?: string;
    rejectionReason?: string;
    thumbnailPhotoUrl?: string | null;
  };
  onPress?: () => void;
  mode: BookingCardMode;
  booking: BookingCardData;
  customerStats?: {
    thisClub: { totalBookings: number; noShowCount: number };
    platformWide: { totalBookings: number; noShowCount: number };
  };
  complaints?: string[];
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onStartSession?: () => void;
  isLoading?: boolean;
  footerText?: string;
}

export function BookingCard({
  mode,
  booking,
  log,
  onPress,
  customerStats,
  complaints,
  onApprove,
  onReject,
  onCancel,
  onStartSession,
  isLoading,
  footerText,
}: BookingCardProps): React.JSX.Element {
  if (log && onPress) {
    const palette = customerStatusPalette(log.status);
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.container, pressed && styles.pressed]}>
        <View style={styles.customerRow}>
          {log.thumbnailPhotoUrl ? (
            <Image source={{ uri: log.thumbnailPhotoUrl }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={styles.thumbFallback}>
              <Text style={styles.thumbFallbackText}>A3</Text>
            </View>
          )}
          <View style={styles.customerMain}>
            <View style={styles.customerHeader}>
              <Text style={styles.customerClub} numberOfLines={2}>
                {log.clubName}
              </Text>
              <View style={[styles.customerStatus, { backgroundColor: palette.bg }]}>
                <Text style={[styles.customerStatusText, { color: palette.fg }]}>
                  {palette.label}
                </Text>
              </View>
            </View>
            <Text style={styles.customerMeta}>
              {capitalize(log.tableType)} • {log.requestedDate} • {to12h(log.requestedStartTime)} •{" "}
              {humanDuration(log.requestedDurationMin)}
            </Text>
            {log.status === "confirmed" && log.confirmedTableLabel ? (
              <Text style={styles.customerSubline}>Table: {log.confirmedTableLabel}</Text>
            ) : null}
            {log.status === "rejected" && log.rejectionReason ? (
              <Text style={styles.customerSubline} numberOfLines={1}>
                Reason: {log.rejectionReason}
              </Text>
            ) : null}
            {log.estimatedCost !== undefined ? (
              <Text style={styles.priceLine}>
                Est. {currencySymbol(log.currency)}
                {log.estimatedCost}
              </Text>
            ) : null}
          </View>
        </View>
        {(log.status === "pending_approval" || log.status === "confirmed") && onCancel ? (
          <Pressable style={styles.customerCancelBtn} onPress={onCancel}>
            <Text style={styles.customerCancelText}>Cancel</Text>
          </Pressable>
        ) : null}
      </Pressable>
    );
  }

  const isOwnerPending = mode === "owner-pending";
  const isOwnerUpcoming = mode === "owner-upcoming";
  const isOwnerHistory = mode === "owner-history";
  const showCustomerMeta = mode !== "customer";
  const chip = statusChipPalette(booking.status);
  const statusLabel = formatStatusLabel(booking.status);

  return (
    <View style={styles.container}>
      {showCustomerMeta ? (
        <View style={styles.headerRow}>
          <View style={styles.nameBlock}>
            <Text style={styles.cardTitle} numberOfLines={3}>
              {booking.customerName ?? "Customer"}
            </Text>
            {booking.customerPhone ? (
              <Text style={styles.phoneLine}>{booking.customerPhone}</Text>
            ) : null}
          </View>
          <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
            <Text style={[styles.statusChipText, { color: chip.fg }]} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaItem}>{capitalize(booking.tableType)}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaItem}>{booking.requestedDate}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaItem}>{booking.requestedStartTime}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaItem}>{durationLabel(booking.requestedDurationMin)}</Text>
      </View>

      {booking.confirmedTableLabel ? (
        <Text style={styles.secondaryLine}>
          Assigned: {booking.confirmedTableLabel}
        </Text>
      ) : null}

      {booking.estimatedCost !== undefined && booking.currency ? (
        <Text style={styles.priceLine}>
          ≈ {booking.currency} {booking.estimatedCost}
        </Text>
      ) : null}

      {isOwnerPending && customerStats ? (
        <Text style={styles.trackRecord}>
          At this club: {customerStats.thisClub.totalBookings} bookings,{" "}
          {customerStats.thisClub.noShowCount} no-shows | Platform-wide:{" "}
          {customerStats.platformWide.totalBookings} bookings,{" "}
          {customerStats.platformWide.noShowCount} no-shows
        </Text>
      ) : null}

      {isOwnerPending && complaints && complaints.length > 0 ? (
        <View style={styles.complaintBanner}>
          <Text style={styles.complaintText}>
            {"\u26A0"} {complaints.map(prettyComplaint).join(", ")}
          </Text>
        </View>
      ) : null}

      {booking.notes ? <Text style={styles.notes}>{booking.notes}</Text> : null}
      {isOwnerHistory && booking.rejectionReason ? (
        <Text style={styles.reason}>Reason: {booking.rejectionReason}</Text>
      ) : null}
      {footerText ? <Text style={styles.footer}>{footerText}</Text> : null}

      {isOwnerPending ? (
        <View style={styles.actionsRow}>
          <Pressable
            disabled={isLoading}
            onPress={onApprove}
            style={({ pressed }) => [
              styles.approveBtn,
              pressed && styles.pressed,
              isLoading && styles.disabled,
            ]}
          >
            <Text style={styles.approveText}>Approve</Text>
          </Pressable>
          <Pressable
            disabled={isLoading}
            onPress={onReject}
            style={({ pressed }) => [
              styles.rejectBtn,
              pressed && styles.pressed,
              isLoading && styles.disabled,
            ]}
          >
            <Text style={styles.rejectText}>Reject</Text>
          </Pressable>
        </View>
      ) : null}

      {isOwnerUpcoming ? (
        <View style={styles.actionsRow}>
          {onStartSession ? (
            <Pressable
              disabled={isLoading}
              onPress={onStartSession}
              style={({ pressed }) => [
                styles.approveBtn,
                pressed && styles.pressed,
                isLoading && styles.disabled,
              ]}
            >
              <Text style={styles.approveText}>Start Session</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={isLoading}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.textDangerBtn,
              pressed && styles.pressed,
              isLoading && styles.disabled,
            ]}
          >
            <Text style={styles.rejectText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function durationLabel(min: number): string {
  return `${min}m`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function prettyComplaint(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function humanDuration(min: number): string {
  if (min === 30) return "30 min";
  if (min === 60) return "1 hour";
  if (min % 60 === 0) return `${min / 60} hours`;
  if (min % 30 === 0) return `${(min / 60).toFixed(1)} hours`;
  return `${min} min`;
}

function currencySymbol(code: string): string {
  if (code === "INR") return "₹";
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return `${code} `;
}

function customerStatusPalette(status: string): { bg: string; fg: string; label: string } {
  switch (status) {
    case "pending_approval":
      return { bg: "rgba(245,127,23,0.18)", fg: colors.accent.amber, label: "Pending" };
    case "confirmed":
      return { bg: "rgba(67,160,71,0.18)", fg: colors.accent.green, label: "Confirmed" };
    case "rejected":
      return { bg: "rgba(244,67,54,0.18)", fg: colors.status.error, label: "Declined" };
    case "cancelled_by_customer":
      return { bg: "rgba(139,148,158,0.18)", fg: colors.text.secondary, label: "Cancelled" };
    case "cancelled_by_club":
      return { bg: "rgba(139,148,158,0.18)", fg: colors.text.secondary, label: "Cancelled by Club" };
    case "expired":
      return { bg: "rgba(139,148,158,0.18)", fg: colors.text.secondary, label: "Expired" };
    default:
      return { bg: "rgba(33,150,243,0.18)", fg: colors.status.info, label: "Completed" };
  }
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "pending_approval":
      return "Awaiting Approval";
    case "cancelled_by_customer":
    case "cancelled_by_club":
      return "Cancelled";
    default:
      return status
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

function statusChipPalette(status: string): { bg: string; fg: string } {
  const fg = "#000000";
  switch (status) {
    case "pending_approval":
      return { bg: FIGMA.chipAwaiting, fg };
    case "confirmed":
      return { bg: FIGMA.chipConfirmed, fg };
    case "completed":
      return { bg: FIGMA.chipCompleted, fg };
    case "rejected":
      return { bg: "#FF5252", fg };
    case "expired":
    case "cancelled_by_customer":
    case "cancelled_by_club":
      return { bg: "#78909C", fg };
    default:
      return { bg: colors.status.disabled, fg: colors.text.primary };
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.secondary,
    borderRadius: FIGMA.cardRadius,
    borderWidth: 1,
    borderColor: FIGMA.cardBorder,
    padding: FIGMA.cardPad,
    gap: FIGMA.rowGap,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: FIGMA.metaGap,
    marginBottom: FIGMA.afterTitleGap - FIGMA.rowGap,
  },
  nameBlock: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: FIGMA.titleSize,
    lineHeight: FIGMA.titleLine,
    fontWeight: "600",
    color: colors.text.primary,
  },
  phoneLine: {
    marginTop: spacing[1],
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: "400",
    color: colors.text.secondary,
  },
  statusChip: {
    minHeight: FIGMA.chipMinH,
    paddingHorizontal: FIGMA.chipPadH,
    paddingVertical: FIGMA.chipPadV,
    borderRadius: radius.full,
    justifyContent: "center",
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  statusChipText: {
    fontSize: FIGMA.chipTextSize,
    lineHeight: FIGMA.chipLine,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: FIGMA.metaGap,
    rowGap: spacing[1],
  },
  metaItem: {
    fontSize: FIGMA.metaSize,
    lineHeight: FIGMA.metaLine,
    fontWeight: "300",
    color: colors.text.primary,
  },
  metaDot: {
    fontSize: FIGMA.metaSize,
    lineHeight: FIGMA.metaLine,
    fontWeight: "300",
    color: colors.text.primary,
  },
  customerRow: { flexDirection: "row", gap: spacing[3], alignItems: "flex-start" },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.bg.tertiary },
  thumbFallback: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFallbackText: { ...typography.label, color: colors.text.secondary },
  customerMain: { flex: 1, gap: spacing[1] },
  customerHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing[2] },
  customerClub: { ...typography.heading4, color: colors.text.primary, flex: 1 },
  customerStatus: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    alignSelf: "flex-start",
  },
  customerStatusText: { ...typography.caption, fontWeight: "600" },
  customerMeta: { ...typography.bodySmall, color: colors.text.secondary },
  customerSubline: { ...typography.bodySmall, color: colors.text.secondary },
  customerCancelBtn: {
    marginTop: spacing[2],
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.status.error,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  customerCancelText: { ...typography.labelSmall, color: colors.status.error },
  secondaryLine: {
    fontSize: FIGMA.metaSize,
    lineHeight: FIGMA.metaLine,
    fontWeight: "300",
    color: colors.text.primary,
  },
  priceLine: {
    fontSize: FIGMA.metaSize,
    lineHeight: FIGMA.metaLine,
    fontWeight: "600",
    color: FIGMA.priceColor,
  },
  notes: {
    fontSize: FIGMA.metaSize,
    lineHeight: FIGMA.metaLine,
    fontWeight: "300",
    color: colors.text.secondary,
    fontStyle: "italic",
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    padding: spacing[2],
  },
  reason: {
    fontSize: FIGMA.metaSize,
    lineHeight: FIGMA.metaLine,
    fontWeight: "300",
    color: colors.text.secondary,
  },
  trackRecord: { ...typography.caption, color: colors.text.secondary },
  complaintBanner: {
    backgroundColor: "rgba(244,67,54,0.14)",
    borderRadius: radius.sm,
    padding: spacing[2],
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  complaintText: { ...typography.bodySmall, color: colors.status.error },
  footer: { ...typography.caption, color: colors.text.secondary },
  actionsRow: { flexDirection: "row", gap: spacing[2], marginTop: spacing[2] },
  approveBtn: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent.green,
  },
  approveText: { ...typography.button, color: colors.bg.primary },
  rejectBtn: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.status.error,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  textDangerBtn: {
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.status.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[3],
  },
  rejectText: { ...typography.button, color: colors.status.error },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

export default BookingCard;
