import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const DEFAULT_CLUB_PIN = { lat: 28.6139, lng: 77.2090 };

const TILE_SIZE = 256;
const MIN_ZOOM = 12;
const MAX_ZOOM = 18;
const DEFAULT_ZOOM = 15;

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
};

type Point = { x: number; y: number };

function project(lat: number, lng: number, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function unproject(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function tileUrl(z: number, x: number, y: number): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export function ClubLocationPinPicker({ lat, lng, onChange, disabled }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [center, setCenter] = useState(() => ({
    lat: lat ?? DEFAULT_CLUB_PIN.lat,
    lng: lng ?? DEFAULT_CLUB_PIN.lng,
  }));
  const [mapSize, setMapSize] = useState({ width: 640, height: 320 });

  useEffect(() => {
    if (lat === null || lng === null) {
      onChangeRef.current(center.lat, center.lng);
    }
  }, [center.lat, center.lng, lat, lng]);

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setMapSize({
        width: Math.max(1, Math.round(entry.contentRect.width)),
        height: Math.max(1, Math.round(entry.contentRect.height)),
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pinLat = lat ?? center.lat;
  const pinLng = lng ?? center.lng;

  const view = useMemo(() => {
    const centerPx = project(center.lat, center.lng, zoom);
    const topLeft = {
      x: centerPx.x - mapSize.width / 2,
      y: centerPx.y - mapSize.height / 2,
    };
    const pinPx = project(pinLat, pinLng, zoom);
    const pinScreen = {
      x: pinPx.x - topLeft.x,
      y: pinPx.y - topLeft.y,
    };

    const startTileX = Math.floor(topLeft.x / TILE_SIZE);
    const startTileY = Math.floor(topLeft.y / TILE_SIZE);
    const endTileX = Math.floor((topLeft.x + mapSize.width) / TILE_SIZE);
    const endTileY = Math.floor((topLeft.y + mapSize.height) / TILE_SIZE);
    const maxTile = 2 ** zoom;

    const tiles: Array<{ key: string; left: number; top: number; url: string }> = [];
    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
        if (tileX < 0 || tileY < 0 || tileX >= maxTile || tileY >= maxTile) continue;
        tiles.push({
          key: `${zoom}-${tileX}-${tileY}`,
          left: tileX * TILE_SIZE - topLeft.x,
          top: tileY * TILE_SIZE - topLeft.y,
          url: tileUrl(zoom, tileX, tileY),
        });
      }
    }

    return { topLeft, pinScreen, tiles };
  }, [center.lat, center.lng, mapSize.height, mapSize.width, pinLat, pinLng, zoom]);

  const handleMapClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const worldX = view.topLeft.x + (event.clientX - rect.left);
      const worldY = view.topLeft.y + (event.clientY - rect.top);
      const next = unproject(worldX, worldY, zoom);
      onChangeRef.current(next.lat, next.lng);
      setCenter(next);
    },
    [disabled, view.topLeft.x, view.topLeft.y, zoom],
  );

  const handleUseMyLocation = () => {
    if (disabled || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCenter(next);
        onChangeRef.current(next.lat, next.lng);
      },
      undefined,
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const hasPin = lat !== null && lng !== null && !(lat === 0 && lng === 0);

  return (
    <div className="club-location-picker">
      <p className="muted">
        Tap the map to place the pin, or drag the map with the arrows and zoom to fine-tune your
        club&apos;s location for &quot;near me&quot; search.
      </p>
      <div className="club-location-map-wrap">
        <div
          ref={mapRef}
          className="club-location-map"
          aria-label="Club location map"
          onClick={handleMapClick}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
            }
          }}
        >
          {view.tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              draggable={false}
              className="club-location-tile"
              style={{ left: tile.left, top: tile.top }}
            />
          ))}
          <div
            className="club-pin-dot club-location-pin"
            style={{ left: view.pinScreen.x, top: view.pinScreen.y }}
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
          <button
            type="button"
            className="btn btn-secondary club-location-control"
            disabled={disabled}
            onClick={() => setCenter((value) => ({ ...value, lat: value.lat + 0.002 }))}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn-secondary club-location-control"
            disabled={disabled}
            onClick={() => setCenter((value) => ({ ...value, lat: value.lat - 0.002 }))}
          >
            ↓
          </button>
          <button
            type="button"
            className="btn btn-secondary club-location-control"
            disabled={disabled}
            onClick={() => setCenter((value) => ({ ...value, lng: value.lng - 0.002 }))}
          >
            ←
          </button>
          <button
            type="button"
            className="btn btn-secondary club-location-control"
            disabled={disabled}
            onClick={() => setCenter((value) => ({ ...value, lng: value.lng + 0.002 }))}
          >
            →
          </button>
        </div>
      </div>
      {hasPin ? (
        <p className="muted club-location-coords">
          Pin: {lat!.toFixed(5)}, {lng!.toFixed(5)}
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-secondary"
        disabled={disabled}
        onClick={handleUseMyLocation}
      >
        Use my current location
      </button>
    </div>
  );
}
