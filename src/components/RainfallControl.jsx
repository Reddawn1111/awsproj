import React, { useState } from 'react';
import { CloudRain, Radio, RefreshCw, AlertCircle, CheckCircle2, Zap, Waves } from 'lucide-react';
import { fetchLiveBengaluruRain } from '../services/openMeteo';

export function RainfallControl({
  rainfallMm,
  onRainfallChange,
  onTriggerDemoSurge
}) {
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState(null);

  const handleFetchLiveRain = async () => {
    setIsFetchingLive(true);
    setLiveStatus(null);
    try {
      const data = await fetchLiveBengaluruRain();
      onRainfallChange(data.scenarioRainfallMm);

      if (data.scenarioRainfallMm === 0) {
        setLiveStatus({
          type: 'success',
          text: 'Open-Meteo: 0 mm/h. Drainage flowing normally (No Inundation).',
          time: data.timestamp
        });
      } else {
        setLiveStatus({
          type: 'success',
          text: `Open-Meteo: ${data.rawCurrentPrecipitationMm} mm/h (Extrapolated: ${data.scenarioRainfallMm} mm/h)`,
          time: data.timestamp
        });
      }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Prominent Quick-Test Demo Simulation Button */}
      {onTriggerDemoSurge && (
        <button
          onClick={onTriggerDemoSurge}
          className="gmaps-demo-surge-btn"
          title="Simulate 145 mm/hr cloudburst with 80% clogged Rajakaluves"
        >
          <Zap size={16} style={{ color: '#ffac33' }} />
          <span>Simulate Extreme Monsoon Surge (Demo)</span>
        </button>
      )}

      {/* Main Slider Section */}
      <div style={{ background: '#090e18', border: '1px solid #16233b', padding: '12px 14px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CloudRain size={15} style={{ color: '#8ab4f8' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em' }}>
              RAINFALL INTENSITY
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span className="font-mono" style={{ fontSize: '20px', fontWeight: 800, color: '#8ab4f8' }}>
              {rainfallMm}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>mm/hr</span>
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
          className="gmaps-slider"
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#80868b', marginTop: '6px' }}>
          <span>0 mm (Dry)</span>
          <span>75 mm (Heavy)</span>
          <span>145 mm (Surge)</span>
          <span>300 mm (Max)</span>
        </div>

        {/* Drainage / Inundation Condition Label */}
        <div style={{
          marginTop: '10px',
          padding: '6px 10px',
          borderRadius: '6px',
          background: rainfallMm === 0 ? 'rgba(52, 168, 83, 0.12)' : (rainfallMm <= 75 ? 'rgba(138, 180, 248, 0.1)' : 'rgba(234, 67, 53, 0.15)'),
          border: `1px solid ${rainfallMm === 0 ? '#34a85350' : (rainfallMm <= 75 ? '#8ab4f840' : '#ea433550')}`,
          fontSize: '11px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#9aa0a6', fontWeight: 600 }}>Drainage Condition:</span>
          <span style={{
            fontWeight: 700,
            color: rainfallMm === 0 ? '#81c995' : (rainfallMm <= 75 ? '#8ab4f8' : '#f28b82')
          }}>
            {rainfallMm === 0 ? 'Drainage flowing normally (No Inundation)' : (rainfallMm <= 75 ? 'Moderate Surface Runoff' : 'Extreme Surge / Depression Filling')}
          </span>
        </div>
      </div>

      {/* Live Bengaluru Rain Integration */}
      <div>
        <button
          onClick={handleFetchLiveRain}
          disabled={isFetchingLive}
          className="gmaps-weather-btn"
          title="Fetch live rainfall from Open-Meteo"
        >
          {isFetchingLive ? (
            <RefreshCw size={14} className="animate-spin" style={{ color: '#8ab4f8' }} />
          ) : (
            <Radio size={14} style={{ color: '#8ab4f8' }} />
          )}
          <span>{isFetchingLive ? 'CONNECTING OPEN-METEO...' : 'SYNC LIVE BENGALURU WEATHER'}</span>
        </button>

        {liveStatus && (
          <div style={{
            marginTop: '6px',
            padding: '6px 8px',
            borderRadius: '6px',
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
    </div>
  );
}
