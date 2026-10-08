// 4clique Geospatial Camera Configuration
// Target Area: Bellandur / Sarjapur / Outer Ring Road (ORR) technology corridor, Bengaluru

export const TARGET_CAMERA = {
  center: [77.6805, 12.9352], // [Longitude, Latitude]
  latitude: 12.9352,
  longitude: 77.6805,
  zoom: 14.5,
  pitch: 60,
  bearing: -25,
  maxPitch: 85,
  minZoom: 11,
  maxZoom: 18
};

export const TERRAIN_CONFIG = {
  source: 'mapbox-dem',
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  tileSize: 512,
  maxzoom: 14,
  exaggeration: 1.5 // Scientifically calibrated: highlights Bellandur valley basin
};
