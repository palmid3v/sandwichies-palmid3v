import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import MapSizeInvalidator from "./MapSizeInvalidator";

const DEFAULT_CENTER = [6.2442, -75.5812];

function MapInteraction({ point, onSelect }) {
  const map = useMap();
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  useEffect(() => {
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
  }, [map, latitude, longitude]);
  useMapEvents({ click: ({ latlng }) => onSelect({ latitude: latlng.lat, longitude: latlng.lng }) });
  return point ? <CircleMarker center={[point.latitude, point.longitude]} radius={9} pathOptions={{ color: "#c6f56b", fillColor: "#21a366", fillOpacity: 1 }} /> : null;
}

export default function MeetingPointPicker({ point, onSelect }) {
  return <div className="meeting-point-map-wrap">
    <MapContainer center={point ? [point.latitude, point.longitude] : DEFAULT_CENTER} zoom={13} scrollWheelZoom={false} className="meeting-point-map" aria-label="Selecciona tu punto de encuentro. Toca el mapa para mover el pin.">
      <MapSizeInvalidator />
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapInteraction point={point} onSelect={onSelect} />
    </MapContainer>
    <small>Toca el mapa para colocar o mover el pin. Puedes ajustar las coordenadas manualmente debajo.</small>
  </div>;
}
