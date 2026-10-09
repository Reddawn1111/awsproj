import React, { useState, useEffect, useRef } from 'react';
import { Map3D } from './components/Map3D';
import { GoogleMapsSearchBar } from './components/GoogleMapsSearchBar';
import { SimulationDrawer } from './components/SimulationDrawer';
import { LiveStatusPill } from './components/LiveStatusPill';
import { DevToolsGuideModal } from './components/DevToolsGuideModal';
import { SettingsModal } from './components/SettingsModal';
import { ReportModal } from './components/ReportModal';
import { RainwaterHarvestModal } from './components/RainwaterHarvestModal';
import { DemoPresetModal } from './components/DemoPresetModal';
import { SimulationPlaybackDock } from './components/SimulationPlaybackDock';
import { BENGALURU_HOTSPOTS, getBengaluruRainGridPoints, matchNearestRain } from './config/bengaluruHotspots';
import { fetchCityRainGrid } from './services/openMeteo';
import { runAwsBlockSimulation, runAwsLiveAssessment } from './services/awsSimulation';
import { calculateSquareBounds, sampleTerrainGrid } from './utils/geo';
import { generate24HourSimulationSequence } from './utils/simulation24h';
import { reverseLocationIQ } from './services/locationiq';
import { getStoredDrainageAlerts } from './config/drainageAlerts';
import { BENGALURU_CENTER } from './config/camera';

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

  // Dynamic Area-Specific Rainwater Harvesting (RWH) Breakdown State
  const [blockRwhStats, setBlockRwhStats] = useState(null);

  // Consolidated Simulation Parameters
  const [rainfallMm, setRainfallMm] = useState(120);
  const [cloggingPercent, setCloggingPercent] = useState(70);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simError, setSimError] = useState(null);
  const [lastSuccessTimestamp, setLastSuccessTimestamp] = useState(null);
  const [latencyMs, setLatencyMs] = useState(0);

  // 24-Hour Time-Stepped Simulation Sequence State
  const [sim24Sequence, setSim24Sequence] = useState(null);
  const [currentSimHour, setCurrentSimHour] = useState(0);
  const [is24SimActive, setIs24SimActive] = useState(false);
  const [is24SimPlaying, setIs24SimPlaying] = useState(false);

  // City-wide Live Assessment State
  const [liveHotspots, setLiveHotspots] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);

  // UI Navigation, Toolbar & Modals
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
  const collapseTimeoutRef = useRef(null);
  const mapRef = useRef(null);

  // Modals & Toolbar Controls State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedDrainIdForReport, setSelectedDrainIdForReport] = useState(null);
  const [isRwhModalOpen, setIsRwhModalOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const [show3DBuildings, setShow3DBuildings] = useState(true);
  const [drainageAlerts, setDrainageAlerts] = useState(() => getStoredDrainageAlerts());

  const [mapboxToken, setMapboxToken] = useState(() => {
    return localStorage.getItem('4clique_mapbox_token') || import.meta.env.VITE_MAPBOX_TOKEN || '';
  });
  const [awsLambdaUrl, setAwsLambdaUrl] = useState(() => {
    return localStorage.getItem('4clique_lambda_url') || import.meta.env.VITE_AWS_LAMBDA_URL || 'http://127.0.0.1:8000';
  });

  const [isDevToolsModalOpen, setIsDevToolsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // 0. Automatic Geolocation on Mount (Fall back gracefully to Bengaluru Center)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = [pos.coords.longitude, pos.coords.latitude];
          setUserLocation(coords);
          if (mapRef.current) {
            mapRef.current.flyTo({
              center: coords,
              zoom: 16,
              pitch: 55,
              bearing: -15,
              duration: 2000
            });
          }
        },
        (err) => {
          console.warn("Geolocation permission denied or unavailable, using Bengaluru center:", err);
          if (mapRef.current) {
            mapRef.current.flyTo({
              center: BENGALURU_CENTER,
              zoom: 14.5,
              pitch: 55,
              bearing: -15,
              duration: 1500
            });
          }
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    }
  }, []);

  // 1. Initial City-wide Live Assessment on Mount
  useEffect(() => {
    executeCityLiveAssessment();
    const interval = setInterval(executeCityLiveAssessment, 15 * 60 * 1000); // 15-min auto refresh
    return () => clearInterval(interval);
  }, [awsLambdaUrl]);

  // 24-Hour Simulation Step Playback Loop (Auto-increments hourly step t = 0 to 24)
  useEffect(() => {
    let timer = null;
    if (is24SimPlaying && is24SimActive) {
      timer = setInterval(() => {
        setCurrentSimHour((prev) => {
          if (prev >= 24) {
            setIs24SimPlaying(false);
            return 24;
          }
          return prev + 1;
        });
      }, 750);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [is24SimPlaying, is24SimActive]);

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

  // 2. Initialize 24-Hour Time-Stepped Grid Simulation Sequence
  const init24HourSimulation = (bounds, rain, clog) => {
    if (!bounds) return;
    try {
      const terrainSamples = sampleTerrainGrid(mapRef.current, bounds, 16);
      const sequence = generate24HourSimulationSequence({
        blockBounds: bounds,
        peakRainfallMm: rain,
        cloggingPercent: clog,
        terrainSamples
      });

      setSim24Sequence(sequence);
      setCurrentSimHour(0);
      setIs24SimActive(true);
      setIs24SimPlaying(true);
    } catch (e) {
      console.warn("Failed to generate 24h simulation sequence:", e);
    }
  };

  // 3. Toggle "SIMULATE" Mode: Decoupled Simulation Trigger
  // Simulation initializes and starts playback automatically ONLY when "SIMULATE" button is clicked
  const handleToggleSimulate = () => {
    if (!isSimulateMode) {
      setIsSimulateMode(true);
      setAppMode('block');

      let targetBounds = blockBounds;
      if (!targetBounds) {
        // If no block selected yet, auto-select a 1 km x 1 km block around current map center or Bellandur
        const center = mapRef.current ? mapRef.current.getCenter() : { lng: 77.6805, lat: 12.9352 };
        targetBounds = calculateSquareBounds(center.lng, center.lat);
        setBlockBounds(targetBounds);
        setBlockLabel('Bengaluru Simulation Zone');
      }

      // Explicitly initialize simulation and auto-play 24h timeline
      runBlockSimulationInternal(targetBounds, rainfallMm, cloggingPercent);
      init24HourSimulation(targetBounds, rainfallMm, cloggingPercent);
    } else {
      // Exit simulation mode & clear active simulation state
      setIsSimulateMode(false);
      setAppMode('live');
      setBlockBounds(null);
      setBlockSimulationResult(null);
      setBlockRwhStats(null);
      setIs24SimActive(false);
      setIs24SimPlaying(false);
      setSim24Sequence(null);
      setCurrentSimHour(0);
    }
  };

  // 4. Area / Block Selection on Coordinate Selection (Search result or map click)
  // Decoupled: ONLY highlights the boundary outline as active. Does NOT auto-run simulation.
  const handleSelectCoordsForBlock = async ([lng, lat], label = null) => {
    const bounds = calculateSquareBounds(lng, lat);
    setBlockBounds(bounds);
    setAppMode('block');

    // Reset previous simulation run state so boundary is active without immediately running simulation
    setBlockSimulationResult(null);
    setIs24SimActive(false);
    setIs24SimPlaying(false);
    setSim24Sequence(null);
    setCurrentSimHour(0);
    setIsSimulateMode(false);

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
  };

  // 5. Run 1km Block Hydrologic Simulation
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
      init24HourSimulation(blockBounds, 145, 80);
    }
  };

  // GPS Locate Me Button: Pinpoint Marker + Smooth Camera Fly-to + Auto-Block
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setUserLocation(BENGALURU_CENTER);
      if (mapRef.current) {
        mapRef.current.flyTo({ center: BENGALURU_CENTER, zoom: 16, pitch: 60, bearing: -20, duration: 1800 });
      }
      if (isSimulateMode) {
        handleSelectCoordsForBlock(BENGALURU_CENTER, 'Bengaluru Center (GPS Fallback)');
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
        setUserLocation(BENGALURU_CENTER);
        if (mapRef.current) {
          mapRef.current.flyTo({ center: BENGALURU_CENTER, zoom: 15, pitch: 60, bearing: -20, duration: 1800 });
        }
        if (isSimulateMode) {
          handleSelectCoordsForBlock(BENGALURU_CENTER, 'Bengaluru Center (GPS Fallback)');
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

  // Municipal & Citizen Override Handler
  const handleOpenReportForDrain = (drainId) => {
    setSelectedDrainIdForReport(drainId);
    setIsReportModalOpen(true);
  };

  const handleReportSubmitted = () => {
    setDrainageAlerts(getStoredDrainageAlerts());
  };

  // Demo Preset Trigger: Consolidated parameter update & 24h simulation launch
  const handleApplyDemoPreset = ({ rainfallMm: rain, cloggingPercent: clog }) => {
    setRainfallMm(rain);
    setCloggingPercent(clog);
    if (!isSimulateMode) {
      setIsSimulateMode(true);
      setAppMode('block');
      const center = mapRef.current ? mapRef.current.getCenter() : { lng: BENGALURU_CENTER[0], lat: BENGALURU_CENTER[1] };
      handleSelectCoordsForBlock([center.lng, center.lat], 'Monsoon Peak Zone');
    } else if (blockBounds) {
      runBlockSimulationInternal(blockBounds, rain, clog);
      init24HourSimulation(blockBounds, rain, clog);
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
      {/* 1. Full-Screen Mapbox Canvas with State-Wide Karnataka Drains & 360 Look-Around Controller */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <Map3D
          mapboxToken={mapboxToken}
          mode={appMode}
          isSimulateMode={isSimulateMode}
          blockBounds={blockBounds}
          blockLabel={blockLabel}
          rainfallMm={rainfallMm}
          cloggingPercent={cloggingPercent}
          userLocation={userLocation}
          onMapClickForBlock={(coords) => {
            handleSelectCoordsForBlock(coords);
          }}
          liveHotspots={liveHotspots}
          simulationResult={blockSimulationResult}
          onElevationStatsCalculated={setElevationStats}
          onBlockRwhCalculated={setBlockRwhStats}
          onMapMoveStart={handleMapMoveStart}
          onMapIdle={handleMapIdle}
          mapRefOut={mapRef}
          drainageAlerts={drainageAlerts}
          onOpenReportModal={handleOpenReportForDrain}
          isOrbiting={isOrbiting}
          onToggleOrbit={() => setIsOrbiting(prev => !prev)}
          show3DBuildings={show3DBuildings}
          onToggle3DBuildings={() => setShow3DBuildings(prev => !prev)}
          // 24-Hour Simulation Sequence Props
          sim24Sequence={sim24Sequence}
          currentSimHour={currentSimHour}
          is24SimActive={is24SimActive}
        />
      </div>

      {/* 2. Google Maps Collapsible Search Bar (Top-Left) with Docked Secondary Utility Ribbon */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 30, maxWidth: '460px', width: 'calc(100vw - 32px)' }}>
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
          rainfallMm={rainfallMm}
          onOpenRWH={() => setIsRwhModalOpen(true)}
          onToggleOrbit={() => setIsOrbiting(prev => !prev)}
          isOrbiting={isOrbiting}
          show3DBuildings={show3DBuildings}
          onToggle3DBuildings={() => setShow3DBuildings(prev => !prev)}
          onOpenDemo={() => setIsDemoModalOpen(true)}
          onOpenReport={() => {
            setSelectedDrainIdForReport(null);
            setIsReportModalOpen(true);
          }}
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

      {/* 4. Floating 1 km x 1 km Simulation Drawer with 24h Timeline & Dynamic RWH Breakdown */}
      <SimulationDrawer
        isOpen={isSimulateMode && !!blockBounds}
        onClose={() => {
          setIsSimulateMode(false);
          setAppMode('live');
          setBlockBounds(null);
          setBlockSimulationResult(null);
          setElevationStats(null);
          setBlockRwhStats(null);
          setIs24SimActive(false);
          setIs24SimPlaying(false);
          setSim24Sequence(null);
          setCurrentSimHour(0);
        }}
        blockBounds={blockBounds}
        blockLabel={blockLabel}
        rainfallMm={rainfallMm}
        cloggingPercent={cloggingPercent}
        elevationStats={elevationStats}
        onRunSimulation={() => runBlockSimulationInternal(blockBounds, rainfallMm, cloggingPercent)}
        onTriggerPresetSurge={handleTriggerPresetSurge}
        isLoading={isSimulating}
        error={simError}
        lastSuccessTimestamp={lastSuccessTimestamp}
        latencyMs={latencyMs}
        simulationResult={blockSimulationResult}
        // Consolidated Parameter Drawer Opener
        onOpenDemoPreset={() => setIsDemoModalOpen(true)}
        // Dynamic Area-Specific RWH Breakdown
        rwhStats={blockRwhStats}
        onOpenRWH={() => setIsRwhModalOpen(true)}
        // 24-Hour Time-Stepped Simulation Sequence Controls
        sim24Sequence={sim24Sequence}
        currentSimHour={currentSimHour}
        onSimHourChange={setCurrentSimHour}
        is24SimActive={is24SimActive}
        is24SimPlaying={is24SimPlaying}
        onToggle24SimPlay={() => setIs24SimPlaying(prev => !prev)}
        onReset24Sim={() => {
          setCurrentSimHour(0);
          setIs24SimPlaying(false);
        }}
        onStart24Simulation={() => {
          if (blockBounds) init24HourSimulation(blockBounds, rainfallMm, cloggingPercent);
        }}
      />

      {/* 4b. Floating Simulation Playback Dock Anchored at Bottom-Center */}
      <SimulationPlaybackDock
        isActive={is24SimActive}
        isPlaying={is24SimPlaying}
        currentHour={currentSimHour}
        simSequence={sim24Sequence}
        onTogglePlay={() => setIs24SimPlaying(prev => !prev)}
        onReset={() => {
          setCurrentSimHour(0);
          setIs24SimPlaying(false);
        }}
        onHourChange={(newHour) => setCurrentSimHour(newHour)}
      />

      {/* 5. Citizen & Municipal Drainage Report Override Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialDrainId={selectedDrainIdForReport}
        onReportSubmitted={handleReportSubmitted}
      />

      {/* 6. Dynamic Area-Specific Rainwater Harvesting (RWH) Calculation Modal */}
      <RainwaterHarvestModal
        isOpen={isRwhModalOpen}
        onClose={() => setIsRwhModalOpen(false)}
        rainfallMm={rainfallMm}
        rwhStats={blockRwhStats}
        blockLabel={blockLabel}
      />

      {/* 7. Monsoon Peak Simulation Demo Preset Modal (Consolidated Simulation Parameters) */}
      <DemoPresetModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        currentRainfall={rainfallMm}
        currentClogging={cloggingPercent}
        onApplyPreset={handleApplyDemoPreset}
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
