import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Navigation, X, Loader2, ArrowRight, Zap } from 'lucide-react';
import { searchLocationIQ, reverseLocationIQ } from '../services/locationiq';

export function GoogleMapsSearchBar({
  onSelectLocation,
  onLocateMe,
  isSimulateMode,
  isSimulateArmed,
  onToggleSimulate,
  isCollapsed = false,
  onExpand,
  locationiqToken
}) {
  const isSimActive = isSimulateMode || isSimulateArmed;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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

  // When map moves, auto-collapse into compact floating pill
  if (isCollapsed) {
    return (
      <div
        onClick={onExpand}
        className="gmaps-collapsed-pill"
        title="Search places across Bengaluru (Click to expand)"
      >
        <Search size={18} style={{ color: '#8ab4f8' }} />
        <span style={{ fontSize: '13px', color: '#e8eaed', fontWeight: 500 }}>
          {query || 'Search Bengaluru...'}
        </span>
        {isSimActive && (
          <span style={{
            fontSize: '10px',
            fontWeight: 800,
            background: 'rgba(0, 240, 255, 0.2)',
            color: '#00f0ff',
            padding: '2px 6px',
            borderRadius: '10px'
          }}>
            SIMULATE
          </span>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="gmaps-search-card">
      <div className="gmaps-search-input-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '14px', color: '#8ab4f8' }}>
          <Search size={18} />
        </div>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search Bengaluru places, wards, roads..."
          className="gmaps-search-input"
        />

        {query && (
          <button onClick={handleClear} className="gmaps-icon-btn" title="Clear">
            <X size={15} />
          </button>
        )}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', paddingRight: '6px' }}>
            <Loader2 size={16} className="animate-spin" style={{ color: '#8ab4f8' }} />
          </div>
        )}

        <div className="gmaps-divider" />

        {/* Current Location GPS Button */}
        <button
          onClick={onLocateMe}
          className="gmaps-icon-btn"
          title="Locate my position via LocationIQ"
        >
          <Navigation size={17} style={{ color: '#8ab4f8' }} />
        </button>

        {/* Dedicated SIMULATE Mode Toggle Button */}
        <button
          onClick={onToggleSimulate}
          className={`gmaps-simulate-pill-btn ${isSimActive ? 'active' : ''}`}
          title="Toggle 1km x 1km Simulation Extractor"
        >
          <Zap size={13} style={{ color: isSimActive ? '#00f0ff' : '#9aa0a6' }} />
          <span>{isSimActive ? 'SIMULATING' : 'SIMULATE'}</span>
        </button>
      </div>

      {/* Autocomplete Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="gmaps-autocomplete-dropdown">
          {results.map((item, idx) => {
            const mainText = item.display_name.split(',')[0];
            const secondaryText = item.display_name.split(',').slice(1, 3).join(', ');

            return (
              <div
                key={item.place_id || idx}
                onClick={() => handleSelectResult(item)}
                className="gmaps-dropdown-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', color: '#8ab4f8', paddingTop: '2px' }}>
                  <MapPin size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8eaed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {mainText}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9aa0a6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {secondaryText}
                  </div>
                </div>
                <ArrowRight size={13} style={{ color: '#5f6368' }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
