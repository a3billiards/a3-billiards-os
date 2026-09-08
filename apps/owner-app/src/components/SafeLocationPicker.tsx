import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { colors, typography, spacing, radius } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";

/**
 * Uses a WebView + Leaflet/OpenStreetMap page instead of `react-native-maps`
 * so a real, tappable/draggable pin map works out of the box on every build —
 * no Google Maps SDK API key or native config required. Manual latitude/
 * longitude fields are shown alongside it for precise entry.
 */

type Coord = { latitude: number; longitude: number };

type PlaceResult = {
  placeId: string;
  label: string;
  latitude: number;
  longitude: number;
};

async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=6&addressdetails=0`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "A3BilliardsOS/1.0 (club-location-picker)",
    },
  });
  if (!res.ok) throw new Error("search failed");

  const rows = (await res.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return rows
    .map((row) => {
      const latitude = Number(row.lat);
      const longitude = Number(row.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return {
        placeId: String(row.place_id),
        label: row.display_name,
        latitude,
        longitude,
      };
    })
    .filter((row): row is PlaceResult => row !== null);
}

function PlaceSearch({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: (coord: Coord) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    debounceRef.current = setTimeout(() => {
      void searchPlaces(trimmed)
        .then((rows) => {
          setResults(rows);
          setSearching(false);
        })
        .catch(() => {
          setResults([]);
          setSearching(false);
          setSearchError(t("sharedUi.safeLocationPicker.searchFailed"));
        });
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, t]);

  return (
    <View style={styles.searchSection}>
      <Text style={styles.label}>{t("sharedUi.safeLocationPicker.searchPlace")}</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        editable={!disabled}
        placeholder={t("sharedUi.safeLocationPicker.searchPlaceholder")}
        placeholderTextColor={colors.text.tertiary}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="words"
      />
      {searching ? (
        <View style={styles.searchStatusRow}>
          <ActivityIndicator size="small" color={colors.accent.green} />
          <Text style={styles.searchStatusText}>
            {t("sharedUi.safeLocationPicker.searching")}
          </Text>
        </View>
      ) : null}
      {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
      {!searching && query.trim().length >= 3 && results.length === 0 && !searchError ? (
        <Text style={styles.searchStatusText}>{t("sharedUi.safeLocationPicker.noResults")}</Text>
      ) : null}
      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.placeId}
          keyboardShouldPersistTaps="handled"
          style={styles.resultsList}
          nestedScrollEnabled
          renderItem={({ item }) => (
            <Pressable
              style={styles.resultRow}
              disabled={disabled}
              onPress={() => {
                onSelect({ latitude: item.latitude, longitude: item.longitude });
                setQuery(item.label.split(",").slice(0, 2).join(",").trim());
                setResults([]);
              }}
            >
              <Text style={styles.resultText} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      ) : null}
    </View>
  );
}

interface Props {
  initialRegion: Coord & { latitudeDelta: number; longitudeDelta: number };
  markerCoord: Coord | null;
  draggable: boolean;
  onChange: (c: Coord) => void;
}

function escapeForScript(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function buildMapHtml(center: Coord, draggable: boolean): string {
  const lat = escapeForScript(center.latitude);
  const lng = escapeForScript(center.longitude);
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var marker = L.marker([${lat}, ${lng}], { draggable: ${draggable ? "true" : "false"} }).addTo(map);

  function post(coord) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(coord));
    }
  }

  marker.on('dragend', function () {
    var p = marker.getLatLng();
    post({ latitude: p.lat, longitude: p.lng });
  });

  map.on('click', function (e) {
    if (!marker.options.draggable) return;
    marker.setLatLng(e.latlng);
    post({ latitude: e.latlng.lat, longitude: e.latlng.lng });
  });

  window.setMarkerFromNative = function (lat, lng) {
    var next = L.latLng(lat, lng);
    marker.setLatLng(next);
    map.setView(next);
  };

  window.setDraggableFromNative = function (isDraggable) {
    if (isDraggable) marker.dragging.enable();
    else marker.dragging.disable();
  };

  window.onerror = function (msg) { post({ error: String(msg) }); };
</script>
</body>
</html>`;
}

function ManualCoordFields({
  markerCoord,
  onChange,
  disabled,
}: Pick<Props, "markerCoord" | "onChange"> & {
  disabled?: boolean;
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
      <Text style={styles.manualHint}>
        {t("sharedUi.safeLocationPicker.manualPinHint")}
      </Text>
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
  const { initialRegion, markerCoord, draggable, onChange } = props;
  const { t } = useTranslation();
  const webviewRef = useRef<WebView>(null);
  const [mapFailed, setMapFailed] = useState(false);

  const initialCenter = useMemo<Coord>(
    () => markerCoord ?? { latitude: initialRegion.latitude, longitude: initialRegion.longitude },
    // Only used to seed the page HTML on first mount — subsequent marker
    // moves are applied imperatively via injectJavaScript to avoid reloading
    // (and re-zooming/panning) the WebView on every drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const html = useMemo(
    () => buildMapHtml(initialCenter, draggable),
    // Rebuild only if draggable mode toggles at mount-adjacent time; live
    // toggles are handled via setDraggableFromNative below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!markerCoord || mapFailed) return;
    webviewRef.current?.injectJavaScript(
      `window.setMarkerFromNative && window.setMarkerFromNative(${markerCoord.latitude}, ${markerCoord.longitude}); true;`,
    );
  }, [markerCoord?.latitude, markerCoord?.longitude, markerCoord, mapFailed]);

  useEffect(() => {
    if (mapFailed) return;
    webviewRef.current?.injectJavaScript(
      `window.setDraggableFromNative && window.setDraggableFromNative(${draggable ? "true" : "false"}); true;`,
    );
  }, [draggable, mapFailed]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as Partial<Coord> & { error?: string };
        if (data.error) return;
        if (
          typeof data.latitude === "number" &&
          typeof data.longitude === "number" &&
          Number.isFinite(data.latitude) &&
          Number.isFinite(data.longitude)
        ) {
          onChange({ latitude: data.latitude, longitude: data.longitude });
        }
      } catch {
        // ignore malformed messages
      }
    },
    [onChange],
  );

  return (
    <View style={styles.root}>
      <PlaceSearch
        disabled={!draggable}
        onSelect={(coord) => onChange(coord)}
      />
      {!mapFailed ? (
        <View style={styles.mapWrap}>
          <WebView
            ref={webviewRef}
            originWhitelist={["*"]}
            source={{ html }}
            style={styles.map}
            onMessage={onMessage}
            onError={() => setMapFailed(true)}
            onHttpError={() => setMapFailed(true)}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.accent.green} />
              </View>
            )}
          />
        </View>
      ) : (
        <View style={styles.mapFallbackBox}>
          <Text style={styles.fallbackTitle}>
            {t("sharedUi.safeLocationPicker.mapUnavailable")}
          </Text>
          <Text style={styles.fallbackBody}>
            {t("sharedUi.safeLocationPicker.fallbackInstructions")}
          </Text>
        </View>
      )}
      <ManualCoordFields
        markerCoord={markerCoord}
        onChange={onChange}
        disabled={!draggable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing[3] },
  searchSection: { gap: spacing[2] },
  searchStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  searchStatusText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  resultsList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
  },
  resultRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  resultText: {
    ...typography.bodySmall,
    color: colors.text.primary,
  },
  mapWrap: { minHeight: 220, borderRadius: radius.md, overflow: "hidden" },
  map: { flex: 1, minHeight: 220 },
  mapFallbackBox: { minHeight: 120, padding: spacing[3], justifyContent: "center" },
  loadingBox: {
    flex: 1,
    minHeight: 220,
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
