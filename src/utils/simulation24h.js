// 4clique 24-Hour Time-Stepped Hydrologic Grid Simulation Engine
// Formula per step: Runoff = (Rainfall * Runoff_Coefficient) - (Drain_Capacity * (1 - Clogging_Rate))

export const STORM_PROFILE_24H = [
  0.00, // Hour 0: Dry baseline (0h)
  0.06, // Hour 1: Light drizzle
  0.15, // Hour 2: Showers begin
  0.30, // Hour 3: Steady monsoon rain
  0.52, // Hour 4: Heavy squall
  0.75, // Hour 5: Severe storm building
  0.92, // Hour 6: Peak deluge surge
  1.00, // Hour 7: Cloudburst peak intensity
  0.95, // Hour 8: Sustained severe cloudburst
  0.82, // Hour 9: High runoff flooding
  0.68, // Hour 10: Intense squall line
  0.55, // Hour 11: Moderate monsoon rain
  0.42, // Hour 12: Tapering rain
  0.30, // Hour 13: Light to moderate rain
  0.20, // Hour 14: Overcast drizzle
  0.12, // Hour 15: Intermittent drizzle
  0.06, // Hour 16: Scattered rain
  0.02, // Hour 17: Storm front clears
  0.00, // Hour 18: Rain stops - Active drainage drawdown
  0.00, // Hour 19: Gravity drainage receding
  0.00, // Hour 20: Continued drainage receding
  0.00, // Hour 21: Lowland pooling clears
  0.00, // Hour 22: Minimal puddle retention
  0.00, // Hour 23: Channels flowing clear
  0.00  // Hour 24: 24h cycle complete - Baseline restored
];

export const HOURLY_LABELS_24H = [
  "00:00 (Baseline)",
  "01:00 (Pre-Storm)",
  "02:00 (Showers)",
  "03:00 (Steady Rain)",
  "04:00 (Squall Front)",
  "05:00 (Heavy Rain)",
  "06:00 (Surge Building)",
  "07:00 (Cloudburst Peak)",
  "08:00 (Max Inundation)",
  "09:00 (Sustained Flood)",
  "10:00 (Active Flooding)",
  "11:00 (Receding Rain)",
  "12:00 (Midday Taper)",
  "13:00 (Light Rain)",
  "14:00 (Drizzle)",
  "15:00 (Passing Clouds)",
  "16:00 (Rain Stops)",
  "17:00 (Drainage Discharge)",
  "18:00 (Active Outflow)",
  "19:00 (Drainage Receding)",
  "20:00 (Receding Inundation)",
  "21:00 (Ponding Clearing)",
  "22:00 (Residual Drainage)",
  "23:00 (Outfall Normal)",
  "24:00 (Cycle Complete)"
];

/**
 * Returns color hex for a given water depth in meters
 */
export function getDepthColor(depthM) {
  if (depthM >= 0.6) return '#ef4444'; // Red (Severe Inundation)
  if (depthM >= 0.3) return '#f97316'; // Orange (Moderate Warning)
  if (depthM > 0.02) return '#eab308'; // Yellow (Watch)
  return '#10b981';                     // Green (Safe baseline)
}

/**
 * Pre-computes 24 discrete hourly simulation frames for a 1 km² block
 *
 * @param {Object} options
 * @param {Object} options.blockBounds - { minLng, minLat, maxLng, maxLat }
 * @param {number} options.peakRainfallMm - User-configured storm rainfall intensity (mm/hr)
 * @param {number} options.cloggingPercent - User-configured drainage siltation/clogging (%)
 * @param {Array} options.terrainSamples - 16x16 elevation samples inside block
 * @param {number} options.runoffCoeff - Default 0.85
 * @param {number} options.drainCapacityMmHr - Baseline drainage capacity (default 30 mm/hr)
 */
export function generate24HourSimulationSequence({
  blockBounds,
  peakRainfallMm = 120,
  cloggingPercent = 70,
  terrainSamples = [],
  runoffCoeff = 0.85,
  drainCapacityMmHr = 30.0
}) {
  if (!blockBounds) return null;

  const { minLng, minLat, maxLng, maxLat } = blockBounds;
  const clogRate = Math.max(0, Math.min(100, cloggingPercent || 0)) / 100;
  const effectiveDrainCapacity = drainCapacityMmHr * Math.max(0.05, 1.0 - clogRate * 0.95);

  // Elevation extents
  let minElevation = 880;
  let maxElevation = 895;
  if (terrainSamples && terrainSamples.length > 0) {
    const elevs = terrainSamples.map(s => s.elevation_m || 885);
    minElevation = Math.min(...elevs);
    maxElevation = Math.max(...elevs);
  }
  const elevRange = Math.max(3.0, maxElevation - minElevation);

  // Grid steps (16x16)
  const steps = 16;
  const lngStep = (maxLng - minLng) / (steps - 1);
  const latStep = (maxLat - minLat) / (steps - 1);
  const halfDx = lngStep * 0.49;
  const halfDy = latStep * 0.49;

  const hourlySteps = [];
  let accumulatedWaterMm = 0; // Cumulative net ponded runoff depth in mm

  for (let t = 0; t <= 24; t++) {
    const rainFraction = STORM_PROFILE_24H[t];
    const currentRainMm = Number((peakRainfallMm * rainFraction).toFixed(1));

    // Standard Hydrology Equation:
    // Inflow = Rainfall * Runoff_Coefficient
    // Outflow = Drain_Capacity * (1 - Clogging_Rate)
    // Runoff_Balance = Inflow - Outflow
    const qIn = currentRainMm * runoffCoeff;
    const qOut = effectiveDrainCapacity;
    const runoffBalance = qIn - qOut; // in mm/hr

    if (runoffBalance > 0) {
      accumulatedWaterMm += runoffBalance;
    } else {
      // Draining out when storm eases or rain stops
      const drainReduction = Math.abs(runoffBalance) * 1.25;
      accumulatedWaterMm = Math.max(0, accumulatedWaterMm - drainReduction);
    }

    // Convert accumulated water mm to ground flood depth (m)
    // Max ceiling capped at 2.4m
    const peakDepthM = currentRainMm > 0 || accumulatedWaterMm > 0
      ? Number(Math.min(2.4, accumulatedWaterMm * 0.015).toFixed(2))
      : 0.0;

    // Reach threshold expands up depression gradient with depth & clogging
    const reachThreshold = peakDepthM > 0.02
      ? Math.min(0.90, 0.22 + (peakDepthM / 2.2) * 0.38 + clogRate * 0.28)
      : 0;

    // Evaluate each grid cell
    const cellFeatures = [];
    let floodedCellCount = 0;
    const totalCells = steps * steps;

    for (let r = 0; r < steps; r++) {
      for (let c = 0; c < steps; c++) {
        const cLng = minLng + c * lngStep;
        const cLat = minLat + r * latStep;

        let cellElev = minElevation + (r / steps) * (elevRange * 0.7);
        if (terrainSamples && terrainSamples.length === totalCells) {
          const sample = terrainSamples[r * steps + c];
          if (sample?.elevation_m) cellElev = sample.elevation_m;
        }

        const relElev = Math.max(0, Math.min(1, (cellElev - minElevation) / elevRange));
        let cellDepth = 0;

        if (reachThreshold > 0 && relElev <= reachThreshold) {
          const depressionFactor = Math.max(0, 1.0 - (relElev / reachThreshold));
          cellDepth = Number((peakDepthM * (0.2 + 0.8 * Math.pow(depressionFactor, 1.2))).toFixed(2));
        }

        if (cellDepth >= 0.05) {
          floodedCellCount++;
          const cellColor = getDepthColor(cellDepth);

          cellFeatures.push({
            type: "Feature",
            id: `sim_cell_${t}_${r}_${c}`,
            properties: {
              id: `sim_cell_${r}_${c}`,
              hour: t,
              depth_m: cellDepth,
              color: cellColor,
              water_opacity: Math.min(0.85, 0.55 + cellDepth * 0.18)
            },
            geometry: {
              type: "Polygon",
              coordinates: [[
                [Number((cLng - halfDx).toFixed(6)), Number((cLat - halfDy).toFixed(6))],
                [Number((cLng + halfDx).toFixed(6)), Number((cLat - halfDy).toFixed(6))],
                [Number((cLng + halfDx).toFixed(6)), Number((cLat + halfDy).toFixed(6))],
                [Number((cLng - halfDx).toFixed(6)), Number((cLat + halfDy).toFixed(6))],
                [Number((cLng - halfDx).toFixed(6)), Number((cLat - halfDy).toFixed(6))]
              ]]
            }
          });
        }
      }
    }

    // Dynamic flow vector lines active during rain/flooding
    if (peakDepthM > 0.05) {
      const spanX = maxLng - minLng;
      const spanY = maxLat - minLat;
      const flowVectors = [
        [
          [minLng + 0.15 * spanX, maxLat - 0.20 * spanY],
          [minLng + 0.40 * spanX, maxLat - 0.45 * spanY],
          [minLng + 0.65 * spanX, minLat + 0.35 * spanY],
          [maxLng - 0.15 * spanX, minLat + 0.20 * spanY]
        ],
        [
          [minLng + 0.25 * spanX, maxLat - 0.15 * spanY],
          [minLng + 0.50 * spanX, maxLat - 0.38 * spanY],
          [minLng + 0.72 * spanX, minLat + 0.40 * spanY]
        ]
      ];

      flowVectors.forEach((coords, vIdx) => {
        cellFeatures.push({
          type: "Feature",
          id: `sim_flow_${t}_${vIdx}`,
          properties: {
            id: `sim_flow_${vIdx}`,
            depth_m: peakDepthM
          },
          geometry: {
            type: "LineString",
            coordinates: coords.map(([lng, lat]) => [
              Number(lng.toFixed(6)),
              Number(lat.toFixed(6))
            ])
          }
        });
      });
    }

    const floodFraction = Number((floodedCellCount / totalCells).toFixed(2));
    const totalVolumeM3 = Math.round(peakDepthM * floodFraction * 1_000_000);
    const affectedBuildings = Math.round(floodFraction * 48);

    hourlySteps.push({
      hour: t,
      label: HOURLY_LABELS_24H[t],
      rainfallMm: currentRainMm,
      accumulatedWaterMm: Math.round(accumulatedWaterMm),
      qInMmHr: Number(qIn.toFixed(1)),
      qOutMmHr: Number(qOut.toFixed(1)),
      netRunoffBalanceMmHr: Number(runoffBalance.toFixed(1)),
      peakWaterDepthM: peakDepthM,
      depthColor: getDepthColor(peakDepthM),
      floodFraction,
      totalVolumeM3,
      affectedBuildings,
      waterGeoJSON: {
        type: "FeatureCollection",
        features: cellFeatures
      }
    });
  }

  return {
    totalHours: 24,
    peakRainfallMm,
    cloggingPercent,
    steps: hourlySteps
  };
}
