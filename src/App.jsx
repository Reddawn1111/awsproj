import React, { useState, useEffect, useRef } from 'react';
import { Map3D } from './components/Map3D';
import { GoogleMapsSearchBar } from './components/GoogleMapsSearchBar';
import { SimulationDrawer } from './components/SimulationDrawer';
import { LiveStatusPill } from './components/LiveStatusPill';
import { DevToolsGuideModal } from './components/DevToolsGuideModal';
import { SettingsModal } from './components/SettingsModal';
import { BENGALURU_HOTSPOTS, getBengaluruRainGridPoints, matchNearestRain } from './config/bengaluruHotspots';
import { fetchCityRainGrid } from './services/openMeteo';
import { runAwsBlockSimulation, runAwsLiveAssessment } from './services/awsSimulation';
import { calculateSquareBounds, sampleTerrainGrid } from './utils/geo';
import { reverseLocationIQ } from './services/locationiq';

export function App() {
  // App Mode: 'live' (city-wide baseline) | 'armed' (click-to-extract) | 'block' (active 1km drawer open)
  const [appMode, setAppMode] = useState('live');
  const [isSimulateMode, setIsSimulateMode] = useState(false);

  // Active Block State
  const [blockBounds, setBlockBounds] = useState(null);
  const [blockLabel, setBlockLabel] = useState('');
  const [blockSimulationResult, setBlockSimulationResult] = useState(null);
  const [elevationStats, setElevationStats] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Simulation Drawer Controls
  const [rainfallMm, setRainfallMm] = useState(120);
  const [cloggingPercent, setCloggingPercent] = useState(70);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simError, setSimError] = useState(null);
  const [lastSuccessTimestamp, setLastSuccessTimestamp] = useState(null);
  const [latencyMs, setLatencyMs] = useState(0);

  // City-wide Live Assessment State
  const [liveHotspots, setLiveHotspots] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);

  // UI Navigation & Modals
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
  const collapseTimeoutRef = useRef(null);
  const mapRef = useRef(null);

  const [mapboxToken, setMapboxToken] = useState(() => {
    return localStorage.getItem('4clique_mapbox_token') || import.meta.env.VITE_MAPBOX_TOKEN || '';
  });
  const [awsLambdaUrl, setAwsLambdaUrl] = useState(() => {
    return localStorage.getItem('4clique_lambda_url') || import.meta.env.VITE_AWS_LAMBDA_URL || 'http://127.0.0.1:8000';
  });

  const [isDevToolsModalOpen, setIsDevToolsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // 1. Initial City-wide Live Assessment on Mount
  useEffect(() => {
    executeCityLiveAssessment();
    const interval = setInterval(executeCityLiveAssessment, 15 * 60 * 1000); // 15-min auto refresh
    return () => clearInterval(interval);
  }, [awsLambdaUrl]);

  const executeCityLiveAssessment = async () => {
    try {
      // 1a. Query 5x5 rain grid across BBMP in single batch
      const gridPoints = getBengaluruRainGridPoints();
      const rainResults = await fetchCityRainGrid(gridPoints);

      // 1b. Match rain reading to each hotspot
      const hotspotsWithRain = BENGALURU_HOTSPOTS.map(h => ({
        ...h,
        rain_mm_hr: matchNearestRain(h.coords, rainResults)
      }));

      // 1c. Invoke AWS Lambda live assessment
      const res = await runAwsLiveAssessment({
        hotspots: hotspotsWithRain,
        awsLambdaUrl
      });

      if (res?.hotspots) {
        setLiveHotspots(res.hotspots);
        setLiveSummary(res.city_summary);
      }
    } catch (err) {
      console.warn("City live assessment error:", err);
    }
  };

  // 2. Toggle "SIMULATE" Mode: Shares isSimulateMode across search bar, map, and drawer
  const handleToggleSimulate = () => {
    if (!isSimulateMode) {
      setIsSimulateMode(true);
      setAppMode('block');
      // If no block selected yet, auto-select a 1 km x 1 km block around current map center or Bellandur
      const center = mapRef.current ? mapRef.current.getCenter() : { lng: 77.6805, lat: 12.9352 };
      handleSelectCoordsForBlock([center.lng, center.lat], 'Bengaluru Simulation Zone');
    } else {
      // Return to live city mode & clear simulation block
      setIsSimulateMode(false);
      setAppMode('live');
      setBlockBounds(null);
      setBlockSimulationResult(null);
    }
  };

  // 3. Extract 1 km x 1 km Block on Coordinate Selection (Search result or map click)
  const handleSelectCoordsForBlock = async ([lng, lat], label = null) => {
    setIsSimulateMode(true);
    setAppMode('block');
    const bounds = calculateSquareBounds(lng, lat);
    setBlockBounds(bounds);

    // Smoothly fly camera to focus on extracted block
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 16,
        pitch: 65,
        bearing: -20,
        duration: 1600
      });
    }

    // Reverse geocode block label if not provided
    if (label) {
      setBlockLabel(label);
    } else {
      reverseLocationIQ(lat, lng).then(r => setBlockLabel(r.primaryName));
    }

    // Auto-trigger block simulation with current parameters
    setTimeout(() => {
      runBlockSimulationInternal(bounds, rainfallMm, cloggingPercent);
    }, 400);
  };

  // 4. Run 1km Block Hydrologic Simulation
  const runBlockSimulationInternal = async (boundsToUse, rainToUse, clogToUse) => {
    if (!boundsToUse) return;
    setIsSimulating(true);
    setSimError(null);

    try {
      // Sample 16x16 terrain elevation grid inside the 1km block
      const terrainSamples = sampleTerrainGrid(mapRef.current, boundsToUse, 16);

      const result = await runAwsBlockSimulation({
        rainfallMm: rainToUse,
        cloggingPercent: clogToUse,
        bounds: boundsToUse,
        terrainSamples,
        awsLambdaUrl
      });

      setBlockSimulationResult(result);
      setLatencyMs(result.latencyMs);
      setLastSuccessTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error("Block simulation failed:", err);
      setSimError(err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  // Preset Trigger: Extreme Monsoon Surge (145 mm/hr, 80% clogging)
  const handleTriggerPresetSurge = () => {
    setRainfallMm(145);
    setCloggingPercent(80);
    if (blockBounds) {
      runBlockSimulationInternal(blockBounds, 145, 80);
    }
  };

  // GPS Locate Me Button: Pinpoint Marker + Smooth Camera Fly-to + Auto-Block
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      const fallback = [77.6805, 12.9352];
      setUserLocation(fallback);
      if (mapRef.current) {
        mapRef.current.flyTo({ center: fallback, zoom: 16, pitch: 60, bearing: -20, duration: 1800 });
      }
      if (isSimulateMode) {
        handleSelectCoordsForBlock(fallback, 'Bengaluru Center (GPS Fallback)');
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(coords);
        if (mapRef.current) {
          mapRef.current.flyTo({ center: coords, zoom: 16.5, pitch: 60, bearing: -20, duration: 1800 });
        }
        if (isSimulateMode) {
          handleSelectCoordsForBlock(coords, 'Current Location (1 km² Block)');
        }
      },
      (err) => {
        console.warn("Geolocation fallback:", err);
        const fallback = [77.6805, 12.9352];
        setUserLocation(fallback);
        if (mapRef.current) {
          mapRef.current.flyTo({ center: fallback, zoom: 16.5, pitch: 60, bearing: -20, duration: 1800 });
        }
        if (isSimulateMode) {
          handleSelectCoordsForBlock(fallback, 'Bellandur Hotspot (GPS Fallback)');
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Fly Camera to selected city hotspot
  const handleFlyToHotspot = (coords) => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: coords, zoom: 15.5, pitch: 60, bearing: -20, duration: 1500 });
    }
  };

  // Map movement auto-collapse search bar
  const handleMapMoveStart = () => {
    if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    setIsSearchCollapsed(true);
  };

  const handleMapIdle = () => {
    if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    collapseTimeoutRef.current = setTimeout(() => {
      setIsSearchCollapsed(false);
    }, 600);
  };

  const handleSaveMapboxToken = (token) => {
    setMapboxToken(token);
    localStorage.setItem('4clique_mapbox_token', token);
  };

  const handleSaveAwsLambdaUrl = (url) => {
    setAwsLambdaUrl(url);
    localStorage.setItem('4clique_lambda_url', url);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#13171f' }}>
      {/* 1. Full-Screen Mapbox Canvas */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <Map3D
          mapboxToken={mapboxToken}
          mode={appMode}
          isSimulateMode={isSimulateMode}
          blockBounds={blockBounds}
          rainfallMm={rainfallMm}
          cloggingPercent={cloggingPercent}
          userLocation={userLocation}
          onMapClickForBlock={(coords) => {
            handleSelectCoordsForBlock(coords);
          }}
          liveHotspots={liveHotspots}
          simulationResult={blockSimulationResult}
          onElevationStatsCalculated={setElevationStats}
          onMapMoveStart={handleMapMoveStart}
          onMapIdle={handleMapIdle}
          mapRefOut={mapRef}
        />
      </div>

      {/* 2. Google Maps Collapsible Search Bar (Top-Left) */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 30, maxWidth: '440px', width: 'calc(100vw - 32px)' }}>
        <GoogleMapsSearchBar
          onSelectLocation={(coords, label) => {
            handleSelectCoordsForBlock(coords, label);
          }}
          onLocateMe={handleLocateMe}
          isSimulateArmed={isSimulateMode}
          isSimulateMode={isSimulateMode}
          onToggleSimulate={handleToggleSimulate}
          isCollapsed={isSearchCollapsed}
          onExpand={() => setIsSearchCollapsed(false)}
        />
      </div>

      {/* 3. Top-Center Live City Assessment Telemetry Pill */}
      <LiveStatusPill
        liveSummary={liveSummary}
        hotspots={liveHotspots}
        onFlyToHotspot={handleFlyToHotspot}
        onOpenDevTools={() => setIsDevToolsModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* 4. Floating 1 km x 1 km Simulation Drawer (Opens upon simulation mode & extraction) */}
      <SimulationDrawer
        isOpen={isSimulateMode && !!blockBounds}
        onClose={() => {
          setIsSimulateMode(false);
          setAppMode('live');
          setBlockBounds(null);
          setBlockSimulationResult(null);
          setElevationStats(null);
        }}
        blockBounds={blockBounds}
        blockLabel={blockLabel}
        rainfallMm={rainfallMm}
        onRainfallChange={setRainfallMm}
        cloggingPercent={cloggingPercent}
        onCloggingChange={setCloggingPercent}
        elevationStats={elevationStats}
        onRunSimulation={() => runBlockSimulationInternal(blockBounds, rainfallMm, cloggingPercent)}
        onTriggerPresetSurge={handleTriggerPresetSurge}
        isLoading={isSimulating}
        error={simError}
        lastSuccessTimestamp={lastSuccessTimestamp}
        latencyMs={latencyMs}
        simulationResult={blockSimulationResult}
      />

      {/* DevTools & Settings Modals */}
      <DevToolsGuideModal
        isOpen={isDevToolsModalOpen}
        onClose={() => setIsDevToolsModalOpen(false)}
        currentEndpoint={awsLambdaUrl}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        mapboxToken={mapboxToken}
        onSaveMapboxToken={handleSaveMapboxToken}
        awsLambdaUrl={awsLambdaUrl}
        onSaveAwsLambdaUrl={handleSaveAwsLambdaUrl}
      />
    </div>
  );
}
