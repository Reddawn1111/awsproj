import React, { useState } from 'react';
import { CloudRain, Radio, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { fetchLiveBengaluruRain } from '../services/openMeteo';

export function RainfallControl({ rainfallMm, onRainfallChange }) {
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState(null); // { type: 'success'|'error', text: '', time: '' }

  const handleFetchLiveRain = async () => {
    setIsFetchingLive(true);
    setLiveStatus(null);
    try {
      const data = await fetchLiveBengaluruRain();
      onRainfallChange(data.scenarioRainfallMm);
      setLiveStatus({
        type: 'success',
        text: `Open-Meteo Live: ${data.rawCurrentPrecipitationMm} mm/h (Scenario: ${data.scenarioRainfallMm} mm)`,
        time: data.timestamp
      });
    } catch (err) {
      console.warn("Failed to fetch live rain from Open-Meteo:", err);
      setLiveStatus({
        type: 'error',
        text: `Live sync failed: ${err.message}. Using manual slider.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } finally {
      setIsFetchingLive(false);
    }
  };

  const handlePreset = (val) => {
    onRainfallChange(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="panel-section-title">
        <CloudRain size={13} style={{ color: '#00f0ff' }} />
        <span>Rainfall Intensity Control</span>
      </div>

      {/* Main Slider Section */}
      <div style={{ background: '#090e18', border: '1px solid #16233b', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em' }}>
            PRECIPITATION DEPTH
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span className="font-mono" style={{ fontSize: '22px', fontWeight: 800, color: '#00f0ff' }}>
              {rainfallMm}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>mm</span>
          </div>
        </div>

        {/* Range Slider */}
        <input
          type="range"
          min="0"
          max="300"
          step="5"
          value={rainfallMm}
          onChange={(e) => onRainfallChange(parseInt(e.target.value, 10))}
          style={{ width: '100%', cursor: 'pointer' }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569', marginTop: '6px' }} className="font-mono">
          <span>0 mm (Dry)</span>
          <span>100 mm</span>
          <span>180 mm (Deluge)</span>
          <span>300 mm (Max)</span>
        </div>

        {/* Storm Intensity Category Tag */}
        <div style={{
          marginTop: '10px',
          padding: '4px 8px',
          background: rainfallMm < 50 ? 'rgba(0, 240, 255, 0.08)' : (rainfallMm <= 150 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.12)'),
          border: `1px solid ${rainfallMm < 50 ? '#00f0ff40' : (rainfallMm <= 150 ? '#f59e0b40' : '#ef444450')}`,
          fontSize: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>Category:</span>
          <span className="font-mono" style={{
            fontWeight: 700,
            color: rainfallMm < 50 ? '#38bdf8' : (rainfallMm <= 150 ? '#fbbf24' : '#f87171')
          }}>
            {rainfallMm === 0 ? 'DRY WEATHER' : (rainfallMm < 50 ? 'LIGHT / MODERATE SHOWER' : (rainfallMm <= 150 ? 'HEAVY MONSOON STORM' : 'EXTREME CLOUDBURST DELUGE'))}
          </span>
        </div>
      </div>

      {/* Live Bengaluru Rain Integration */}
      <div>
        <button
          onClick={handleFetchLiveRain}
          disabled={isFetchingLive}
          className="btn-secondary"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '9px 12px',
            borderColor: '#2b3f63',
            background: '#0d1726'
          }}
        >
          {isFetchingLive ? (
            <RefreshCw size={13} className="animate-spin" style={{ color: '#00f0ff' }} />
          ) : (
            <Radio size={13} style={{ color: '#00f0ff' }} />
          )}
          <span style={{ color: '#e2e8f0', letterSpacing: '0.04em' }}>
            {isFetchingLive ? 'CONNECTING OPEN-METEO...' : 'FETCH LIVE BENGALURU RAIN'}
          </span>
        </button>

        {/* Live Weather Status Indicator */}
        {liveStatus && (
          <div style={{
            marginTop: '6px',
            padding: '6px 8px',
            fontSize: '10px',
            background: liveStatus.type === 'success' ? '#062017' : '#260b0e',
            border: `1px solid ${liveStatus.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: liveStatus.type === 'success' ? '#34d399' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {liveStatus.type === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            <span style={{ flex: 1 }}>{liveStatus.text}</span>
            <span className="font-mono" style={{ color: '#64748b' }}>{liveStatus.time}</span>
          </div>
        )}
      </div>

      {/* Reference Scenario Presets */}
      <div>
        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '6px' }}>
          HISTORICAL / DESIGN BENCHMARKS:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          <button
            onClick={() => handlePreset(65)}
            className="btn-secondary font-mono"
            style={{ padding: '4px 6px', fontSize: '10px', justifyContent: 'center' }}
            title="Substation threshold breach"
          >
            65 mm (KPTCL)
          </button>
          <button
            onClick={() => handlePreset(110)}
            className="btn-secondary font-mono"
            style={{ padding: '4px 6px', fontSize: '10px', justifyContent: 'center' }}
            title="Ecospace ORR breach"
          >
            110 mm (ORR)
          </button>
          <button
            onClick={() => handlePreset(180)}
            className="btn-secondary font-mono"
            style={{ padding: '4px 6px', fontSize: '10px', justifyContent: 'center', borderColor: '#38bdf8' }}
            title="Bengaluru 2022 Deluge benchmark"
          >
            180 mm (2022)
          </button>
        </div>
      </div>
    </div>
  );
}
