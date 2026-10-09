// 4clique Geospatial Camera Configuration
// Default Center: Bengaluru Center (Vidhana Soudha / MG Road axis)

export const BENGALURU_CENTER = [77.5946, 12.9716]; // [Longitude, Latitude]
export const KARNATAKA_CENTER = [75.7139, 15.3173];

export const TARGET_CAMERA = {
  center: BENGALURU_CENTER,
  latitude: 12.9716,
  longitude: 77.5946,
  zoom: 14.5,
  pitch: 55,
  bearing: -15,
  maxPitch: 85,
  minZoom: 5.5,
  maxZoom: 18
};

export const KARNATAKA_CAMERA = {
  center: KARNATAKA_CENTER,
  latitude: 15.3173,
  longitude: 75.7139,
  zoom: 6.8,
  pitch: 35,
  bearing: 0
};

export const TERRAIN_CONFIG = {
  source: 'mapbox-dem',
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  tileSize: 512,
  maxzoom: 14,
  exaggeration: 1.4
};
