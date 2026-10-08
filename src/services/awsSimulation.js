// 4clique AWS Hydrologic Simulation & City Assessment Service
// Dispatches to AWS Lambda Function URL with fallback client-side engine

import { calculateSquareBounds } from '../utils/geo';

const IMPERVIOUS_FRACTION = 0.85;
const BASELINE_RAJAKALUVE_CAPACITY_MM_HR = 30.0;
const MAX_WATER_CEILING_METERS = 1.8;
const MIN_WATER_CURB_METERS = 0.20;

/**
 * Executes 1 km x 1 km block simulation on AWS Lambda.
 */
export async function runAwsBlockSimulation({
  rainfallMm,
  cloggingPercent,
  bounds,
  terrainSamples = [],
  awsLambdaUrl = null
}) {
  const envUrl = import.meta.env.VITE_AWS_LAMBDA_URL;
  const targetUrl = (awsLambdaUrl || envUrl || 'http://127.0.0.1:8000').trim();

  // Support both [[minLng, minLat], [maxLng, maxLat]] and dict
  const formattedBounds = Array.isArray(bounds) ? bounds : [
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat]
  ];

  const payload = {
    project: "4clique",
    mode: "block_simulation",
    rainfall_mm: Math.max(0, parseFloat(rainfallMm) || 0),
    clogging_percent: Math.max(0, Math.min(100, parseFloat(cloggingPercent) || 0)),
    bounds: formattedBounds,
    terrain_samples: terrainSamples
  };

  console.log("%c[4clique AWS Block Request]", "color: #00f0ff; font-weight: bold;", {
    endpoint: targetUrl,
    method: "POST",
    payload
  });

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    console.log('[4clique Simulation] AWS Lambda Result:', data);
    console.log("%c[4clique AWS Block Response 200 OK]", "color: #10b981; font-weight: bold;", {
      latencyMs,
      data
    });

    return {
      ...data,
      latencyMs,
      rawEndpoint: targetUrl,
      isLocalFallback: false
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[4clique] AWS Lambda block call failed (${err.message}). Using local high-fidelity fallback.`);

    // Local fallback matching python logic
    const fallback = calculateLocalBlockSimulation(payload);
    console.log('[4clique Simulation] AWS Lambda Result:', fallback);
    return {
      ...fallback,
      latencyMs: Math.max(12, Math.round(performance.now() - startTime)),
      rawEndpoint: `${targetUrl} (Local Engine)`,
      isLocalFallback: true,
      fallbackNotice: err.message
    };
  }
}

/**
 * Executes automated city-wide live assessment on AWS Lambda.
 */
export async function runAwsLiveAssessment({
  hotspots,
  awsLambdaUrl = null
}) {
  const envUrl = import.meta.env.VITE_AWS_LAMBDA_URL;
  const targetUrl = (awsLambdaUrl || envUrl || 'http://127.0.0.1:8000').trim();

  const payload = {
    project: "4clique",
    mode: "live_assessment",
    hotspots: hotspots.map(h => ({
      id: h.id,
      name: h.name,
      zone: h.zone,
      coords: h.coords,
      radius_m: h.radius_m,
      elevation_m: h.elevation_m,
      baseline_clogging: h.baseline_clogging,
      rain_mm_hr: h.rain_mm_hr || 0.0
    }))
  };

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    return {
      ...data,
      latencyMs,
      rawEndpoint: targetUrl,
      isLocalFallback: false
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[4clique] AWS Lambda live assessment failed (${err.message}). Using local fallback.`);

    const fallback = calculateLocalLiveAssessment(payload);
    return {
      ...fallback,
      latencyMs: Math.max(10, Math.round(performance.now() - startTime)),
      rawEndpoint: `${targetUrl} (Local Engine)`,
      isLocalFallback: true
    };
  }
}

// Local simulation fallback algorithms matching Python lambda
function calculateLocalFlow(rainfallMm, cloggingPercent) {
  const rain = Math.max(0, rainfallMm);
  const clogging = Math.max(0, Math.min(100, cloggingPercent)) / 100.0;

  if (rain === 0) {
    return {
      depth_meters: 0.0,
      tier: "SAFE",
      tier_label: "Drainage flowing normally (No Inundation)"
    };
  }

  const qIn = rain * IMPERVIOUS_FRACTION;
  const cap = BASELINE_RAJAKALUVE_CAPACITY_MM_HR * Math.max(0.05, 1.0 - (clogging * 0.95));
  const net = Math.max(0, qIn - cap);

  if (net === 0) {
    return {
      depth_meters: 0.0,
      tier: "SAFE",
      tier_label: "Drainage flowing normally (No Inundation)"
    };
  }

  const raw = net * 0.015;
  const depth = Math.round(Math.min(MAX_WATER_CEILING_METERS, Math.max(MIN_WATER_CURB_METERS, raw)) * 100) / 100;

  let tier = "SAFE";
  let tierLabel = "Safe / Ankle Ponding (<0.3m)";
  if (depth >= 0.80) {
    tier = "SEVERE";
    tierLabel = "Hazard / Ground Submersion (>0.8m)";
  } else if (depth >= 0.30) {
    tier = "MODERATE";
    tierLabel = "Warning / Road Waterlogging (0.3m - 0.8m)";
  }

  return { depth_meters: depth, tier, tier_label: tierLabel };
}

function calculateLocalBlockSimulation(payload) {
  const { rainfall_mm, clogging_percent, bounds, terrain_samples } = payload;
  const baseFlow = calculateLocalFlow(rainfall_mm, clogging_percent);
  const baseDepth = baseFlow.depth_meters;

  const pooled_cells = [];
  let wetCount = 0;

  if (terrain_samples && terrain_samples.length > 0 && baseDepth > 0) {
    const elevs = terrain_samples.map(s => s.elevation_m || 885);
    const minE = Math.min(...elevs);
    const maxE = Math.max(...elevs);
    const range = Math.max(1, maxE - minE);

    terrain_samples.forEach(s => {
      const e = s.elevation_m || minE;
      const factor = Math.max(0, 1.0 - ((e - minE) / (range * 0.75)));
      let cellD = Math.round(Math.min(MAX_WATER_CEILING_METERS, baseDepth * factor) * 100) / 100;
      if (cellD < 0.1) cellD = 0;
      if (cellD > 0) wetCount++;

      let tier = "SAFE";
      if (cellD >= 0.8) tier = "SEVERE";
      else if (cellD >= 0.3) tier = "MODERATE";
      else if (cellD > 0) tier = "LOW";

      pooled_cells.push({
        lng: s.lng,
        lat: s.lat,
        elevation_m: e,
        depth_meters: cellD,
        tier
      });
    });
  }

  const floodFraction = terrain_samples.length > 0 ? Math.round((wetCount / terrain_samples.length) * 100) / 100 : (baseDepth > 0 ? 0.65 : 0);
  const totalWaterVolumeM3 = baseDepth > 0 ? Math.round(baseDepth * floodFraction * 1000000 * 10) / 10 : 0.0;
  const floodedBuildingCount = baseDepth > 0 ? Math.round(floodFraction * 45) : 0;
  const vulnerabilityIndex = baseDepth > 0 ? Math.round(Math.min(1.0, (baseDepth / 1.8) * 0.6 + (clogging_percent / 100.0) * 0.4) * 100) / 100 : 0.0;

  return {
    project: "4clique",
    mode: "block_simulation",
    scenario_id: `4clique-blk-local-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    rainfall_mm,
    clogging_percent,
    bounds,
    peak_water_depth_m: baseDepth,
    total_water_volume_m3: totalWaterVolumeM3,
    flooded_building_count: floodedBuildingCount,
    vulnerability_index: vulnerabilityIndex,
    tier: baseFlow.tier,
    tier_label: baseFlow.tier_label,
    flood_fraction: floodFraction,
    flooded_sqkm: floodFraction,
    impacted_arterial_roads: Math.round(floodFraction * 8),
    infrastructure: [],
    pooled_cells
  };
}

function calculateLocalLiveAssessment(payload) {
  const { hotspots = [] } = payload;
  let maxRain = 0;
  let riskCount = 0;
  let worst = "None";

  const evaluated = hotspots.map(h => {
    const rain = h.rain_mm_hr || 0;
    maxRain = Math.max(maxRain, rain);
    const flow = calculateLocalFlow(rain, (h.baseline_clogging || 0.7) * 100);
    if (flow.tier !== "SAFE") riskCount++;
    return {
      id: h.id,
      name: h.name,
      zone: h.zone,
      coords: h.coords,
      radius_m: h.radius_m,
      rain_mm_hr: rain,
      depth_meters: flow.depth_meters,
      tier: flow.tier,
      tier_label: flow.tier_label
    };
  });

  return {
    mode: "live_assessment",
    city: "Bengaluru",
    city_summary: {
      max_rain_mm_hr: maxRain,
      total_hotspots: hotspots.length,
      hotspots_at_risk: riskCount,
      worst_hotspot: worst,
      status_label: maxRain === 0 || riskCount === 0 ? "Drainage flowing normally (No Inundation)" : `${riskCount} Hotspots at Risk (Max: ${maxRain} mm/hr)`
    },
    hotspots: evaluated
  };
}
