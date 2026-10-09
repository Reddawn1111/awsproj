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
  Play,
  Pause,
  RotateCcw,
  Droplets,
  Calendar,
  Layers,
  MapPin,
  TrendingDown,
  Info,
  ChevronRight
} from 'lucide-react';
import { fetchPointRain } from '../services/openMeteo';

export function SimulationDrawer({
  isOpen,
  onClose,
  blockBounds,
  blockLabel,
  rainfallMm = 120,
  cloggingPercent = 70,
  elevationStats,
  onRunSimulation,
  onTriggerPresetSurge,
  isLoading,
  error,
  lastSuccessTimestamp,
  latencyMs,
  simulationResult,
  // Main Demo Preset Modal Opener (Centralized Parameters)
  onOpenDemoPreset = null,
  // Dynamic Area-Specific RWH Data & Modal Trigger
  rwhStats = null,
  onOpenRWH = null,
  // 24-Hour Time-Stepped Simulation Sequence Controls
  sim24Sequence = null,
  currentSimHour = 0,
  onSimHourChange = null,
  is24SimActive = false,
  is24SimPlaying = false,
  onToggle24SimPlay = null,
  onReset24Sim = null,
  onStart24Simulation = null
}) {
  const [isFetchingPointRain, setIsFetchingPointRain] = useState(false);
  const [livePointNotice, setLivePointNotice] = useState(null);

  if (!isOpen) return null;

  // Real-time hydrologic metrics
  const active24Step = (is24SimActive && sim24Sequence?.steps?.[currentSimHour])
    ? sim24Sequence.steps[currentSimHour]
    : null;

  const currentDisplayRain = active24Step ? active24Step.rainfallMm : rainfallMm;
  const peakDepthM = active24Step
    ? active24Step.peakWaterDepthM
    : (elevationStats?.floodRise !== undefined
        ? Number(elevationStats.floodRise.toFixed(2))
        : (simulationResult?.peak_water_depth_m !== undefined ? simulationResult.peak_water_depth_m : 0.45));

  const floodFraction = active24Step
    ? active24Step.floodFraction
    : (simulationResult?.flood_fraction ?? (rainfallMm > 0 ? Math.min(0.85, (peakDepthM / 2.2) * 0.75) : 0));

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
  } else if (peakDepthM > 0.02) {
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
        width: '390px',
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 50,
        pointerEvents: 'auto',
        background: 'rgba(19, 24, 34, 0.95)',
        backdropFilter: 'blur(16px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 25px rgba(0, 240, 255, 0.1)',
        overflow: 'hidden'
      }}
    >
      {/* Drawer Header */}
      <div className="gmaps-drawer-header" style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(90deg, rgba(0, 240, 255, 0.06), transparent)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 8px #00f0ff' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#e8eaed', letterSpacing: '0.02em' }}>
              1 km² Simulation Block
            </div>
            <div style={{ fontSize: '10.5px', color: '#8ab4f8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
              {blockLabel || 'Extracted Zone'}
            </div>
          </div>
        </div>

        <button onClick={onClose} className="gmaps-icon-btn" title="Exit Simulation Block">
          <X size={17} />
        </button>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
        
        {/* Real-time Inundation Telemetry Result Card */}
        <div style={{
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'rgba(24, 28, 38, 0.9)',
          border: `1px solid ${tierColor}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '10px', color: '#9aa0a6', textTransform: 'uppercase', fontWeight: 600 }}>
              {is24SimActive ? `Hour ${currentSimHour}:00 Depth` : 'Peak Inundation'}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginTop: '1px' }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: tierColor }}>
                {peakDepthM > 0 ? `${peakDepthM} m` : '0.0 m'}
              </span>
              <span style={{ fontSize: '11px', color: '#9aa0a6' }}>
                {tierLabel}
              </span>
            </div>
            {elevationStats && (
              <div style={{ fontSize: '9.5px', color: '#8ab4f8', marginTop: '2px' }}>
                Base Elevation: {elevationStats.minElevation.toFixed(1)}m • Surface: {elevationStats.waterSurfaceElevation.toFixed(1)}m
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#9aa0a6', textTransform: 'uppercase', fontWeight: 600 }}>
              Flooded Area
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e8eaed', marginTop: '2px' }}>
              {Math.round(floodFraction * 100)}% ({simulationResult?.flooded_sqkm ?? (floodFraction * 1.0).toFixed(2)} km²)
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. "SIMULATE DEMO" & 24-HOUR TIME-STEPPED GRID SIMULATION CONTROLLER
            ========================================================================= */}
        <div className="sim24-timeline-box">
          <div className="sim24-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={13} style={{ color: '#00f0ff' }} />
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#e2e8f0' }}>
                24-Hour Timeline Simulation
              </span>
            </div>

            <div className="sim24-hour-badge">
              Hour {String(currentSimHour).padStart(2, '0')}:00 / 24:00
            </div>
          </div>

          {/* Timeline Playback Controls & Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div className="sim24-controls-row">
              <button
                type="button"
                onClick={onToggle24SimPlay}
                className="sim24-play-btn"
                title={is24SimPlaying ? "Pause 24h Playback" : "Play 24-Hour Sequence"}
              >
                {is24SimPlaying ? <Pause size={12} fill="#05080c" /> : <Play size={12} fill="#05080c" />}
                <span>{is24SimPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                type="button"
                onClick={onReset24Sim}
                className="sim24-btn"
                title="Reset simulation to Hour 0 (0h baseline)"
              >
                <RotateCcw size={12} />
                <span>Reset (0h)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onStart24Simulation}
              className="sim24-btn"
              style={{ background: 'rgba(0, 240, 255, 0.12)', borderColor: 'rgba(0, 240, 255, 0.35)', color: '#00f0ff' }}
              title="Initialize dynamic 24-hour hydrologic runoff loop"
            >
              <Zap size={12} />
              <span>Simulate Demo</span>
            </button>
          </div>

          {/* Scrubbable 0h to 24h Slider */}
          <div>
            <input
              type="range"
              min="0"
              max="24"
              step="1"
              value={currentSimHour}
              onChange={(e) => {
                if (onSimHourChange) onSimHourChange(Number(e.target.value));
              }}
              className="sim24-slider"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
              <span>0h (Dry)</span>
              <span>6h (Squall)</span>
              <span>8h (Peak)</span>
              <span>16h (Recede)</span>
              <span>24h (Clear)</span>
            </div>
          </div>

          {/* Step Telemetry Row */}
          {active24Step && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              padding: '6px 8px',
              borderRadius: '6px',
              background: 'rgba(0, 0, 0, 0.25)',
              fontSize: '10px'
            }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Rainfall:</span>{' '}
                <strong style={{ color: '#38bdf8' }}>{active24Step.rainfallMm} mm/h</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Runoff Bal:</span>{' '}
                <strong style={{ color: active24Step.netRunoffBalanceMmHr > 0 ? '#ef4444' : '#10b981' }}>
                  {active24Step.netRunoffBalanceMmHr > 0 ? `+${active24Step.netRunoffBalanceMmHr}` : active24Step.netRunoffBalanceMmHr}
                </strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#94a3b8' }}>Risk Bldgs:</span>{' '}
                <strong style={{ color: active24Step.affectedBuildings > 10 ? '#ef4444' : '#f59e0b' }}>
                  {active24Step.affectedBuildings}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            4. CONSOLIDATED SIMULATION PARAMETERS (Sliders consolidated into Demo Preset)
            Eliminating duplicate slider UI clutter from bottom-right overlay drawer
            ========================================================================= */}
        <div style={{
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>
              <Sliders size={13} style={{ color: '#f59e0b' }} />
              <span>Simulation Parameters</span>
            </div>
            
            {onOpenDemoPreset && (
              <button
                type="button"
                onClick={onOpenDemoPreset}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00f0ff',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: 0
                }}
              >
                <span>Configure Preset</span>
                <ChevronRight size={12} />
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{
              padding: '7px 9px',
              borderRadius: '7px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)'
            }}>
              <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>Peak Rain Intensity</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                {rainfallMm} <span style={{ fontSize: '10px', fontWeight: 500 }}>mm/hr</span>
              </div>
            </div>

            <div style={{
              padding: '7px 9px',
              borderRadius: '7px',
              background: cloggingPercent > 60 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${cloggingPercent > 60 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`
            }}>
              <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>Drainage Clogging</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: cloggingPercent > 60 ? '#ef4444' : '#f59e0b', marginTop: '2px' }}>
                {cloggingPercent}% <span style={{ fontSize: '10px', fontWeight: 500 }}>(Siltation)</span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            5. AREA-SPECIFIC RAINWATER HARVESTING (RWH) BREAKDOWN
            Dynamic per selected block (cell-specific rooftop area & standard hydrology)
            ========================================================================= */}
        {rwhStats && (
          <div className="rwh-breakdown-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Droplets size={14} style={{ color: '#00f0ff' }} />
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#f1f5f9' }}>
                  Block Rainwater Harvesting (RWH)
                </span>
              </div>

              {onOpenRWH && (
                <button
                  type="button"
                  onClick={onOpenRWH}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#00f0ff',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: 0
                  }}
                >
                  <span>Full RWH Engine</span>
                  <ChevronRight size={12} />
                </button>
              )}
            </div>

            <div className="rwh-stat-grid">
              <div className="rwh-stat-box">
                <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase' }}>Terrace Coverage</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#00f0ff', marginTop: '1px' }}>
                  {rwhStats.terraceAreaM2?.toLocaleString()} m²
                </div>
                <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                  {rwhStats.terraceCoveragePercent}% of block • {rwhStats.isExplicitFootprint ? 'Footprints' : 'Zoned Model'}
                </div>
              </div>

              <div className="rwh-stat-box">
                <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase' }}>Collectable Water</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#10b981', marginTop: '1px' }}>
                  {rwhStats.harvestableKL?.toLocaleString()} kL
                </div>
                <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                  {rwhStats.harvestableLiters?.toLocaleString()} Liters
                </div>
              </div>
            </div>

            <div style={{
              padding: '6px 8px',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              fontSize: '10.5px',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Non-Potable Supply Potential:</span>
              <strong style={{ color: '#10b981' }}>
                ~{rwhStats.daysNonPotableSupply} Days
              </strong>
            </div>
          </div>
        )}

        {/* Primary AWS Hydrologic Simulation Trigger Button */}
        <div>
          <button
            onClick={onRunSimulation}
            disabled={isLoading}
            className="gmaps-primary-aws-btn"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>INVOKING AWS LAMBDA...</span>
              </>
            ) : (
              <>
                <Zap size={15} />
                <span>Run 4clique AWS Simulation</span>
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
