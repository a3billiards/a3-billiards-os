import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
export const DEFAULT_CLUB_PIN = { lat: 28.6139, lng: 77.2090 };
const TILE_SIZE = 256;
const MIN_ZOOM = 12;
const MAX_ZOOM = 18;
const DEFAULT_ZOOM = 15;
function project(lat, lng, zoom) {
    const scale = TILE_SIZE * 2 ** zoom;
    const x = ((lng + 180) / 360) * scale;
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    return { x, y };
}
function unproject(x, y, zoom) {
    const scale = TILE_SIZE * 2 ** zoom;
    const lng = (x / scale) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * y) / scale;
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { lat, lng };
}
function tileUrl(z, x, y) {
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}
export function ClubLocationPinPicker({ lat, lng, onChange, disabled, focusLat, focusLng, }) {
    const mapRef = useRef(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const dragRef = useRef(null);
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const [center, setCenter] = useState(() => ({
        lat: lat ?? focusLat ?? DEFAULT_CLUB_PIN.lat,
        lng: lng ?? focusLng ?? DEFAULT_CLUB_PIN.lng,
    }));
    const [mapSize, setMapSize] = useState({ width: 640, height: 360 });
    const [isDragging, setIsDragging] = useState(false);
    const [locationError, setLocationError] = useState(null);
    useEffect(() => {
        if (focusLat == null || focusLng == null)
            return;
        setCenter({ lat: focusLat, lng: focusLng });
        onChangeRef.current(focusLat, focusLng);
    }, [focusLat, focusLng]);
    useEffect(() => {
        const node = mapRef.current;
        if (!node)
            return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry)
                return;
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
        const tiles = [];
        for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
            for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
                if (tileX < 0 || tileY < 0 || tileX >= maxTile || tileY >= maxTile)
                    continue;
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
    const handleMapClick = useCallback((event) => {
        if (disabled || !mapRef.current || isDragging)
            return;
        const rect = mapRef.current.getBoundingClientRect();
        const worldX = view.topLeft.x + (event.clientX - rect.left);
        const worldY = view.topLeft.y + (event.clientY - rect.top);
        const next = unproject(worldX, worldY, zoom);
        onChangeRef.current(next.lat, next.lng);
        setCenter(next);
    }, [disabled, isDragging, view.topLeft.x, view.topLeft.y, zoom]);
    const handlePointerDown = useCallback((event) => {
        if (disabled || !mapRef.current)
            return;
        mapRef.current.setPointerCapture(event.pointerId);
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startCenter: { ...center },
        };
        setIsDragging(false);
    }, [center, disabled]);
    const handlePointerMove = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            setIsDragging(true);
        }
        const startPx = project(drag.startCenter.lat, drag.startCenter.lng, zoom);
        const next = unproject(startPx.x - dx, startPx.y - dy, zoom);
        setCenter(next);
    }, [zoom]);
    const handlePointerUp = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        dragRef.current = null;
        mapRef.current?.releasePointerCapture(event.pointerId);
        setTimeout(() => setIsDragging(false), 0);
    }, []);
    const handleWheel = useCallback((event) => {
        if (disabled)
            return;
        event.preventDefault();
        setZoom((value) => {
            const delta = event.deltaY > 0 ? -1 : 1;
            return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value + delta));
        });
    }, [disabled]);
    const handleUseMyLocation = () => {
        if (disabled)
            return;
        if (!navigator.geolocation) {
            setLocationError("Location is not available in this browser. Click the map to place your pin.");
            return;
        }
        setLocationError(null);
        navigator.geolocation.getCurrentPosition((position) => {
            const next = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };
            setCenter(next);
            onChangeRef.current(next.lat, next.lng);
        }, () => {
            setLocationError("Could not get your location. Allow location access or click the map to place your pin.");
        }, { enableHighAccuracy: true, timeout: 10000 });
    };
    const hasPin = lat !== null && lng !== null && !(lat === 0 && lng === 0);
    return (_jsxs("div", { className: "club-location-picker", children: [_jsx("p", { className: "muted", children: "Drag the map to move around, click to drop the pin, or use your current location. Scroll or use +/\u2212 to zoom." }), _jsxs("div", { className: "club-location-map-wrap", children: [_jsxs("div", { ref: mapRef, className: `club-location-map ${isDragging ? "club-location-map--dragging" : ""}`, "aria-label": "Club location map", onClick: handleMapClick, onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, onPointerCancel: handlePointerUp, onWheel: handleWheel, role: "application", children: [view.tiles.map((tile) => (_jsx("img", { src: tile.url, alt: "", loading: "lazy", decoding: "async", draggable: false, className: "club-location-tile", style: { left: tile.left, top: tile.top } }, tile.key))), _jsx("div", { className: "club-pin-dot club-location-pin", style: { left: view.pinScreen.x, top: view.pinScreen.y } })] }), _jsxs("div", { className: "club-location-controls", children: [_jsx("button", { type: "button", className: "btn btn-secondary club-location-control", disabled: disabled || zoom >= MAX_ZOOM, onClick: () => setZoom((value) => Math.min(MAX_ZOOM, value + 1)), children: "+" }), _jsx("button", { type: "button", className: "btn btn-secondary club-location-control", disabled: disabled || zoom <= MIN_ZOOM, onClick: () => setZoom((value) => Math.max(MIN_ZOOM, value - 1)), children: "\u2212" })] })] }), hasPin ? (_jsxs("p", { className: "muted club-location-coords", children: ["Pin: ", lat.toFixed(5), ", ", lng.toFixed(5)] })) : (_jsx("p", { className: "muted club-location-coords", children: "Click the map to place your club pin." })), _jsx("button", { type: "button", className: "btn btn-secondary", disabled: disabled, onClick: handleUseMyLocation, children: "Use my current location" }), locationError ? (_jsx("p", { className: "muted club-location-coords", role: "alert", children: locationError })) : null] }));
}
