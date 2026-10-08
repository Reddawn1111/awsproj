# 4clique: 3D Urban Waterlogging & Flood Simulation Digital Twin

**Track:** Heat and Water  
**Target Basin:** Bengaluru (Bellandur – Sarjapur – Outer Ring Road Technology Corridor)  
**Target Camera:** Latitude `12.9352°N`, Longitude `77.6805°E`, Pitch `60°`, Bearing `-20°`

---

## 1. Executive Summary & Concept

Rapid urbanization along Bengaluru's Outer Ring Road (ORR) and the Bellandur lake basin has transformed historical valley cascades into impervious tech corridors. During high-intensity monsoon deluges, low-lying bottleneck sections experience severe waterlogging, crippling transit corridors and threatening critical power and healthcare infrastructure.

**4clique** is an AWS-centric, interactive **3D Urban Waterlogging Digital Twin and Hydrologic Decision-Support System**. It models how real-world terrain elevation, storm rainfall depth, drainage conveyance, and engineered interventions (*Rajakaluve Desilting* and *Retention Basins*) affect localized flood depth and infrastructure vulnerability.

```
REAL WORLD
Terrain + Rainfall + Drainage + Infrastructure
        ↓
4CLIQUE DIGITAL TWIN
        ↓
Simulate Rainfall (0–300 mm / Live Open-Meteo)
        ↓
Predict Water Accumulation via AWS Lambda
        ↓
Identify Infrastructure at Risk (Sakra Hospital, KPTCL Substation, Ecospace ORR)
        ↓
Test Mitigation Interventions
        ↓
Compare BEFORE (Baseline) vs AFTER (Intervention)
```

---

## 2. System Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │          4CLIQUE FRONTEND APPLICATION        │
                  │             (React 18 + Vite + 3D)           │
                  └───────────────┬──────────────────┬───────────┘
                                  │                  │
                Live Precipitation│                  │ Direct Client POST
                (Lat 12.935, Lng 77.680)             │ (JSON Payload)
                                  ▼                  ▼
                  ┌──────────────────────┐   ┌───────────────────────────┐
                  │      OPEN-METEO      │   │   AWS LAMBDA FUNCTION URL │
                  │     WEATHER API      │   │      (Python 3.11)        │
                  │   (Free & Public)    │   │  Hydrologic Twin Engine   │
                  └──────────────────────┘   └─────────────┬─────────────┘
                                                           │
                                                           │ Deterministic Simulation
                                                           │ & Before vs After Metrics
                                                           ▼
                                             ┌───────────────────────────┐
                                             │       JSON RESPONSE       │
                                             │   - Scenario ID           │
                                             │   - Flooded Area (km²)    │
                                             │   - Impacted Arterials    │
                                             │   - Infra Vulnerability   │
                                             │   - Flood Reduction %     │
                                             │   - Micro-catchment depths│
                                             └─────────────┬─────────────┘
                                                           │
                                                           ▼
                  ┌──────────────────────────────────────────────┐
                  │          3D MAPBOX GL JS v3 DIORAMA          │
                  │  - Mapbox Terrain-DEM Topography (1.5x)      │
                  │  - 3D Extruded Buildings                     │
                  │  - Dynamic Waterlogging Depth Layers         │
                  │  - Pulsing 3D Infrastructure Status Markers  │
                  └──────────────────────────────────────────────┘
```

---

## 3. Hydrologic Model & Scientific Assumptions

> [!NOTE]
> This is a scenario-based hydrologic decision-support prototype calibrated for rapid urban engineering simulation, not a certified hydrodynamic flood warning system.

1. **Catchment Geography:** Bellandur-ORR natural drainage basin encompasses approximately **$42.5\text{ km}^2$**.
2. **Impervious Surface Coverage:** Estimated at **$80\%$** with a composite runoff coefficient of **$C = 0.85$**, typical of dense IT corridors and paved arterials.
3. **Hydrologic Water Balance:**
   - **Gross Storm Runoff Volume:** $V_{\text{gross}} = \text{Area} \times \text{Rainfall Depth} \times C$
   - **Drainage Conveyance:**
     - **BASELINE (Clogged Rajakaluves):** Effective conveyance restricted to $120,000\text{ m}^3/\text{hr}$ due to silt accumulation, encroachment, and choked culverts.
     - **DESILT_RAJAKALUVES:** Systematic dredging and desilting increases conveyance by **$+35\%$** to $162,000\text{ m}^3/\text{hr}$.
     - **RETENTION_BASIN:** Constructs a dedicated $15,000\text{ m}^3$ detention buffer upstream of Ecospace to absorb initial hydrograph surges.
   - **Net Surface Ponding:** $V_{\text{net}} = \max(0, V_{\text{gross}} - V_{\text{drain}} - V_{\text{retention}})$.
4. **Hypsometric Depression Accumulation:** Water preferentially accumulates in low-lying micro-basins ($880\text{m} - 886\text{m}$) before spreading to elevated flanks ($>900\text{m}$).
5. **Critical Infrastructure Failure Thresholds:**
   - **Bellandur KPTCL Substation ($882\text{m}$ elevation):** Sits in the lowest depression adjacent to the main trunk canal. Breaches at $\ge 65\text{ mm}$ (Baseline), $\ge 80\text{ mm}$ (Retention Basin), $\ge 95\text{ mm}$ (Desilt).
   - **Ecospace ORR ($884\text{m}$ elevation):** High-density tech park depression and arterial underpass. Breaches at $\ge 110\text{ mm}$ (Baseline), $\ge 138\text{ mm}$ (Retention Basin), $\ge 155\text{ mm}$ (Desilt).
   - **Sakra World Hospital ($886\text{m}$ elevation):** Level 1 trauma center access ramp. Breaches during severe events at $\ge 190\text{ mm}$ (Baseline), $\ge 220\text{ mm}$ (Retention Basin), $\ge 245\text{ mm}$ (Desilt).

---

## 4. Flood Visualization Depth Tiers

Dynamic 3D polygon layers reflect local water accumulation depths:
- **Low Depth ($< 50\text{ mm}$):** Cyan / Light Blue (`#00f0ff`)
- **Moderate Depth ($50 - 150\text{ mm}$):** Amber / Orange (`#f59e0b`)
- **Severe Depth ($> 150\text{ mm}$):** Crimson Red (`#ef4444`)

---

## 5. Deploying the Python 3.11 Lambda on AWS

Deploying the backend to AWS Lambda takes **less than 3 minutes**:

### Step 1: Create AWS Lambda Function
1. Log in to the [AWS Management Console](https://console.aws.amazon.com/).
2. Navigate to **AWS Lambda** → **Create function**.
3. Choose **Author from scratch**.
4. Configure:
   - **Function name:** `4clique-hydrologic-twin`
   - **Runtime:** **Python 3.11**
   - **Architecture:** `x86_64` or `arm64`
5. Click **Create function**.

### Step 2: Upload Code
1. Open `lambda/lambda_function.py` from this repository.
2. In the AWS Lambda Code editor, replace the contents of `lambda_function.py` with the code from `lambda/lambda_function.py`.
3. Click **Deploy**.

> [!TIP]
> The function relies entirely on Python 3.11 standard libraries (`json`, `uuid`, `datetime`). No external `.zip` or pip packages are required! Cold starts are $<50\text{ ms}$.

### Step 3: Configure Function URL with CORS
1. In the Lambda function console, go to the **Configuration** tab → **Function URL**.
2. Click **Create function URL**.
3. Choose:
   - **Auth type:** `NONE` (Public URL for hackathon demonstration)
   - Check **Configure cross-origin resource sharing (CORS)**
4. Set CORS parameters:
   - **Allow origin:** `*`
   - **Allow headers:** `*` (or `content-type, authorization`)
   - **Allow methods:** `POST`, `OPTIONS`
5. Click **Save**.
6. Copy the generated **Function URL** (e.g. `https://xxxxxxxxxxxx.lambda-url.ap-south-1.on.aws/`).

### Step 4: Configure Frontend
In your `.env` file (or via the in-app Settings modal):
```env
VITE_MAPBOX_TOKEN=pk.eyJ1Ijoi...
VITE_AWS_LAMBDA_URL=https://xxxxxxxxxxxx.lambda-url.ap-south-1.on.aws/
```

---

## 6. Local Quickstart (Without Immediate AWS Access)

You can run the full digital twin locally with our included zero-dependency Python local Lambda runner:

### Terminal 1: Start Local Lambda Server
```bash
npm run server:lambda
# Running on http://127.0.0.1:8000 with full CORS support!
```

### Terminal 2: Start Frontend Application
```bash
npm install
npm run dev
# Running on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## 7. Hackathon Judging & DevTools Verification Guide

Judges can verify actual AWS cloud execution in **Chrome or Firefox DevTools**:

1. Open **4clique** at `http://localhost:5173`.
2. Press `F12` (or right-click → **Inspect**) to open DevTools.
3. Switch to the **Network** tab.
4. Filter by **Fetch/XHR**.
5. Set rainfall to `180 mm` and select `DESILT_RAJAKALUVES`.
6. Click **"RUN 4CLIQUE HYDROLOGIC TWIN ON AWS"**.
7. In the Network log, select the request to the Lambda Function URL:
   - **Request URL:** `<Your AWS Lambda Function URL>`
   - **Request Method:** `POST`
   - **Status Code:** `200 OK`
   - **Request Payload:**
     ```json
     {
       "project": "4clique",
       "rainfall_mm": 180,
       "intervention": "DESILT_RAJAKALUVES",
       "target_zone": "Bellandur-ORR"
     }
     ```
   - **Response JSON:**
     ```json
     {
       "scenario_id": "4clique-sim-a1b2c3d4",
       "flooded_sqkm": 15.24,
       "impacted_arterial_roads": 17,
       "infrastructure_status": {
         "Bellandur KPTCL Substation": "FLOODED",
         "Ecospace ORR": "OPERATIONAL",
         "Sakra World Hospital": "OPERATIONAL"
       },
       "flood_reduction_percentage": 35.4,
       "baseline": {
         "flooded_sqkm": 23.6,
         "impacted_arterial_roads": 26
       }
     }
     ```
8. Observe the 3D map:
   - Water accumulation drops by **$35.4\%$**.
   - Ecospace ORR switches from `FLOODED` (baseline) to `OPERATIONAL`.
   - The Before vs After analytical panel displays real-time mitigation gains.

---

## 8. Technology Stack

- **Frontend:** React 18, Vite 5, Mapbox GL JS v3, Lucide Icons.
- **Geospatial & 3D:** Mapbox Terrain-DEM raster tiles, Mapbox 3D extruded vector buildings, GeoJSON micro-catchments.
- **Backend / Cloud:** Python 3.11, AWS Lambda, Lambda Function URL with native CORS.
- **External Data:** Open-Meteo Weather API (Hourly & Real-time precipitation).