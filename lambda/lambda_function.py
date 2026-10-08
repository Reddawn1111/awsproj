"""
4clique Hydrologic Digital Twin - AWS Lambda Backend
Track: Heat and Water
Scope: Full Bengaluru City Assessment & 1km x 1km Neighborhood Simulation

Runtime: Python 3.11
Protocol: AWS Lambda Function URL with native CORS support

Core Hydrologic Math Engine:
- Inflow: Q_in = Rainfall_Rate (mm/hr) * Impervious_Runoff_Coeff (0.85)
- Outflow: Q_out = Baseline_Rajakaluve_Capacity (30 mm/hr) * (1.0 - Siltation_Clogging_Ratio)
- Net Accumulation: max(0.0, (Q_in - Q_out) * Duration_Factor)
- Converted Ground Water Depth (Meters): min(1.8, max(0.2, Net_Accumulation * 0.015))
  * Clamped strictly between curb level (0.2 m) and ground-floor submersion (1.8 m)
  * Under zero-rain conditions: "Drainage flowing normally (No Inundation)"
- Building Risk Tiers inside simulation zone:
  * Depth < 0.3 m: SAFE / Default Charcoal (#1f242d)
  * Depth 0.3 m - 0.8 m: MODERATE / Warning Amber (#eab308)
  * Depth > 0.8 m: SEVERE / Hazard Crimson (#ef4444)
"""

import json
import uuid
import datetime

# Standard CORS headers for AWS Lambda Function URL
CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Requested-With",
    "Access-Control-Max-Age": "86400"
}

IMPERVIOUS_FRACTION = 0.85
BASELINE_RAJAKALUVE_CAPACITY_MM_HR = 30.0
STORM_DURATION_HOURS = 1.0
MAX_WATER_CEILING_METERS = 1.8
MIN_WATER_CURB_METERS = 0.20

CRITICAL_INFRASTRUCTURE = [
    {
        "id": "sakra_hospital",
        "name": "Sakra World Hospital",
        "coordinates": [77.6896, 12.9279],
        "elevation_m": 886.0,
        "failure_depth_m": 1.20
    },
    {
        "id": "bellandur_substation",
        "name": "Bellandur KPTCL Substation",
        "coordinates": [77.6748, 12.9322],
        "elevation_m": 882.0,
        "failure_depth_m": 0.50
    },
    {
        "id": "ecospace_orr",
        "name": "Ecospace ORR",
        "coordinates": [77.6834, 12.9260],
        "elevation_m": 884.0,
        "failure_depth_m": 0.80
    }
]


def calculate_runoff_depth(rainfall_mm: float, clogging_percent: float):
    """
    Computes net accumulation (mm) and ground-level water depth (m)
    clamped strictly between 0.2m (curb) and 1.8m (ground floor submersion).
    """
    rainfall_mm = max(0.0, float(rainfall_mm))
    clogging_percent = max(0.0, min(100.0, float(clogging_percent)))
    clogging_ratio = clogging_percent / 100.0

    if rainfall_mm <= 0.0:
        return {
            "q_in_mm_hr": 0.0,
            "q_out_mm_hr": round(BASELINE_RAJAKALUVE_CAPACITY_MM_HR * (1.0 - clogging_ratio), 1),
            "net_accum_mm": 0.0,
            "depth_meters": 0.0,
            "tier": "SAFE",
            "tier_label": "Drainage flowing normally (No Inundation)"
        }

    q_in = rainfall_mm * IMPERVIOUS_FRACTION
    effective_cap_ratio = max(0.05, 1.0 - (clogging_ratio * 0.95))
    q_out = BASELINE_RAJAKALUVE_CAPACITY_MM_HR * effective_cap_ratio
    net_accum = max(0.0, (q_in - q_out) * STORM_DURATION_HOURS)

    if net_accum <= 0.0:
        return {
            "q_in_mm_hr": round(q_in, 1),
            "q_out_mm_hr": round(q_out, 1),
            "net_accum_mm": 0.0,
            "depth_meters": 0.0,
            "tier": "SAFE",
            "tier_label": "Drainage flowing normally (No Inundation)"
        }

    # Physical depth conversion clamped strictly to [0.2m, 1.8m]
    raw_depth = net_accum * 0.015
    depth_m = round(min(MAX_WATER_CEILING_METERS, max(MIN_WATER_CURB_METERS, raw_depth)), 2)

    # Spec building risk tiers:
    # < 0.3 m: SAFE
    # 0.3 m - 0.8 m: MODERATE
    # > 0.8 m: SEVERE
    if depth_m < 0.30:
        tier = "SAFE"
        tier_label = "Safe / Ankle Ponding (<0.3m)"
    elif depth_m <= 0.80:
        tier = "MODERATE"
        tier_label = "Warning / Road Waterlogging (0.3m - 0.8m)"
    else:
        tier = "SEVERE"
        tier_label = "Hazard / Ground Submersion (>0.8m)"

    return {
        "q_in_mm_hr": round(q_in, 1),
        "q_out_mm_hr": round(q_out, 1),
        "net_accum_mm": round(net_accum, 1),
        "depth_meters": depth_m,
        "tier": tier,
        "tier_label": tier_label
    }


def handle_live_city_assessment(payload):
    """
    Evaluates automated city-wide live assessment across Bengaluru hotspots.
    """
    hotspots = payload.get("hotspots", [])
    evaluated_hotspots = []
    max_rain = 0.0
    at_risk_count = 0
    worst_hotspot = None
    worst_depth = -1.0

    for hs in hotspots:
        rain = float(hs.get("rain_mm_hr", 0.0))
        max_rain = max(max_rain, rain)
        clogging = float(hs.get("baseline_clogging", 0.70)) * 100.0

        flow = calculate_runoff_depth(rain, clogging)
        depth_m = flow["depth_meters"]
        tier = flow["tier"]

        if tier in ["MODERATE", "SEVERE"]:
            at_risk_count += 1

        if depth_m > worst_depth:
            worst_depth = depth_m
            worst_hotspot = hs.get("name")

        evaluated_hotspots.append({
            "id": hs.get("id"),
            "name": hs.get("name"),
            "zone": hs.get("zone"),
            "coords": hs.get("coords"),
            "radius_m": hs.get("radius_m", 500),
            "rain_mm_hr": rain,
            "depth_meters": depth_m,
            "tier": tier,
            "tier_label": flow["tier_label"]
        })

    if max_rain == 0.0 or at_risk_count == 0:
        status_label = "Drainage flowing normally (No Inundation)"
    else:
        status_label = f"{at_risk_count} Hotspots at Risk (Max: {max_rain} mm/hr)"

    return {
        "mode": "live_assessment",
        "city": "Bengaluru",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "city_summary": {
            "max_rain_mm_hr": round(max_rain, 1),
            "total_hotspots": len(hotspots),
            "hotspots_at_risk": at_risk_count,
            "worst_hotspot": worst_hotspot if at_risk_count > 0 else "None",
            "status_label": status_label
        },
        "hotspots": evaluated_hotspots
    }


def handle_block_simulation(payload):
    """
    Executes 1 km x 1 km neighborhood simulation with terrain depression pooling
    and building risk tier evaluation.
    """
    rainfall_mm = float(payload.get("rainfall_mm", 120.0))
    clogging_percent = float(payload.get("clogging_percent", 75.0))
    bounds = payload.get("bounds", {})
    terrain_samples = payload.get("terrain_samples", [])

    base_flow = calculate_runoff_depth(rainfall_mm, clogging_percent)
    base_depth_m = base_flow["depth_meters"]

    # 1. Depression pooling across terrain grid
    pooled_cells = []
    wet_cells_count = 0

    if terrain_samples and base_depth_m > 0:
        elevations = [s.get("elevation_m", 885.0) for s in terrain_samples]
        min_elev = min(elevations)
        max_elev = max(elevations)
        elev_range = max(1.0, max_elev - min_elev)

        for s in terrain_samples:
            elev = s.get("elevation_m", min_elev)
            # Cells in lower depressions pool deeper; higher ridge cells drain off
            elevation_offset = elev - min_elev
            depression_factor = max(0.0, 1.0 - (elevation_offset / (elev_range * 0.75)))

            cell_depth = round(min(MAX_WATER_CEILING_METERS, max(0.0, base_depth_m * depression_factor)), 2)
            if cell_depth < 0.10:
                cell_depth = 0.0

            if cell_depth > 0:
                wet_cells_count += 1

            if cell_depth >= 0.80:
                cell_tier = "SEVERE"
            elif cell_depth >= 0.30:
                cell_tier = "MODERATE"
            elif cell_depth > 0:
                cell_tier = "LOW"
            else:
                cell_tier = "SAFE"

            pooled_cells.append({
                "lng": s.get("lng"),
                "lat": s.get("lat"),
                "elevation_m": elev,
                "depth_meters": cell_depth,
                "tier": cell_tier
            })
    elif base_depth_m > 0:
        # Synthetic fallback if terrain samples missing
        pooled_cells.append({
            "lng": (bounds.get("minLng", 77.68) + bounds.get("maxLng", 77.68)) / 2,
            "lat": (bounds.get("minLat", 12.93) + bounds.get("maxLat", 12.93)) / 2,
            "elevation_m": 884.0,
            "depth_meters": base_depth_m,
            "tier": base_flow["tier"]
        })
        wet_cells_count = 1

    total_cells = max(1, len(terrain_samples))
    flood_fraction = round(wet_cells_count / total_cells, 2)

    # 2. Extract bounding coordinates supporting both [[minLng, minLat], [maxLng, maxLat]] and dict
    if isinstance(bounds, list) and len(bounds) >= 2:
        min_lng = float(bounds[0][0])
        min_lat = float(bounds[0][1])
        max_lng = float(bounds[1][0])
        max_lat = float(bounds[1][1])
    elif isinstance(bounds, dict):
        min_lng = float(bounds.get("minLng", 0))
        max_lng = float(bounds.get("maxLng", 0))
        min_lat = float(bounds.get("minLat", 0))
        max_lat = float(bounds.get("maxLat", 0))
    else:
        min_lng = min_lat = max_lng = max_lat = 0.0

    infra_in_block = []
    for node in CRITICAL_INFRASTRUCTURE:
        coords = node["coordinates"]
        if min_lng <= coords[0] <= max_lng and min_lat <= coords[1] <= max_lat:
            is_flooded = base_depth_m >= node["failure_depth_m"] and base_depth_m > 0
            infra_in_block.append({
                "id": node["id"],
                "name": node["name"],
                "status": "FLOODED" if is_flooded else "OPERATIONAL",
                "failure_depth_m": node["failure_depth_m"],
                "current_depth_m": base_depth_m
            })

    # 3. Before vs After baseline (unmitigated 85% clogging)
    baseline_flow = calculate_runoff_depth(rainfall_mm, 85.0)
    base_reduction_pct = 0.0
    if baseline_flow["depth_meters"] > 0 and base_depth_m < baseline_flow["depth_meters"]:
        base_reduction_pct = round(((baseline_flow["depth_meters"] - base_depth_m) / baseline_flow["depth_meters"]) * 100.0, 1)

    # 4. Computed metrics required by specification
    total_water_volume_m3 = round(base_depth_m * flood_fraction * 1_000_000, 1) if base_depth_m > 0 else 0.0
    flooded_building_count = int(round(flood_fraction * 45)) if base_depth_m > 0 else 0
    vulnerability_index = round(min(1.0, (base_depth_m / 1.8) * 0.6 + (clogging_percent / 100.0) * 0.4), 2) if base_depth_m > 0 else 0.0

    return {
        "project": "4clique",
        "mode": "block_simulation",
        "scenario_id": f"4clique-blk-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "rainfall_mm": rainfall_mm,
        "clogging_percent": clogging_percent,
        "bounds": bounds,
        "q_in_mm_hr": base_flow["q_in_mm_hr"],
        "q_out_mm_hr": base_flow["q_out_mm_hr"],
        "net_accumulation_mm": base_flow["net_accum_mm"],
        "peak_water_depth_m": base_depth_m,
        "total_water_volume_m3": total_water_volume_m3,
        "flooded_building_count": flooded_building_count,
        "vulnerability_index": vulnerability_index,
        "tier": base_flow["tier"],
        "tier_label": base_flow["tier_label"],
        "flood_fraction": flood_fraction,
        "flooded_sqkm": round(flood_fraction * 1.0, 2), # 1km x 1km = 1.0 sqkm
        "impacted_arterial_roads": max(0, int(round(flood_fraction * 8))),
        "infrastructure": infra_in_block,
        "baseline": {
            "clogging_percent": 85.0,
            "peak_water_depth_m": baseline_flow["depth_meters"],
            "tier": baseline_flow["tier"]
        },
        "flood_reduction_percentage": base_reduction_pct,
        "pooled_cells": pooled_cells
    }


def lambda_handler(event, context):
    """
    AWS Lambda Function URL Entrypoint.
    Dispatches to live city assessment or 1km block simulation based on payload mode.
    """
    # 1. CORS Pre-flight
    http_method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod")
    if http_method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({"status": "CORS pre-flight OK"})
        }

    try:
        # 2. Parse Request Body
        raw_body = event.get("body", "{}")
        if isinstance(raw_body, str):
            payload = json.loads(raw_body) if raw_body.strip() else {}
        elif isinstance(raw_body, dict):
            payload = raw_body
        else:
            payload = {}

        mode = payload.get("mode", "block_simulation")
        if mode == "live_assessment" or "hotspots" in payload:
            response_data = handle_live_city_assessment(payload)
        else:
            response_data = handle_block_simulation(payload)

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps(response_data)
        }

    except Exception as exc:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "error": "Internal hydrologic engine fault",
                "details": str(exc)
            })
        }
