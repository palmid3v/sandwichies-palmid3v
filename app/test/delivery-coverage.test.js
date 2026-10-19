import test from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERY_COVERAGE,
  assessDeliveryCoverage,
  distanceInKm,
} from "../shared/delivery-coverage.js";

test("delivery coverage uses the configured 10 km radius and manual review", () => {
  assert.equal(DELIVERY_COVERAGE.originAddress, "Cra 96a #49-110");
  assert.equal(DELIVERY_COVERAGE.radiusKm, 10);
  assert.equal(DELIVERY_COVERAGE.verificationMode, "manual");
});

test("coverage assessment requires manual review when coordinates are unavailable", () => {
  assert.deepEqual(assessDeliveryCoverage(), {
    status: "manual_review",
    distanceKm: null,
    withinRadius: null,
  });
});

test("coverage assessment flags a destination inside the radius for manual review", () => {
  const result = assessDeliveryCoverage({
    originCoordinates: { latitude: 4.65, longitude: -74.05 },
    destinationCoordinates: { latitude: 4.66, longitude: -74.05 },
  });
  assert.equal(result.status, "manual_review");
  assert.equal(result.withinRadius, true);
  assert.ok(result.distanceKm > 0 && result.distanceKm < 10);
});

test("coverage assessment flags a destination outside the radius without auto-rejecting it", () => {
  const result = assessDeliveryCoverage({
    originCoordinates: { latitude: 4.65, longitude: -74.05 },
    destinationCoordinates: { latitude: 4.80, longitude: -74.05 },
  });
  assert.equal(result.status, "manual_review");
  assert.equal(result.withinRadius, false);
  assert.ok(result.distanceKm > 10);
});

test("invalid coordinates do not produce a misleading distance", () => {
  assert.equal(distanceInKm(
    { latitude: 100, longitude: 0 },
    { latitude: 0, longitude: 0 },
  ), null);
});
