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
      {/* 2. SECONDARY SUB-BAR (COLLAPSIBLE VERTICAL ACTION MENU) */}
      {showRibbon ? (
        <div
          className="gmaps-utility-ribbon"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '8px',
            background: 'rgba(18, 22, 30, 0.95)',
            backdropFilter: 'blur(16px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.55), 0 0 1px rgba(0, 240, 255, 0.2)',
            width: '100%',
            maxWidth: '320px',
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

          {/* Action 4: Demo Simulation Presets */}
          <button
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

          {/* Action 5: Report / Audit Button */}
          <button
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
