import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { cn } from "./ui";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  /** palette token name */
  tone?: "rust" | "gold" | "sage" | "turq" | "ink";
  active?: boolean;
}

const TONE_HEX: Record<string, string> = {
  rust: "#b8502b",
  gold: "#e0a458",
  sage: "#7e8f63",
  turq: "#2f8f8a",
  ink: "#2b1d12",
};

let cachedToken: string | null | undefined;
async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken ?? null;
  try {
    const r = await fetch("/api/config");
    const d = (await r.json()) as { mapboxToken?: string | null };
    cachedToken = d.mapboxToken ?? null;
  } catch {
    cachedToken = null;
  }
  return cachedToken ?? null;
}

export function RodeoMap({
  pins,
  selectedId,
  onSelect,
  routeOrigin,
  showRoute,
  className,
}: {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  routeOrigin?: { lat: number; lng: number } | null;
  showRoute?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getToken().then(setToken);
  }, []);

  // init map once we have a token + container
  useEffect(() => {
    if (!token || !ref.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-98.5, 33.5],
      zoom: 4.2,
      attributionControl: false,
      cooperativeGestures: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [token]);

  // sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const render = () => {
      // remove stale
      for (const [id, m] of Object.entries(markersRef.current)) {
        if (!pins.find((p) => p.id === id)) {
          m.remove();
          delete markersRef.current[id];
        }
      }
      const bounds = new mapboxgl.LngLatBounds();
      for (const p of pins) {
        bounds.extend([p.lng, p.lat]);
        const hex = TONE_HEX[p.tone ?? "rust"];
        let marker = markersRef.current[p.id];
        if (!marker) {
          const el = document.createElement("button");
          el.className = "eight-pin";
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelect?.(p.id);
          });
          marker = new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
          markersRef.current[p.id] = marker;
        }
        const el = marker.getElement();
        const selected = p.id === selectedId;
        el.style.cssText = `width:${selected ? 26 : 18}px;height:${selected ? 26 : 18}px;border-radius:50%;cursor:pointer;border:2px solid #faf4e8;background:${hex};box-shadow:0 2px 6px rgba(43,29,18,.4);transition:all .2s;${selected ? "z-index:5;transform:scale(1.1)" : ""}`;
      }
      if (routeOrigin) bounds.extend([routeOrigin.lng, routeOrigin.lat]);
      if (pins.length) {
        try {
          map.fitBounds(bounds, { padding: 60, maxZoom: 8, duration: 600 });
        } catch {
          /* single point */
        }
      }
    };

    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [pins, selectedId, onSelect, routeOrigin]);

  // draw a travel route (origin -> each pin, nearest-first) as a line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const draw = () => {
      const id = "tour-route";
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
      if (!showRoute || !routeOrigin || pins.length === 0) return;

      const ordered = [...pins].sort(
        (a, b) =>
          dist(routeOrigin, a) - dist(routeOrigin, b),
      );
      const coords = [[routeOrigin.lng, routeOrigin.lat], ...ordered.map((p) => [p.lng, p.lat])];
      map.addSource(id, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
      });
      map.addLayer({
        id,
        type: "line",
        source: id,
        paint: { "line-color": "#b8502b", "line-width": 3, "line-dasharray": [2, 1.5], "line-opacity": 0.85 },
      });
    };
    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
  }, [showRoute, routeOrigin, pins]);

  if (token === null) {
    return <MapFallback pins={pins} selectedId={selectedId} onSelect={onSelect} className={className} />;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div ref={ref} className="h-full w-full" />
      {token === undefined && (
        <div className="absolute inset-0 grid place-items-center bg-paper/60 text-xs text-ink/50">
          Loading map…
        </div>
      )}
    </div>
  );
}

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.hypot(a.lat - b.lat, a.lng - b.lng);
}

/* Graceful no-token fallback: a tidy plotted "constellation" of pins so the
   feature still communicates value without Mapbox. */
function MapFallback({
  pins,
  selectedId,
  onSelect,
  className,
}: {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const x = (p: MapPin) => ((p.lng - minLng) / (maxLng - minLng || 1)) * 88 + 6;
  const y = (p: MapPin) => (1 - (p.lat - minLat) / (maxLat - minLat || 1)) * 80 + 8;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-saddle/20 bg-gradient-to-br from-paper to-sand/40", className)}>
      <div className="pointer-events-none absolute inset-0 grain opacity-50" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.07]" preserveAspectRatio="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`h${i}`} x1="0" x2="100%" y1={`${i * 14}%`} y2={`${i * 14}%`} stroke="#2b1d12" strokeWidth="1" />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v${i}`} y1="0" y2="100%" x1={`${i * 11}%`} x2={`${i * 11}%`} stroke="#2b1d12" strokeWidth="1" />
        ))}
      </svg>
      {pins.map((p) => {
        const hex = TONE_HEX[p.tone ?? "rust"];
        const selected = p.id === selectedId;
        return (
          <button
            key={p.id}
            onClick={() => onSelect?.(p.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bone transition hover:scale-125"
            style={{
              left: `${x(p)}%`,
              top: `${y(p)}%`,
              width: selected ? 22 : 15,
              height: selected ? 22 : 15,
              background: hex,
              boxShadow: "0 2px 6px rgba(43,29,18,.4)",
              zIndex: selected ? 5 : 1,
            }}
            title={`${p.title}${p.subtitle ? " · " + p.subtitle : ""}`}
          />
        );
      })}
      <div className="absolute bottom-2 left-3 text-[10px] font-semibold uppercase tracking-widest text-ink/40">
        Map preview
      </div>
    </div>
  );
}
