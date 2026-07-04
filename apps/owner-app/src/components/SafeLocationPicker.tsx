import React, { Component, Suspense, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import Constants from "expo-constants";
import { colors, typography, spacing, radius } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";

/**
 * `react-native-maps` requires native Google Maps SDK keys. Without them,
 * `MapView` can **hard-crash** the Android/iOS process — React error boundaries
 * never run. We therefore skip loading `react-native-maps` entirely unless
 * `expo-constants` reports a configured key (same source as the native embed).
 *
 * Manual latitude/longitude fields are always shown so owners can pin precisely.
 */

function hasNativeGoogleMapsApiKey(): boolean {
  const ex = Constants.expoConfig;
  if (!ex) return false;
  if (Platform.OS === "android") {
    const k = ex.android?.config?.googleMaps?.apiKey;
    return typeof k === "string" && k.trim().length >= 8;
  }
  if (Platform.OS === "ios") {
    const ios = ex.ios as { config?: { googleMapsApiKey?: string } } | undefined;
    const k = ios?.config?.googleMapsApiKey;
    return typeof k === "string" && k.trim().length >= 8;
  }
  return false;
}

type Coord = { latitude: number; longitude: number };

interface Props {
  initialRegion: Coord & { latitudeDelta: number; longitudeDelta: number };
  markerCoord: Coord | null;
  draggable: boolean;
  onChange: (c: Coord) => void;
}

interface BoundaryState {
  hasError: boolean;
}

class MapErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  BoundaryState
> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[SafeLocationPicker] map render failed:", error.message);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const LazyMapBlock = React.lazy(async () => {
  const Maps = await import("react-native-maps");
  const MapView = Maps.default;
  const { Marker } = Maps;

  function MapBlock({
    initialRegion,
    markerCoord,
    draggable,
    onChange,
  }: Props): React.JSX.Element {
    return (
      <MapView style={styles.map} initialRegion={initialRegion}>
        {markerCoord ? (
          <Marker
            coordinate={markerCoord}
            draggable={draggable}
            onDragEnd={(e) => onChange(e.nativeEvent.coordinate)}
          />
        ) : null}
      </MapView>
    );
  }

  return { default: MapBlock };
});

function ManualCoordFields({
  markerCoord,
  onChange,
  disabled,
  showMapHint,
}: Pick<Props, "markerCoord" | "onChange"> & {
  disabled?: boolean;
  showMapHint?: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [latStr, setLatStr] = useState(
    markerCoord ? String(markerCoord.latitude) : "",
  );
  const [lngStr, setLngStr] = useState(
    markerCoord ? String(markerCoord.longitude) : "",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!markerCoord) return;
    setLatStr(String(markerCoord.latitude));
    setLngStr(String(markerCoord.longitude));
  }, [markerCoord?.latitude, markerCoord?.longitude, markerCoord]);

  return (
    <View style={styles.manualSection}>
      {showMapHint ? (
        <Text style={styles.manualHint}>
          {t("sharedUi.safeLocationPicker.manualPinHint")}
        </Text>
      ) : (
        <>
          <Text style={styles.fallbackTitle}>
            {t("sharedUi.safeLocationPicker.mapUnavailable")}
          </Text>
          <Text style={styles.fallbackBody}>
            {t("sharedUi.safeLocationPicker.fallbackInstructions")}
          </Text>
        </>
      )}
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>{t("sharedUi.safeLocationPicker.latitude")}</Text>
          <TextInput
            value={latStr}
            onChangeText={setLatStr}
            editable={!disabled}
            keyboardType="numbers-and-punctuation"
            placeholder="28.6139"
            placeholderTextColor={colors.text.tertiary}
            style={styles.input}
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>{t("sharedUi.safeLocationPicker.longitude")}</Text>
          <TextInput
            value={lngStr}
            onChangeText={setLngStr}
            editable={!disabled}
            keyboardType="numbers-and-punctuation"
            placeholder="77.2090"
            placeholderTextColor={colors.text.tertiary}
            style={styles.input}
          />
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.applyBtn, disabled && styles.applyBtnDisabled]}
        disabled={disabled}
        onPress={() => {
          const lat = Number(latStr);
          const lng = Number(lngStr);
          if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            setError(t("sharedUi.safeLocationPicker.latError"));
            return;
          }
          if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            setError(t("sharedUi.safeLocationPicker.lngError"));
            return;
          }
          setError(null);
          onChange({ latitude: lat, longitude: lng });
        }}
      >
        <Text style={styles.applyBtnText}>
          {t("sharedUi.safeLocationPicker.useCoordinates")}
        </Text>
      </Pressable>
    </View>
  );
}

export function SafeLocationPicker(props: Props): React.JSX.Element {
  const hasMap = hasNativeGoogleMapsApiKey();

  return (
    <View style={styles.root}>
      {hasMap ? (
        <MapErrorBoundary
          fallback={
            <View style={styles.mapFallbackBox}>
              <ManualCoordFields
                markerCoord={props.markerCoord}
                onChange={props.onChange}
                disabled={!props.draggable}
              />
            </View>
          }
        >
          <Suspense
            fallback={
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.accent.green} />
              </View>
            }
          >
            <LazyMapBlock {...props} />
          </Suspense>
        </MapErrorBoundary>
      ) : null}
      <ManualCoordFields
        markerCoord={props.markerCoord}
        onChange={props.onChange}
        disabled={!props.draggable}
        showMapHint={hasMap}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing[3] },
  map: { flex: 1, minHeight: 200 },
  mapFallbackBox: { minHeight: 120 },
  loadingBox: {
    flex: 1,
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.tertiary,
  },
  manualSection: {
    backgroundColor: colors.bg.tertiary,
    padding: spacing[3],
    borderRadius: radius.md,
    gap: spacing[2],
  },
  manualHint: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  fallbackTitle: {
    ...typography.heading4,
    color: colors.text.primary,
  },
  fallbackBody: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  row: { flexDirection: "row", gap: spacing[3] },
  col: { flex: 1 },
  label: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.bg.secondary,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 44,
  },
  applyBtn: {
    backgroundColor: colors.accent.green,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    alignItems: "center",
    minHeight: 44,
  },
  applyBtnDisabled: { opacity: 0.5 },
  applyBtnText: {
    ...typography.button,
    color: colors.bg.primary,
  },
  error: {
    ...typography.bodySmall,
    color: colors.status.error,
  },
});

export default SafeLocationPicker;
