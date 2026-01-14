/**
 * GPS to Model Coordinate Conversion
 * 
 * Requires a reference point to map between GPS and model coordinates.
 * The reference point should be stored in the database for each model.
 * 
 * Coordinate system mapping:
 * - GPS Latitude (north) → Model Y axis
 * - GPS Longitude (east) → Model X axis
 * - GPS Elevation → Model Z axis (absolute elevation in mm)
 */

export interface ReferencePoint {
  gps: {
    lat: number;
    lon: number;
    elev: number;
  };
  model: {
    x: number;
    y: number;
    z: number;
  };
}

// Earth radius and conversion factors
// 1 degree of latitude ≈ 111,000 meters (constant)
// 1 degree of longitude ≈ 111,000 * cos(latitude) meters
const METERS_PER_DEGREE_LAT = 111000;

/**
 * Calculate meters per degree longitude at a given latitude
 */
function getMetersPerDegreeLon(latitude: number): number {
  const latRad = (latitude * Math.PI) / 180;
  return METERS_PER_DEGREE_LAT * Math.cos(latRad);
}

/**
 * Convert GPS coordinates (lat, lon, elev) to model coordinates (x, y, z)
 * @param gpsCoords GPS input (elevation in meters)
 * @param targetUnitScale Conversion factor from meters to model unit (1000 for mm, 1 for m, 3.28084 for ft)
 * @param referencePoint Reference point mapping between GPS and model coordinates (REQUIRED)
 */
export function gpsToModel(
  gpsCoords: { lat: number; lon: number; elev: number },
  targetUnitScale: number = 1,
  referencePoint: ReferencePoint
): { x: number; y: number; z: number } {
  if (!referencePoint) {
    throw new Error('Reference point is required for GPS to model conversion');
  }

  const refGps = referencePoint.gps;
  const refModel = referencePoint.model;

  // Calculate differences from reference point in GPS units (degrees and meters)
  const deltaLat = gpsCoords.lat - refGps.lat;
  const deltaLon = gpsCoords.lon - refGps.lon;
  const deltaElev = gpsCoords.elev - refGps.elev; // both in meters

  // Calculate meters per degree longitude at current latitude
  const metersPerDegreeLon = getMetersPerDegreeLon(gpsCoords.lat);

  // Convert lat/lon differences to meters
  const deltaXMeters = deltaLon * metersPerDegreeLon;
  const deltaYMeters = deltaLat * METERS_PER_DEGREE_LAT;
  const deltaZMeters = deltaElev; // already in meters

  // Convert meter deltas to target units
  const deltaXInTargetUnits = deltaXMeters * targetUnitScale;
  const deltaYInTargetUnits = deltaYMeters * targetUnitScale;
  const deltaZInTargetUnits = deltaZMeters * targetUnitScale;

  // Return coordinates in target units (reference is already in target units)
  return {
    x: refModel.x + deltaXInTargetUnits,
    y: refModel.y + deltaYInTargetUnits,
    z: refModel.z + deltaZInTargetUnits,
  };
}
