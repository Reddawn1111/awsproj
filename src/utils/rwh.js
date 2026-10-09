// 4clique Area-Specific Rainwater Harvesting (RWH) Hydrology Engine
// Standard Formula: Harvestable_Volume (L) = Rainfall (mm) * Terrace_Area (m²) * Runoff_Coefficient * Filter_Efficiency

/**
 * Calculates Shoelace area of a polygon in square meters given coordinates in [lng, lat]
 */
export function calculatePolygonAreaM2(coordinates) {
  if (!coordinates || coordinates.length < 3) return 0;
  const lat0 = coordinates[0][1];
  const metersPerDegLat = 110574;
  const metersPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);

  let area = 0;
  const n = coordinates.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = coordinates[i][0] * metersPerDegLng;
    const yi = coordinates[i][1] * metersPerDegLat;
    const xj = coordinates[j][0] * metersPerDegLng;
    const yj = coordinates[j][1] * metersPerDegLat;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area) / 2;
}

/**
 * Classifies urban zoning based on block location and surrounding landmarks
 */
export function inferBlockZoning(label = '', center = null) {
  const text = (label || '').toLowerCase();
  
  // Commercial / High-density Tech Corridor
  if (
    text.includes('ecospace') ||
    text.includes('tech park') ||
    text.includes('outer ring road') ||
    text.includes('orr') ||
    text.includes('whitefield') ||
    text.includes('electronic city') ||
    text.includes('manyata') ||
    text.includes('peenya') ||
    text.includes('industrial')
  ) {
    return {
      category: 'Commercial / Tech Corridor',
      builtUpRatio: 0.60,
      rooftopFraction: 0.75, // 70-80% rooftop for commercial
      occupantDensityM2: 12,
      runoffCoefficient: 0.88,
      filterEfficiency: 0.90,
      description: 'High-density commercial / IT park campus with expansive flat concrete/metal rooftops'
    };
  }

  // Dense Urban Residential / Mixed Core
  if (
    text.includes('koramangala') ||
    text.includes('indiranagar') ||
    text.includes('malleswaram') ||
    text.includes('hsr') ||
    text.includes('jayanagar') ||
    text.includes('btm') ||
    text.includes('shivajinagar') ||
    text.includes('majestic') ||
    text.includes('shanthi nagar')
  ) {
    return {
      category: 'High-Density Urban Residential',
      builtUpRatio: 0.65,
      rooftopFraction: 0.60, // 55-65% rooftop for high-density residential
      occupantDensityM2: 18,
      runoffCoefficient: 0.85,
      filterEfficiency: 0.90,
      description: 'Multi-story apartments and dense urban residential fabric'
    };
  }

  // Suburban / Peri-Urban Residential
  return {
    category: 'Suburban / Mixed Residential',
    builtUpRatio: 0.45,
    rooftopFraction: 0.35, // 30-40% rooftop for suburban
    occupantDensityM2: 25,
    runoffCoefficient: 0.82,
    filterEfficiency: 0.90,
    description: 'Suburban low-rise residential layout with gardens and open ground'
  };
}

/**
 * Performs cell-specific RWH calculation for a selected 1 km² block
 *
 * @param {Object} options
 * @param {Object} options.blockBounds - { minLng, minLat, maxLng, maxLat, center }
 * @param {string} options.blockLabel - Location label / geocoded name
 * @param {number} options.rainfallMm - Current / configured rainfall event (mm)
 * @param {Array} options.renderedBuildings - Optional vector building features inside block
 * @param {number} options.customRunoffCoeff - Optional custom runoff coefficient (default 0.85)
 * @param {number} options.customFilterEfficiency - Optional custom filter efficiency (default 0.90)
 */
export function calculateBlockRWH({
  blockBounds,
  blockLabel = '',
  rainfallMm = 120,
  renderedBuildings = null,
  customRunoffCoeff = null,
  customFilterEfficiency = null
}) {
  const BLOCK_TOTAL_AREA_M2 = 1_000_000; // Standard 1 km x 1 km block = 1,000,000 m²
  const rainDepthMm = Math.max(0, Number(rainfallMm) || 0);

  const zoning = inferBlockZoning(blockLabel, blockBounds?.center);
  const runoffCoeff = customRunoffCoeff || zoning.runoffCoefficient || 0.85;
  const filterEff = customFilterEfficiency || zoning.filterEfficiency || 0.90;

  let calculatedTerraceAreaM2 = 0;
  let isExplicitFootprint = false;
  let buildingCount = 0;

  // 1. Try explicit vector footprint calculation if buildings are provided
  if (renderedBuildings && renderedBuildings.length > 0 && blockBounds) {
    const { minLng, minLat, maxLng, maxLat } = blockBounds;
    let explicitAreaSum = 0;
    let validBuildings = 0;

    renderedBuildings.forEach((b) => {
      let coords = null;
      if (b.geometry?.type === 'Polygon' && b.geometry.coordinates?.[0]) {
        coords = b.geometry.coordinates[0];
      } else if (b.geometry?.type === 'MultiPolygon' && b.geometry.coordinates?.[0]?.[0]) {
        coords = b.geometry.coordinates[0][0];
      }

      if (coords && coords.length >= 3) {
        // Check centroid or first point within bounds
        const [pLng, pLat] = coords[0];
        if (pLng >= minLng && pLng <= maxLng && pLat >= minLat && pLat <= maxLat) {
          const area = calculatePolygonAreaM2(coords);
          if (area > 20 && area < 50_000) { // filter noise or tile clipping artifacts
            explicitAreaSum += area;
            validBuildings++;
          }
        }
      }
    });

    if (validBuildings >= 5 && explicitAreaSum >= 10_000) {
      calculatedTerraceAreaM2 = Math.round(explicitAreaSum);
      isExplicitFootprint = true;
      buildingCount = validBuildings;
    }
  }

  // 2. If explicit polygons absent or sparse, use scientific block zoning and density formula:
  // Estimated_Terrace_Area = Block_Total_Area * Built_Up_Ratio * Rooftop_Fraction
  if (!isExplicitFootprint || calculatedTerraceAreaM2 === 0) {
    const estimatedTerraceArea = BLOCK_TOTAL_AREA_M2 * zoning.builtUpRatio * zoning.rooftopFraction;
    calculatedTerraceAreaM2 = Math.round(estimatedTerraceArea);
    isExplicitFootprint = false;
    buildingCount = Math.round(calculatedTerraceAreaM2 / 380); // ~380 m² average terrace per structure
  }

  // 3. Hydrology Formula:
  // Harvestable_Volume (Liters) = Rainfall (mm) * Terrace_Area (m²) * Runoff_Coefficient * Filter_Efficiency
  // Note: 1 mm of rain over 1 m² = 1.0 Liter
  const harvestableLiters = Math.round(rainDepthMm * calculatedTerraceAreaM2 * runoffCoeff * filterEff);
  const harvestableKL = Number((harvestableLiters / 1_000).toFixed(1)); // 1 kL = 1 m³ = 1,000 Liters
  const harvestableM3 = harvestableKL;

  // 4. Non-Potable Water Supply Capacity Breakdown:
  // Standard non-potable domestic requirement (toilet flushing + landscaping + maintenance) = 45 LPCD
  // Estimated building occupants based on terrace footprint and density
  const estimatedOccupants = Math.max(100, Math.round(calculatedTerraceAreaM2 / zoning.occupantDensityM2));
  const dailyNonPotableDemandL = Math.max(4_500, estimatedOccupants * 45); // Liters / day

  const daysNonPotableSupply = harvestableLiters > 0
    ? Math.round(harvestableLiters / dailyNonPotableDemandL)
    : 0;

  const terraceCoveragePercent = Number(((calculatedTerraceAreaM2 / BLOCK_TOTAL_AREA_M2) * 100).toFixed(1));

  return {
    blockTotalAreaM2: BLOCK_TOTAL_AREA_M2,
    terraceAreaM2: calculatedTerraceAreaM2,
    terraceCoveragePercent,
    isExplicitFootprint,
    buildingCount,
    zoningCategory: zoning.category,
    zoningDescription: zoning.description,
    rainfallMm: rainDepthMm,
    runoffCoefficient: runoffCoeff,
    filterEfficiency: filterEff,
    harvestableLiters,
    harvestableKL,
    harvestableM3,
    estimatedOccupants,
    dailyNonPotableDemandL,
    daysNonPotableSupply
  };
}
