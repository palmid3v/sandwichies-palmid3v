import { useEffect } from "react";
import L from "leaflet";
import { Marker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import MapSizeInvalidator from "./MapSizeInvalidator";

const DEFAULT_CENTER = [6.2442, -75.5812];
const MEETING_POINT_ICON = L.divIcon({ className: "meeting-point-marker", html: "", iconSize: [24, 24], iconAnchor: [12, 12] });

function MapInteraction({ point, onSelect }) {
  const map = useMap();
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  useEffect(() => {
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
  }, [map, latitude, longitude]);
  useMapEvents({ click: ({ latlng }) => onSelect({ latitude: latlng.lat, longitude: latlng.lng }) });
  const handleDragEnd = (event) => {
    const position = event.target.getLatLng();
    onSelect({ latitude: position.lat, longitude: position.lng });
  };
  return point ? <Marker
    position={[point.latitude, point.longitude]}
    icon={MEETING_POINT_ICON}
    draggable
    eventHandlers={{ dragend: handleDragEnd }}
    keyboard
    title="Arrastra para ajustar el punto de encuentro"
    alt="Punto de encuentro"
  /> : null;
}

export default function MeetingPointPicker({ point, onSelect }) {
  return <div className="meeting-point-map-wrap">
    <MapContainer center={point ? [point.latitude, point.longitude] : DEFAULT_CENTER} zoom={13} scrollWheelZoom={false} className="meeting-point-map" aria-label="Selecciona tu punto de encuentro. Toca el mapa para mover el pin.">
      <MapSizeInvalidator />
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapInteraction point={point} onSelect={onSelect} />
    </MapContainer>
    <small>Toca el mapa para colocar el pin o arrástralo para ajustar la ubicación. También puedes editar las coordenadas manualmente debajo.</small>
  </div>;
}
