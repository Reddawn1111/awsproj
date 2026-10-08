// 4clique Critical Infrastructure Configuration
// Target Zone: Bellandur - Sarjapur - ORR Corridor, Bengaluru

export const CRITICAL_INFRASTRUCTURE = [
  {
    id: "sakra_hospital",
    name: "Sakra World Hospital",
    category: "Emergency Healthcare / Level 1 Trauma",
    coordinates: [77.6896, 12.9279], // [lng, lat]
    elevation_m: 886.0,
    criticalThresholdMm: 190,
    description: "Primary trauma healthcare center for eastern ORR technology belt. Access cut off when Devarabeesanahalli arterial underpass breaches.",
    importance: "CRITICAL LIFE-SAFETY"
  },
  {
    id: "bellandur_substation",
    name: "Bellandur KPTCL Substation",
    category: "Power Grid Substation (220/66 kV)",
    coordinates: [77.6748, 12.9322],
    elevation_m: 882.0,
    criticalThresholdMm: 65,
    description: "Grid transmission substation feeding ORR tech parks. Low-elevation basin prone to backflow flooding from Bellandur primary rajakaluve.",
    importance: "HIGH POWER RELIABILITY"
  },
  {
    id: "ecospace_orr",
    name: "Ecospace ORR",
    category: "Major Technology Park & Transit Corridor",
    coordinates: [77.6834, 12.9260],
    elevation_m: 884.0,
    criticalThresholdMm: 110,
    description: "Over 80,000 workforce density on arterial Outer Ring Road. Sits in a natural catchment depression susceptible to severe vehicle stranding.",
    importance: "ECONOMIC & TRANSIT ARTERY"
  }
];
