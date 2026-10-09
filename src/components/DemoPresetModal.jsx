import React, { useState, useEffect } from 'react';
import { X, Play, Sliders, CloudRain, Zap, ShieldAlert, Waves, Check, Activity } from 'lucide-react';

export function DemoPresetModal({
  isOpen,
  onClose,
  currentRainfall = 120,
  currentClogging = 70,
  onApplyPreset
}) {
  const [clogging, setClogging] = useState(currentClogging || 70);
  const [rainfall, setRainfall] = useState(currentRainfall || 120);
  const [scenarioName, setScenarioName] = useState('Monsoon Peak Scenario');

  useEffect(() => {
    setClogging(currentClogging || 70);
  }, [currentClogging]);

  useEffect(() => {
    setRainfall(currentRainfall || 120);
  }, [currentRainfall]);

  if (!isOpen) return null;

  // Real-time Hydrology Physics Calculations:
  // Runoff = (Rainfall * Runoff_Coefficient) - (Drain_Capacity * (1 - Clogging_Rate))
  const runoffCoeff = 0.85;
  const drainCapacity = 30.0; // mm/h baseline
  const qIn = Number((rainfall * runoffCoeff).toFixed(1));
  const qOut = Number((drainCapacity * Math.max(0.05, 1 - (clogging / 100) * 0.95)).toFixed(1));
  const netRunoff = Number((qIn - qOut).toFixed(1));
  const estimatedPeakDepth = Number(Math.min(2.4, Math.max(0, netRunoff * 0.018)).toFixed(2));
  const estimatedVelocityMs = Number(Math.min(3.5, 0.4 + (rainfall / 150) * 2.2 * (1 - (clogging / 100) * 0.4)).toFixed(1));

  const handleApply = () => {
    if (onApplyPreset) {
      onApplyPreset({
        rainfallMm: rainfall,
        cloggingPercent: clogging,
        scenarioName
      });
    }
    onClose();
  };

  return (
    <div className="gmaps-modal-backdrop" onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 14, 0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '16px'
    }}>
      <div 
        className="gmaps-modal-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(19, 24, 34, 0.96)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 172, 51, 0.28)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65), 0 0 25px rgba(255, 172, 51, 0.15)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(90deg, rgba(255, 172, 51, 0.08), transparent)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 172, 51, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffac33'
            }}>
              <Zap size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
                Simulation Parameters & Demo Presets
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                Central hydrologic control engine for storm intensity & rajakaluve siltation
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Quick Scenario Pills */}
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              Select Scenario Preset
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { name: 'Monsoon Peak Scenario', rain: 120, clog: 70 },
                { name: 'Cloudburst Surge', rain: 145, clog: 85 },
                { name: 'Extreme 100-Yr Storm', rain: 180, clog: 95 },
                { name: 'Moderate Monsoon', rain: 45, clog: 35 }
              ].map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setScenarioName(p.name);
                    setRainfall(p.rain);
                    setClogging(p.clog);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '20px',
                    border: `1px solid ${scenarioName === p.name ? '#ffac33' : 'rgba(255, 255, 255, 0.1)'}`,
                    background: scenarioName === p.name ? 'rgba(255, 172, 51, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    color: scenarioName === p.name ? '#ffac33' : '#94a3b8',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Slider 1: Precipitation Intensity */}
          <div style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                <CloudRain size={15} style={{ color: '#38bdf8' }} />
                <span>Rainfall Intensity (mm/hr)</span>
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: 800,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                {rainfall} mm/hr
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="5"
              value={rainfall}
              onChange={(e) => {
                setRainfall(Number(e.target.value));
                setScenarioName('Custom Settings');
              }}
              style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              <span>0 mm (Dry)</span>
              <span>45 mm (Moderate)</span>
              <span>120 mm (Peak)</span>
              <span>250 mm (Extreme)</span>
            </div>
          </div>

          {/* Slider 2: Drainage Siltation / Clogging Level */}
          <div style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                <Sliders size={15} style={{ color: '#f59e0b' }} />
                <span>Drainage Siltation / Clogging (%)</span>
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: 800,
                color: clogging > 60 ? '#ef4444' : '#f59e0b',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                {clogging}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={clogging}
              onChange={(e) => {
                setClogging(Number(e.target.value));
                setScenarioName('Custom Settings');
              }}
              style={{ width: '100%', accentColor: clogging > 60 ? '#ef4444' : '#f59e0b', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              <span>0% (Clean / Free Flow)</span>
              <span>50% (Silted)</span>
              <span>100% (Completely Choked)</span>
            </div>
          </div>

          {/* Real-time Physics Balance Card */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div>
              <div style={{ fontSize: '9.5px', color: '#94a3b8', textTransform: 'uppercase' }}>Inflow Q_in</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                {qIn} mm/h
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9.5px', color: '#94a3b8', textTransform: 'uppercase' }}>Outflow Q_out</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                {qOut} mm/h
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9.5px', color: '#94a3b8', textTransform: 'uppercase' }}>Est. Flood Depth</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: estimatedPeakDepth >= 0.6 ? '#ef4444' : (estimatedPeakDepth > 0 ? '#f59e0b' : '#10b981'), marginTop: '2px' }}>
                {estimatedPeakDepth} m
              </div>
            </div>
          </div>

          {/* Hydrologic Balance Formula Note */}
          <div style={{ fontSize: '10.5px', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
            <code>Runoff = (Rainfall × 0.85) - (Drain_Capacity × (1 - Clogging_Rate))</code>
          </div>

          {/* Apply & Simulate Button */}
          <button
            type="button"
            onClick={handleApply}
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ffac33 0%, #ea580c 100%)',
              border: 'none',
              color: '#05080c',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(255, 172, 51, 0.35)'
            }}
          >
            <Play size={16} fill="#05080c" />
            <span>APPLY & INITIALIZE 24-HOUR SIMULATION</span>
          </button>
        </div>
      </div>
    </div>
  );
}
