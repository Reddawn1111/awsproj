import React, { useState } from 'react';
import {
  CloudRain,
  Sliders,
  Zap,
  Loader2,
  RefreshCw,
  X,
  Waves,
  Building2,
  AlertTriangle,
  ChevronDown,
  Layers,
  MapPin,
  TrendingDown
} from 'lucide-react';
import { fetchPointRain } from '../services/openMeteo';

export function SimulationDrawer({
  isOpen,
  onClose,
  blockBounds,
  blockLabel,
  rainfallMm,
  onRainfallChange,
  cloggingPercent,
  onCloggingChange,
  elevationStats,
  onRunSimulation,
  onTriggerPresetSurge,
  isLoading,
  error,
  lastSuccessTimestamp,
  latencyMs,
  simulationResult
}) {
  const [isFetchingPointRain, setIsFetchingPointRain] = useState(false);
  const [livePointNotice, setLivePointNotice] = useState(null);

  if (!isOpen) return null;

  const handleFetchBlockRain = async () => {
    if (!blockBounds) return;
    setIsFetchingPointRain(true);
    setLivePointNotice(null);
    try {
      const center = blockBounds.center || [
        (blockBounds.minLng + blockBounds.maxLng) / 2,
        (blockBounds.minLat + blockBounds.maxLat) / 2
      ];
      const data = await fetchPointRain(center[1], center[0]);
      onRainfallChange(data.rain_mm_hr);
      setLivePointNotice(`Live rain at block: ${data.rain_mm_hr} mm/hr (${data.timestamp})`);
    } finally {
      setIsFetchingPointRain(false);
    }
  };

  const runoffMultiplier = 0.85 * (1 + (cloggingPercent / 100) * 1.5);
  const accumulatedVolume = (rainfallMm / 1000) * runoffMultiplier;
  const calculatedFloodRise = Number(Math.min(2.2, accumulatedVolume * 4.0).toFixed(2));

  const peakDepthM = elevationStats?.floodRise !== undefined 
    ? Number(elevationStats.floodRise.toFixed(2))
    : (simulationResult?.peak_water_depth_m !== undefined ? simulationResult.peak_water_depth_m : calculatedFloodRise);

  const floodFraction = simulationResult?.flood_fraction ?? (rainfallMm > 0 ? Math.min(0.85, (peakDepthM / 2.2) * 0.75) : 0);
  
  let tier = 'SAFE';
  let tierColor = '#10b981';
  let tierLabel = '(Dry / Safe)';

  if (peakDepthM >= 0.6) {
    tier = 'SEVERE';
    tierColor = '#ef4444';
    tierLabel = '(Critical Inundation)';
  } else if (peakDepthM >= 0.3) {
    tier = 'MODERATE';
    tierColor = '#f97316';
    tierLabel = '(Moderate Warning)';
  } else if (peakDepthM > 0) {
    tier = 'MILD';
    tierColor = '#eab308';
    tierLabel = '(Mild Ingress)';
  }

  return (
    <div
      className="gmaps-sim-drawer"
      style={{
        position: 'absolute',
        bottom: '24px',
        right: '16px',
        zIndex: 50,
        pointerEvents: 'auto'
      }}
    >
      {/* Drawer Header */}
      <div className="gmaps-drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f0ff' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#e8eaed', letterSpacing: '0.02em' }}>
              1 km² Simulation Block
            </div>
            <div style={{ fontSize: '10.5px', color: '#8ab4f8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '260px' }}>
              {blockLabel || 'Extracted Zone'}
            </div>
          </div>
        </div>

        <button onClick={onClose} className="gmaps-icon-btn" title="Exit Simulation Block">
          <X size={17} />
        </button>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
        {/* Real-time Result Banner */}
        <div style={{
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'rgba(24, 28, 38, 0.85)',
          border: `1px solid ${tierColor}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '10px', color: '#9aa0a6', textTransform: 'uppercase', fontWeight: 600 }}>
              Peak Valley Inundation
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '1px' }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: tierColor }}>
                {peakDepthM > 0 ? `${peakDepthM} m` : '0.0 m'}
              </span>
              <span style={{ fontSize: '11px', color: '#9aa0a6' }}>
                {tierLabel}
              </span>
            </div>
            {elevationStats && (
              <div style={{ fontSize: '9.5px', color: '#8ab4f8', marginTop: '2px' }}>
                Water Surface: {elevationStats.waterSurfaceElevation.toFixed(1)}m (Base: {elevationStats.minElevation.toFixed(1)}m)
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#9aa0a6', textTransform: 'uppercase', fontWeight: 600 }}>
              Flooded Block Area
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e8eaed', marginTop: '2px' }}>
              {Math.round(floodFraction * 100)}% ({simulationResult?.flooded_sqkm ?? (floodFraction * 1.0).toFixed(2)} km²)
            </div>
          </div>
        </div>

        {/* 4-Tier Standard Municipal Waterlogging Risk Legend */}
        <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ fontSize: '10px', color: '#9aa0a6', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>
            Building Severity Classification:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', fontSize: '9px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#1f242d', border: '1px solid #475569', flexShrink: 0 }} />
              <span style={{ color: '#cbd5e1', whiteSpace: 'nowrap' }}>&le;0m Safe</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#eab308', flexShrink: 0 }} />
              <span style={{ color: '#cbd5e1', whiteSpace: 'nowrap' }}>&lt;0.3m Watch</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f97316', flexShrink: 0 }} />
              <span style={{ color: '#cbd5e1', whiteSpace: 'nowrap' }}>0.3-0.6m Warn</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444', flexShrink: 0 }} />
              <span style={{ color: '#cbd5e1', whiteSpace: 'nowrap' }}>&ge;0.6m Critical</span>
            </div>
          </div>
        </div>

        {/* Telemetry Metrics Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          padding: '8px 10px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div>
            <div style={{ fontSize: '9px', color: '#9aa0a6', textTransform: 'uppercase', fontWeight: 600 }}>Volume</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#8ab4f8', marginTop: '2px' }}>
              {(simulationResult?.total_water_volume_m3 ?? Math.round(peakDepthM * floodFraction * 1000000)).toLocaleString()} m³
            </div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#9aa0a6', textTransform: 'uppercase', fontWeight: 600 }}>At Risk Bldgs</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: peakDepthM >= 0.6 ? '#ef4444' : (peakDepthM > 0 ? '#f59e0b' : '#10b981'), marginTop: '2px' }}>
              {simulationResult?.flooded_building_count ?? (peakDepthM > 0 ? Math.round(floodFraction * 45) : 0)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#9aa0a6', textTransform: 'uppercase', fontWeight: 600 }}>Vulnerability</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#e8eaed', marginTop: '2px' }}>
              {simulationResult?.vulnerability_index !== undefined ? `${Math.round(simulationResult.vulnerability_index * 100)}%` : (peakDepthM > 0 ? `${Math.round(Math.min(1, (peakDepthM / 1.8) * 0.6 + (cloggingPercent / 100) * 0.4) * 100)}%` : '0%')}
            </div>
          </div>
        </div>

        {/* Sliders: Rainfall & Clogging with Live Numerical Badges */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#e8eaed' }}>
              <CloudRain size={14} style={{ color: '#8ab4f8' }} />
              <span>Rainfall Intensity</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                background: 'rgba(138, 180, 248, 0.16)',
                border: '1px solid rgba(138, 180, 248, 0.35)',
                color: '#8ab4f8',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.02em'
              }}>
                {rainfallMm} mm/hr
              </span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="300"
            step="5"
            value={rainfallMm}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              console.log('[4clique Simulation] Slider Update:', { rainfall: val, clogging: cloggingPercent });
              onRainfallChange(val);
            }}
            className="gmaps-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#80868b', marginTop: '3px' }}>
            <span>0 mm</span>
            <span>75 mm</span>
            <span>145 mm (Cloudburst)</span>
            <span>300 mm</span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#e8eaed' }}>
              <Sliders size={14} style={{ color: '#fbbc04' }} />
              <span>Drainage Siltation / Clogging</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                background: cloggingPercent > 60 ? 'rgba(239, 68, 68, 0.16)' : 'rgba(251, 188, 4, 0.16)',
                border: `1px solid ${cloggingPercent > 60 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(251, 188, 4, 0.35)'}`,
                color: cloggingPercent > 60 ? '#ef4444' : '#fbbc04',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.02em'
              }}>
                {cloggingPercent}%
              </span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={cloggingPercent}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              console.log('[4clique Simulation] Slider Update:', { rainfall: rainfallMm, clogging: val });
              onCloggingChange(val);
            }}
            className="gmaps-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#80868b', marginTop: '3px' }}>
            <span>0% (Clean)</span>
            <span>50%</span>
            <span>100% (Blocked)</span>
          </div>
        </div>

        {/* Live Rain Sync Button */}
        <div>
          <button
            onClick={handleFetchBlockRain}
            disabled={isFetchingPointRain}
            className="gmaps-weather-btn"
          >
            {isFetchingPointRain ? (
              <Loader2 size={13} className="animate-spin" style={{ color: '#8ab4f8' }} />
            ) : (
              <RefreshCw size={13} style={{ color: '#8ab4f8' }} />
            )}
            <span>Fetch Live Rain at Block (Open-Meteo)</span>
          </button>
          {livePointNotice && (
            <div style={{ fontSize: '10px', color: '#81c995', marginTop: '4px' }}>
              {livePointNotice}
            </div>
          )}
        </div>

        {/* Demo Preset Button */}
        <button
          onClick={onTriggerPresetSurge}
          className="gmaps-demo-surge-btn"
          title="Set 145 mm/hr and 80% clogging"
        >
          <Zap size={14} style={{ color: '#ffac33' }} />
          <span>Preset: Extreme Cloudburst Surge (145 mm/h)</span>
        </button>

        {/* Primary AWS Simulation Button */}
        <div>
          <button
            onClick={onRunSimulation}
            disabled={isLoading}
            className="gmaps-primary-aws-btn"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>INVOKING AWS LAMBDA...</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Run 4clique AWS Hydrologic Simulation</span>
              </>
            )}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '10px', color: '#9aa0a6' }}>
            <span>Target: AWS Lambda Function URL</span>
            {lastSuccessTimestamp && (
              <span style={{ color: '#81c995' }}>
                200 OK • {latencyMs}ms ({lastSuccessTimestamp})
              </span>
            )}
          </div>

          {error && (
            <div style={{ marginTop: '5px', padding: '6px 8px', borderRadius: '4px', background: 'rgba(234, 67, 53, 0.15)', color: '#f28b82', fontSize: '10.5px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Critical Infrastructure in Block */}
        {simulationResult?.infrastructure && simulationResult.infrastructure.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#e8eaed', marginBottom: '4px' }}>
              Infrastructure Nodes in 1 km² Block:
            </div>
            {simulationResult.infrastructure.map(node => (
              <div key={node.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 0' }}>
                <span style={{ color: '#cbd5e1' }}>{node.name}</span>
                <span style={{ fontWeight: 700, color: node.status === 'FLOODED' ? '#ef4444' : '#10b981' }}>
                  {node.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
