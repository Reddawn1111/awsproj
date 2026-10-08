"""
4clique Hydrologic Digital Twin - AWS Lambda Backend
Track: Heat and Water
Target Zone: Bellandur - Sarjapur - Outer Ring Road (ORR) Technology Corridor, Bengaluru

Runtime: Python 3.11
Protocol: AWS Lambda Function URL with full CORS support

Hydrologic Model Assumptions:
- Catchment Area: 42.5 km2 (Bellandur-ORR natural drainage basin)
- Urban Impervious Surface Fraction: 80% (Composite runoff coefficient C = 0.85)
- Rational Method / Reservoir-Depression Hypsometry for surface runoff:
  * Gross Runoff Volume: V = Area * Rainfall_depth * Runoff_Coefficient
  * Drainage Conveyance:
    - BASELINE (Clogged Rajakaluves): 120,000 m3/hr effective conveyance
    - DESILT_RAJAKALUVES (+35% Conveyance): 162,000 m3/hr effective conveyance
    - RETENTION_BASIN: Adds 15,000 m3 dedicated peak retention storage capacity
- Infrastructure Failure Thresholds calibrated to localized terrain elevation:
  * Bellandur KPTCL Substation (882m): lowest depression, highly vulnerable to backflow
  * Ecospace ORR Underpass (884m): tech corridor depression, breaches during sustained ponding
  * Sakra World Hospital Access (886m): critical emergency arterial, breaches in severe deluges
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

# Catchment Parameters
CATCHMENT_AREA_SQKM = 42.5
IMPERVIOUS_FRACTION = 0.80
RUNOFF_COEFFICIENT = 0.85

# Critical Infrastructure Specifications
INFRASTRUCTURE_NODES = {
    "Bellandur KPTCL Substation": {
        "elevation_m": 882.0,
        "coordinates": [77.6748, 12.9322],
        "baseline_threshold_mm": 65.0,
        "desilt_threshold_mm": 95.0,
        "retention_threshold_mm": 80.0
    },
    "Ecospace ORR": {
        "elevation_m": 884.0,
        "coordinates": [77.6834, 12.9260],
        "baseline_threshold_mm": 110.0,
        "desilt_threshold_mm": 155.0,
        "retention_threshold_mm": 138.0
    },
    "Sakra World Hospital": {
        "elevation_m": 886.0,
        "coordinates": [77.6896, 12.9279],
        "baseline_threshold_mm": 190.0,
        "desilt_threshold_mm": 245.0,
        "retention_threshold_mm": 220.0
    }
}

# Micro-catchment elevation models for spatial flood visualization
MICRO_CATCHMENTS_CONFIG = [
    {"id": "bellandur_lake_basin", "name": "Bellandur Lake Foreshore", "elevation_m": 880.2, "area_sqkm": 3.8, "center": [77.6710, 12.9370]},
    {"id": "kptcl_substation_zone", "name": "KPTCL Substation Lowland", "elevation_m": 882.0, "area_sqkm": 2.2, "center": [77.6748, 12.9322]},
    {"id": "ecospace_valley", "name": "Ecospace ORR Depression", "elevation_m": 884.1, "area_sqkm": 4.5, "center": [77.6834, 12.9260]},
    {"id": "sakra_corridor", "name": "Sakra ER Road Corridor", "elevation_m": 886.3, "area_sqkm": 2.8, "center": [77.6896, 12.9279]},
    {"id": "kadubeesanahalli_drain", "name": "Kadubeesanahalli Rajakaluve", "elevation_m": 887.8, "area_sqkm": 3.4, "center": [77.6960, 12.9365]},
    {"id": "ibblur_junction", "name": "Ibblur / Sarjapur Junction", "elevation_m": 892.5, "area_sqkm": 4.1, "center": [77.6705, 12.9220]},
    {"id": "kaikondrahalli_valley", "name": "Kaikondrahalli Lowlands", "elevation_m": 895.0, "area_sqkm": 3.1, "center": [77.6815, 12.9130]},
    {"id": "hsr_ridge_flank", "name": "HSR Flank Natural Slope", "elevation_m": 905.0, "area_sqkm": 5.6, "center": [77.6590, 12.9200]}
]


def simulate_hydrology(rainfall_mm: float, intervention: str):
    """
    Simulates water accumulation, flooded area, impacted roads, and infrastructure statuses
    based on terrain elevations, rainfall volume, and drainage conveyance.
    """
    rainfall_m = rainfall_mm / 1000.0
    catchment_area_m2 = CATCHMENT_AREA_SQKM * 1_000_000.0
    gross_volume_m3 = catchment_area_m2 * rainfall_m
    runoff_volume_m3 = gross_volume_m3 * RUNOFF_COEFFICIENT

    # Drainage and retention capacities over reference 6-hour storm event
    storm_duration_hours = 6.0
    if intervention == "DESILT_RAJAKALUVES":
        hourly_conveyance = 162_000.0  # +35% over baseline 120,000 m3/hr
        retention_storage_m3 = 0.0
    elif intervention == "RETENTION_BASIN":
        hourly_conveyance = 120_000.0  # baseline rajakaluve capacity
        retention_storage_m3 = 15_000.0  # 15,000 m3 temporary buffer basin
    else:  # BASELINE
        hourly_conveyance = 120_000.0
        retention_storage_m3 = 0.0

    total_conveyance_volume_m3 = hourly_conveyance * storm_duration_hours
    net_accumulated_volume_m3 = max(0.0, runoff_volume_m3 - total_conveyance_volume_m3 - retention_storage_m3)

    # Flooded area calculation (km2) via catchment hypsometric curve
    if rainfall_mm <= 5.0:
        flooded_sqkm = 0.0
    else:
        # Non-linear relationship reflecting basin depression filling
        effective_depth_mm = (net_accumulated_volume_m3 / catchment_area_m2) * 1000.0
        # Calibration curve for Bellandur depression
        flooded_sqkm = round(min(28.5, (effective_depth_mm ** 0.82) * 0.42), 2)
        if intervention == "DESILT_RAJAKALUVES":
            # Significant valley-wide drawdown
            flooded_sqkm = round(flooded_sqkm * 0.67, 2)
        elif intervention == "RETENTION_BASIN":
            # Localized peak attenuation
            flooded_sqkm = round(flooded_sqkm * 0.81, 2)

    # Impacted Arterial Roads (Outer Ring Road, Sarjapur Rd, Haralur Rd, Bellandur Lake Rd, etc.)
    max_arterial_segments = 32
    if rainfall_mm <= 15.0:
        impacted_roads = 0
    else:
        ratio = flooded_sqkm / 28.5
        impacted_roads = int(round(min(max_arterial_segments, ratio * max_arterial_segments)))
        if rainfall_mm > 50.0 and impacted_roads == 0:
            impacted_roads = 2

    # Infrastructure status evaluation
    infra_status = {}
    for name, config in INFRASTRUCTURE_NODES.items():
        if intervention == "DESILT_RAJAKALUVES":
            threshold = config["desilt_threshold_mm"]
        elif intervention == "RETENTION_BASIN":
            threshold = config["retention_threshold_mm"]
        else:
            threshold = config["baseline_threshold_mm"]

        if rainfall_mm >= threshold:
            infra_status[name] = "FLOODED"
        else:
            infra_status[name] = "OPERATIONAL"

    # Micro-catchment spatial water depths (for 3D map visualization)
    micro_depths = []
    base_datum_m = 880.0
    for zone in MICRO_CATCHMENTS_CONFIG:
        elev = zone["elevation_m"]
        elev_offset = max(0.1, elev - base_datum_m)
        
        # Water preferentially accumulates at lower elevations
        # Elevation inverse weighting factor
        gravity_accumulation_factor = max(0.05, 1.0 - (elev_offset / 25.0))
        
        if intervention == "DESILT_RAJAKALUVES":
            mitigation_factor = 0.65
        elif intervention == "RETENTION_BASIN" and "ecospace" in zone["id"]:
            # Retention basin directly mitigates Ecospace depression
            mitigation_factor = 0.55
        elif intervention == "RETENTION_BASIN":
            mitigation_factor = 0.82
        else:
            mitigation_factor = 1.0

        local_depth_mm = round(max(0.0, rainfall_mm * gravity_accumulation_factor * mitigation_factor * 1.15), 1)
        
        # Color tier according to specification:
        # < 50 mm: cyan/light blue (#00f0ff)
        # 50 - 150 mm: amber/orange (#f59e0b)
        # > 150 mm: crimson red (#ef4444)
        if local_depth_mm < 50.0:
            depth_tier = "LOW"
            color_hex = "#00f0ff"
        elif local_depth_mm <= 150.0:
            depth_tier = "MODERATE"
            color_hex = "#f59e0b"
        else:
            depth_tier = "SEVERE"
            color_hex = "#ef4444"

        micro_depths.append({
            "id": zone["id"],
            "name": zone["name"],
            "elevation_m": elev,
            "center": zone["center"],
            "water_depth_mm": local_depth_mm,
            "depth_tier": depth_tier,
            "color": color_hex
        })

    return {
        "flooded_sqkm": flooded_sqkm,
        "impacted_arterial_roads": impacted_roads,
        "infrastructure_status": infra_status,
        "gross_runoff_m3": round(runoff_volume_m3, 0),
        "net_accumulated_volume_m3": round(net_accumulated_volume_m3, 0),
        "micro_catchments": micro_depths
    }


def lambda_handler(event, context):
    """
    Entry point for AWS Lambda Function URL.
    Handles HTTP OPTIONS pre-flight and POST execution.
    """
    # 1. Handle CORS Pre-flight
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

        # 3. Validate Inputs
        project = payload.get("project", "4clique")
        if project != "4clique":
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "error": "Invalid project",
                    "expected": "4clique",
                    "received": project
                })
            }

        try:
            rainfall_mm = float(payload.get("rainfall_mm", 0))
        except (ValueError, TypeError):
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "error": "Invalid rainfall_mm. Must be a numeric value between 0 and 300."
                })
            }

        if rainfall_mm < 0.0 or rainfall_mm > 300.0:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "error": "Rainfall out of range. Allowed range is 0 to 300 mm."
                })
            }

        intervention = payload.get("intervention", "BASELINE")
        valid_interventions = ["BASELINE", "DESILT_RAJAKALUVES", "RETENTION_BASIN"]
        if intervention not in valid_interventions:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "error": f"Invalid intervention '{intervention}'. Must be one of: {valid_interventions}"
                })
            }

        target_zone = payload.get("target_zone", "Bellandur-ORR")

        # 4. Execute Hydrologic Simulation for Selected Intervention
        active_results = simulate_hydrology(rainfall_mm, intervention)

        # 5. Execute Baseline Hydrologic Simulation for Defensible Before-vs-After Comparison
        baseline_results = simulate_hydrology(rainfall_mm, "BASELINE")

        # Calculate Flood Reduction Percentage against Baseline
        baseline_area = baseline_results["flooded_sqkm"]
        active_area = active_results["flooded_sqkm"]
        if baseline_area > 0.0 and intervention != "BASELINE":
            flood_reduction_percentage = round(((baseline_area - active_area) / baseline_area) * 100.0, 1)
        else:
            flood_reduction_percentage = 0.0

        # Construct deterministic response conformant with specification
        scenario_id = f"4clique-sim-{uuid.uuid4().hex[:8]}"
        response_data = {
            "project": "4clique",
            "scenario_id": scenario_id,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "rainfall_mm": rainfall_mm,
            "intervention": intervention,
            "target_zone": target_zone,
            "flooded_sqkm": active_results["flooded_sqkm"],
            "impacted_arterial_roads": active_results["impacted_arterial_roads"],
            "infrastructure_status": active_results["infrastructure_status"],
            "flood_reduction_percentage": flood_reduction_percentage,
            "baseline": {
                "flooded_sqkm": baseline_results["flooded_sqkm"],
                "impacted_arterial_roads": baseline_results["impacted_arterial_roads"],
                "infrastructure_status": baseline_results["infrastructure_status"],
                "gross_runoff_m3": baseline_results["gross_runoff_m3"],
                "net_accumulated_volume_m3": baseline_results["net_accumulated_volume_m3"]
            },
            "hydrologic_metrics": {
                "catchment_area_sqkm": CATCHMENT_AREA_SQKM,
                "impervious_fraction": IMPERVIOUS_FRACTION,
                "gross_runoff_m3": active_results["gross_runoff_m3"],
                "net_accumulated_volume_m3": active_results["net_accumulated_volume_m3"],
                "volume_averted_m3": max(0, baseline_results["net_accumulated_volume_m3"] - active_results["net_accumulated_volume_m3"])
            },
            "micro_catchments": active_results["micro_catchments"]
        }

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
