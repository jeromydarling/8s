import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { MapPin } from "./RodeoMap";

const RodeoMap = lazy(() => import("./RodeoMap").then((m) => ({ default: m.RodeoMap })));

// Loads mapbox-gl (~heavy) only when the map scrolls into view, keeping it out
// of the initial bundle. Same props as RodeoMap.
export function LazyRodeoMap(props: {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  routeOrigin?: { lat: number; lng: number } | null;
  showRoute?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ref.current || show) return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setShow(true),
      { rootMargin: "200px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [show]);

  return (
    <div ref={ref} className={props.className}>
      {show ? (
        <Suspense fallback={<MapSkeleton />}>
          <RodeoMap {...props} className="h-full w-full" />
        </Suspense>
      ) : (
        <MapSkeleton />
      )}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="grid h-full w-full place-items-center rounded-2xl bg-gradient-to-br from-paper to-sand/40 text-xs font-semibold uppercase tracking-widest text-ink/40">
      Map
    </div>
  );
}
