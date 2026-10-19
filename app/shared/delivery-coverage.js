export const DELIVERY_COVERAGE = Object.freeze({
  originAddress: "Cra 96a #49-110",
  radiusKm: 10,
  verificationMode: "manual",
});

const isCoordinate = (value, min, max) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export const distanceInKm = (origin, destination) => {
  if (
    !origin || !destination ||
    !isCoordinate(origin.latitude, -90, 90) ||
    !isCoordinate(origin.longitude, -180, 180) ||
    !isCoordinate(destination.latitude, -90, 90) ||
    !isCoordinate(destination.longitude, -180, 180)
  ) return null;

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const originLatitude = radians(origin.latitude);
  const destinationLatitude = radians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) *
    Math.sin(longitudeDelta / 2) ** 2;
  const bounded = Math.min(1, Math.max(0, haversine));
  return 6371 * 2 * Math.asin(Math.sqrt(bounded));
};

export const assessDeliveryCoverage = ({ originCoordinates, destinationCoordinates } = {}) => {
  const distanceKm = distanceInKm(originCoordinates, destinationCoordinates);
  if (distanceKm === null) {
    return { status: "manual_review", distanceKm: null, withinRadius: null };
  }

  const withinRadius = distanceKm <= DELIVERY_COVERAGE.radiusKm;
  return {
    status: "manual_review",
    distanceKm,
    withinRadius,
  };
};
