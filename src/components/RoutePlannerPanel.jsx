import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock3,
  CloudRain,
  Compass,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Zap,
  X
} from 'lucide-react';
import { searchLocationIQ } from '../services/locationiq';
import { fetchAlternativeRoutes } from '../services/routePlanning';
import {
  assessRoutes,
  collectHazardMarkers,
  evaluateCorridorFlood,
  formatRerouteSuggestion,
  generateCorridorHazards,
  getRouteExclusionCoordinates,
  getRouteRiskNotice,
  recommendRoute,
  ROUTE_SIMULATION_PRESETS
} from '../services/routeAssessment';
import { BENGALURU_HOTSPOTS } from '../config/bengaluruHotspots';

function LocationField({ label, value, onChange, onSelect, placeholder, locationiqToken }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const updateQuery = (nextValue) => {
    onChange(nextValue);
    clearTimeout(debounceRef.current);
    if (nextValue.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await searchLocationIQ(nextValue, locationiqToken);
        setResults(items || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div className="route-location-field">
      <label>{label}</label>
      <div className="route-input-wrap">
        <MapPin size={15} />
        <input
          value={value?.label || ''}
          onChange={event => updateQuery(event.target.value)}
          placeholder={placeholder}
        />
        {loading && <Loader2 size={14} className="animate-spin" />}
      </div>
      {results.length > 0 && (
        <div className="route-search-results">
          {results.map((item, index) => (
            <button
              key={item.place_id || index}
              type="button"
              onClick={() => {
                onSelect({
                  label: item.display_name.split(',')[0],
                  coords: [Number(item.lon), Number(item.lat)]
                });
                setResults([]);
              }}
            >
              <strong>{item.display_name.split(',')[0]}</strong>
              <span>{item.display_name.split(',').slice(1, 3).join(', ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const formatDistance = meters => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
const formatDuration = seconds => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
};

export function RoutePlannerPanel({
  mapboxToken,
  liveHotspots = [],
  simulationResult = null,
  simulationStatus = 'idle',
  drainageAlerts = [],
  selectedRouteId: selectedRouteIdFromMap,
  onRoutesChange,
  isOpen = true,
  onClose,
  locationiqToken
}) {
  const [origin, setOrigin] = useState({ label: '', coords: null });
  const [destination, setDestination] = useState({ label: '', coords: null });
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [rerouteNotice, setRerouteNotice] = useState('');
  const routeRequestIdRef = useRef(0);

  // --------------------------------------------------------------------------
  // Route Corridor Flood Simulation State & Parameters
  // --------------------------------------------------------------------------
  const [corridorDataSource, setCorridorDataSource] = useState('realworld'); // 'realworld' | 'preset'
  const [activePresetId, setActivePresetId] = useState(null);
  const [rainfallMm, setRainfallMm] = useState(45);
  const [cloggingPercent, setCloggingPercent] = useState(50);
  const [isSimControlsExpanded, setIsSimControlsExpanded] = useState(true);

  // 1. Dynamic Corridor Hazards based on current simulation parameters
  const candidateCorridorHazards = useMemo(() => {
    const hotspotsToUse = (Array.isArray(liveHotspots) && liveHotspots.length > 0)
      ? liveHotspots
      : BENGALURU_HOTSPOTS;

    return generateCorridorHazards({
      liveHotspots: hotspotsToUse,
      drainageAlerts,
      rainfallMm,
      cloggingPercent,
      mode: corridorDataSource
    });
  }, [liveHotspots, drainageAlerts, rainfallMm, cloggingPercent, corridorDataSource]);

  // 2. Evaluate all routes against corridor hazards (start buffer, path buffer, destination buffer)
  const evaluatedRoutes = useMemo(() => {
    if (!routes.length) return [];
    return routes.map((route, index) => {
      const evalResult = evaluateCorridorFlood(route, {
        hazards: candidateCorridorHazards,
        corridorOptions: { startRadiusMeters: 250, destinationRadiusMeters: 250, corridorRadiusMeters: 120 }
      });
      return {
        ...route,
        corridorEval: evalResult,
        isBlocked: evalResult.isBlocked,
        blockedHazards: evalResult.blockedHazards,
        worstHazard: evalResult.worstHazard,
        peakDepth: evalResult.peakDepth,
        corridorHazards: evalResult.corridorHazards,
        corridorHazardCount: evalResult.corridorHazards.length,
        criticalCount: evalResult.blockedHazards.length
      };
    });
  }, [routes, candidateCorridorHazards]);

  // 3. Identify safe bypass route (fastest non-blocked alternative)
  const safeBypassCandidate = useMemo(() => {
    if (!evaluatedRoutes.length) return null;
    const clearRoutes = evaluatedRoutes.filter(r => !r.isBlocked);
    if (clearRoutes.length > 0) {
      return [...clearRoutes].sort((a, b) => a.duration - b.duration)[0];
    }
    return null;
  }, [evaluatedRoutes]);

  const primaryRoute = evaluatedRoutes[0] || null;
  const activeRoute = evaluatedRoutes.find(r => r.id === selectedRouteId) || primaryRoute;
  const isPrimaryBlocked = !!primaryRoute?.isBlocked;
  const isActiveBlocked = !!activeRoute?.isBlocked;

  // 4. Proactive Rerouting Suggestion Banner Content
  const proactiveSuggestion = useMemo(() => {
    if (!evaluatedRoutes.length) return null;
    const worstPoint = activeRoute?.worstHazard || primaryRoute?.worstHazard;
    if (!worstPoint) return null;
    return formatRerouteSuggestion(activeRoute || primaryRoute, worstPoint, safeBypassCandidate);
  }, [evaluatedRoutes, activeRoute, primaryRoute, safeBypassCandidate]);

  // 5. Active corridor hazard points to display on map (excluding block-cell grid clutter)
  const activeCorridorHazards = useMemo(() => {
    if (!evaluatedRoutes.length) return [];
    const map = new Map();
    // Prioritize hazards along the active selected route, then include any candidate route hazards
    const routeToDisplay = activeRoute || primaryRoute;
    (routeToDisplay?.corridorHazards || []).forEach(h => {
      if (!map.has(h.id)) map.set(h.id, h);
    });
    // Add other blocked hazards from alternatives for reference
    evaluatedRoutes.forEach(r => {
      (r.blockedHazards || []).forEach(h => {
        if (!map.has(h.id)) map.set(h.id, h);
      });
    });
    return Array.from(map.values());
  }, [evaluatedRoutes, activeRoute, primaryRoute]);

  const exclusionCoordinates = useMemo(() => {
    return getRouteExclusionCoordinates(activeCorridorHazards);
  }, [activeCorridorHazards]);

  const routeAssessments = useMemo(() => assessRoutes(routes, {
    liveHotspots,
    simulationResult,
    simulationStatus,
    drainageAlerts
  }), [routes, liveHotspots, simulationResult, simulationStatus, drainageAlerts]);

  const recommendation = useMemo(() => {
    if (safeBypassCandidate) return safeBypassCandidate;
    return recommendRoute(routeAssessments);
  }, [safeBypassCandidate, routeAssessments]);

  const riskNotice = useMemo(() => getRouteRiskNotice(routeAssessments, simulationStatus), [routeAssessments, simulationStatus]);

  useEffect(() => {
    if (selectedRouteIdFromMap) setSelectedRouteId(selectedRouteIdFromMap);
  }, [selectedRouteIdFromMap]);

  // Sync route lines, safe bypass highlights, and corridor hazards to parent
  const syncRoutePlan = (nextRoutes, nextSelection) => {
    if (onRoutesChange) {
      const annotatedRoutes = nextRoutes.map(r => {
        const isSafe = (r.id === safeBypassCandidate?.id) && (isPrimaryBlocked || isActiveBlocked);
        return {
          ...r,
          isSafeBypass: isSafe,
          isBlocked: !!r.isBlocked
        };
      });

      onRoutesChange({
        routes: annotatedRoutes,
        selectedRouteId: nextSelection,
        hazards: activeCorridorHazards,
        origin,
        destination,
        assessments: assessRoutes(annotatedRoutes, { liveHotspots, simulationResult, simulationStatus, drainageAlerts })
      });
    }
  };

  const clearRoutesForInputChange = () => {
    routeRequestIdRef.current += 1;
    setRoutes([]);
    setSelectedRouteId(null);
    setRerouteNotice('');
    setMessage('');
    if (onRoutesChange) {
      onRoutesChange({ routes: [], selectedRouteId: null, hazards: [], origin: null, destination: null, assessments: [] });
    }
  };

  // --------------------------------------------------------------------------
  // Complete Exit / Close Handler
  // --------------------------------------------------------------------------
  const handleExitRoutePlanner = () => {
    routeRequestIdRef.current += 1;
    setOrigin({ label: '', coords: null });
    setDestination({ label: '', coords: null });
    setRoutes([]);
    setSelectedRouteId(null);
    setMessage('');
    setRerouteNotice('');
    if (onRoutesChange) {
      onRoutesChange({
        routes: [],
        selectedRouteId: null,
        hazards: [],
        origin: null,
        destination: null,
        assessments: []
      });
    }
    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    if (!routes.length) return;
    const nextSelection = selectedRouteId && evaluatedRoutes.some(route => route.id === selectedRouteId && !route.isBlocked)
      ? selectedRouteId
      : safeBypassCandidate?.id || recommendation?.id || selectedRouteId;
    if (nextSelection !== selectedRouteId) setSelectedRouteId(nextSelection);
    syncRoutePlan(evaluatedRoutes, nextSelection);
  }, [evaluatedRoutes, safeBypassCandidate, recommendation]);

  // Preset Selection Handler
  const handleApplyPreset = (preset) => {
    setActivePresetId(preset.id);
    setCorridorDataSource('preset');
    setRainfallMm(preset.rainfallMm);
    setCloggingPercent(preset.cloggingPercent);
  };

  // Data Source Toggle
  const handleToggleDataSource = (source) => {
    setCorridorDataSource(source);
    if (source === 'realworld') {
      setActivePresetId(null);
      setRainfallMm(35);
      setCloggingPercent(45);
    } else {
      if (!activePresetId) {
        handleApplyPreset(ROUTE_SIMULATION_PRESETS[0]); // Flash Flood
      }
    }
  };

  // One-click Switch to Safe Route
  const handleSwitchToSafeRoute = () => {
    if (safeBypassCandidate) {
      setSelectedRouteId(safeBypassCandidate.id);
      syncRoutePlan(evaluatedRoutes, safeBypassCandidate.id);
    }
  };

  // Primary Route Plan Action
  const handlePlan = async (event) => {
    event.preventDefault();
    if (!origin.coords || !destination.coords) {
      setMessage('Choose both a start location and destination from the search suggestions.');
      return;
    }
    setLoading(true);
    const requestId = ++routeRequestIdRef.current;
    setMessage('');
    setRerouteNotice('');
    try {
      // First pass: request directions with current point exclusions
      const result = await fetchAlternativeRoutes(origin, destination, mapboxToken, exclusionCoordinates);
      if (requestId !== routeRequestIdRef.current) return;
      setRoutes(result.routes);
      setSelectedRouteId(result.routes[0]?.id || null);
      setRerouteNotice(result.notice || '');
      syncRoutePlan(result.routes, result.routes[0]?.id || null);
    } catch (error) {
      if (requestId !== routeRequestIdRef.current) return;
      setRoutes([]);
      setSelectedRouteId(null);
      setMessage(`Routing unavailable: ${error.message}`);
      if (onRoutesChange) {
        onRoutesChange({ routes: [], selectedRouteId: null, hazards: [], origin, destination, assessments: [] });
      }
    } finally {
      setLoading(false);
    }
  };

  const selectRoute = (id) => {
    setSelectedRouteId(id);
    syncRoutePlan(evaluatedRoutes, id);
  };

  const swapLocations = () => {
    clearRoutesForInputChange();
    const tempOrigin = origin;
    setOrigin(destination);
    setDestination(tempOrigin);
  };

  if (!isOpen) return null;

  return (
    <section className="route-planner-panel" aria-label="Alternative route planner">
      {/* 1. Header with Title & Explicit 'X' Close Button */}
      <header className="route-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="route-panel-icon"><Route size={16} /></div>
          <div>
            <strong>Alternative Route Planner</strong>
            <span>Corridor Flood Bypass · Waterlogging Aware</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExitRoutePlanner}
          className="gmaps-icon-btn route-header-close-btn"
          title="Exit Route Planner"
          aria-label="Exit Route Planner"
        >
          <X size={15} />
        </button>
      </header>

      {/* 2. Origin & Destination Input Form */}
      <form className="route-planner-form" onSubmit={handlePlan}>
        <LocationField
          label="START (ORIGIN)"
          value={origin}
          onChange={label => {
            clearRoutesForInputChange();
            setOrigin(current => ({ ...current, label, coords: null }));
          }}
          onSelect={location => {
            clearRoutesForInputChange();
            setOrigin(location);
          }}
          placeholder="Choose origin in Bengaluru…"
          locationiqToken={locationiqToken}
        />

        <button
          type="button"
          className="route-swap-button"
          onClick={swapLocations}
          title="Swap start and destination"
        >
          <ArrowUp size={12} />
          <ArrowDown size={12} />
        </button>

        <LocationField
          label="DESTINATION"
          value={destination}
          onChange={label => {
            clearRoutesForInputChange();
            setDestination(current => ({ ...current, label, coords: null }));
          }}
          onSelect={location => {
            clearRoutesForInputChange();
            setDestination(location);
          }}
          placeholder="Choose destination in Bengaluru…"
          locationiqToken={locationiqToken}
        />

        <button className="route-plan-button" disabled={loading} type="submit">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          {loading ? 'Evaluating Safe Corridors…' : 'Find Safe Routes'}
        </button>
      </form>

      {message && <div className="route-panel-message">{message}</div>}

      {/* 3. Corridor Flood Simulation & Stress Test Card */}
      <div className="route-sim-controls-card">
        <div className="route-sim-controls-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={13} className="text-cyan-400" />
            <span className="route-sim-title">CORRIDOR SIMULATION & STRESS TEST</span>
          </div>
          <span className={`route-sim-badge ${corridorDataSource === 'preset' ? 'is-preset' : 'is-realworld'}`}>
            {corridorDataSource === 'preset' ? '⚡ Demo Presets' : '📡 Real-World Data'}
          </span>
        </div>

        {/* Mode Toggle: Real-World Data vs Demo Presets */}
        <div className="route-sim-mode-toggle">
          <button
            type="button"
            className={`route-mode-btn ${corridorDataSource === 'realworld' ? 'active' : ''}`}
            onClick={() => handleToggleDataSource('realworld')}
          >
            📡 Real-World Data
          </button>
          <button
            type="button"
            className={`route-mode-btn ${corridorDataSource === 'preset' ? 'active' : ''}`}
            onClick={() => handleToggleDataSource('preset')}
          >
            ⚡ Demo Presets
          </button>
        </div>

        {/* Demo Presets Quick Pills */}
        <div className="route-presets-grid">
          {ROUTE_SIMULATION_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              className={`route-preset-pill ${activePresetId === preset.id && corridorDataSource === 'preset' ? 'active' : ''}`}
              onClick={() => handleApplyPreset(preset)}
              title={preset.description}
            >
              <span>{preset.icon}</span>
              <strong>{preset.label}</strong>
              <small>{preset.rainfallMm}mm • {preset.cloggingPercent}%</small>
            </button>
          ))}
        </div>

        {/* Interactive Sliders for Rainfall & Clogging */}
        <div className="route-sliders-group">
          {/* Rainfall Intensity Slider */}
          <div className="route-slider-row">
            <div className="route-slider-label">
              <span><CloudRain size={12} /> Rainfall Intensity</span>
              <strong>{rainfallMm} mm/hr</strong>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="5"
              value={rainfallMm}
              onChange={e => {
                setRainfallMm(Number(e.target.value));
                setCorridorDataSource('preset');
                setActivePresetId(null);
              }}
              className="route-range-slider"
            />
            <div className="route-slider-quick-buttons">
              <button
                type="button"
                className={`route-quick-btn ${rainfallMm === 25 ? 'selected' : ''}`}
                onClick={() => { setRainfallMm(25); setCorridorDataSource('preset'); }}
              >
                Low (25)
              </button>
              <button
                type="button"
                className={`route-quick-btn ${rainfallMm === 65 ? 'selected' : ''}`}
                onClick={() => { setRainfallMm(65); setCorridorDataSource('preset'); }}
              >
                Moderate (65)
              </button>
              <button
                type="button"
                className={`route-quick-btn ${rainfallMm === 135 ? 'selected' : ''}`}
                onClick={() => { setRainfallMm(135); setCorridorDataSource('preset'); }}
              >
                Extreme (135)
              </button>
            </div>
          </div>

          {/* Drainage Clogging Factor Slider */}
          <div className="route-slider-row">
            <div className="route-slider-label">
              <span><Sliders size={12} /> Drain Clogging Factor</span>
              <strong>{cloggingPercent}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={cloggingPercent}
              onChange={e => {
                setCloggingPercent(Number(e.target.value));
                setCorridorDataSource('preset');
                setActivePresetId(null);
              }}
              className="route-range-slider"
            />
          </div>
        </div>
      </div>

      {/* 4. Proactive Rerouting Suggestion Banner */}
      {proactiveSuggestion && (isPrimaryBlocked || isActiveBlocked) && (
        <div className="route-proactive-banner">
          <div className="route-proactive-header">
            <AlertTriangle size={15} className="route-proactive-icon" />
            <div className="route-proactive-text">
              <strong>Corridor Blockage Detected</strong>
              <p>{proactiveSuggestion}</p>
            </div>
          </div>
          {safeBypassCandidate && safeBypassCandidate.id !== selectedRouteId && (
            <button
              type="button"
              className="route-apply-safe-btn"
              onClick={handleSwitchToSafeRoute}
            >
              <ShieldCheck size={13} />
              Switch to Safe Bypass ({safeBypassCandidate.name})
            </button>
          )}
        </div>
      )}

      {/* 5. Evaluated Routes List */}
      {evaluatedRoutes.length > 0 && (
        <div className="route-results">
          <div className="route-data-label">
            <span>NAVIGABLE ALTERNATIVES</span>
            <span>
              {corridorDataSource === 'preset'
                ? `CORRIDOR STRESS TEST (${rainfallMm}mm/h · ${cloggingPercent}%)`
                : 'REAL-WORLD TELEMETRY'}
            </span>
          </div>

          {rerouteNotice && (
            <div className="route-recommendation route-recommendation-warning">
              <AlertTriangle size={15} />
              <span>{rerouteNotice}</span>
            </div>
          )}

          {safeBypassCandidate && !isPrimaryBlocked && (
            <div className="route-recommendation">
              <ShieldCheck size={15} />
              <span>
                Recommended: {safeBypassCandidate.name} has zero modeled flood blockages along its corridor.
              </span>
            </div>
          )}

          {evaluatedRoutes.map((route, index) => {
            const isSelected = selectedRouteId === route.id;
            const isSafe = route.id === safeBypassCandidate?.id && (isPrimaryBlocked || isActiveBlocked);
            const isBlocked = !!route.isBlocked;

            return (
              <button
                key={route.id}
                type="button"
                className={`route-option ${isSelected ? 'selected' : ''} ${isSafe ? 'is-safe-bypass' : ''} ${isBlocked ? 'is-blocked' : ''}`}
                onClick={() => selectRoute(route.id)}
              >
                <span
                  className="route-option-color"
                  style={{
                    background: isSafe
                      ? '#45d6c5'
                      : isBlocked
                      ? '#ea4335'
                      : ['#45d6c5', '#8ab4f8', '#fbbc04', '#c58af9'][index % 4]
                  }}
                />
                <span className="route-option-main">
                  <span className="route-option-title">
                    {route.name}
                    {isSafe && <em className="route-safe-badge">🛡️ SAFE BYPASS</em>}
                    {isBlocked && <em className="route-critical-badge">BLOCKED ({route.peakDepth.toFixed(1)}m)</em>}
                  </span>
                  <span className="route-option-meta">
                    <span><Route size={12} />{formatDistance(route.distance)}</span>
                    <span><Clock3 size={12} />{formatDuration(route.duration)}</span>
                  </span>
                  <span className={`route-option-hazards ${isBlocked ? 'has-hazards' : ''}`}>
                    {isBlocked && route.worstHazard
                      ? `Blocked at ${route.worstHazard.name} (${route.worstHazard.depth_meters.toFixed(1)}m water) • Impassable corridor`
                      : route.corridorHazardCount
                      ? `${route.corridorHazardCount} minor waterlogged zone(s) • Navigable with caution`
                      : 'Clear road corridor • Zero waterlogging detected'}
                  </span>
                </span>
                <span className="route-option-action">
                  {isSelected ? 'Selected' : 'Select'}
                </span>
              </button>
            );
          })}

          <p className="route-disclaimer">
            Route corridor evaluation monitors origin buffer (250m), polyline road buffer (120m), and destination buffer (250m) against urban hotspots & rajakaluve outfalls.
          </p>

          {/* 6. Explicit "Exit Route Planner" Button at Bottom of Panel */}
          <button
            type="button"
            className="route-exit-footer-button"
            onClick={handleExitRoutePlanner}
          >
            <X size={14} />
            Exit Route Planner
          </button>
        </div>
      )}
    </section>
  );
}
