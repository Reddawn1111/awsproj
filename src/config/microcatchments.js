// 4clique Bellandur-ORR Micro-Catchment Spatial Features
// GeoJSON polygon representations of low-lying depression basins and drainage corridors

export const VALLEY_CORRIDORS_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "bellandur_lake_basin",
      properties: {
        id: "bellandur_lake_basin",
        name: "Bellandur Lake Foreshore Basin",
        elevation_m: 880.2,
        zone_type: "Primary Water Retention Sink"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.6620, 12.9320],
          [77.6710, 12.9430],
          [77.6795, 12.9460],
          [77.6850, 12.9400],
          [77.6790, 12.9330],
          [77.6695, 12.9300],
          [77.6620, 12.9320]
        ]]
      }
    },
    {
      type: "Feature",
      id: "kptcl_substation_zone",
      properties: {
        id: "kptcl_substation_zone",
        name: "KPTCL Substation Lowland Basin",
        elevation_m: 882.0,
        zone_type: "Critical Substation Perimeter"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.6715, 12.9295],
          [77.6780, 12.9345],
          [77.6765, 12.9360],
          [77.6705, 12.9315],
          [77.6715, 12.9295]
        ]]
      }
    },
    {
      type: "Feature",
      id: "ecospace_valley",
      properties: {
        id: "ecospace_valley",
        name: "Ecospace ORR Depression Corridor",
        elevation_m: 884.1,
        zone_type: "High-Density Tech Hub Basin"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.6785, 12.9230],
          [77.6875, 12.9290],
          [77.6860, 12.9310],
          [77.6775, 12.9250],
          [77.6785, 12.9230]
        ]]
      }
    },
    {
      type: "Feature",
      id: "sakra_corridor",
      properties: {
        id: "sakra_corridor",
        name: "Sakra Hospital & Devarabeesanahalli Crossing",
        elevation_m: 886.3,
        zone_type: "Emergency Access Valley"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.6865, 12.9255],
          [77.6935, 12.9305],
          [77.6920, 12.9325],
          [77.6850, 12.9275],
          [77.6865, 12.9255]
        ]]
      }
    },
    {
      type: "Feature",
      id: "kadubeesanahalli_drain",
      properties: {
        id: "kadubeesanahalli_drain",
        name: "Kadubeesanahalli Rajakaluve Outflow",
        elevation_m: 887.8,
        zone_type: "Primary Arterial Storm Canal"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.6915, 12.9330],
          [77.7010, 12.9400],
          [77.6995, 12.9420],
          [77.6900, 12.9350],
          [77.6915, 12.9330]
        ]]
      }
    },
    {
      type: "Feature",
      id: "ibblur_junction",
      properties: {
        id: "ibblur_junction",
        name: "Ibblur / Sarjapur Junction Lowlands",
        elevation_m: 892.5,
        zone_type: "Major Road Transit Node"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.6660, 12.9180],
          [77.6750, 12.9250],
          [77.6735, 12.9270],
          [77.6645, 12.9200],
          [77.6660, 12.9180]
        ]]
      }
    },
    {
      type: "Feature",
      id: "kaikondrahalli_valley",
      properties: {
        id: "kaikondrahalli_valley",
        name: "Kaikondrahalli Feeder Valley",
        elevation_m: 895.0,
        zone_type: "Upstream Lake Corridor"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.6770, 12.9090],
          [77.6860, 12.9160],
          [77.6845, 12.9180],
          [77.6755, 12.9110],
          [77.6770, 12.9090]
        ]]
      }
    },
    {
      type: "Feature",
      id: "hsr_ridge_flank",
      properties: {
        id: "hsr_ridge_flank",
        name: "HSR Layout Flank Slope",
        elevation_m: 905.0,
        zone_type: "Elevated Ridge Slope"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.6540, 12.9160],
          [77.6640, 12.9240],
          [77.6625, 12.9260],
          [77.6525, 12.9180],
          [77.6540, 12.9160]
        ]]
      }
    }
  ]
};
