import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";

export const DEFAULT_CLUB_PIN = { lat: 28.6139, lng: 77.209 };

const TILE_SIZE = 256;
const MIN_ZOOM = 12;
const MAX_ZOOM = 18;
const DEFAULT_ZOOM = 15;
const MAX_TILES = 36;
const MAP_HEIGHT = 280;

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
  focusLat?: number | null;
  focusLng?: number | null;
  /** Bumps when parent wants the map to jump to focusLat/focusLng once. */
  focusToken?: number;
  /** Hide the drag/click hint (parent can show it elsewhere). */
  hideHint?: boolean;
};

type Point = { x: number; y: number };

function project(lat: number, lng: number, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function unproject(
  x: number,
  y: number,
  zoom: number,
): { lat: number; lng: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function tileUrl(z: number, x: number, y: number): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

function nearlySame(a: number, b: number, eps = 1e-7): boolean {
  return Math.abs(a - b) < eps;
}

function ClubLocationPinPickerInner({
  lat,
  lng,
  onChange,
  disabled,
  focusLat,
  focusLng,
  focusToken = 0,
  hideHint = false,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastFocusTokenRef = useRef<number>(-1);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startCenter: { lat: number; lng: number };
    moved: boolean;
  } | null>(null);
  const mapWidthRef = useRef(640);
  const resizeTimerRef = useRef<number | null>(null);

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [center, setCenter] = useState(() => ({
    lat: lat ?? focusLat ?? DEFAULT_CLUB_PIN.lat,
    lng: lng ?? focusLng ?? DEFAULT_CLUB_PIN.lng,
  }));
  // Width only — height is CSS-fixed to stop scroll/resize flicker.
  const [mapWidth, setMapWidth] = useState(640);
  const [isDragging, setIsDragging] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Apply parent geocode focus once per token — avoids re-centering loops.
  useEffect(() => {
    if (focusToken === lastFocusTokenRef.current) return;
    if (focusLat == null || focusLng == null) return;
    if (!Number.isFinite(focusLat) || !Number.isFinite(focusLng)) return;

    lastFocusTokenRef.current = focusToken;
    setCenter({ lat: focusLat, lng: focusLng });
    if (
      lat == null ||
      lng == null ||
      !nearlySame(lat, focusLat) ||
      !nearlySame(lng, focusLng)
    ) {
      onChangeRef.current(focusLat, focusLng);
    }
  }, [focusToken, focusLat, focusLng, lat, lng]);

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;

    const applyWidth = (width: number) => {
      const next = Math.max(240, Math.round(width));
      if (Math.abs(mapWidthRef.current - next) < 8) return;
      mapWidthRef.current = next;
      setMapWidth(next);
    };

    applyWidth(node.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      if (resizeTimerRef.current != null) {
        window.clearTimeout(resizeTimerRef.current);
      }
      // Debounce so page scroll / scrollbar gutter does not thrash tiles.
      resizeTimerRef.current = window.setTimeout(() => {
        applyWidth(width);
      }, 120);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (resizeTimerRef.current != null) {
        window.clearTimeout(resizeTimerRef.current);
      }
    };
  }, []);

  const pinLat = lat ?? center.lat;
  const pinLng = lng ?? center.lng;

  const view = useMemo(() => {
    const width = mapWidth;
    const height = MAP_HEIGHT;
    const centerPx = project(center.lat, center.lng, zoom);
    const topLeft = {
      x: centerPx.x - width / 2,
      y: centerPx.y - height / 2,
    };
    const pinPx = project(pinLat, pinLng, zoom);
    const pinScreen = {
      x: Math.round(pinPx.x - topLeft.x),
      y: Math.round(pinPx.y - topLeft.y),
    };

    const startTileX = Math.floor(topLeft.x / TILE_SIZE);
    const startTileY = Math.floor(topLeft.y / TILE_SIZE);
    const endTileX = Math.floor((topLeft.x + width) / TILE_SIZE);
    const endTileY = Math.floor((topLeft.y + height) / TILE_SIZE);
    const maxTile = 2 ** zoom;

    const tiles: Array<{ key: string; left: number; top: number; url: string }> =
      [];
    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
        if (tileX < 0 || tileY < 0 || tileX >= maxTile || tileY >= maxTile) {
          continue;
        }
        tiles.push({
          key: `${zoom}-${tileX}-${tileY}`,
          left: Math.round(tileX * TILE_SIZE - topLeft.x),
          top: Math.round(tileY * TILE_SIZE - topLeft.y),
          url: tileUrl(zoom, tileX, tileY),
        });
        if (tiles.length >= MAX_TILES) break;
      }
      if (tiles.length >= MAX_TILES) break;
    }

    return { topLeft, pinScreen, tiles };
  }, [center.lat, center.lng, mapWidth, pinLat, pinLng, zoom]);

  const handleMapClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (disabled || !mapRef.current) return;
      if (dragRef.current?.moved || isDragging) return;
      const rect = mapRef.current.getBoundingClientRect();
      const worldX = view.topLeft.x + (event.clientX - rect.left);
      const worldY = view.topLeft.y + (event.clientY - rect.top);
      const next = unproject(worldX, worldY, zoom);
      if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;
      onChangeRef.current(next.lat, next.lng);
      setCenter(next);
    },
    [disabled, isDragging, view.topLeft.x, view.topLeft.y, zoom],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled || !mapRef.current) return;
      mapRef.current.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startCenter: { ...center },
        moved: false,
      };
      setIsDragging(false);
    },
    [center, disabled],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        drag.moved = true;
        setIsDragging(true);
      }
      if (!drag.moved) return;
      const startPx = project(drag.startCenter.lat, drag.startCenter.lng, zoom);
      const next = unproject(startPx.x - dx, startPx.y - dy, zoom);
      if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;
      setCenter(next);
    },
    [zoom],
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try {
      mapRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    window.setTimeout(() => setIsDragging(false), 0);
  }, []);

  const handleUseMyLocation = () => {
    if (disabled) return;
    if (!navigator.geolocation) {
      setLocationError(
        "Location is not available in this browser. Click the map to place your pin.",
      );
      return;
    }
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) {
          setLocationError(
            "Could not read a valid location. Click the map instead.",
          );
          return;
        }
        setCenter(next);
        onChangeRef.current(next.lat, next.lng);
      },
      () => {
        setLocationError(
          "Could not get your location. Allow location access or click the map to place your pin.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const hasPin = lat !== null && lng !== null && !(lat === 0 && lng === 0);

  return (
    <div className="club-location-picker">
      {hideHint ? null : (
        <p className="muted">
          Drag the map to move around, click to drop the pin, or use your current
          location. Use +/− to zoom.
        </p>
      )}
      <div className="club-location-map-card">
        <div className="club-location-map-wrap">
          <div
            ref={mapRef}
            className={`club-location-map ${isDragging ? "club-location-map--dragging" : ""}`}
            aria-label="Club location map"
            onClick={handleMapClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="application"
          >
            {view.tiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.url}
                alt=""
                decoding="async"
                draggable={false}
                className="club-location-tile"
                style={{
                  transform: `translate3d(${tile.left}px, ${tile.top}px, 0)`,
                }}
              />
            ))}
            <div
              className="club-pin-dot club-location-pin"
              style={{
                transform: `translate3d(${view.pinScreen.x}px, ${view.pinScreen.y}px, 0)`,
              }}
            />
          </div>
          <div className="club-location-controls">
            <button
              type="button"
              className="btn btn-secondary club-location-control"
              disabled={disabled || zoom >= MAX_ZOOM}
              onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 1))}
            >
              +
            </button>
            <button
              type="button"
              className="btn btn-secondary club-location-control"
              disabled={disabled || zoom <= MIN_ZOOM}
              onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 1))}
            >
              −
            </button>
          </div>
        </div>
        {hasPin ? (
          <p className="muted club-location-coords">
            Pin: {lat!.toFixed(5)}, {lng!.toFixed(5)}
          </p>
        ) : (
          <p className="muted club-location-coords">
            Click the map to place your club pin.
          </p>
        )}
        <button
          type="button"
          className="btn btn-secondary club-location-geo"
          disabled={disabled}
          onClick={handleUseMyLocation}
        >
          Use my current location
        </button>
        {locationError ? (
          <p className="muted club-location-coords" role="alert">
            {locationError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const ClubLocationPinPicker = memo(ClubLocationPinPickerInner);
