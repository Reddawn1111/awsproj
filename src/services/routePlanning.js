async function requestDirections(coordinates, params) {
  const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params}`);
  if (!response.ok) throw new Error(`Mapbox Directions HTTP ${response.status}`);
  const data = await response.json();
  if (!data.routes?.length) throw new Error('Mapbox Directions returned no navigable routes.');
  if (data.routes.some(route => !Array.isArray(route.geometry?.coordinates) || route.geometry.coordinates.length < 2)) {
    throw new Error('Mapbox Directions returned route data without usable road geometry.');
  }
  return data.routes;
}

/**
 * Fetch navigable alternatives and, when possible, ask Mapbox to avoid modeled hazard points.
 * @param {Object} origin - { coords: [lng, lat], label?: string }
 * @param {Object} destination - { coords: [lng, lat], label?: string }
 * @param {string} mapboxToken - Mapbox public access token
 * @param {Array<[number, number]>} exclusionCoordinates - [[lng, lat], ...] points to avoid
 */
export async function fetchAlternativeRoutes(origin, destination, mapboxToken, exclusionCoordinates = []) {
  if (!mapboxToken) throw new Error('Mapbox Directions is unavailable until a Mapbox token is configured.');

  const coordinates = `${origin.coords[0]},${origin.coords[1]};${destination.coords[0]},${destination.coords[1]}`;
  const params = new URLSearchParams({
    alternatives: 'true',
    geometries: 'geojson',
    overview: 'full',
    steps: 'false',
    access_token: mapboxToken
  });

  let routes;
  let exclusionStatus = 'none';
  let notice = '';

  if (exclusionCoordinates.length) {
    const excludedParams = new URLSearchParams(params);
    // Mapbox Directions supports up to 50 point exclusions
    const pointExclusions = exclusionCoordinates
      .slice(0, 50)
      .map(([lng, lat]) => `point(${lng} ${lat})`)
      .join(',');

    excludedParams.set('exclude', pointExclusions);
    try {
      routes = await requestDirections(coordinates, excludedParams);
      exclusionStatus = 'requested';
    } catch (error) {
      notice = `Mapbox could not apply flood point exclusions (${error.message}); returned ordinary route alternatives for assessment.`;
    }
  }

  if (!routes) {
    routes = await requestDirections(coordinates, params);
  }

  return {
    routes: routes.map((route, index) => ({
      id: `mapbox-route-${index + 1}`,
      name: index === 0 ? 'Primary route' : `Alternative ${index}`,
      coordinates: route.geometry.coordinates,
      distance: route.distance,
      duration: route.duration,
      source: 'MAPBOX DIRECTIONS',
      isDemo: false
    })),
    source: 'MAPBOX',
    exclusionStatus,
    notice
  };
}
