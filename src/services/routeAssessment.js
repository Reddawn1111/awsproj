const radians = value => value * Math.PI / 180;

export function distanceBetweenCoords(a, b) {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function pointToRouteDistance(point, coordinates) {
  const [lng, lat] = point;
  const metersPerLng = 111320 * Math.cos(radians(lat));
  const metersPerLat = 110540;
  let minimum = Infinity;
  for (let index = 1; index < coordinates.length; index++) {
    const previous = coordinates[index - 1];
    const next = coordinates[index];
    const ax = (previous[0] - lng) * metersPerLng;
    const ay = (previous[1] - lat) * metersPerLat;
    const bx = (next[0] - lng) * metersPerLng;
    const by = (next[1] - lat) * metersPerLat;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    minimum = Math.min(minimum, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return minimum;
}

function normalizeBounds(bounds) {
  if (Array.isArray(bounds) && bounds.length >= 2) {
    return { minLng: bounds[0][0], minLat: bounds[0][1], maxLng: bounds[1][0], maxLat: bounds[1][1] };
  }
  if (bounds && typeof bounds === 'object') return bounds;
  return null;
}

export function routeWithinBounds(route, bounds) {
  const normalized = normalizeBounds(bounds);
  if (!normalized || !route.coordinates?.length) return false;
  return route.coordinates.every(([lng, lat]) => (
    lng >= normalized.minLng && lng <= normalized.maxLng && lat >= normalized.minLat && lat <= normalized.maxLat
  ));
}

function getGridCellRadiusMeters(simulationResult, cells, bounds) {
  if (simulationResult?.grid_cell_size_meters) return simulationResult.grid_cell_size_meters / 2;
  const side = Math.round(Math.sqrt(cells.length));
  if (side < 2 || side * side !== cells.length || !bounds) return null;
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const cellWidth = distanceBetweenCoords([bounds.minLng, midLat], [bounds.maxLng, midLat]) / (side - 1);
  const cellHeight = distanceBetweenCoords([(bounds.minLng + bounds.maxLng) / 2, bounds.minLat], [(bounds.minLng + bounds.maxLng) / 2, bounds.maxLat]) / (side - 1);
  return Math.hypot(cellWidth, cellHeight) / 2;
}

export function hazardLevel(hazard) {
  const depth = Number(hazard.depth_meters ?? hazard.depth_m ?? 0);
  const tier = String(hazard.tier || '').toUpperCase();
  const status = String(hazard.currentStatus || hazard.defaultStatus || hazard.status || '').toUpperCase();
  const deficit = Number(hazard.deficitPercent || 0);

  if (depth >= 0.8 || tier === 'SEVERE' || tier === 'CRITICAL' || status === 'SEVERE' || deficit >= 35) return 'critical';
  if (depth >= 0.3 || ['MODERATE', 'WARNING'].includes(tier) || status === 'MODERATE' || deficit >= 20) return 'warning';
  if (depth > 0 || ['LOW', 'MILD'].includes(tier)) return 'low';
  return null;
}

/**
 * Evaluates whether a flood hazard intersects the route corridor.
 * Evaluates along origin start radius, destination radius, and route corridor line.
 */
export function matchesRouteCorridor(hazard, route, {
  startRadiusMeters = 200,
  destinationRadiusMeters = 200,
  corridorRadiusMeters = 80
} = {}) {
  const coords = hazard.coords || [Number(hazard.lng), Number(hazard.lat)];
  if (!coords.every(Number.isFinite)) return false;
  if (!route?.coordinates || route.coordinates.length < 2) return false;

  const hazardRadius = Number(hazard.radius_m) || 0;
  const startCoord = route.coordinates[0];
  const destCoord = route.coordinates[route.coordinates.length - 1];

  // 1. Origin / Start zone radius
  const distToStart = distanceBetweenCoords(coords, startCoord);
  if (distToStart <= hazardRadius + startRadiusMeters) {
    return { matches: true, zone: 'start', distance: distToStart };
  }

  // 2. Destination zone radius
  const distToDest = distanceBetweenCoords(coords, destCoord);
  if (distToDest <= hazardRadius + destinationRadiusMeters) {
    return { matches: true, zone: 'destination', distance: distToDest };
  }

  // 3. Polyline route corridor radius
  const distToRoute = pointToRouteDistance(coords, route.coordinates);
  if (distToRoute <= hazardRadius + corridorRadiusMeters) {
    return { matches: true, zone: 'corridor', distance: distToRoute };
  }

  return false;
}

export function matchesRoute(hazard, route) {
  const coords = hazard.coords || [Number(hazard.lng), Number(hazard.lat)];
  if (!coords.every(Number.isFinite)) return false;
  return pointToRouteDistance(coords, route.coordinates) <= (Number(hazard.radius_m) || 0);
}

/**
 * Collects all flood hazard markers including:
 * 1. Live BBMP City Hotspots
 * 2. Severe / Clogged Karnataka Rajakaluves & Drains
 * 3. 1km Block Simulation Pooled Cells
 */
export function collectHazardMarkers(liveHotspots = [], simulationResult = null, simulationStatus = 'idle', drainageAlerts = [], includeBlockCells = false) {
  const markers = [];

  // 1. City Hotspot Model
  liveHotspots
    .filter(hazard => hazardLevel(hazard))
    .forEach(hazard => {
      const coords = hazard.coords || [Number(hazard.lng), Number(hazard.lat)];
      if (coords.every(Number.isFinite)) {
        markers.push({
          ...hazard,
          id: hazard.id || `hotspot-${coords[0]}-${coords[1]}`,
          coords,
          radius_m: Number(hazard.radius_m) || 350,
          level: hazardLevel(hazard),
          source: 'CITY HOTSPOT MODEL'
        });
      }
    });

  // 2. Severe / Clogged Rajakaluve Outfalls
  if (Array.isArray(drainageAlerts)) {
    drainageAlerts
      .filter(drain => hazardLevel(drain))
      .forEach(drain => {
        const coords = drain.coordinates || drain.coords;
        if (coords && coords.length === 2 && coords.every(Number.isFinite)) {
          markers.push({
            id: drain.id || `drain-${coords[0]}-${coords[1]}`,
            name: `${drain.shortName || drain.name || 'Rajakaluve'} (${drain.currentStatus || drain.defaultStatus || 'High Deficit'})`,
            coords,
            radius_m: 250,
            depth_meters: (Number(drain.deficitPercent) || 30) / 40,
            tier: drain.defaultStatus === 'Severe' ? 'SEVERE' : 'MODERATE',
            level: hazardLevel(drain),
            source: 'KARNATAKA RAJAKALUVE DATABASE'
          });
        }
      });
  }

  // 3. Block Simulation Grid Cells (disabled by default to prevent cluttering 3D building view)
  if (includeBlockCells && ['current', 'fallback'].includes(simulationStatus) && Array.isArray(simulationResult?.pooled_cells)) {
    const bounds = normalizeBounds(simulationResult.bounds);
    const cells = simulationResult.pooled_cells.filter(cell => Number.isFinite(Number(cell.lng)) && Number.isFinite(Number(cell.lat)));
    const radius = getGridCellRadiusMeters(simulationResult, cells, bounds);
    if (radius) {
      cells.filter(cell => hazardLevel(cell)).forEach(cell => {
        markers.push({
          id: `block-cell-${cell.row ?? `${cell.lng}-${cell.lat}`}`,
          name: `Flood model ${Number(cell.depth_meters ?? cell.depth_m).toFixed(2)} m`,
          coords: [Number(cell.lng), Number(cell.lat)],
          radius_m: radius,
          depth_meters: Number(cell.depth_meters ?? cell.depth_m),
          tier: cell.tier,
          level: hazardLevel(cell),
          source: simulationStatus === 'fallback' ? 'LOCAL SIMULATION GRID' : 'BLOCK SIMULATION GRID'
        });
      });
    }
  }

  return markers;
}

export function getRouteExclusionCoordinates(hazards, maximum = 50) {
  const severityOrder = { critical: 0, warning: 1, low: 2 };
  const unique = new Map();
  hazards
    .filter(hazard => ['critical', 'warning'].includes(hazard.level))
    .sort((a, b) => severityOrder[a.level] - severityOrder[b.level])
    .forEach(hazard => {
      const key = `${hazard.coords[0].toFixed(5)},${hazard.coords[1].toFixed(5)}`;
      if (!unique.has(key)) unique.set(key, hazard.coords);
    });
  return [...unique.values()].slice(0, maximum);
}

export function assessRouteHazards(route, {
  liveHotspots = [],
  simulationResult = null,
  simulationStatus = 'idle',
  drainageAlerts = [],
  corridorOptions = null
} = {}) {
  const geometryValid = route.coordinates?.length >= 2 && route.coordinates.every(point => point.length >= 2 && point.every(Number.isFinite));
  if (!geometryValid) {
    return { ...route, hazards: [], hazardCount: 0, criticalCount: 0, assessment: 'insufficient', assessmentReason: 'Route geometry is unavailable.' };
  }

  // Evaluator function: check corridor buffer if enabled/applicable, or fallback to direct point-distance
  const checkHazardIntersection = (hazard) => {
    if (corridorOptions) {
      return !!matchesRouteCorridor(hazard, route, corridorOptions);
    }
    return matchesRoute(hazard, route);
  };

  const hotspotHazards = liveHotspots
    .map(hotspot => ({
      ...hotspot,
      coords: hotspot.coords || [Number(hotspot.lng), Number(hotspot.lat)],
      depth_meters: hotspot.depth_meters ?? hotspot.depth_m ?? 0,
      radius_m: Number(hotspot.radius_m) || 350
    }))
    .filter(hazard => hazardLevel(hazard) && checkHazardIntersection(hazard))
    .map(hazard => ({ ...hazard, source: 'CITY HOTSPOT MODEL', level: hazardLevel(hazard) }));

  // Severe rajakaluve drainage hazards along the corridor
  const drainHazards = (Array.isArray(drainageAlerts) ? drainageAlerts : [])
    .filter(drain => hazardLevel(drain))
    .map(drain => ({
      ...drain,
      coords: drain.coordinates || drain.coords,
      radius_m: 250,
      depth_meters: (Number(drain.deficitPercent) || 30) / 40,
      name: drain.shortName || drain.name || 'Rajakaluve Clogging'
    }))
    .filter(hazard => hazard.coords && checkHazardIntersection(hazard))
    .map(hazard => ({ ...hazard, source: 'KARNATAKA RAJAKALUVE DATABASE', level: hazardLevel(hazard) }));

  const resultUsable = ['current', 'fallback'].includes(simulationStatus) && simulationResult;
  const bounds = resultUsable ? normalizeBounds(simulationResult.bounds) : null;
  const cells = resultUsable && Array.isArray(simulationResult.pooled_cells)
    ? simulationResult.pooled_cells.filter(cell => Number.isFinite(Number(cell.lng)) && Number.isFinite(Number(cell.lat)))
    : [];
  const cellRadius = getGridCellRadiusMeters(simulationResult, cells, bounds);
  const routeCovered = routeWithinBounds(route, bounds) && (
    Number(simulationResult.peak_water_depth_m) <= 0 || cellRadius !== null
  );

  const floodCells = cells.filter(cell => hazardLevel(cell)).map(cell => ({
    id: `block-cell-${cell.row ?? cell.id ?? `${cell.lng}-${cell.lat}`}`,
    name: `Simulated water ${Number(cell.depth_meters ?? cell.depth_m).toFixed(2)} m`,
    coords: [Number(cell.lng), Number(cell.lat)],
    radius_m: cellRadius || 0,
    depth_meters: Number(cell.depth_meters ?? cell.depth_m),
    tier: cell.tier,
    source: simulationStatus === 'fallback' ? 'LOCAL SIMULATION GRID' : 'BLOCK SIMULATION GRID',
    level: hazardLevel(cell)
  })).filter(hazard => checkHazardIntersection(hazard));

  const hazards = [...hotspotHazards, ...drainHazards, ...floodCells];
  const criticalCount = hazards.filter(hazard => hazard.level === 'critical').length;
  const simulationFailed = simulationStatus === 'failed';

  let assessment = 'insufficient';
  let assessmentReason = 'The route is outside the simulated block or the flood grid lacks enough geographic detail.';
  if (simulationStatus === 'stale') {
    assessment = 'stale';
    assessmentReason = 'Rainfall or clogging changed after this simulation; run it again to refresh route risk.';
  } else if (simulationFailed) {
    assessment = 'failed';
    assessmentReason = 'The latest simulation failed, so route safety cannot be assessed from it.';
  } else if (hazards.length) {
    assessment = criticalCount ? 'critical' : 'affected';
    assessmentReason = criticalCount
      ? `${criticalCount} critical modeled flood area${criticalCount === 1 ? '' : 's'} intersect this route.`
      : `${hazards.length} modeled flood hotspot${hazards.length === 1 ? '' : 's'} intersect this route.`;
  } else if (simulationStatus === 'current' && routeCovered) {
    assessment = 'clear';
    assessmentReason = 'No sampled flood cells intersect this route inside the simulated block.';
  } else if (simulationStatus === 'fallback' && routeCovered) {
    assessment = 'fallback-clear';
    assessmentReason = 'No sampled flood cells intersect this route in the local fallback model.';
  } else if (simulationStatus === 'idle' && hotspotHazards.length === 0 && drainHazards.length === 0) {
    assessment = 'unassessed';
    assessmentReason = 'Run a block simulation to assess this route against current flood conditions.';
  }

  return {
    ...route,
    hazards,
    hazardCount: hazards.length,
    criticalCount,
    assessment,
    assessmentReason,
    routeCovered,
    cellRadiusMeters: cellRadius
  };
}

export function assessRoutes(routes, options) {
  return routes.map(route => assessRouteHazards(route, options));
}

export function recommendRoute(assessments) {
  const verifiedClear = assessments.filter(route => route.assessment === 'clear');
  if (verifiedClear.length) return [...verifiedClear].sort((a, b) => a.duration - b.duration)[0];
  const modelClear = assessments.filter(route => route.assessment === 'fallback-clear');
  if (modelClear.length) return [...modelClear].sort((a, b) => a.duration - b.duration)[0];
  const unassessed = assessments.filter(route => route.assessment === 'unassessed');
  if (unassessed.length) return [...unassessed].sort((a, b) => a.duration - b.duration)[0];
  const affected = assessments.filter(route => route.assessment === 'affected');
  if (affected.length) return [...affected].sort((a, b) => a.hazardCount - b.hazardCount || a.duration - b.duration)[0];
  return null;
}

export function getRouteRiskNotice(assessments, simulationStatus) {
  if (simulationStatus === 'stale') return 'Simulation is stale. Rerun it before relying on route risk.';
  if (simulationStatus === 'failed') return 'The latest simulation failed. Route safety is unavailable.';
  if (simulationStatus === 'loading') return 'Simulation is running; route assessment is temporarily unavailable.';
  if (assessments.length && assessments.every(route => ['critical', 'affected'].includes(route.assessment))) {
    return 'All returned routes intersect modeled flood hazards. No verified safe alternative is available.';
  }
  if (assessments.some(route => route.assessment === 'clear')) return '';
  if (assessments.some(route => route.assessment === 'fallback-clear')) {
    return 'A critical modeled flood area intersects one or more routes; the local-model alternative is not a verified safe route.';
  }
  if (assessments.some(route => route.assessment === 'critical')) {
    return 'A critical modeled flood area intersects one or more routes; no unaffected route has complete coverage.';
  }
  if (!assessments.some(route => ['clear', 'fallback-clear'].includes(route.assessment))) {
    return 'Insufficient geographic coverage to identify a verified safe route.';
  }
  return '';
}

export function isLatestSimulationResponse(requestId, latestRequestId, requestedInputs, currentInputs) {
  return requestId === latestRequestId &&
    requestedInputs.rainfallMm === currentInputs.rainfallMm &&
    requestedInputs.cloggingPercent === currentInputs.cloggingPercent &&
    JSON.stringify(requestedInputs.bounds) === JSON.stringify(currentInputs.bounds);
}

// -------------------------------------------------------------
// Route Corridor Flood Simulation Pipeline & Presets
// -------------------------------------------------------------

export const ROUTE_SIMULATION_PRESETS = [
  {
    id: 'flash_flood',
    label: 'Flash Flood',
    icon: '⚡',
    rainfallMm: 135,
    cloggingPercent: 85,
    description: 'Cloudburst surge: Extreme inundation at underpasses & lowlands'
  },
  {
    id: 'monsoon_peak',
    label: 'Monsoon Peak',
    icon: '🌧️',
    rainfallMm: 95,
    cloggingPercent: 70,
    description: 'Sustained monsoon rain across major arterial corridors'
  },
  {
    id: 'clogged_arterial',
    label: 'Clogged Arterial',
    icon: '🚧',
    rainfallMm: 55,
    cloggingPercent: 95,
    description: 'Debris-choked rajakaluves causing severe backwater pooling'
  },
  {
    id: 'clear_normal',
    label: 'Clear / Safe',
    icon: '☀️',
    rainfallMm: 15,
    cloggingPercent: 20,
    description: 'Normal flow with fully functioning storm drainage'
  }
];

/**
 * Generates dynamic corridor flood hazards scaled by rainfall intensity & clogging factor.
 */
export function generateCorridorHazards({
  liveHotspots = [],
  drainageAlerts = [],
  rainfallMm = 50,
  cloggingPercent = 50,
  mode = 'realworld'
} = {}) {
  const isPreset = mode === 'preset';
  const hazards = [];

  const candidateHotspots = Array.isArray(liveHotspots) ? liveHotspots : [];
  candidateHotspots.forEach(hs => {
    const coords = hs.coords || [Number(hs.lng), Number(hs.lat)];
    if (!coords.every(Number.isFinite)) return;

    let depth;
    if (isPreset) {
      const baseDepth = Number(hs.depth_meters || (hs.baseline_clogging ? hs.baseline_clogging * 0.7 : 0.45));
      const rainMultiplier = Math.max(0.1, rainfallMm / 50);
      const clogMultiplier = 0.5 + (cloggingPercent / 100) * 1.0;
      depth = Math.round(baseDepth * rainMultiplier * clogMultiplier * 100) / 100;
    } else {
      depth = Number(hs.depth_meters ?? hs.depth_m ?? 0.35);
    }

    const tier = depth >= 0.6 ? 'CRITICAL' : depth >= 0.25 ? 'WARNING' : 'LOW';
    hazards.push({
      id: hs.id || `hs-${coords[0]}-${coords[1]}`,
      name: hs.name || 'Urban Flood Hotspot',
      zone: hs.zone || 'Bengaluru',
      coords,
      radius_m: Number(hs.radius_m) || 350,
      depth_meters: depth,
      tier,
      level: depth >= 0.6 ? 'critical' : depth >= 0.25 ? 'warning' : 'low',
      source: isPreset ? 'ROUTE CORRIDOR SIMULATION' : 'REAL-WORLD TELEMETRY'
    });
  });

  if (Array.isArray(drainageAlerts)) {
    drainageAlerts.forEach(drain => {
      const coords = drain.coordinates || drain.coords;
      if (!coords || coords.length !== 2 || !coords.every(Number.isFinite)) return;

      let depth;
      if (isPreset) {
        const deficit = Number(drain.deficitPercent || 30);
        const baseDepth = deficit / 45;
        const rainMultiplier = Math.max(0.1, rainfallMm / 50);
        const clogMultiplier = 0.5 + (cloggingPercent / 100) * 1.0;
        depth = Math.round(baseDepth * rainMultiplier * clogMultiplier * 100) / 100;
      } else {
        depth = Math.round(((Number(drain.deficitPercent) || 30) / 40) * 100) / 100;
      }

      const tier = depth >= 0.6 ? 'CRITICAL' : depth >= 0.25 ? 'WARNING' : 'LOW';
      hazards.push({
        id: drain.id || `drain-${coords[0]}-${coords[1]}`,
        name: `${drain.shortName || drain.name || 'Rajakaluve Clogging'}`,
        coords,
        radius_m: 250,
        depth_meters: depth,
        tier,
        level: depth >= 0.6 ? 'critical' : depth >= 0.25 ? 'warning' : 'low',
        source: isPreset ? 'ROUTE CORRIDOR SIMULATION' : 'KARNATAKA RAJAKALUVE DATABASE'
      });
    });
  }

  return hazards;
}

/**
 * Evaluates whether a route intersects corridor hazards under current hydrologic parameters.
 */
export function evaluateCorridorFlood(route, {
  hazards = [],
  corridorOptions = { startRadiusMeters: 250, destinationRadiusMeters: 250, corridorRadiusMeters: 120 }
} = {}) {
  if (!route?.coordinates || route.coordinates.length < 2) {
    return { corridorHazards: [], blockedHazards: [], worstHazard: null, isBlocked: false, peakDepth: 0 };
  }

  const corridorHazards = [];
  const blockedHazards = [];

  hazards.forEach(hazard => {
    const match = matchesRouteCorridor(hazard, route, corridorOptions);
    if (match && match.matches) {
      const depth = Number(hazard.depth_meters || 0);
      const item = { ...hazard, matchZone: match.zone, distanceMeters: Math.round(match.distance) };
      corridorHazards.push(item);
      if (depth >= 0.5 || item.level === 'critical') {
        blockedHazards.push(item);
      }
    }
  });

  blockedHazards.sort((a, b) => (b.depth_meters || 0) - (a.depth_meters || 0));
  const peakDepth = corridorHazards.length ? Math.max(...corridorHazards.map(h => h.depth_meters || 0)) : 0;

  return {
    corridorHazards,
    blockedHazards,
    worstHazard: blockedHazards[0] || null,
    isBlocked: blockedHazards.length > 0,
    peakDepth
  };
}

/**
 * Formats user-facing proactive reroute suggestion.
 */
export function formatRerouteSuggestion(primaryRoute, blockedHazard, safeRoute) {
  if (!blockedHazard) return null;
  const primName = primaryRoute?.name || 'Route 1';
  const depthStr = `${Number(blockedHazard.depth_meters || 0.6).toFixed(1)}m water`;
  const hazardName = blockedHazard.name || 'Flooded Corridor';
  if (safeRoute) {
    return `${primName}: Blocked via ${hazardName} (${depthStr}) ➔ Rerouting via ${safeRoute.name} (Safe)`;
  }
  return `${primName}: Blocked via ${hazardName} (${depthStr}) ➔ Recalculating safe bypass…`;
}
