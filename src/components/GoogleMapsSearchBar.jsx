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
  Compass
} from 'lucide-react';
import { searchLocationIQ } from '../services/locationiq';

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
  onOpenDemo,
  onOpenReport
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isRibbonExpanded, setIsRibbonExpanded] = useState(true);
  const [ribbonHovered, setRibbonHovered] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Direct coordinate check
    const coordMatch = val.match(/^([+-]?\d+(\.\d+)?)[,\s]+([+-]?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setResults([{
          place_id: 'coord',
          display_name: `Coordinates: ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`,
          lat: lat.toString(),
          lon: lng.toString()
        }]);
        setIsOpen(true);
        return;
      }
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await searchLocationIQ(val, locationiqToken);
        setResults(items);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 280);
  };

  const handleSelectResult = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      onSelectLocation([lng, lat], item.display_name.split(',')[0]);
      setQuery(item.display_name.split(',')[0]);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const isRWHAvailable = rainfallMm <= 50;

  // When map moves, auto-collapse behavior
  const showRibbon = !isCollapsed || ribbonHovered;

  return (
    <div
      ref={containerRef}
      className="gmaps-control-stack"
      onMouseEnter={() => setRibbonHovered(true)}
      onMouseLeave={() => setRibbonHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%',
        maxWidth: '460px',
        position: 'relative'
      }}
    >
      {/* 1. PRIMARY SEARCH BAR (TOP BAR) */}
      <div className="gmaps-search-card" style={{
        background: 'rgba(24, 26, 32, 0.94)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 240, 255, 0.08)',
        position: 'relative',
        zIndex: 40
      }}>
        <div className="gmaps-search-input-wrapper" style={{
          display: 'flex',
          alignItems: 'center',
          height: '46px',
          padding: '0 8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '8px', paddingRight: '6px', color: '#8ab4f8' }}>
            <Search size={18} />
          </div>

          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              setIsOpen(true);
              if (onExpand) onExpand();
            }}
            placeholder="Search Bengaluru places, wards, drains..."
            className="gmaps-search-input"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: '13.5px',
              fontWeight: 500,
              outline: 'none',
              minWidth: 0
            }}
          />

          {query && (
            <button onClick={handleClear} className="gmaps-icon-btn" title="Clear">
              <X size={15} />
            </button>
          )}

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', paddingRight: '4px' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: '#8ab4f8' }} />
            </div>
          )}

          <div style={{ width: '1px', height: '22px', background: 'rgba(255, 255, 255, 0.12)', margin: '0 6px' }} />

          {/* "Locate Me" GPS Button */}
          <button
            onClick={onLocateMe}
            className="gmaps-icon-btn"
            title="Locate my position (GPS)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8ab4f8',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
          >
            <Navigation size={17} />
          </button>

          {/* "Simulate" CTA Button with Primary Brand Accent */}
          <button
            onClick={onToggleSimulate}
            title={isSimulateMode ? "Exit Simulation Mode" : "Extract 1 km² block and simulate flood runoff"}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: isSimulateMode
                ? 'linear-gradient(135deg, #00f0ff 0%, #0077b6 100%)'
                : 'rgba(0, 240, 255, 0.12)',
              border: `1px solid ${isSimulateMode ? '#00f0ff' : 'rgba(0, 240, 255, 0.35)'}`,
              color: isSimulateMode ? '#05080c' : '#00f0ff',
              fontWeight: 800,
              fontSize: '11.5px',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              marginLeft: '4px',
              boxShadow: isSimulateMode ? '0 0 16px rgba(0, 240, 255, 0.45)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Play size={13} fill={isSimulateMode ? '#05080c' : '#00f0ff'} />
            <span>{isSimulateMode ? 'SIMULATING' : 'SIMULATE'}</span>
          </button>
        </div>

        {/* Autocomplete Results Dropdown */}
        {isOpen && results.length > 0 && (
          <div className="gmaps-autocomplete-dropdown" style={{
            position: 'absolute',
            top: '52px',
            left: 0,
            right: 0,
            background: 'rgba(24, 26, 32, 0.98)',
            backdropFilter: 'blur(16px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 60
          }}>
            {results.map((item, idx) => {
              const mainText = item.display_name.split(',')[0];
              const secondaryText = item.display_name.split(',').slice(1, 3).join(', ');

              return (
                <div
                  key={item.place_id || idx}
                  onClick={() => handleSelectResult(item)}
                  className="gmaps-dropdown-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
                  }}
                >
                  <MapPin size={16} style={{ color: '#8ab4f8', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8eaed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {mainText}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9aa0a6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {secondaryText}
                    </div>
                  </div>
                  <ArrowRight size={13} style={{ color: '#5f6368', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. SECONDARY SUB-BAR (COLLAPSIBLE UTILITY RIBBON) */}
      {showRibbon ? (
        <div
          className="gmaps-utility-ribbon"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 8px',
            background: 'rgba(20, 23, 30, 0.92)',
            backdropFilter: 'blur(10px)',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            overflowX: 'auto',
            animation: 'fadeInSlideDown 0.2s ease-out'
          }}
        >
          {/* Button 1: Rainwater Harvest */}
          <button
            onClick={isRWHAvailable ? onOpenRWH : null}
            disabled={!isRWHAvailable}
            title={isRWHAvailable ? "Calculate Rainwater Harvesting rooftop potential" : "RWH calculations paused: Diverting surface surge to emergency flood bypass."}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '7px',
              border: `1px solid ${isRWHAvailable ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)'}`,
              background: isRWHAvailable ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              color: isRWHAvailable ? '#38bdf8' : '#64748b',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isRWHAvailable ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
              opacity: isRWHAvailable ? 1 : 0.6,
              transition: 'all 0.15s ease'
            }}
          >
            <Droplets size={13} style={{ color: isRWHAvailable ? '#38bdf8' : '#64748b' }} />
            <span>RWH Potential</span>
            {!isRWHAvailable && <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 800 }}>&gt;50mm</span>}
          </button>

          {/* Button 2: 360° Panoramic Look-Around / Street View */}
          <button
            onClick={onToggleOrbit}
            title={isOrbiting ? "Exit 360° Street View" : "Enter 360° panoramic first-person street view (pitch & yaw look-around)"}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '7px',
              border: `1px solid ${isOrbiting ? '#00f0ff' : 'rgba(255, 255, 255, 0.1)'}`,
              background: isOrbiting ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: isOrbiting ? '#00f0ff' : '#cbd5e1',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: isOrbiting ? '0 0 10px rgba(0, 240, 255, 0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCcw size={13} style={{ transform: isOrbiting ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            <span>{isOrbiting ? '360° Active' : '360° View'}</span>
          </button>

          {/* Button 3: 3D Buildings Toggle */}
          <button
            onClick={onToggle3DBuildings}
            title="Toggle extruded 3D buildings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '7px',
              border: `1px solid ${show3DBuildings ? 'rgba(138, 180, 248, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              background: show3DBuildings ? 'rgba(138, 180, 248, 0.1)' : 'rgba(255, 255, 255, 0.04)',
              color: show3DBuildings ? '#8ab4f8' : '#94a3b8',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            <Building2 size={13} />
            <span>3D Buildings</span>
          </button>

          {/* Button 4: Demo Preset Button */}
          <button
            onClick={onOpenDemo}
            title="Open simplified Monsoon Peak Scenario demo modal"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '7px',
              border: '1px solid rgba(255, 172, 51, 0.3)',
              background: 'rgba(255, 172, 51, 0.1)',
              color: '#ffac33',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            <Zap size={13} />
            <span>Demo Preset</span>
          </button>

          {/* Button 5: Report / Audit Button */}
          <button
            onClick={onOpenReport}
            title="Citizen & Municipal drainage status override"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '7px',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#f87171',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            <ShieldAlert size={13} />
            <span>Report / Audit</span>
          </button>
        </div>
      ) : (
        /* Collapsed Floating Pill Icon (when user pans/zooms map) */
        <div
          onClick={() => {
            if (onExpand) onExpand();
            setRibbonHovered(true);
          }}
          title="Click or hover to expand utility toolbar"
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            background: 'rgba(20, 23, 30, 0.92)',
            backdropFilter: 'blur(8px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#8ab4f8',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
          }}
        >
          <Sliders size={13} />
          <span>Tools & Overrides</span>
          <ChevronDown size={12} />
        </div>
      )}
    </div>
  );
}
