import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { TARGET_CAMERA, TERRAIN_CONFIG } from '../config/camera';
import { CRITICAL_INFRASTRUCTURE } from '../config/infrastructure';
import { VALLEY_CORRIDORS_GEOJSON } from '../config/microcatchments';
import { Layers, Compass, Eye, Shield, AlertTriangle } from 'lucide-react';

export function Map3D({
  mapboxToken,
  simulationData,
  infrastructureStatus,
  focusCoords
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [hoveredFeature, setHoveredFeature] = useState(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const token = mapboxToken || import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      setMapError("Missing Mapbox Access Token. Set VITE_MAPBOX_TOKEN in .env or configure in settings.");
      return;
    }

    mapboxgl.accessToken = token;

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: TARGET_CAMERA.center,
        zoom: TARGET_CAMERA.zoom,
        pitch: TARGET_CAMERA.pitch,
        bearing: TARGET_CAMERA.bearing,
        maxPitch: TARGET_CAMERA.maxPitch,
        minZoom: TARGET_CAMERA.minZoom,
        maxZoom: TARGET_CAMERA.maxZoom,
        antialias: true
      });

      mapRef.current = map;

      map.on('load', () => {
        setMapLoaded(true);
        setMapError(null);

        // 1. Add Mapbox Terrain-DEM for restrained realistic 3D topography
        try {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: TERRAIN_CONFIG.url,
            tileSize: TERRAIN_CONFIG.tileSize,
            maxzoom: TERRAIN_CONFIG.maxzoom
          });
          map.setTerrain({ source: 'mapbox-dem', exaggeration: TERRAIN_CONFIG.exaggeration });
        } catch (terrErr) {
          console.warn("Could not load Mapbox terrain DEM:", terrErr);
        }

        // 2. Add realistic Sky / Atmospheric Fog for dark command center diorama
        try {
          map.setFog({
            'range': [-0.5, 3],
            'color': '#080d1a',
            'horizon-blend': 0.1,
            'high-color': '#111827',
            'space-color': '#030712',
            'star-intensity': 0.2
          });
        } catch (e) {
          // ignore
        }

        // 3. Add 3D Extruded Buildings Layer
        try {
          const layers = map.getStyle().layers;
          const labelLayerId = layers.find(
            (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
          )?.id;

          map.addLayer(
            {
              id: '3d-buildings',
              source: 'composite',
              'source-layer': 'building',
              filter: ['==', 'extrude', 'true'],
              type: 'fill-extrusion',
              minzoom: 13,
              paint: {
                'fill-extrusion-color': '#1e293b',
                'fill-extrusion-height': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  13,
                  0,
                  15.05,
                  ['get', 'height']
                ],
                'fill-extrusion-base': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  13,
                  0,
                  15.05,
                  ['get', 'min_height']
                ],
                'fill-extrusion-opacity': 0.75
              }
            },
            labelLayerId
          );
        } catch (bldErr) {
          console.warn("Could not add 3D buildings layer:", bldErr);
        }

        // 4. Add Dynamic Waterlogging / Flood Catchment GeoJSON Source
        map.addSource('flood-catchments', {
          type: 'geojson',
          data: VALLEY_CORRIDORS_GEOJSON
        });

        // 4a. Base Water Surface Layer
        map.addLayer({
          id: 'flood-water-fill',
          type: 'fill',
          source: 'flood-catchments',
          paint: {
            'fill-color': ['coalesce', ['get', 'color'], '#00f0ff'],
            'fill-opacity': ['coalesce', ['get', 'opacity'], 0.15]
          }
        });

        // 4b. 3D Water Accumulation Depth Extrusion
        map.addLayer({
          id: 'flood-water-extrusion',
          type: 'fill-extrusion',
          source: 'flood-catchments',
          paint: {
            'fill-extrusion-color': ['coalesce', ['get', 'color'], '#00f0ff'],
            'fill-extrusion-height': ['coalesce', ['get', 'water_height_m'], 2],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.65
          }
        });

        // 4c. Basin Edge Boundary Glow
        map.addLayer({
          id: 'flood-water-lines',
          type: 'line',
          source: 'flood-catchments',
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#00f0ff'],
            'line-width': 2,
            'line-opacity': 0.8
          }
        });

        // Interactivity on hover
        map.on('mousemove', 'flood-water-fill', (e) => {
          if (e.features && e.features[0]) {
            map.getCanvas().style.cursor = 'pointer';
            setHoveredFeature(e.features[0].properties);
          }
        });

        map.on('mouseleave', 'flood-water-fill', () => {
          map.getCanvas().style.cursor = '';
          setHoveredFeature(null);
        });
      });

      map.on('error', (e) => {
        if (e.error && e.error.message && e.error.message.includes('401')) {
          setMapError("Invalid Mapbox token (HTTP 401). Check your token in .env or settings.");
        }
      });

      // Cleanup
      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (err) {
      setMapError(`Mapbox initialization failed: ${err.message}`);
    }
  }, [mapboxToken]);

  // Sync Flood GeoJSON data when AWS simulation response arrives
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const source = map.getSource('flood-catchments');
    if (!source) return;

    const microDepths = simulationData?.micro_catchments || [];
    const rainfallMm = simulationData?.rainfall_mm ?? 0;

    // Merge micro_catchments depths into VALLEY_CORRIDORS_GEOJSON features
    const updatedFeatures = VALLEY_CORRIDORS_GEOJSON.features.map((feat) => {
      const match = microDepths.find((m) => m.id === feat.id || m.id === feat.properties.id);
      let depthMm = match ? match.water_depth_mm : (rainfallMm * 0.4);
      let color = match ? match.color : '#00f0ff';
      let depthTier = match ? match.depth_tier : 'LOW';

      // Fallback color thresholds according to spec:
      // < 50 mm: cyan/light blue (#00f0ff)
      // 50-150 mm: amber/orange (#f59e0b)
      // > 150 mm: crimson red (#ef4444)
      if (depthMm < 50) {
        color = '#00f0ff';
        depthTier = 'LOW';
      } else if (depthMm <= 150) {
        color = '#f59e0b';
        depthTier = 'MODERATE';
      } else {
        color = '#ef4444';
        depthTier = 'SEVERE';
      }

      // Height extrusion for 3D diorama (in meters)
      const waterHeightM = Math.min(25, Math.max(1, (depthMm / 10.0)));
      const opacity = depthMm > 150 ? 0.75 : (depthMm > 50 ? 0.6 : 0.4);

      return {
        ...feat,
        properties: {
          ...feat.properties,
          water_depth_mm: depthMm,
          water_height_m: waterHeightM,
          color: color,
          opacity: opacity,
          depth_tier: depthTier
        }
      };
    });

    source.setData({
      type: "FeatureCollection",
      features: updatedFeatures
    });
  }, [simulationData, mapLoaded]);

  // Render 3D Infrastructure Markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    CRITICAL_INFRASTRUCTURE.forEach((node) => {
      const status = infrastructureStatus?.[node.name] || 'OPERATIONAL';
      const isFlooded = status === 'FLOODED';

      if (markersRef.current[node.id]) {
        // Update existing marker element DOM
        const el = markersRef.current[node.id].getElement();
        const pin = el.querySelector('.marker-pin');
        const dot = el.querySelector('.pulse-dot');
        const statusBadge = el.querySelector('.marker-status-text');

        if (pin) {
          pin.className = `marker-pin ${isFlooded ? 'flooded' : 'operational'}`;
        }
        if (dot) {
          dot.className = `pulse-dot ${isFlooded ? 'flooded' : 'operational'}`;
        }
        if (statusBadge) {
          statusBadge.textContent = status;
          statusBadge.style.color = isFlooded ? '#f87171' : '#34d399';
        }
      } else {
        // Create new interactive 3D marker
        const el = document.createElement('div');
        el.className = 'mapbox-custom-marker';
        el.innerHTML = `
          <div class="marker-pin ${isFlooded ? 'flooded' : 'operational'}">
            <div class="pulse-dot ${isFlooded ? 'flooded' : 'operational'}"></div>
            <span>${node.name}</span>
            <span class="marker-status-text" style="margin-left: 4px; font-weight: 800; color: ${isFlooded ? '#f87171' : '#34d399'}">
              ${status}
            </span>
          </div>
        `;

        el.addEventListener('click', () => {
          map.flyTo({
            center: node.coordinates,
            zoom: 15.5,
            pitch: 65,
            bearing: -15,
            duration: 1500
          });
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(node.coordinates)
          .addTo(map);

        markersRef.current[node.id] = marker;
      }
    });
  }, [infrastructureStatus, mapLoaded]);

  // Handle focus coordinates passed from outside
  useEffect(() => {
    if (focusCoords && mapRef.current) {
      mapRef.current.flyTo({
        center: focusCoords,
        zoom: 15.8,
        pitch: 65,
        bearing: -20,
        duration: 1600
      });
    }
  }, [focusCoords]);

  // Reset Camera View
  const handleResetCamera = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: TARGET_CAMERA.center,
      zoom: TARGET_CAMERA.zoom,
      pitch: TARGET_CAMERA.pitch,
      bearing: TARGET_CAMERA.bearing,
      duration: 1800
    });
  };

  // Toggle Terrain
  const handleToggleTerrain = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (showTerrain) {
      map.setTerrain(null);
      setShowTerrain(false);
    } else {
      map.setTerrain({ source: 'mapbox-dem', exaggeration: TERRAIN_CONFIG.exaggeration });
      setShowTerrain(true);
    }
  };

  // Toggle 3D Buildings
  const handleToggleBuildings = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const nextVal = !showBuildings;
    setShowBuildings(nextVal);
    if (map.getLayer('3d-buildings')) {
      map.setLayoutProperty('3d-buildings', 'visibility', nextVal ? 'visible' : 'none');
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Map Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Mapbox Token Error Banner */}
      {mapError && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.95)',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '2px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '12px',
          maxWidth: '540px'
        }}>
          <AlertTriangle size={18} />
          <div>
            <strong>Mapbox Configuration Notice:</strong>
            <div style={{ marginTop: '2px' }}>{mapError}</div>
          </div>
        </div>
      )}

      {/* Map Overlay Controls */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <button
          onClick={handleResetCamera}
          className="btn-secondary"
          title="Reset Camera to Target Corridor (Lat 12.9352, Lng 77.6805, Pitch 60°)"
        >
          <Compass size={13} style={{ color: '#00f0ff' }} />
          <span>Reset Camera</span>
        </button>

        <button
          onClick={handleToggleTerrain}
          className="btn-secondary"
          title="Toggle 3D Terrain DEM"
        >
          <Layers size={13} style={{ color: showTerrain ? '#00f0ff' : '#64748b' }} />
          <span>Terrain: {showTerrain ? '3D ON' : '2D OFF'}</span>
        </button>

        <button
          onClick={handleToggleBuildings}
          className="btn-secondary"
          title="Toggle Extruded 3D Buildings"
        >
          <Eye size={13} style={{ color: showBuildings ? '#00f0ff' : '#64748b' }} />
          <span>3D Buildings</span>
        </button>
      </div>

      {/* 3D Flood Depth Legend */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        zIndex: 30,
        background: 'rgba(9, 14, 24, 0.92)',
        border: '1px solid #1e2c45',
        padding: '8px 12px',
        fontSize: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <div style={{ color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Flood Waterlogging Depth Legend
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', background: '#00f0ff', display: 'inline-block' }}></span>
            <span style={{ color: '#cbd5e1' }}>&lt; 50 mm (Low)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', background: '#f59e0b', display: 'inline-block' }}></span>
            <span style={{ color: '#cbd5e1' }}>50 – 150 mm (Moderate)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', background: '#ef4444', display: 'inline-block' }}></span>
            <span style={{ color: '#cbd5e1' }}>&gt; 150 mm (Severe)</span>
          </div>
        </div>
      </div>

      {/* Hovered Catchment Telemetry Pill */}
      {hoveredFeature && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          zIndex: 30,
          background: 'rgba(9, 14, 24, 0.95)',
          border: '1px solid #00f0ff',
          padding: '8px 12px',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          boxShadow: '0 4px 16px rgba(0, 240, 255, 0.2)'
        }}>
          <div style={{ fontWeight: 700, color: '#f1f5f9' }}>
            {hoveredFeature.name}
          </div>
          <div style={{ display: 'flex', gap: '10px', color: '#94a3b8', fontSize: '10px' }} className="font-mono">
            <span>Elev: {hoveredFeature.elevation_m}m</span>
            <span>Water Depth: <strong style={{ color: hoveredFeature.color }}>{hoveredFeature.water_depth_mm ?? 0} mm</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
