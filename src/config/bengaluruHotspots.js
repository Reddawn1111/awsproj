// 4clique Bengaluru Flood Hotspots & Rain Grid Configuration
// Catalogues documented urban flood hotspots across all 8 BBMP zones.

export const BENGALURU_HOTSPOTS = [
  // 1. Mahadevapura / East
  { id: 'hs_bellandur_basin', name: 'Bellandur Lake Basin', zone: 'Mahadevapura', coords: [77.6710, 12.9370], radius_m: 750, elevation_m: 880.2, baseline_clogging: 0.75 },
  { id: 'hs_ecospace_orr', name: 'Ecospace ORR Valley', zone: 'Mahadevapura', coords: [77.6834, 12.9260], radius_m: 600, elevation_m: 884.1, baseline_clogging: 0.80 },
  { id: 'hs_sakra_corridor', name: 'Sakra ER Road Corridor', zone: 'Mahadevapura', coords: [77.6896, 12.9279], radius_m: 500, elevation_m: 886.3, baseline_clogging: 0.65 },
  { id: 'hs_varthur_lake', name: 'Varthur Lake Outflow', zone: 'Mahadevapura', coords: [77.7420, 12.9410], radius_m: 800, elevation_m: 875.0, baseline_clogging: 0.70 },
  { id: 'hs_kr_puram', name: 'KR Puram Lowland / Tin Factory', zone: 'Mahadevapura', coords: [77.6780, 13.0030], radius_m: 650, elevation_m: 888.0, baseline_clogging: 0.85 },
  { id: 'hs_marathahalli', name: 'Marathahalli Underpass', zone: 'Mahadevapura', coords: [77.6980, 12.9550], radius_m: 550, elevation_m: 890.0, baseline_clogging: 0.75 },
  { id: 'hs_sai_layout', name: 'Sai Layout (Horamavu)', zone: 'Mahadevapura', coords: [77.6650, 13.0320], radius_m: 600, elevation_m: 885.0, baseline_clogging: 0.85 },

  // 2. Bommanahalli / South-East
  { id: 'hs_silk_board', name: 'Central Silk Board Junction', zone: 'Bommanahalli', coords: [77.6230, 12.9170], radius_m: 600, elevation_m: 892.0, baseline_clogging: 0.85 },
  { id: 'hs_hsr_sector6', name: 'HSR Layout Sector 6/7 Lowlands', zone: 'Bommanahalli', coords: [77.6320, 12.9120], radius_m: 650, elevation_m: 894.0, baseline_clogging: 0.70 },
  { id: 'hs_bilekahalli', name: 'Bilekahalli Bannerghatta Road', zone: 'Bommanahalli', coords: [77.6010, 12.8980], radius_m: 500, elevation_m: 902.0, baseline_clogging: 0.65 },
  { id: 'hs_anugraha_layout', name: 'Anugraha Layout (BTM 4th)', zone: 'Bommanahalli', coords: [77.6180, 12.8950], radius_m: 550, elevation_m: 896.0, baseline_clogging: 0.75 },

  // 3. South Zone / Koramangala
  { id: 'hs_koramangala_4th', name: 'Koramangala 4th Block Valley', zone: 'South', coords: [77.6290, 12.9340], radius_m: 600, elevation_m: 890.0, baseline_clogging: 0.80 },
  { id: 'hs_ejipura_drain', name: 'Ejipura Rajakaluve Corridor', zone: 'South', coords: [77.6270, 12.9430], radius_m: 500, elevation_m: 891.0, baseline_clogging: 0.80 },
  { id: 'hs_lalbagh_west', name: 'Lalbagh West / Ashoka Pillar', zone: 'South', coords: [77.5810, 12.9420], radius_m: 450, elevation_m: 905.0, baseline_clogging: 0.60 },

  // 4. Central / East BBMP
  { id: 'hs_shanthinagar', name: 'Shanthinagar Bus Station Lowland', zone: 'East', coords: [77.5950, 12.9560], radius_m: 500, elevation_m: 898.0, baseline_clogging: 0.75 },
  { id: 'hs_ulsoor_lake', name: 'Ulsoor Lake Foreshore', zone: 'East', coords: [77.6200, 12.9820], radius_m: 600, elevation_m: 900.0, baseline_clogging: 0.60 },
  { id: 'hs_shivajinagar', name: 'Shivajinagar Russell Market', zone: 'East', coords: [77.6050, 12.9860], radius_m: 450, elevation_m: 908.0, baseline_clogging: 0.75 },

  // 5. West Zone
  { id: 'hs_majestic', name: 'Majestic City Railway Underpass', zone: 'West', coords: [77.5700, 12.9770], radius_m: 500, elevation_m: 915.0, baseline_clogging: 0.85 },
  { id: 'hs_okalipuram', name: 'Okalipuram Low-lying Underpass', zone: 'West', coords: [77.5650, 12.9830], radius_m: 450, elevation_m: 910.0, baseline_clogging: 0.80 },
  { id: 'hs_vijayanagar', name: 'Vijayanagar Pipeline Drain', zone: 'West', coords: [77.5350, 12.9680], radius_m: 500, elevation_m: 920.0, baseline_clogging: 0.65 },

  // 6. North / Hebbal / Yelahanka
  { id: 'hs_hebbal_flyover', name: 'Hebbal Flyover Depression', zone: 'North', coords: [77.5920, 13.0350], radius_m: 700, elevation_m: 901.0, baseline_clogging: 0.80 },
  { id: 'hs_nagawara_lake', name: 'Nagawara Lake Inflow (Manyata)', zone: 'North', coords: [77.6200, 13.0450], radius_m: 750, elevation_m: 895.0, baseline_clogging: 0.75 },
  { id: 'hs_yelahanka_old', name: 'Yelahanka Kogilu Road', zone: 'Yelahanka', coords: [77.6000, 13.1050], radius_m: 600, elevation_m: 912.0, baseline_clogging: 0.65 },
  { id: 'hs_kendriya_vihar', name: 'Kendriya Vihar (Yelahanka)', zone: 'Yelahanka', coords: [77.5920, 13.1180], radius_m: 550, elevation_m: 908.0, baseline_clogging: 0.85 },

  // 7. Dasarahalli / Peenya
  { id: 'hs_peenya_drain', name: 'Peenya Industrial Sub-basin', zone: 'Dasarahalli', coords: [77.5180, 13.0280], radius_m: 650, elevation_m: 924.0, baseline_clogging: 0.75 },
  { id: 'hs_goraguntepalya', name: 'Goraguntepalya Junction', zone: 'Dasarahalli', coords: [77.5450, 13.0240], radius_m: 550, elevation_m: 918.0, baseline_clogging: 0.80 },

  // 8. Rajarajeshwari Nagar (RR Nagar)
  { id: 'hs_rr_nagar_gate', name: 'Rajarajeshwari Arch Lowlands', zone: 'RR Nagar', coords: [77.5250, 12.9350], radius_m: 600, elevation_m: 905.0, baseline_clogging: 0.70 },
  { id: 'hs_nayandahalli', name: 'Nayandahalli Junction / Vrishabhavathi', zone: 'RR Nagar', coords: [77.5210, 12.9460], radius_m: 650, elevation_m: 898.0, baseline_clogging: 0.85 },
  { id: 'hs_kengeri_mori', name: 'Kengeri Mori Rajakaluve', zone: 'RR Nagar', coords: [77.4850, 12.9120], radius_m: 600, elevation_m: 890.0, baseline_clogging: 0.75 }
];

// Generate 5x5 Grid covering BBMP (77.45 - 77.75 E, 12.84 - 13.12 N)
export function getBengaluruRainGridPoints() {
  const points = [];
  const minLng = 77.46;
  const maxLng = 77.74;
  const minLat = 12.85;
  const maxLat = 13.11;
  const steps = 5;

  const latStep = (maxLat - minLat) / (steps - 1);
  const lngStep = (maxLng - minLng) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const lat = Number((minLat + i * latStep).toFixed(3));
      const lng = Number((minLng + j * lngStep).toFixed(3));
      points.push({ id: `grid_${i}_${j}`, lat, lng });
    }
  }
  return points;
}

// Find nearest rain grid point reading for any given hotspot coordinate
export function matchNearestRain(coords, rainGridPoints) {
  if (!rainGridPoints || rainGridPoints.length === 0) return 0;
  const [lng, lat] = coords;
  let nearest = rainGridPoints[0];
  let minD2 = Infinity;

  for (const pt of rainGridPoints) {
    const d2 = Math.pow(pt.lat - lat, 2) + Math.pow(pt.lng - lng, 2);
    if (d2 < minD2) {
      minD2 = d2;
      nearest = pt;
    }
  }
  return nearest.rain_mm_hr || 0;
}
