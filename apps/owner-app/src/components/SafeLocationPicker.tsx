import React, { Component, Suspense, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { colors, typography, spacing, radius } from "@a3/ui/theme";

/**
 * `react-native-maps` requires a Google Maps API key on Android. When the key
 * is missing, MapView crashes the entire screen on render. We wrap the map in
 * a lazy boundary + ErrorBoundary so that:
 *  - Module-level import failures don't tear down the React tree.
 *  - Render-time native module crashes show a manual lat/lng fallback instead
 *    of a white screen.
 *
 * Falls back to a numeric input UI for lat/lng when the map isn't available.
 */

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

function ManualCoordFallback({
  markerCoord,
  onChange,
}: Pick<Props, "markerCoord" | "onChange">): React.JSX.Element {
  const [latStr, setLatStr] = useState(
    markerCoord ? String(markerCoord.latitude) : "",
  );
  const [lngStr, setLngStr] = useState(
    markerCoord ? String(markerCoord.longitude) : "",
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>Map unavailable</Text>
      <Text style={styles.fallbackBody}>
        Enter your venue coordinates manually. You can copy them from Google
        Maps (right-click your venue → click the lat/lng to copy).
      </Text>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            value={latStr}
            onChangeText={setLatStr}
            keyboardType="numbers-and-punctuation"
            placeholder="28.6139"
            placeholderTextColor={colors.text.tertiary}
            style={styles.input}
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            value={lngStr}
            onChangeText={setLngStr}
            keyboardType="numbers-and-punctuation"
            placeholder="77.2090"
            placeholderTextColor={colors.text.tertiary}
            style={styles.input}
          />
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={styles.applyBtn}
        onPress={() => {
          const lat = Number(latStr);
          const lng = Number(lngStr);
          if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            setError("Latitude must be a number between -90 and 90.");
            return;
          }
          if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            setError("Longitude must be a number between -180 and 180.");
            return;
          }
          setError(null);
          onChange({ latitude: lat, longitude: lng });
        }}
      >
        <Text style={styles.applyBtnText}>Use these coordinates</Text>
      </Pressable>
    </View>
  );
}

export function SafeLocationPicker(props: Props): React.JSX.Element {
  const fallback = (
    <ManualCoordFallback
      markerCoord={props.markerCoord}
      onChange={props.onChange}
    />
  );

  return (
    <MapErrorBoundary fallback={fallback}>
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
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.tertiary,
  },
  fallback: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    padding: spacing[4],
    justifyContent: "center",
    gap: spacing[3],
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
