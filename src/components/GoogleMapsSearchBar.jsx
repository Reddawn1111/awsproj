import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Navigation,
  X,
  Loader2,
  ArrowRight,
  Play,
  RotateCcw,
  Building2,
  Droplets,
  Zap,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Sliders,
  Layers,
  Pause,
  Compass,
  AlertTriangle,
  Route,
  CloudRain
} from 'lucide-react';
import { searchLocationIQ } from '../services/locationiq';
import { BENGALURU_HOTSPOTS } from '../config/bengaluruHotspots';
import { KARNATAKA_DRAINS } from '../config/karnatakaDrains';

// Major Bengaluru localities & BBMP zones for instantaneous local query matching
const BENGALURU_LOCALITIES = [
  { name: 'Indiranagar', zone: 'East', coords: [77.6412, 12.9784] },
  { name: 'Whitefield', zone: 'Mahadevapura', coords: [77.7499, 12.9698] },
  { name: 'Jayanagar', zone: 'South', coords: [77.5833, 12.9308] },
  { name: 'Malleshwaram', zone: 'West', coords: [77.5714, 13.0031] },
  { name: 'Electronic City', zone: 'Bommanahalli', coords: [77.6749, 12.8452] },
  { name: 'Sarjapur Road', zone: 'Mahadevapura', coords: [77.6784, 12.9121] },
  { name: 'Manyata Tech Park', zone: 'North', coords: [77.6195, 13.0482] },
  { name: 'Banashankari', zone: 'South', coords: [77.5726, 12.9255] },
  { name: 'Basavanagudi', zone: 'South', coords: [77.5738, 12.9432] },
  { name: 'Rajajinagar', zone: 'West', coords: [77.5559, 12.9982] },
  { name: 'BTM Layout', zone: 'South', coords: [77.6101, 12.9166] },
  { name: 'Richmond Town', zone: 'East', coords: [77.6033, 12.9667] },
  { name: 'Domlur', zone: 'East', coords: [77.6389, 12.9609] },
  { name: 'Kalyan Nagar', zone: 'East', coords: [77.6433, 13.0280] },
  { name: 'Kengeri Satellite Town', zone: 'RR Nagar', coords: [77.4833, 12.9167] }
];

function searchLocalBengaluruDatasets(q) {
  if (!q || q.trim().length < 2) return [];
  const queryLower = q.toLowerCase().trim();
  const matched = [];

  // 1. Search Flood Hotspots
  for (const h of BENGALURU_HOTSPOTS) {
    if (
      h.name.toLowerCase().includes(queryLower) ||
      h.zone.toLowerCase().includes(queryLower) ||
      h.id.toLowerCase().includes(queryLower)
    ) {
      matched.push({
        place_id: `hotspot_${h.id}`,
        display_name: `${h.name}, ${h.zone} Zone, Bengaluru`,
        main_text: h.name,
        secondary_text: `${h.zone} Zone • Baseline Clogging: ${(h.baseline_clogging * 100).toFixed(0)}%`,
        lat: h.coords[1].toString(),
        lon: h.coords[0].toString(),
        category: 'HOTSPOT'
      });
      if (matched.length >= 6) break;
    }
  }

  // 2. Search Karnataka & Bengaluru Drains / Rajakaluves
  for (const d of KARNATAKA_DRAINS) {
    if (
      d.name.toLowerCase().includes(queryLower) ||
      (d.shortName && d.shortName.toLowerCase().includes(queryLower)) ||
      (d.valley && d.valley.toLowerCase().includes(queryLower)) ||
      (d.district && d.district.toLowerCase().includes(queryLower)) ||
      (d.taluk && d.taluk.toLowerCase().includes(queryLower))
    ) {
      const label = d.shortName || d.name;
      matched.push({
        place_id: `drain_${d.id}`,
        display_name: `${label}, ${d.district || 'Bengaluru'}`,
        main_text: label,
        secondary_text: `${d.valley || 'Drainage Trunk'} • Status: ${d.defaultStatus || 'Active'} • Deficit: ${d.deficitPercent || 0}%`,
        lat: d.coordinates[1].toString(),
        lon: d.coordinates[0].toString(),
        category: 'DRAIN'
      });
      if (matched.length >= 12) break;
    }
  }

  // 3. Search Key Localities
  for (const loc of BENGALURU_LOCALITIES) {
    if (
      loc.name.toLowerCase().includes(queryLower) ||
      loc.zone.toLowerCase().includes(queryLower)
    ) {
      matched.push({
        place_id: `loc_${loc.name.toLowerCase().replace(/\s+/g, '_')}`,
        display_name: `${loc.name}, ${loc.zone}, Bengaluru`,
        main_text: loc.name,
        secondary_text: `${loc.zone} Zone, Bengaluru Urban`,
        lat: loc.coords[1].toString(),
        lon: loc.coords[0].toString(),
        category: 'WARD'
      });
      if (matched.length >= 15) break;
    }
  }

  return matched;
}

export function GoogleMapsSearchBar({
  onSelectLocation,
  onLocateMe,
  isSimulateMode,
  onToggleSimulate,
  isCollapsed = false,
  onExpand,
  locationiqToken,
  // Secondary Ribbon Actions
  rainfallMm = 120,
  onOpenRWH,
  onToggleOrbit,
  isOrbiting = false,
  show3DBuildings = true,
  onToggle3DBuildings,
  isTopView = false,
  onTogglePerspective,
  onOpenDemo,
  onOpenReport,
  onToggleRoutePlanner,
  isRoutePlannerOpen = false,
  onToggleEnvIntel,
  isEnvIntelOpen = false
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isToolsOpen, setIsToolsOpen] = useState(true); // Starts expanded/open on initial app load

  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    // Direct coordinate check (lat, lng)
    const coordMatch = val.match(/^([+-]?\d+(\.\d+)?)[,\s]+([+-]?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setResults([{
          place_id: 'coord',
          display_name: `Coordinates: ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`,
          main_text: `${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`,
          secondary_text: 'Geographic Coordinates Pinpoint',
          lat: lat.toString(),
          lon: lng.toString(),
          category: 'COORDINATES'
        }]);
        setIsOpen(true);
        return;
      }
    }

    // Instantaneous local dataset matching (Bengaluru hotspots, rajakaluves, wards)
    const localMatches = searchLocalBengaluruDatasets(val);
    if (localMatches.length > 0) {
      setResults(localMatches);
      setIsOpen(true);
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await searchLocationIQ(val, locationiqToken);
        const formattedRemote = (items || []).map(item => ({
          ...item,
          main_text: item.display_name.split(',')[0],
          secondary_text: item.display_name.split(',').slice(1, 3).join(', '),
          category: 'PLACE'
        }));

        setResults(prev => {
          const existingIds = new Set(localMatches.map(m => m.place_id));
          const uniqueRemote = formattedRemote.filter(item => !existingIds.has(item.place_id));
          const combined = [...localMatches, ...uniqueRemote];
          return combined.length > 0 ? combined : formattedRemote;
        });
        setIsOpen(true);
      } catch (err) {
        if (localMatches.length > 0) {
          setResults(localMatches);
          setIsOpen(true);
        }
      } finally {
        setIsLoading(false);
      }
    }, 280);
  };

  // Keyboard navigation for autocomplete recommendations (arrow keys + Enter + Escape)
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => {
        if (results.length === 0) return -1;
        return prev < results.length - 1 ? prev + 1 : 0;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => {
        if (results.length === 0) return -1;
        return prev > 0 ? prev - 1 : results.length - 1;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelectResult(results[highlightedIndex]);
      } else if (results.length > 0) {
        handleSelectResult(results[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleSelectResult = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      const label = item.main_text || item.display_name.split(',')[0];
      onSelectLocation([lng, lat], label);
      setQuery(label);
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const isRWHAvailable = rainfallMm <= 50;

  return (
    <div
      ref={containerRef}
      className="gmaps-control-stack"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        position: 'relative'
      }}
    >
      {/* 1. TOP BAR ROW: 3 DISTINCT, SEPARATED GLASSMORPHIC ELEMENTS */}
      <div
        className="gmaps-top-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          position: 'relative',
          zIndex: 40
        }}
      >
        {/* 1A. STANDALONE SEARCH INPUT BAR */}
        <div
          className="gmaps-search-card"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            height: '44px',
            padding: '0 10px',
            background: 'rgba(20, 24, 32, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 240, 255, 0.05)',
            position: 'relative',
            transition: 'border-color 0.18s ease, box-shadow 0.18s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', paddingRight: '8px', color: '#8ab4f8' }}>
            <Search size={17} />
          </div>

          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0 || query.trim().length >= 2) {
                if (results.length === 0 && query.trim().length >= 2) {
                  const local = searchLocalBengaluruDatasets(query);
                  if (local.length > 0) setResults(local);
                }
                setIsOpen(true);
              }
            }}
            placeholder="Search Bengaluru places, wards, drains..."
            className="gmaps-search-input"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: '13px',
              fontWeight: 500,
              outline: 'none',
              minWidth: 0
            }}
          />

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="gmaps-icon-btn"
              title="Clear Search"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'color 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
            >
              <X size={15} />
            </button>
          )}

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '4px' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: '#8ab4f8' }} />
            </div>
          )}

          {/* Autocomplete Results Dropdown right beneath the search input bar */}
          {isOpen && results.length > 0 && (
            <div
              className="gmaps-autocomplete-dropdown"
              style={{
                position: 'absolute',
                top: '50px',
                left: 0,
                right: 0,
                background: 'rgba(20, 24, 32, 0.98)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75), 0 0 1px rgba(0, 240, 255, 0.25)',
                maxHeight: '320px',
                overflowY: 'auto',
                zIndex: 60
              }}
            >
              {results.map((item, idx) => {
                const mainText = item.main_text || item.display_name.split(',')[0];
                const secondaryText = item.secondary_text || item.display_name.split(',').slice(1, 3).join(', ');
                const category = item.category || 'PLACE';
                const isHighlighted = idx === highlightedIndex;

                const badgeColor =
                  category === 'DRAIN' ? '#00f0ff' :
                  category === 'HOTSPOT' ? '#f59e0b' :
                  category === 'WARD' ? '#10b981' : '#8ab4f8';
                const badgeBg =
                  category === 'DRAIN' ? 'rgba(0, 240, 255, 0.12)' :
                  category === 'HOTSPOT' ? 'rgba(245, 158, 11, 0.14)' :
                  category === 'WARD' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(138, 180, 248, 0.12)';

                return (
                  <div
                    key={item.place_id || idx}
                    onClick={() => handleSelectResult(item)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className="gmaps-dropdown-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: isHighlighted ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {category === 'DRAIN' ? (
                      <Droplets size={16} style={{ color: '#00f0ff', flexShrink: 0 }} />
                    ) : category === 'HOTSPOT' ? (
                      <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    ) : (
                      <MapPin size={16} style={{ color: '#8ab4f8', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#e8eaed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {mainText}
                        </span>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          color: badgeColor,
                          background: badgeBg,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          letterSpacing: '0.04em'
                        }}>
                          {category}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#9aa0a6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                        {secondaryText}
                      </div>
                    </div>
                    <ArrowRight size={13} style={{ color: isHighlighted ? '#00f0ff' : '#5f6368', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 1B. STANDALONE LOCATE ME BUTTON */}
        <button
          type="button"
          onClick={onLocateMe}
          className="gmaps-locate-btn"
          title="Locate my position (GPS)"
          style={{
            height: '44px',
            width: '44px',
            minWidth: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(20, 24, 32, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#8ab4f8',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(138, 180, 248, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(138, 180, 248, 0.4)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(20, 24, 32, 0.94)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#8ab4f8';
          }}
        >
          <Navigation size={17} />
        </button>

        {/* 1C. STANDALONE SIMULATE ACTION PILL */}
        <button
          type="button"
          onClick={onToggleSimulate}
          title={isSimulateMode ? "Exit Simulation Mode" : "Extract 1 km² block and simulate flood runoff"}
          style={{
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 16px',
            borderRadius: '12px',
            background: isSimulateMode
              ? 'linear-gradient(135deg, #00f0ff 0%, #0077b6 100%)'
              : 'rgba(20, 24, 32, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${isSimulateMode ? '#00f0ff' : 'rgba(0, 240, 255, 0.35)'}`,
            color: isSimulateMode ? '#05080c' : '#00f0ff',
            fontWeight: 800,
            fontSize: '11.5px',
            letterSpacing: '0.04em',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: isSimulateMode
              ? '0 0 20px rgba(0, 240, 255, 0.5), 0 8px 32px rgba(0, 0, 0, 0.5)'
              : '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 240, 255, 0.08)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!isSimulateMode) {
              e.currentTarget.style.background = 'rgba(0, 240, 255, 0.14)';
              e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.6)';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(0, 240, 255, 0.35), 0 8px 32px rgba(0, 0, 0, 0.6)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSimulateMode) {
              e.currentTarget.style.background = 'rgba(20, 24, 32, 0.94)';
              e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.35)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 240, 255, 0.08)';
            }
          }}
        >
          <Play size={13} fill={isSimulateMode ? '#05080c' : '#00f0ff'} />
          <span>{isSimulateMode ? 'SIMULATING' : 'SIMULATE'}</span>
        </button>
      </div>

      {/* 2. "TOOLS & OVERRIDES" DROPDOWN (STARTS EXPANDED ON MOUNT, USER-CONTROLLED TOGGLE ONLY) */}
      <div
        className="gmaps-tools-dropdown-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          width: '100%',
          maxWidth: '320px'
        }}
      >
        <button
          type="button"
          onClick={() => setIsToolsOpen(prev => !prev)}
          title={isToolsOpen ? "Click to collapse Tools & Overrides" : "Click to expand Tools & Overrides"}
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            background: isToolsOpen ? 'rgba(20, 24, 32, 0.94)' : 'rgba(20, 24, 32, 0.88)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '20px',
            border: isToolsOpen ? '1px solid rgba(0, 240, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.12)',
            color: isToolsOpen ? '#00f0ff' : '#cbd5e1',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.5)';
            e.currentTarget.style.color = '#00f0ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = isToolsOpen ? 'rgba(0, 240, 255, 0.35)' : 'rgba(255, 255, 255, 0.12)';
            e.currentTarget.style.color = isToolsOpen ? '#00f0ff' : '#cbd5e1';
          }}
        >
          <Sliders size={13} style={{ color: isToolsOpen ? '#00f0ff' : '#8ab4f8' }} />
          <span>Tools & Overrides</span>
          {isToolsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {isToolsOpen && (
          <div
            className="gmaps-utility-ribbon"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '8px',
              background: 'rgba(18, 22, 30, 0.95)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.55), 0 0 1px rgba(0, 240, 255, 0.2)',
              width: '100%',
              animation: 'fadeInSlideDown 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px 4px 6px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Digital Twin Quick Actions
              </span>
              <span style={{ fontSize: '9.5px', color: '#64748b' }}>Primary Controls</span>
            </div>

            {/* Action 1: Rainwater Harvesting Potential */}
            <button
              type="button"
              onClick={isRWHAvailable ? onOpenRWH : null}
              disabled={!isRWHAvailable}
              title={isRWHAvailable ? "Calculate Rainwater Harvesting rooftop potential" : "RWH calculations paused: Diverting surface surge to emergency flood bypass."}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: `1px solid ${isRWHAvailable ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                background: isRWHAvailable ? 'rgba(0, 240, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                color: isRWHAvailable ? '#38bdf8' : '#64748b',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: isRWHAvailable ? 'pointer' : 'not-allowed',
                opacity: isRWHAvailable ? 1 : 0.6,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (isRWHAvailable) {
                  e.currentTarget.style.background = 'rgba(0, 240, 255, 0.12)';
                  e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (isRWHAvailable) {
                  e.currentTarget.style.background = 'rgba(0, 240, 255, 0.06)';
                  e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.2)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Droplets size={14} style={{ color: isRWHAvailable ? '#38bdf8' : '#64748b' }} />
                <span>RWH Potential</span>
              </div>
              <span style={{ fontSize: '9.5px', color: isRWHAvailable ? '#38bdf8' : '#ef4444', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 0, 0, 0.25)' }}>
                {isRWHAvailable ? 'Rooftop Model' : '>50mm Paused'}
              </span>
            </button>

            {/* Action 2: 360° Panoramic Look-Around / Street View */}
            <button
              type="button"
              onClick={onToggleOrbit}
              title={isOrbiting ? "Exit 360° Street View" : "Enter 360° panoramic first-person street view (pitch & yaw look-around)"}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: `1px solid ${isOrbiting ? '#00f0ff' : 'rgba(255, 255, 255, 0.08)'}`,
                background: isOrbiting ? 'rgba(0, 240, 255, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                color: isOrbiting ? '#00f0ff' : '#cbd5e1',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: isOrbiting ? '0 0 12px rgba(0, 240, 255, 0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isOrbiting ? 'rgba(0, 240, 255, 0.24)' : 'rgba(255, 255, 255, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isOrbiting ? 'rgba(0, 240, 255, 0.18)' : 'rgba(255, 255, 255, 0.03)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={14} style={{ transform: isOrbiting ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: isOrbiting ? '#00f0ff' : '#cbd5e1' }} />
                <span>360° View</span>
              </div>
              <span style={{ fontSize: '9.5px', color: isOrbiting ? '#00f0ff' : '#94a3b8', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 0, 0, 0.25)' }}>
                {isOrbiting ? 'Active Orbit' : 'Pitch & Yaw'}
              </span>
            </button>

            {/* Action 3: 3D Buildings Mesh */}
            <button
              type="button"
              onClick={onToggle3DBuildings}
              title="Toggle extruded 3D buildings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: `1px solid ${show3DBuildings ? 'rgba(138, 180, 248, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                background: show3DBuildings ? 'rgba(138, 180, 248, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                color: show3DBuildings ? '#8ab4f8' : '#94a3b8',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = show3DBuildings ? 'rgba(138, 180, 248, 0.18)' : 'rgba(255, 255, 255, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = show3DBuildings ? 'rgba(138, 180, 248, 0.1)' : 'rgba(255, 255, 255, 0.03)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={14} style={{ color: show3DBuildings ? '#8ab4f8' : '#94a3b8' }} />
                <span>3D Buildings</span>
              </div>
              <span style={{ fontSize: '9.5px', color: show3DBuildings ? '#8ab4f8' : '#64748b', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 0, 0, 0.25)' }}>
                {show3DBuildings ? 'Extruded' : 'Off'}
              </span>
            </button>

            {/* Action 4: Top View / Angled View Perspective Toggle */}
            <button
              type="button"
              onClick={onTogglePerspective}
              title={isTopView ? "Switch to 3D Angled Perspective View (pitch: 58°)" : "Switch to 2D Overhead Top-Down View (pitch: 0°)"}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: `1px solid ${isTopView ? 'rgba(0, 240, 255, 0.35)' : 'rgba(168, 85, 247, 0.3)'}`,
                background: isTopView ? 'rgba(0, 240, 255, 0.12)' : 'rgba(168, 85, 247, 0.08)',
                color: isTopView ? '#00f0ff' : '#c084fc',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isTopView ? 'rgba(0, 240, 255, 0.2)' : 'rgba(168, 85, 247, 0.16)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isTopView ? 'rgba(0, 240, 255, 0.12)' : 'rgba(168, 85, 247, 0.08)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isTopView ? (
                  <Compass size={14} style={{ color: '#00f0ff' }} />
                ) : (
                  <Layers size={14} style={{ color: '#c084fc' }} />
                )}
                <span>{isTopView ? '🗺️ Top View' : '📐 Angled View'}</span>
              </div>
              <span style={{
                fontSize: '9.5px',
                color: isTopView ? '#00f0ff' : '#c084fc',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(0, 0, 0, 0.25)'
              }}>
                {isTopView ? '2D Overhead' : '3D Tilt'}
              </span>
            </button>

            {/* Action 5: Demo Simulation Presets */}
            <button
              type="button"
              onClick={onOpenDemo}
              title="Open simplified Monsoon Peak Scenario demo modal"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 172, 51, 0.3)',
                background: 'rgba(255, 172, 51, 0.08)',
                color: '#ffac33',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 172, 51, 0.16)';
                e.currentTarget.style.borderColor = 'rgba(255, 172, 51, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 172, 51, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 172, 51, 0.3)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={14} style={{ color: '#ffac33' }} />
                <span>Demo Presets</span>
              </div>
              <span style={{ fontSize: '9.5px', color: '#ffac33', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 0, 0, 0.25)' }}>
                Monsoon Scenarios
              </span>
            </button>

            {/* Action 6: Report / Audit Button */}
            <button
              type="button"
              onClick={onOpenReport}
              title="Citizen & Municipal drainage status override"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                background: 'rgba(239, 68, 68, 0.06)',
                color: '#f87171',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={14} style={{ color: '#f87171' }} />
                <span>Citizen Report</span>
              </div>
              <span style={{ fontSize: '9.5px', color: '#f87171', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 0, 0, 0.25)' }}>
                Drain Audit
              </span>
            </button>

            {/* Action 7: Alternative Route Planner (Flood Bypass Corridor) */}
            <button
              type="button"
              onClick={onToggleRoutePlanner}
              title="Open Alternative Route Planner with corridor flood hazard detection & bypass routing"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: `1px solid ${isRoutePlannerOpen ? '#45d6c5' : 'rgba(69, 214, 197, 0.25)'}`,
                background: isRoutePlannerOpen ? 'rgba(69, 214, 197, 0.18)' : 'rgba(69, 214, 197, 0.06)',
                color: isRoutePlannerOpen ? '#45d6c5' : '#9cf0dd',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: isRoutePlannerOpen ? '0 0 12px rgba(69, 214, 197, 0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isRoutePlannerOpen ? 'rgba(69, 214, 197, 0.24)' : 'rgba(69, 214, 197, 0.14)';
                e.currentTarget.style.borderColor = 'rgba(69, 214, 197, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isRoutePlannerOpen ? 'rgba(69, 214, 197, 0.18)' : 'rgba(69, 214, 197, 0.06)';
                e.currentTarget.style.borderColor = isRoutePlannerOpen ? '#45d6c5' : 'rgba(69, 214, 197, 0.25)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Route size={14} style={{ color: isRoutePlannerOpen ? '#45d6c5' : '#34d399' }} />
                <span>Route Planner</span>
              </div>
              <span style={{
                fontSize: '9.5px',
                color: isRoutePlannerOpen ? '#45d6c5' : '#34d399',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(0, 0, 0, 0.25)'
              }}>
                {isRoutePlannerOpen ? 'Active' : 'Flood Bypass'}
              </span>
            </button>

            {/* Action 8: Environmental Intelligence & Satellite WMS */}
            <button
              type="button"
              onClick={onToggleEnvIntel}
              title="Open Environmental Intelligence panel with real-time weather & ISRO Bhuvan satellite WMS layers"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: `1px solid ${isEnvIntelOpen ? '#38bdf8' : 'rgba(56, 189, 248, 0.25)'}`,
                background: isEnvIntelOpen ? 'rgba(56, 189, 248, 0.18)' : 'rgba(56, 189, 248, 0.06)',
                color: isEnvIntelOpen ? '#38bdf8' : '#bae6fd',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: isEnvIntelOpen ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isEnvIntelOpen ? 'rgba(56, 189, 248, 0.24)' : 'rgba(56, 189, 248, 0.14)';
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isEnvIntelOpen ? 'rgba(56, 189, 248, 0.18)' : 'rgba(56, 189, 248, 0.06)';
                e.currentTarget.style.borderColor = isEnvIntelOpen ? '#38bdf8' : 'rgba(56, 189, 248, 0.25)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CloudRain size={14} style={{ color: isEnvIntelOpen ? '#38bdf8' : '#60a5fa' }} />
                <span>Environmental Intel</span>
              </div>
              <span style={{
                fontSize: '9.5px',
                color: isEnvIntelOpen ? '#38bdf8' : '#60a5fa',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(0, 0, 0, 0.25)'
              }}>
                {isEnvIntelOpen ? 'Active' : 'WMS & Weather'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
