import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Navigation, X, Loader2, ArrowRight, Layers, Compass } from 'lucide-react';

const LOCATIONIQ_API_KEY = 'pk.b331338dcd3fee9865865d43152f9ed9';

// Bounding box for Greater Bengaluru & Tech Corridors
// Format: lon1,lat1,lon2,lat2 (minLon, minLat, maxLon, maxLat)
const BENGALURU_VIEWBOX = '77.40,12.78,77.85,13.15';

const QUICK_CORRIDORS = [
  { name: 'Bellandur Lake', coords: [77.6710, 12.9370], desc: 'Drainage Basin Foreshore' },
  { name: 'Ecospace ORR', coords: [77.6834, 12.9260], desc: 'Tech Corridor Bottleneck' },
  { name: 'Sakra Hospital', coords: [77.6896, 12.9279], desc: 'Level 1 Trauma Arterial' },
  { name: 'KPTCL Substation', coords: [77.6748, 12.9322], desc: 'Critical Power Grid 882m' },
  { name: 'HSR Layout', coords: [77.6380, 12.9116], desc: 'Upper Ridge Catchment' },
  { name: 'Sarjapur Rd', coords: [77.6850, 12.9150], desc: 'Major Basin Inflow' }
];

export function SearchBar({
  onSelectLocation,
  isCollapsed = false,
  onExpand,
  onCollapse
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const searchInputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search via LocationIQ Geocoding API
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setErrorMessage(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Direct Coordinate check (e.g., "12.9352, 77.6805")
    const coordMatch = val.match(/^([+-]?\d+(\.\d+)?)[,\s]+([+-]?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setResults([{
          place_id: 'custom-coord',
          display_name: `Coordinates: ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`,
          lat: lat.toString(),
          lon: lng.toString(),
          type: 'coordinate'
        }]);
        setIsOpen(true);
        return;
      }
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const searchQuery = val.toLowerCase().includes('bengaluru') || val.toLowerCase().includes('bangalore')
          ? val
          : `${val}, Bengaluru`;

        const url = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(searchQuery)}&format=json&bounded=0&viewbox=${BENGALURU_VIEWBOX}&countrycodes=in&limit=6`;

        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 404) {
            setResults([]);
            return;
          }
          throw new Error(`LocationIQ HTTP ${response.status}`);
        }

        const data = await response.json();
        if (Array.isArray(data)) {
          setResults(data);
          setIsOpen(true);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.warn('LocationIQ search error:', err);
        setErrorMessage('Search error. Try landmark chips below.');
      } finally {
        setIsLoading(false);
      }
    }, 320);
  };

  // Select result and fly camera
  const handleSelectResult = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      onSelectLocation([lng, lat], item.display_name);
      setQuery(item.display_name.split(',')[0]);
      setIsOpen(false);
    }
  };

  // Quick corridor jump
  const handleQuickJump = (corridor) => {
    onSelectLocation(corridor.coords, corridor.name);
    setQuery(corridor.name);
    setIsOpen(false);
  };

  // Integrated "Current Location" button using LocationIQ Reverse Geocoding
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const revUrl = `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_API_KEY}&lat=${latitude}&lon=${longitude}&format=json`;
          const res = await fetch(revUrl);
          if (res.ok) {
            const revData = await res.json();
            const locationName = revData.display_name?.split(',').slice(0, 2).join(',') || 'Current Location';
            setQuery(locationName);
            onSelectLocation([longitude, latitude], locationName);
          } else {
            setQuery(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            onSelectLocation([longitude, latitude], 'Current Location');
          }
        } catch {
          setQuery(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          onSelectLocation([longitude, latitude], 'Current Location');
        } finally {
          setIsLocating(false);
          setIsOpen(false);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        // Fallback: fly to central Bellandur basin
        setErrorMessage('Location permission denied. Fly to Bellandur Corridor.');
        onSelectLocation([77.6805, 12.9352], 'Bellandur-ORR Central Corridor');
        setQuery('Bellandur-ORR');
        setIsLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  // When collapsed during map panning, render compact Google Maps floating pill
  if (isCollapsed) {
    return (
      <div
        onClick={onExpand}
        className="gmaps-collapsed-pill"
        title="Search places across Bengaluru (Click to expand)"
      >
        <Search size={18} style={{ color: '#8ab4f8' }} />
        <span style={{ fontSize: '13px', color: '#e8eaed', fontWeight: 500 }}>
          {query ? query : 'Search Bengaluru...'}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="gmaps-search-card">
      {/* Primary Google Maps Input Bar */}
      <div className="gmaps-search-input-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '14px', color: '#8ab4f8' }}>
          <Search size={19} />
        </div>

        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search places, wards, or coordinates in Bengaluru..."
          className="gmaps-search-input"
        />

        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClear}
            className="gmaps-icon-btn"
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', paddingRight: '8px' }}>
            <Loader2 size={16} className="animate-spin" style={{ color: '#8ab4f8' }} />
          </div>
        )}

        {/* Vertical Divider */}
        <div className="gmaps-divider" />

        {/* Current Location GPS Button */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className={`gmaps-icon-btn ${isLocating ? 'active' : ''}`}
          title="Locate me via LocationIQ GPS"
        >
          {isLocating ? (
            <Loader2 size={18} className="animate-spin" style={{ color: '#8ab4f8' }} />
          ) : (
            <Navigation size={18} style={{ color: '#8ab4f8' }} />
          )}
        </button>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div style={{ padding: '6px 14px', fontSize: '11px', color: '#f28b82', background: 'rgba(234, 67, 53, 0.1)' }}>
          {errorMessage}
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="gmaps-autocomplete-dropdown">
          {results.map((item, idx) => {
            const mainText = item.display_name.split(',')[0];
            const secondaryText = item.display_name.split(',').slice(1, 4).join(', ');

            return (
              <div
                key={item.place_id || idx}
                onClick={() => handleSelectResult(item)}
                className="gmaps-dropdown-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', color: '#9aa0a6', paddingTop: '2px' }}>
                  <MapPin size={17} style={{ color: '#8ab4f8' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8eaed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {mainText}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9aa0a6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                    {secondaryText || item.display_name}
                  </div>
                </div>
                <ArrowRight size={13} style={{ color: '#5f6368' }} />
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Corridor Landmark Chips */}
      <div className="gmaps-quick-chips-container">
        <div style={{ fontSize: '10px', color: '#9aa0a6', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
          Key Valley Depressions & Critical Arterials:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {QUICK_CORRIDORS.map((corridor) => (
            <button
              key={corridor.name}
              onClick={() => handleQuickJump(corridor)}
              className="gmaps-chip"
              title={`${corridor.name}: ${corridor.desc}`}
            >
              <MapPin size={11} style={{ color: '#8ab4f8' }} />
              <span>{corridor.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
