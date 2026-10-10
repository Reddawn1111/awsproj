import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { TARGET_CAMERA, TERRAIN_CONFIG, BENGALURU_CENTER, KARNATAKA_CAMERA } from '../config/camera';
import { boundsToGeoJSON, buildOutsideMaskGeoJSON, calculateGravityWaterFlow } from '../utils/geo';
import { KARNATAKA_DRAINS, getKarnatakaDrainsGeoJSON, KARNATAKA_BOUNDS } from '../config/karnatakaDrains';
import { calculateBlockRWH } from '../utils/rwh';
import {
  Layers,
  Compass,
  Eye,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  X,
  ShieldAlert,
  Gauge,
  MapPin,
  Maximize2
} from 'lucide-react';

/**
 * Urban Waterlogging Severity Classification & Color Thresholds:
 * - Baseline / Safe (Depth <= 0 m): #1f242d (Normal Dark Charcoal Grey)
 * - Mild Ingress / Watch (0 < Depth < 0.3 m): #eab308 (Yellow)
 * - Moderate Waterlogging / Warning (0.3 m <= Depth < 0.6 m): #f97316 (Orange)
 * - Severe Waterlogging / Critical Inundation (Depth >= 0.6 m): #ef4444 (Red)
 */
function getWaterloggingColor(depthMeters) {
  if (depthMeters >= 0.6) return '#ef4444'; // Red (High Risk / Critical low-lying ponding)
  if (depthMeters >= 0.3) return '#f97316'; // Amber/Orange (Moderate Risk)
  if (depthMeters >= 0.08) return '#eab308'; // Soft Yellow (Low Risk / Minor clogging / Higher ground)
  return '#1f242d';                         // Safe / Unflooded (Default dark structural charcoal)
}

function getCompassHeadingLabel(deg) {
  const normalized = ((deg % 360) + 360) % 360;
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(normalized / 22.5) % 16;
  return `${Math.round(normalized)}° ${directions[index]}`;
}

export function Map3D({
  mapboxToken,
  mode = 'live', // 'live' | 'armed' | 'block'
  isSimulateMode = false,
  blockBounds = null,
  blockLabel = '',
  rainfallMm = 120,
  cloggingPercent = 70,
  userLocation = null,
  onMapClickForBlock = null,
  liveHotspots = [],
  simulationResult = null,
  onElevationStatsCalculated = null,
  onBlockRwhCalculated = null,
  onMapMoveStart,
  onMapIdle,
  mapRefOut,
  drainageAlerts = [],
  onOpenReportModal = null,
  isOrbiting = false, // Aliased to 360 Street View mode
  onToggleOrbit = null,
  show3DBuildings = true,
  onToggle3DBuildings = null,
  onPitchChange = null,
  // 24-Hour Simulation Sequence Props
  sim24Sequence = null,
  currentSimHour = 0,
  is24SimActive = false
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const locateMarkerRef = useRef(null);
  const flowAnimFrameRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [showTerrain, setShowTerrain] = useState(true);

  // 360° Street View / Panoramic Look-Around Controller State
  const [is360AutoPanning, setIs360AutoPanning] = useState(false);
  const [hudYaw, setHudYaw] = useState(0);
  const [hudPitch, setHudPitch] = useState(55);

  const is360ActiveRef = useRef(false);
  const is360AutoPanningRef = useRef(false);
  const origin360CoordsRef = useRef(null);
  const priorCameraRef = useRef(null);
  const currentYawRef = useRef(0);
  const currentPitchRef = useRef(55);
  const targetYawRef = useRef(0);
  const targetPitchRef = useRef(55);
  const velYawRef = useRef(0);
  const velPitchRef = useRef(0);
  const isDragging360Ref = useRef(false);
  const lastPointerPosRef = useRef({ x: 0, y: 0 });
  const panoramaAnimFrameRef = useRef(null);

  // Active Drainage Chokepoint Telemetry Popup Card State
  const [activeDrainAlert, setActiveDrainAlert] = useState(null);

  useEffect(() => {
    is360ActiveRef.current = isOrbiting;
  }, [isOrbiting]);

  useEffect(() => {
    is360AutoPanningRef.current = is360AutoPanning;
  }, [is360AutoPanning]);

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
        bearing: -15,
        maxPitch: 85,
        minZoom: 5.5, // Expanded minimum zoom for full Karnataka state-wide view
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
        if (onPitchChange) onPitchChange(map.getPitch() <= 15);
        updateGravitySimulationAndBuildings();
      });

      map.on('pitchend', () => {
        if (onPitchChange) onPitchChange(map.getPitch() <= 15);
      });

      map.on('idle', () => {
        updateGravitySimulationAndBuildings();
      });

      // Interactive Map Click for Block Extractor
      map.on('click', (e) => {
        // Dismiss active drainage telemetry card if open
        setActiveDrainAlert(null);

        // Guard against clicks on interactive drainage pin / cluster layers
        const drainFeatures = map.queryRenderedFeatures(e.point, {
          layers: ['karnataka-drain-clusters', 'karnataka-drain-unclustered-pin'].filter(l => map.getLayer(l))
        });
        if (drainFeatures.length > 0) return;

        if (onMapClickForBlock && !is360ActiveRef.current) {
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

          // 3b. Dedicated GeoJSON Highlight Overlay for Inundated Buildings (Single Atomic Repaint)
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

        // 6a. Dynamic Water Fill
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

        // =========================================================================
        // 7. KARNATAKA STATE-WIDE DRAINAGE PINPOINTS & MULTI-RESOLUTION CLUSTERING
        // Refactored from heavy DOM elements to high-performance GeoJSON cluster indexing
        // =========================================================================
        const initialDrainsGeoJSON = getKarnatakaDrainsGeoJSON(
          (drainageAlerts && drainageAlerts.length > 0) ? drainageAlerts : KARNATAKA_DRAINS
        );

        map.addSource('karnataka-drains-source', {
          type: 'geojson',
          data: initialDrainsGeoJSON,
          cluster: true,
          clusterMaxZoom: 11, // At zoom 12+, clusters smoothly resolve into distinct pinpoint markers
          clusterRadius: 50,  // Progressive density grouping radius in pixels
          clusterProperties: {
            severe_count: ['+', ['case', ['==', ['get', 'status'], 'Severe'], 1, 0]],
            moderate_count: ['+', ['case', ['==', ['get', 'status'], 'Moderate'], 1, 0]]
          }
        });

        // 7a. State Zoom Cluster Halo (Heat / Density halo around regional nodes)
        map.addLayer({
          id: 'karnataka-drain-cluster-halo',
          type: 'circle',
          source: 'karnataka-drains-source',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'case',
              ['>', ['get', 'severe_count'], 0], 'rgba(239, 68, 68, 0.28)',
              ['>', ['get', 'moderate_count'], 0], 'rgba(245, 158, 11, 0.25)',
              'rgba(0, 240, 255, 0.22)'
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              24, 6, 32, 15, 42
            ],
            'circle-blur': 0.35
          }
        });

        // 7b. Density Cluster Pins (Color-coded by highest risk in cluster)
        map.addLayer({
          id: 'karnataka-drain-clusters',
          type: 'circle',
          source: 'karnataka-drains-source',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'case',
              ['>', ['get', 'severe_count'], 0], '#ef4444',
              ['>', ['get', 'moderate_count'], 0], '#f59e0b',
              '#0284c7'
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              16, 6, 22, 15, 28
            ],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff'
          }
        });

        // 7c. Cluster Point Count Label
        map.addLayer({
          id: 'karnataka-drain-cluster-count',
          type: 'symbol',
          source: 'karnataka-drains-source',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 12
          },
          paint: {
            'text-color': '#ffffff'
          }
        });

        // 7d. Distinct Local Pinpoint Outer Glow (District / Taluk / Ward scale)
        map.addLayer({
          id: 'karnataka-drain-unclustered-glow',
          type: 'circle',
          source: 'karnataka-drains-source',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'match',
              ['get', 'status'],
              'Severe', 'rgba(239, 68, 68, 0.35)',
              'Moderate', 'rgba(245, 158, 11, 0.35)',
              'rgba(16, 185, 129, 0.35)'
            ],
            'circle-radius': 13,
            'circle-blur': 0.4
          }
        });

        // 7e. Distinct Local Drainage Inlet & Major Outfall Pinpoint Circle
        map.addLayer({
          id: 'karnataka-drain-unclustered-pin',
          type: 'circle',
          source: 'karnataka-drains-source',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'match',
              ['get', 'status'],
              'Severe', '#ef4444',
              'Moderate', '#f59e0b',
              '#10b981'
            ],
            'circle-radius': 6.5,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });

        // 7f. Local Drain Name Label (Visible at Ward / Local zoom >= 12.5)
        map.addLayer({
          id: 'karnataka-drain-unclustered-label',
          type: 'symbol',
          source: 'karnataka-drains-source',
          filter: ['!', ['has', 'point_count']],
          minzoom: 12.5,
          layout: {
            'text-field': ['get', 'shortName'],
            'text-size': 10,
            'text-offset': [0, 1.4],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#f8fafc',
            'text-halo-color': '#0a0d14',
            'text-halo-width': 2
          }
        });

        // Cluster Click: Progressive multi-resolution zoom
        map.on('click', 'karnataka-drain-clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['karnataka-drain-clusters'] });
          if (!features.length) return;
          const clusterId = features[0].properties.cluster_id;
          const src = map.getSource('karnataka-drains-source');
          if (src && typeof src.getClusterExpansionZoom === 'function') {
            src.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;
              map.easeTo({
                center: features[0].geometry.coordinates,
                zoom: Math.min(16, zoom),
                duration: 700
              });
            });
          }
        });

        // Unclustered Pin Click: Open telemetry card and focus camera
        map.on('click', 'karnataka-drain-unclustered-pin', (e) => {
          e.originalEvent.stopPropagation();
          const feat = e.features?.[0];
          if (!feat) return;
          const props = feat.properties;
          const coords = feat.geometry.coordinates;

          map.flyTo({
            center: coords,
            zoom: 15.8,
            pitch: 55,
            duration: 1000
          });

          setActiveDrainAlert({
            id: props.id,
            name: props.name,
            shortName: props.shortName,
            district: props.district,
            taluk: props.taluk,
            valley: props.valley,
            currentStatus: props.status,
            defaultStatus: props.status,
            designCapacityM3s: props.designCapacityM3s,
            currentDischargeM3s: props.currentDischargeM3s,
            deficitPercent: props.deficitPercent,
            criticality: props.criticality,
            description: props.description,
            lastDesilted: props.lastDesilted,
            coordinates: coords
          });
        });

        // Cursor Pointer on hover
        map.on('mouseenter', 'karnataka-drain-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'karnataka-drain-clusters', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'karnataka-drain-unclustered-pin', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'karnataka-drain-unclustered-pin', () => { map.getCanvas().style.cursor = ''; });

        // 8. Water Surface Shimmer & Flow Lines Animation Loop
        let animStep = 0;
        const animateFlow = () => {
          animStep += 1;
          if (mapRef.current) {
            const m = mapRef.current;
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
        if (panoramaAnimFrameRef.current) cancelAnimationFrame(panoramaAnimFrameRef.current);
        if (locateMarkerRef.current) {
          locateMarkerRef.current.remove();
          locateMarkerRef.current = null;
        }
        map.remove();
        mapRef.current = null;
      };
    } catch (err) {
      setMapError(`Mapbox initialization failed: ${err.message}`);
    }
  }, [mapboxToken]);

  // Sync state-wide drains GeoJSON with local storage overrides
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const src = map.getSource('karnataka-drains-source');
    if (src) {
      src.setData(getKarnatakaDrainsGeoJSON(drainageAlerts && drainageAlerts.length > 0 ? drainageAlerts : KARNATAKA_DRAINS));
    }
  }, [drainageAlerts, mapLoaded]);

  // Sync drain layers visibility: Dim/hide during active 1km block extraction
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const isSimBlock = (mode === 'block' || isSimulateMode) && blockBounds;
    const vis = isSimBlock ? 'none' : 'visible';

    const drainLayers = [
      'karnataka-drain-cluster-halo',
      'karnataka-drain-clusters',
      'karnataka-drain-cluster-count',
      'karnataka-drain-unclustered-glow',
      'karnataka-drain-unclustered-pin',
      'karnataka-drain-unclustered-label'
    ];

    drainLayers.forEach((lyr) => {
      if (map.getLayer(lyr)) {
        map.setLayoutProperty(lyr, 'visibility', vis);
      }
    });
  }, [mode, isSimulateMode, blockBounds, mapLoaded]);

  // =========================================================================
  // 360-DEGREE PANORAMA / STREET VIEW INTERACTION CONTROLLER
  // Replaces OrbitControls with First-Person Pitch & Yaw Controller
  // Fixed origin position, PointerLock / mouse-drag / touch-drag with damping
  // =========================================================================
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!container) return;

    if (!isOrbiting) {
      // Exit 360 Street View mode: Restore standard map controls
      if (panoramaAnimFrameRef.current) {
        cancelAnimationFrame(panoramaAnimFrameRef.current);
        panoramaAnimFrameRef.current = null;
      }
      map.dragPan.enable();
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
      return;
    }

    // Entering 360 Panoramic Look-Around Mode
    const origin = blockBounds?.center || (userLocation ? userLocation : [map.getCenter().lng, map.getCenter().lat]);
    origin360CoordsRef.current = origin;
    priorCameraRef.current = {
      center: map.getCenter(),
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing()
    };

    currentYawRef.current = map.getBearing() || 0;
    targetYawRef.current = currentYawRef.current;
    currentPitchRef.current = Math.max(15, Math.min(80, map.getPitch() || 55));
    targetPitchRef.current = currentPitchRef.current;
    velYawRef.current = 0;
    velPitchRef.current = 0;
    isDragging360Ref.current = false;

    // Fix camera position at origin point with street-level eye height
    map.dragPan.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    map.flyTo({
      center: origin,
      zoom: 17.5,
      pitch: currentPitchRef.current,
      bearing: currentYawRef.current,
      duration: 1200
    });

    // Pointer Drag Handlers (Mouse)
    const handleMouseDown = (e) => {
      isDragging360Ref.current = true;
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!isDragging360Ref.current) return;
      // Clamp delta coordinates to prevent sudden jump/momentum spikes
      const rawDx = e.clientX - lastPointerPosRef.current.x;
      const rawDy = e.clientY - lastPointerPosRef.current.y;
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

      const dx = Math.max(-30, Math.min(30, rawDx));
      const dy = Math.max(-30, Math.min(30, rawDy));

      const sensitivity = 0.22; // Degrees per pixel
      targetYawRef.current = (targetYawRef.current + dx * sensitivity) % 360;
      if (targetYawRef.current < 0) targetYawRef.current += 360;

      // Vertical drag Y-axis controls Pitch (clamped strictly between 10° and 80° to prevent flipping)
      targetPitchRef.current = Math.max(10, Math.min(80, targetPitchRef.current - dy * sensitivity));

      // Damped momentum tracking for smooth release without rapid spinning
      velYawRef.current = Math.max(-2.5, Math.min(2.5, dx * sensitivity * 0.4));
      velPitchRef.current = Math.max(-2.0, Math.min(2.0, -dy * sensitivity * 0.4));
    };

    const handleMouseUp = () => {
      isDragging360Ref.current = false;
    };

    // Touch Drag Handlers (Mobile / Tablet)
    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging360Ref.current = true;
        lastPointerPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e) => {
      if (!isDragging360Ref.current || e.touches.length !== 1) return;
      const rawDx = e.touches[0].clientX - lastPointerPosRef.current.x;
      const rawDy = e.touches[0].clientY - lastPointerPosRef.current.y;
      lastPointerPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      const dx = Math.max(-30, Math.min(30, rawDx));
      const dy = Math.max(-30, Math.min(30, rawDy));

      const sensitivity = 0.25;
      targetYawRef.current = (targetYawRef.current + dx * sensitivity) % 360;
      if (targetYawRef.current < 0) targetYawRef.current += 360;
      targetPitchRef.current = Math.max(10, Math.min(80, targetPitchRef.current - dy * sensitivity));

      velYawRef.current = Math.max(-2.5, Math.min(2.5, dx * sensitivity * 0.4));
      velPitchRef.current = Math.max(-2.0, Math.min(2.0, -dy * sensitivity * 0.4));
    };

    const handleTouchEnd = () => {
      isDragging360Ref.current = false;
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    // Continuous 60 FPS Damping & Inertia Animation Loop
    let running = true;
    const animateLookAround = () => {
      if (!running || !mapRef.current) return;

      if (!isDragging360Ref.current) {
        if (is360AutoPanningRef.current) {
          targetYawRef.current = (targetYawRef.current + 0.15) % 360;
        } else {
          // Rapid momentum damping decay
          velYawRef.current *= 0.72;
          velPitchRef.current *= 0.72;
          if (Math.abs(velYawRef.current) < 0.01) velYawRef.current = 0;
          if (Math.abs(velPitchRef.current) < 0.01) velPitchRef.current = 0;

          targetYawRef.current = (targetYawRef.current + velYawRef.current) % 360;
          if (targetYawRef.current < 0) targetYawRef.current += 360;
          targetPitchRef.current = Math.max(10, Math.min(80, targetPitchRef.current + velPitchRef.current));
        }
      }

      // Shortest angular difference calculation prevents rapid wrap-around spinning:
      let diffYaw = ((targetYawRef.current - currentYawRef.current + 540) % 360) - 180;
      const damping = isDragging360Ref.current ? 0.35 : 0.22;
      currentYawRef.current = (currentYawRef.current + diffYaw * damping) % 360;
      if (currentYawRef.current < 0) currentYawRef.current += 360;

      currentPitchRef.current += (targetPitchRef.current - currentPitchRef.current) * damping;
      currentPitchRef.current = Math.max(10, Math.min(80, currentPitchRef.current));

      map.setBearing(currentYawRef.current);
      map.setPitch(currentPitchRef.current);
      // Strictly fix camera position at selected origin point
      map.setCenter(origin360CoordsRef.current);

      setHudYaw(Math.round(currentYawRef.current));
      setHudPitch(Math.round(currentPitchRef.current));

      panoramaAnimFrameRef.current = requestAnimationFrame(animateLookAround);
    };

    panoramaAnimFrameRef.current = requestAnimationFrame(animateLookAround);

    return () => {
      running = false;
      if (panoramaAnimFrameRef.current) {
        cancelAnimationFrame(panoramaAnimFrameRef.current);
        panoramaAnimFrameRef.current = null;
      }
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOrbiting, mapLoaded, blockBounds, userLocation]);

  // Sync 3D Buildings Visibility with Ribbon Toggle
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const vis = show3DBuildings ? 'visible' : 'none';
    if (map.getLayer('3d-buildings')) {
      map.setLayoutProperty('3d-buildings', 'visibility', vis);
    }
    if (map.getLayer('flooded-buildings-layer')) {
      map.setLayoutProperty('flooded-buildings-layer', 'visibility', vis);
    }
  }, [show3DBuildings, mapLoaded]);

  // =========================================================================
  // 1. ELEVATION SAMPLING, GRAVITY FLOW & DYNAMIC RWH CALCULATION
  // Supports both static single-run and 24-Hour Time-Stepped Sequence Playback
  // =========================================================================
  const updateGravitySimulationAndBuildings = useCallback(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const hasBounds = (mode === 'block' || isSimulateMode) && blockBounds;
    const waterSrc = map.getSource('water-flood-source');
    const fldSrc = map.getSource('flooded-buildings-source');

    if (!hasBounds) {
      if (waterSrc) waterSrc.setData({ type: 'FeatureCollection', features: [] });
      if (fldSrc) fldSrc.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Decoupled Simulation Check: If simulation has not been triggered, keep water & flood mesh empty
    const isSimRunning = isSimulateMode;
    if (!isSimRunning) {
      if (waterSrc) waterSrc.setData({ type: 'FeatureCollection', features: [] });
      if (fldSrc) fldSrc.setData({ type: 'FeatureCollection', features: [] });

      // Still calculate area-specific RWH potential for the selected block
      try {
        const buildingLayers = ['3d-buildings', 'building-extrusion'].filter(l => map.getLayer(l));
        const renderedBuildings = buildingLayers.length > 0 ? map.queryRenderedFeatures({ layers: buildingLayers }) : [];
        if (onBlockRwhCalculated) {
          const rwhData = calculateBlockRWH({
            blockBounds,
            blockLabel,
            rainfallMm,
            renderedBuildings
          });
          onBlockRwhCalculated(rwhData);
        }
      } catch (e) {
        // ignore
      }
      return;
    }

    // 24-Hour Simulation Time-Stepped Mode Override
    if (is24SimActive && sim24Sequence?.steps?.[currentSimHour]) {
      const activeStep = sim24Sequence.steps[currentSimHour];
      if (waterSrc && activeStep.waterGeoJSON) {
        waterSrc.setData(activeStep.waterGeoJSON);
      }

      // Granular Per-Building Severity Color Mapping across the 24h window
      if (fldSrc) {
        try {
          const buildingLayers = ['3d-buildings', 'building-extrusion'].filter(l => map.getLayer(l));
          const renderedBuildings = buildingLayers.length > 0 ? map.queryRenderedFeatures({ layers: buildingLayers }) : [];
          const { minLng, minLat, maxLng, maxLat } = blockBounds;
          const seenCenters = new Set();
          const floodedFeatures = [];

          // Elevation extents for localized building depth
          const minElev = sim24Sequence.minElevation || 880;
          const maxElev = sim24Sequence.maxElevation || 895;
          const elevRange = Math.max(3.0, maxElev - minElev);
          const clogRatio = Math.max(0, Math.min(100, cloggingPercent || 0)) / 100;

          // Dynamic flood reach threshold expanding up terrain gradient with runoff depth
          const floodReachThreshold = activeStep.peakWaterDepthM > 0.02
            ? Math.min(0.92, 0.20 + (activeStep.peakWaterDepthM / 2.2) * 0.42 + clogRatio * 0.28)
            : 0;

          renderedBuildings.forEach((building) => {
            let center = null;
            if (building.geometry?.type === 'Polygon' && building.geometry.coordinates?.[0]?.length) {
              const ring = building.geometry.coordinates[0];
              let sLng = 0, sLat = 0;
              for (let i = 0; i < ring.length; i++) { sLng += ring[i][0]; sLat += ring[i][1]; }
              center = [sLng / ring.length, sLat / ring.length];
            } else if (building.geometry?.type === 'MultiPolygon' && building.geometry.coordinates?.[0]?.[0]?.length) {
              const ring = building.geometry.coordinates[0][0];
              let sLng = 0, sLat = 0;
              for (let i = 0; i < ring.length; i++) { sLng += ring[i][0]; sLat += ring[i][1]; }
              center = [sLng / ring.length, sLat / ring.length];
            }
            if (!center) return;
            const [bLng, bLat] = center;
            if (bLng < minLng || bLng > maxLng || bLat < minLat || bLat > maxLat) return;

            const cKey = `${bLng.toFixed(5)},${bLat.toFixed(5)}`;
            if (seenCenters.has(cKey)) return;
            seenCenters.add(cKey);

            // Derive localized ground elevation
            let bldgElev = null;
            if (typeof map.queryTerrainElevation === 'function') {
              bldgElev = map.queryTerrainElevation(center);
            }
            if (bldgElev === null || isNaN(bldgElev)) {
              const relX = (bLng - minLng) / (maxLng - minLng);
              const relY = (bLat - minLat) / (maxLat - minLat);
              bldgElev = minElev + (relX * 0.35 + relY * 0.65) * elevRange;
            }

            const relElev = Math.max(0, Math.min(1, (bldgElev - minElev) / elevRange));
            let depthAtBldg = 0;

            if (activeStep.peakWaterDepthM > 0.02 && relElev <= floodReachThreshold) {
              const depressionFactor = Math.max(0, 1.0 - (relElev / floodReachThreshold));
              depthAtBldg = Number((activeStep.peakWaterDepthM * (0.12 + 0.88 * Math.pow(depressionFactor, 1.3))).toFixed(2));
            }

            // Map color strictly based on localized depth:
            // >= 0.6m -> Red (#ef4444)
            // >= 0.3m -> Orange (#f97316)
            // >= 0.08m -> Soft Yellow (#eab308)
            // < 0.08m -> Safe Charcoal (#1f242d)
            const renderColor = getWaterloggingColor(depthAtBldg);

            floodedFeatures.push({
              type: 'Feature',
              id: `sim24_bldg_${floodedFeatures.length}`,
              properties: {
                id: `sim24_bldg_${floodedFeatures.length}`,
                renderColor,
                height: building.properties?.height || 18,
                min_height: building.properties?.min_height || 0,
                depth_m: depthAtBldg
              },
              geometry: building.geometry
            });
          });

          fldSrc.setData({ type: 'FeatureCollection', features: floodedFeatures });
        } catch (e) {
          // ignore
        }
      }
      return;
    }

    // Standard Steady-State Hydrologic Calculation
    const { minElevation, maxElevation, floodRise, waterSurfaceElevation, waterGeoJSON } = calculateGravityWaterFlow(
      map,
      blockBounds,
      rainfallMm,
      cloggingPercent
    );

    if (onElevationStatsCalculated) {
      onElevationStatsCalculated({ minElevation, maxElevation, floodRise, waterSurfaceElevation });
    }

    if (waterSrc) {
      waterSrc.setData(waterGeoJSON);
      if (map.getLayer('water-fill')) map.setLayoutProperty('water-fill', 'visibility', 'visible');
      if (map.getLayer('water-flow-lines')) map.setLayoutProperty('water-flow-lines', 'visibility', 'visible');
    }

    // Dynamic Building Footprint Extraction & Area-Specific RWH Computation
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
          let sumLng = 0, sumLat = 0;
          for (let i = 0; i < ring.length; i++) { sumLng += ring[i][0]; sumLat += ring[i][1]; }
          center = [sumLng / ring.length, sumLat / ring.length];
        } else if (building.geometry?.type === 'MultiPolygon' && building.geometry.coordinates?.[0]?.[0]?.length) {
          const ring = building.geometry.coordinates[0][0];
          let sumLng = 0, sumLat = 0;
          for (let i = 0; i < ring.length; i++) { sumLng += ring[i][0]; sumLat += ring[i][1]; }
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

      fldSrc.setData({
        type: 'FeatureCollection',
        features: floodedFeatures
      });

      // Calculate Area-Specific Rainwater Harvesting metrics from rendered structures
      if (onBlockRwhCalculated) {
        const rwhData = calculateBlockRWH({
          blockBounds,
          blockLabel,
          rainfallMm,
          renderedBuildings
        });
        onBlockRwhCalculated(rwhData);
      }
    } catch (err) {
      console.warn("Dedicated highlight overlay error:", err);
    }
  }, [
    mapLoaded,
    mode,
    isSimulateMode,
    blockBounds,
    is24SimActive,
    sim24Sequence,
    currentSimHour,
    rainfallMm,
    cloggingPercent,
    blockLabel,
    onElevationStatsCalculated,
    onBlockRwhCalculated
  ]);

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
  }, [mode, isSimulateMode, blockBounds, mapLoaded, updateGravitySimulationAndBuildings]);

  // Sync Gravity Water Flow & Building Tinting on parameter or step changes
  useEffect(() => {
    updateGravitySimulationAndBuildings();
  }, [rainfallMm, cloggingPercent, blockBounds, isSimulateMode, mode, mapLoaded, is24SimActive, currentSimHour, updateGravitySimulationAndBuildings]);

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

  const handleResetCamera = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: BENGALURU_CENTER,
      zoom: TARGET_CAMERA.zoom,
      pitch: 55,
      bearing: -15,
      duration: 1500
    });
  };

  const handleFlyToFullKarnataka = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: KARNATAKA_BOUNDS.center,
      zoom: KARNATAKA_BOUNDS.zoom,
      pitch: KARNATAKA_BOUNDS.pitch,
      bearing: KARNATAKA_BOUNDS.bearing,
      duration: 1600
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: isOrbiting ? 'grab' : (mode === 'armed' ? 'crosshair' : 'grab')
        }}
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

      {/* Floating Tools (Top-Right) with State-Wide Extents */}
      <div className="gmaps-floating-tools">
        <button
          onClick={handleFlyToFullKarnataka}
          className="gmaps-tool-btn"
          title="View Full Karnataka State (Multi-Resolution Spatial Drainage Index)"
        >
          <Maximize2 size={14} style={{ color: '#00f0ff' }} />
          <span>Full Karnataka</span>
        </button>

        <button
          onClick={handleResetCamera}
          className="gmaps-tool-btn"
          title="Reset Camera to Bengaluru Center (Pitch 55°)"
        >
          <Compass size={14} style={{ color: '#8ab4f8' }} />
          <span>Bengaluru City</span>
        </button>

        <button
          onClick={handleToggleTerrain}
          className={`gmaps-tool-btn ${showTerrain ? 'active' : ''}`}
          title="Toggle 3D Terrain DEM"
        >
          <Layers size={14} style={{ color: showTerrain ? '#8ab4f8' : '#9aa0a6' }} />
          <span>Terrain 3D</span>
        </button>

        <button
          onClick={onToggle3DBuildings}
          className={`gmaps-tool-btn ${show3DBuildings ? 'active' : ''}`}
          title="Toggle 3D Buildings"
        >
          <Eye size={14} style={{ color: show3DBuildings ? '#8ab4f8' : '#9aa0a6' }} />
          <span>3D Buildings</span>
        </button>
      </div>

      {/* 360° Street View / Panoramic First-Person Look-Around Controller HUD */}
      {isOrbiting && (
        <>
          <div className="panorama-drag-hint">
            <RotateCcw size={14} style={{ color: '#00f0ff' }} />
            <span>Click & Drag to Look Around in 360° (Heading & Pitch Locked to Origin)</span>
          </div>

          <div className="panorama-hud">
            <div className="orbit-info">
              <div className="orbit-pulsing-dot" />
              <span>Street View: <strong>{blockLabel || 'Origin Centroid'}</strong></span>
            </div>

            <div className="orbit-divider" />

            {/* Compass Heading Gauge */}
            <div className="panorama-badge" title="Continuous 360° Yaw Heading">
              <Compass size={13} />
              <span>{getCompassHeadingLabel(hudYaw)}</span>
            </div>

            {/* Pitch Gauge */}
            <div className="panorama-badge" title="Vertical Pitch (Clamped 5° - 85°)">
              <Gauge size={13} />
              <span>Pitch: {hudPitch}°</span>
            </div>

            <div className="orbit-divider" />

            {/* Auto-Pan Slow Scan Toggle */}
            <button
              onClick={() => setIs360AutoPanning(prev => !prev)}
              className="panorama-btn"
              title={is360AutoPanning ? "Pause Auto-Pan Scan" : "Start 360° Panoramic Scan"}
            >
              {is360AutoPanning ? <Pause size={12} fill="#00f0ff" /> : <Play size={12} fill="#00f0ff" />}
              <span>{is360AutoPanning ? 'Pause Scan' : 'Auto-Pan'}</span>
            </button>

            {/* Reset to North */}
            <button
              onClick={() => {
                targetYawRef.current = 0;
                targetPitchRef.current = 55;
                velYawRef.current = 0;
                velPitchRef.current = 0;
              }}
              className="panorama-btn"
              title="Reset Facing True North"
            >
              <RotateCcw size={12} />
              <span>Face North</span>
            </button>

            <div className="orbit-divider" />

            {/* Exit 360 View */}
            <button
              onClick={onToggleOrbit}
              className="panorama-exit-btn"
              title="Exit 360° Street View & Return to Orbit/Map Mode"
            >
              <X size={13} />
              <span>Exit 360°</span>
            </button>
          </div>
        </>
      )}

      {/* Active Drainage Chokepoint Telemetry Popup Card */}
      {activeDrainAlert && (
        <div className="drainage-popup-card">
          <div className="drainage-popup-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} style={{ color: activeDrainAlert.currentStatus === 'Severe' ? '#ef4444' : activeDrainAlert.currentStatus === 'Moderate' ? '#f59e0b' : '#10b981' }} />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
                  {activeDrainAlert.name}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  {activeDrainAlert.district ? `${activeDrainAlert.district} • ` : ''}{activeDrainAlert.valley}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveDrainAlert(null)}
              className="drainage-popup-close"
              title="Close Card"
            >
              <X size={15} />
            </button>
          </div>

          <div className="drainage-popup-body">
            <div className="drainage-stat-row">
              <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>Design vs Observed Discharge:</span>
              <strong style={{ color: activeDrainAlert.currentDischargeM3s > activeDrainAlert.designCapacityM3s ? '#ef4444' : '#10b981', fontSize: '12.5px' }}>
                {activeDrainAlert.currentDischargeM3s} / {activeDrainAlert.designCapacityM3s} m³/s
                <span style={{ fontSize: '11px', marginLeft: '4px' }}>
                  ({Math.round((activeDrainAlert.currentDischargeM3s / activeDrainAlert.designCapacityM3s) * 100)}%)
                </span>
              </strong>
            </div>

            <div className="drainage-stat-row">
              <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>Current Alert Severity:</span>
              <span className="drainage-status-badge" style={{
                background: activeDrainAlert.currentStatus === 'Severe' ? 'rgba(239, 68, 68, 0.2)' : activeDrainAlert.currentStatus === 'Moderate' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: activeDrainAlert.currentStatus === 'Severe' ? '#ef4444' : activeDrainAlert.currentStatus === 'Moderate' ? '#f59e0b' : '#10b981',
                border: `1px solid ${activeDrainAlert.currentStatus === 'Severe' ? '#ef4444' : activeDrainAlert.currentStatus === 'Moderate' ? '#f59e0b' : '#10b981'}44`
              }}>
                {activeDrainAlert.currentStatus || activeDrainAlert.defaultStatus}
              </span>
            </div>

            <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.45', marginTop: '6px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
              {activeDrainAlert.description}
            </div>

            {activeDrainAlert.overrideNote && (
              <div style={{ fontSize: '10.5px', color: '#38bdf8', marginTop: '4px', fontStyle: 'italic' }}>
                ✓ {activeDrainAlert.overrideNote}
              </div>
            )}
          </div>

          <div className="drainage-popup-footer">
            <button
              onClick={() => {
                if (onOpenReportModal) onOpenReportModal(activeDrainAlert.id);
                setActiveDrainAlert(null);
              }}
              className="drainage-override-btn"
            >
              <ShieldAlert size={14} />
              <span>Report / Change Status</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode Instructions Indicator in Armed Mode */}
      {mode === 'armed' && (
        <div className="gmaps-armed-hint-banner">
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 10px #00f0ff' }} />
          <span>Search an area or click anywhere across Karnataka to extract a 1 km x 1 km simulation zone.</span>
        </div>
      )}
    </div>
  );
}
