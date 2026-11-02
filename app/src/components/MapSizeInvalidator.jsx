import { useEffect } from "react";
import { useMap } from "react-leaflet";

export default function MapSizeInvalidator() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;

    const invalidate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, animate: false });
      });
    };

    map.whenReady(invalidate);

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(invalidate)
      : null;

    observer?.observe(container);
    window.addEventListener("resize", invalidate);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);

  return null;
}
