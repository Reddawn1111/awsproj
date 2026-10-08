import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { TARGET_CAMERA, TERRAIN_CONFIG } from '../config/camera';
import { CRITICAL_INFRASTRUCTURE } from '../config/infrastructure';
import { boundsToGeoJSON, buildOutsideMaskGeoJSON, calculateGravityWaterFlow } from '../utils/geo';
import { Layers, Compass, Eye, Waves, AlertTriangle } from 'lucide-react';

/**
 * Urban Waterlogging Severity Classification & Color Thresholds:
 * - Baseline / Safe (Depth <= 0 m): #1f242d (Normal Dark Charcoal Grey)
 * - Mild Ingress / Watch (0 < Depth < 0.3 m): #eab308 (Yellow)
 * - Moderate Waterlogging / Warning (0.3 m <= Depth < 0.6 m): #f97316 (Orange)
 * - Severe Waterlogging / Critical Inundation (Depth >= 0.6 m): #ef4444 (Red)
 */
function getWaterloggingColor(depthMeters) {
  if (depthMeters >= 0.6) return '#ef4444'; // Red
  if (depthMeters >= 0.3) return '#f97316'; // Orange
  if (depthMeters > 0)    return '#eab308'; // Yellow
}

export function Map3D({
  mapboxToken,
  mode = 'live', // 'live' | 'armed' | 'block'
  isSimulateMode = false,
  blockBounds = null,
  rainfallMm = 120,
  cloggingPercent = 70,
  userLocation = null,
  onMapClickForBlock = null,
  liveHotspots = [],
  simulationResult = null,
  onElevationStatsCalculated = null,
  onMapMoveStart,
  onMapIdle,
  mapRefOut
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const locateMarkerRef = useRef(null);
  const flowAnimFrameRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);

  // Initialize Mapbox GL JS v3
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
        pitch: 55,
        bearing: -20,
        maxPitch: 85,
        minZoom: 10,
        maxZoom: 18,
        antialias: true,
        attributionControl: false
      });

      mapRef.current = map;
      if (mapRefOut) mapRefOut.current = map;

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

      map.on('movestart', () => {
        if (onMapMoveStart) onMapMoveStart();
      });

      map.on('moveend', () => {
        if (onMapIdle) onMapIdle();
        updateGravitySimulationAndBuildings();
      });

      map.on('idle', () => {
        updateGravitySimulationAndBuildings();
      });

      // Interactive Map Click for Block Extractor when armed or in block mode
      map.on('click', (e) => {
        if (onMapClickForBlock) {
          onMapClickForBlock([e.lngLat.lng, e.lngLat.lat]);
        }
      });

      map.on('load', () => {
        setMapLoaded(true);
        setMapError(null);

        // 1. Add Mapbox Terrain-DEM
        try {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: TERRAIN_CONFIG.url,
            tileSize: TERRAIN_CONFIG.tileSize,
            maxzoom: TERRAIN_CONFIG.maxzoom
          });
          map.setTerrain({ source: 'mapbox-dem', exaggeration: TERRAIN_CONFIG.exaggeration });
        } catch (terrErr) {
          console.warn("Terrain DEM error:", terrErr);
        }

        // 2. Realistic Night Sky & Fog
        try {
          map.setFog({
            'range': [-0.5, 4.0],
            'color': '#131822',
            'horizon-blend': 0.15,
            'high-color': '#1a2230',
            'space-color': '#0d1117',
            'star-intensity': 0.1
          });
        } catch (e) {
          // ignore
        }

        // 3. Extruded 3D Buildings Layer (Clean Charcoal Basemap)
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
                'fill-extrusion-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'height'],
                  0, '#1f242d',
                  25, '#242a32',
                  60, '#2d3436',
                  120, '#353b3d'
                ],
                'fill-extrusion-height': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  13, 0,
                  15.05, ['get', 'height']
                ],
                'fill-extrusion-base': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  13, 0,
                  15.05, ['get', 'min_height']
                ],
                'fill-extrusion-opacity': 0.92
              }
            },
            labelLayerId
          );

          // 3b. Dedicated GeoJSON Highlight Overlay for Inundated Buildings
          if (!map.getSource('flooded-buildings-source')) {
            map.addSource('flooded-buildings-source', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] }
            });

            map.addLayer(
              {
                id: 'flooded-buildings-layer',
                type: 'fill-extrusion',
                source: 'flooded-buildings-source',
                paint: {
                  'fill-extrusion-color': ['coalesce', ['get', 'renderColor'], '#1f242d'],
                  'fill-extrusion-height': ['coalesce', ['get', 'height'], 15],
                  'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
                  'fill-extrusion-opacity': 0.95
                }
              },
              labelLayerId
            );
          }
        } catch (bldErr) {
          console.warn("Could not add 3D buildings layer:", bldErr);
        }

        // 4. Outside-Mask Source & Layer (Dims out surrounding map outside active 1km block)
        map.addSource('outside-mask-src', {
          type: 'geojson',
          data: buildOutsideMaskGeoJSON(null)
        });
        map.addLayer({
          id: 'outside-mask-layer',
          type: 'fill',
          source: 'outside-mask-src',
          paint: {
            'fill-color': '#05080c',
            'fill-opacity': 0.58
          }
        }, '3d-buildings');

        // 5. Active Block Bounding Box Outline & Glow
        map.addSource('block-box-src', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
        map.addLayer({
          id: 'block-box-fill',
          type: 'fill',
          source: 'block-box-src',
          paint: {
            'fill-color': '#00f0ff',
            'fill-opacity': 0.04
          }
        }, '3d-buildings');
        map.addLayer({
          id: 'block-box-line-glow',
          type: 'line',
          source: 'block-box-src',
          paint: {
            'line-color': '#00f0ff',
            'line-width': 6,
            'line-opacity': 0.35,
            'line-blur': 4
          }
        }, '3d-buildings');
        map.addLayer({
          id: 'block-box-line',
          type: 'line',
          source: 'block-box-src',
          paint: {
            'line-color': '#00f0ff',
            'line-width': 2.5,
            'line-opacity': 0.95
          }
        }, '3d-buildings');

        // 6. Terrain-Draped Fluid Water Layers (Placed strictly BELOW 3d-buildings)
        map.addSource('water-flood-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        // 6a. Dynamic Water Fill (Shallow <0.4m -> rgba(0, 180, 216, 0.6), Deep >0.8m -> rgba(0, 119, 182, 0.8))
        map.addLayer({
          id: 'water-fill',
          type: 'fill',
          source: 'water-flood-source',
          filter: ['==', '$type', 'Polygon'],
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'depth_m'], 0],
              0.0, 'rgba(0, 180, 216, 0.6)',
              0.4, 'rgba(0, 180, 216, 0.6)',
              0.8, 'rgba(0, 119, 182, 0.8)'
            ],
            'fill-opacity': 0.68
          }
        }, '3d-buildings');

        // 6b. Dynamic Flow Vector Lines with Animated Dash Pattern
        map.addLayer({
          id: 'water-flow-lines',
          type: 'line',
          source: 'water-flood-source',
          filter: ['==', '$type', 'LineString'],
          paint: {
            'line-color': '#00f0ff',
            'line-width': 2.5,
            'line-opacity': 0.85,
            'line-dasharray': [2, 4, 0, 4]
          }
        }, '3d-buildings');

        // 7. Water Surface Shimmer & Flow Lines Animation (requestAnimationFrame)
        // Modulates fill-opacity between 0.55 and 0.82; animates flow dash offset
        let animStep = 0;
        const animateFlow = () => {
          animStep += 1;
          if (mapRef.current) {
            const m = mapRef.current;
            // Shimmer between 0.55 and 0.82: midpoint 0.685, amplitude 0.135
            const shimmerOpacity = 0.685 + Math.sin(animStep * 0.05) * 0.135;
            try {
              if (m.getLayer('water-fill')) {
                m.setPaintProperty('water-fill', 'fill-opacity', shimmerOpacity);
              }
              if (m.getLayer('water-flow-lines')) {
                const dashDynamic = (animStep / 10) % 6;
                m.setPaintProperty('water-flow-lines', 'line-dasharray', [2, 4, dashDynamic, 4]);
              }
            } catch {
              // ignore during tile transition
            }
          }
          flowAnimFrameRef.current = requestAnimationFrame(animateFlow);
        };
        flowAnimFrameRef.current = requestAnimationFrame(animateFlow);
      });

      map.on('error', (e) => {
        if (e.error?.message?.includes('401')) {
          setMapError("Invalid Mapbox token (HTTP 401). Check settings.");
        }
      });

      return () => {
        if (flowAnimFrameRef.current) cancelAnimationFrame(flowAnimFrameRef.current);
        if (locateMarkerRef.current) {
          locateMarkerRef.current.remove();
          locateMarkerRef.current = null;
        }
        Object.values(markersRef.current).forEach(m => m.remove());
        markersRef.current = {};
        map.remove();
        mapRef.current = null;
      };
    } catch (err) {
      setMapError(`Mapbox initialization failed: ${err.message}`);
    }
  }, [mapboxToken]);

  // 1. Elevation Sampling & Gravity Flow Model with Dedicated GeoJSON Highlight Overlay
  const updateGravitySimulationAndBuildings = () => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const isSimActive = (mode === 'block' || isSimulateMode) && blockBounds;
    const waterSrc = map.getSource('water-flood-source');
    const fldSrc = map.getSource('flooded-buildings-source');

    if (!isSimActive) {
      if (waterSrc) waterSrc.setData({ type: 'FeatureCollection', features: [] });
      if (fldSrc) fldSrc.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // A. Ground Elevation Sampling across the 1km x 1km block & Hydrologic Runoff
    const { minElevation, maxElevation, floodRise, waterSurfaceElevation, waterGeoJSON } = calculateGravityWaterFlow(
      map,
      blockBounds,
      rainfallMm,
      cloggingPercent
    );

    console.log('[4clique Simulation] Sampled Elevation:', {
      minElevation: Number(minElevation.toFixed(1)),
      floodLevel: Number(floodRise.toFixed(2))
    });

    if (onElevationStatsCalculated) {
      onElevationStatsCalculated({ minElevation, maxElevation, floodRise, waterSurfaceElevation });
    }

    // B. Drape fluid water geometry strictly over low depressions where terrain elevation < waterSurfaceElevation
    if (waterSrc) {
      waterSrc.setData(waterGeoJSON);
      if (map.getLayer('water-fill')) {
        map.setLayoutProperty('water-fill', 'visibility', 'visible');
      }
      if (map.getLayer('water-flow-lines')) {
        map.setLayoutProperty('water-flow-lines', 'visibility', 'visible');
      }
    }

    // C. Individual Per-Building Basement Risk & Elevation Tinting via Dedicated GeoJSON Highlight Overlay
    if (!fldSrc) return;

    try {
      const buildingLayers = ['3d-buildings', 'building-extrusion'].filter(l => map.getLayer(l));
      const renderedBuildings = buildingLayers.length > 0 ? map.queryRenderedFeatures({ layers: buildingLayers }) : [];
      const { minLng, minLat, maxLng, maxLat } = blockBounds;
      const seenCenters = new Set();
      const floodedFeatures = [];

      renderedBuildings.forEach((building) => {
        let center = null;
        if (building.geometry?.type === 'Polygon' && building.geometry.coordinates?.[0]?.length) {
          const ring = building.geometry.coordinates[0];
          let sumLng = 0;
          let sumLat = 0;
          for (let i = 0; i < ring.length; i++) {
            sumLng += ring[i][0];
            sumLat += ring[i][1];
          }
          center = [sumLng / ring.length, sumLat / ring.length];
        } else if (building.geometry?.type === 'MultiPolygon' && building.geometry.coordinates?.[0]?.[0]?.length) {
          const ring = building.geometry.coordinates[0][0];
          let sumLng = 0;
          let sumLat = 0;
          for (let i = 0; i < ring.length; i++) {
            sumLng += ring[i][0];
            sumLat += ring[i][1];
          }
          center = [sumLng / ring.length, sumLat / ring.length];
        }

        if (!center) return;
        const [bLng, bLat] = center;
        if (bLng < minLng || bLng > maxLng || bLat < minLat || bLat > maxLat) return;

        const centerKey = `${center[0].toFixed(5)},${center[1].toFixed(5)}`;
        if (seenCenters.has(centerKey)) return;
        seenCenters.add(centerKey);

        let bldgElev = null;
        if (typeof map.queryTerrainElevation === 'function') {
          bldgElev = map.queryTerrainElevation(center);
        }
        if (bldgElev === null || isNaN(bldgElev)) {
          bldgElev = minElevation + 0.3;
        }

        const elevRange = Math.max(3.0, maxElevation - minElevation);
        const relElev = Math.max(0, Math.min(1, (bldgElev - minElevation) / elevRange));
        const clogRatio = Math.max(0, Math.min(100, cloggingPercent || 0)) / 100;
        // Reach threshold extends up the catchment slope as rain and clogging escalate
        const floodReachThreshold = floodRise > 0.02
          ? Math.min(0.88, 0.25 + (floodRise / 2.2) * 0.35 + clogRatio * 0.28)
          : 0;

        let waterDepthAtBuilding = 0;
        if (floodRise > 0.02 && relElev <= floodReachThreshold) {
          const depressionFactor = Math.max(0, 1.0 - (relElev / floodReachThreshold));
          waterDepthAtBuilding = Number((floodRise * (0.22 + 0.78 * Math.pow(depressionFactor, 1.2))).toFixed(2));
        }

        const renderColor = getWaterloggingColor(waterDepthAtBuilding);
        const baseBldgHeight = building.properties?.height || 18;

        floodedFeatures.push({
          type: 'Feature',
          id: `flood_bldg_${floodedFeatures.length}`,
          properties: {
            id: `flood_bldg_${floodedFeatures.length}`,
            renderColor,
            height: baseBldgHeight,
            min_height: building.properties?.min_height || 0,
            depth_m: Number(waterDepthAtBuilding.toFixed(2))
          },
          geometry: building.geometry
        });
      });

      // If fewer than 12 buildings found (e.g. view zoomed out or sparse area), generate synthetic building footprints
      if (floodedFeatures.length < 12) {
        const gridRows = 5;
        const gridCols = 5;
        const dLng = (maxLng - minLng) / (gridCols + 1);
        const dLat = (maxLat - minLat) / (gridRows + 1);
        const bldgHalfLng = dLng * 0.28;
        const bldgHalfLat = dLat * 0.28;

        for (let r = 1; r <= gridRows; r++) {
          for (let c = 1; c <= gridCols; c++) {
            const bLng = minLng + c * dLng;
            const bLat = minLat + r * dLat;
            let bldgElev = 880.0;
            if (typeof map.queryTerrainElevation === 'function') {
              const qElev = map.queryTerrainElevation([bLng, bLat]);
              if (qElev !== null && !isNaN(qElev)) bldgElev = qElev;
            }
            const elevRange = Math.max(3.0, maxElevation - minElevation);
            const relElev = Math.max(0, Math.min(1, (bldgElev - minElevation) / elevRange));
            const clogRatio = Math.max(0, Math.min(100, cloggingPercent || 0)) / 100;
            const floodReachThreshold = floodRise > 0.02
              ? Math.min(0.88, 0.25 + (floodRise / 2.2) * 0.35 + clogRatio * 0.28)
              : 0;

            let waterDepthAtBuilding = 0;
            if (floodRise > 0.02 && relElev <= floodReachThreshold) {
              const depressionFactor = Math.max(0, 1.0 - (relElev / floodReachThreshold));
              waterDepthAtBuilding = Number((floodRise * (0.22 + 0.78 * Math.pow(depressionFactor, 1.2))).toFixed(2));
            }

            const renderColor = getWaterloggingColor(waterDepthAtBuilding);

            floodedFeatures.push({
              type: 'Feature',
              id: `synth_bldg_${r}_${c}`,
              properties: {
                id: `synth_bldg_${r}_${c}`,
                renderColor,
                height: 16 + ((r * 11 + c * 17) % 25),
                min_height: 0,
                depth_m: Number(waterDepthAtBuilding.toFixed(2))
              },
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [Number((bLng - bldgHalfLng).toFixed(6)), Number((bLat - bldgHalfLat).toFixed(6))],
                  [Number((bLng + bldgHalfLng).toFixed(6)), Number((bLat - bldgHalfLat).toFixed(6))],
                  [Number((bLng + bldgHalfLng).toFixed(6)), Number((bLat + bldgHalfLat).toFixed(6))],
                  [Number((bLng - bldgHalfLng).toFixed(6)), Number((bLat + bldgHalfLat).toFixed(6))],
                  [Number((bLng - bldgHalfLng).toFixed(6)), Number((bLat - bldgHalfLat).toFixed(6))]
                ]]
              }
            });
          }
        }
      }

      fldSrc.setData({
        type: 'FeatureCollection',
        features: floodedFeatures
      });
    } catch (err) {
      console.warn("Dedicated highlight overlay error:", err);
    }
  };

  // Sync Block Extractor Bounding Box & Outside-Mask
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const boxSrc = map.getSource('block-box-src');
    const maskSrc = map.getSource('outside-mask-src');

    const isSimActive = (mode === 'block' || isSimulateMode) && blockBounds;
    if (isSimActive) {
      if (boxSrc) boxSrc.setData(boundsToGeoJSON(blockBounds));
      if (maskSrc) maskSrc.setData(buildOutsideMaskGeoJSON(blockBounds));
    } else {
      if (boxSrc) boxSrc.setData({ type: 'FeatureCollection', features: [] });
      if (maskSrc) maskSrc.setData({ type: 'FeatureCollection', features: [] });
    }

    updateGravitySimulationAndBuildings();
  }, [mode, isSimulateMode, blockBounds, mapLoaded]);

  // Sync Gravity Water Flow & Building Tinting on parameter changes
  useEffect(() => {
    updateGravitySimulationAndBuildings();
  }, [rainfallMm, cloggingPercent, blockBounds, isSimulateMode, mode, mapLoaded]);

  // Locate Me Pinpoint Marker
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !userLocation) return;
    const map = mapRef.current;

    if (locateMarkerRef.current) {
      locateMarkerRef.current.setLngLat(userLocation);
    } else {
      const el = document.createElement('div');
      el.className = 'gmaps-locate-pin-container';
      el.title = 'Your Current Location';
      el.innerHTML = `
        <div class="gmaps-locate-pulse-halo"></div>
        <div class="gmaps-locate-pin">
          <svg width="28" height="36" viewBox="0 0 24 32" fill="none">
            <path d="M12 0C5.37 0 0 5.37 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.37 18.63 0 12 0Z" fill="#1a73e8"/>
            <circle cx="12" cy="12" r="5" fill="#ffffff"/>
          </svg>
        </div>
      `;
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(userLocation)
        .addTo(map);
      locateMarkerRef.current = marker;
    }
  }, [userLocation, mapLoaded]);

  // Infrastructure Markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    CRITICAL_INFRASTRUCTURE.forEach((node) => {
      let isFlooded = false;
      if (mode === 'block' && simulationResult?.infrastructure) {
        const found = simulationResult.infrastructure.find(n => n.id === node.id);
        if (found) isFlooded = found.status === 'FLOODED';
      }

      if (markersRef.current[node.id]) {
        const el = markersRef.current[node.id].getElement();
        const pin = el.querySelector('.marker-pin');
        const dot = el.querySelector('.pulse-dot');
        const statusBadge = el.querySelector('.marker-status-text');

        if (pin) pin.className = `marker-pin ${isFlooded ? 'flooded' : 'operational'}`;
        if (dot) dot.className = `pulse-dot ${isFlooded ? 'flooded' : 'operational'}`;
        if (statusBadge) {
          statusBadge.textContent = isFlooded ? 'FLOODED' : 'OPERATIONAL';
          statusBadge.style.color = isFlooded ? '#ea4335' : '#34a853';
        }
      } else {
        const el = document.createElement('div');
        el.className = 'mapbox-custom-marker';
        el.innerHTML = `
          <div class="marker-pin ${isFlooded ? 'flooded' : 'operational'}">
            <div class="pulse-dot ${isFlooded ? 'flooded' : 'operational'}"></div>
            <span style="font-weight: 600;">${node.name}</span>
            <span class="marker-status-text" style="margin-left: 5px; font-weight: 800; color: ${isFlooded ? '#ea4335' : '#34a853'}">
              ${isFlooded ? 'FLOODED' : 'OPERATIONAL'}
            </span>
          </div>
        `;

        el.addEventListener('click', () => {
          map.flyTo({
            center: node.coordinates,
            zoom: 16,
            pitch: 60,
            bearing: -20,
            duration: 1400
          });
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(node.coordinates)
          .addTo(map);

        markersRef.current[node.id] = marker;
      }
    });
  }, [simulationResult, mode, mapLoaded]);

  const handleResetCamera = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: TARGET_CAMERA.center,
      zoom: TARGET_CAMERA.zoom,
      pitch: 55,
      bearing: -20,
      duration: 1500
    });
  };

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

  const handleToggleBuildings = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const nextVal = !showBuildings;
    setShowBuildings(nextVal);
    if (map.getLayer('3d-buildings')) {
      map.setLayoutProperty('3d-buildings', 'visibility', nextVal ? 'visible' : 'none');
    }
    if (map.getLayer('flooded-buildings-layer')) {
      map.setLayoutProperty('flooded-buildings-layer', 'visibility', nextVal ? 'visible' : 'none');
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', cursor: mode === 'armed' ? 'crosshair' : 'grab' }}
      />

      {mapError && (
        <div className="gmaps-error-banner">
          <AlertTriangle size={18} style={{ color: '#ea4335' }} />
          <div>
            <strong>Mapbox Configuration:</strong>
            <div style={{ marginTop: '2px', fontSize: '11px' }}>{mapError}</div>
          </div>
        </div>
      )}

      {/* Floating Tools (Top-Right) */}
      <div className="gmaps-floating-tools">
        <button
          onClick={handleResetCamera}
          className="gmaps-tool-btn"
          title="Reset Camera to Bengaluru (Lat 12.9352, Lng 77.6805, Pitch 55°)"
        >
          <Compass size={15} style={{ color: '#8ab4f8' }} />
          <span>Reset Camera</span>
        </button>

        <button
          onClick={handleToggleTerrain}
          className={`gmaps-tool-btn ${showTerrain ? 'active' : ''}`}
          title="Toggle 3D Terrain DEM"
        >
          <Layers size={15} style={{ color: showTerrain ? '#8ab4f8' : '#9aa0a6' }} />
          <span>Terrain 3D</span>
        </button>

        <button
          onClick={handleToggleBuildings}
          className={`gmaps-tool-btn ${showBuildings ? 'active' : ''}`}
          title="Toggle 3D Buildings"
        >
          <Eye size={15} style={{ color: showBuildings ? '#8ab4f8' : '#9aa0a6' }} />
          <span>3D Buildings</span>
        </button>
      </div>

      {/* Mode Instructions Indicator in Armed Mode */}
      {mode === 'armed' && (
        <div className="gmaps-armed-hint-banner">
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 10px #00f0ff' }} />
          <span>Search an area or click anywhere on Bengaluru to extract a 1 km x 1 km simulation zone.</span>
        </div>
      )}
    </div>
  );
}
