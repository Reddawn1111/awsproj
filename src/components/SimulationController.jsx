import React, { useState } from 'react';
import {
  CloudRain,
  Sliders,
  Zap,
  Loader2,
  RefreshCw,
  ChevronDown,
  Activity,
  Waves,
  Building2,
  ShieldAlert,
  Info
} from 'lucide-react';
import { fetchLiveBengaluruRain } from '../services/openMeteo';

export function SimulationController({
  rainfallMm,
  onRainfallChange,
  cloggingPercent,
  onCloggingChange,
  onRunSimulation,
  onTriggerDemoSurge,
  isLoading,
  error,
  lastSuccessTimestamp,
  latencyMs,
  simulationData,
  infrastructureStatus,
  onFocusNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('CONTROLS');
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState(null);

  const handleFetchLiveWeather = async () => {
    setIsFetchingWeather(true);
    setWeatherNotice(null);
    try {
      const data = await fetchLiveBengaluruRain();
      onRainfallChange(data.scenarioRainfallMm);
      if (data.scenarioRainfallMm === 0) {
        setWeatherNotice({
          type: 'success',
          text: 'Open-Meteo: 0 mm/h. Drainage flowing normally (No Inundation).'
        });
      } else {
        setWeatherNotice({
          type: 'success',
          text: `Open-Meteo: ${data.rawCurrentPrecipitationMm} mm/h (Scenario: ${data.scenarioRainfallMm} mm/h)`
        });
      }
    } catch (err) {
      console.warn("Weather sync error:", err);
      setWeatherNotice({
        type: 'error',
        text: 'Live weather service unreachable. Use manual slider.'
      });
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const waterDepthMeters = simulationData?.water_depth_meters ?? 0;
  const severity = simulationData?.severity || 'SAFE';
  const severityLabel = simulationData?.severity_label || (rainfallMm === 0 ? 'Drainage flowing normally (No Inundation)' : 'Safe / Baseline');
  const severityColor = simulationData?.severity_color || '#34a853';

  if (isCollapsed) {
    return (
      <div
        onClick={() => setIsCollapsed(false)}
        className="gmaps-controller-collapsed-btn"
        title="Open Simulation Controller"
      >
        <Activity size={18} style={{ color: '#8ab4f8' }} />
        <span>4clique Hydrologic Twin</span>
        <div style={{
          padding: '2px 8px',
          borderRadius: '12px',
          background: severityColor + '25',
          color: severityColor,
          fontSize: '11px',
          fontWeight: 700
        }}>
          {waterDepthMeters > 0 ? `${waterDepthMeters}m Depth` : 'Dry / 0m'}
        </div>
      </div>
    );
  }

  return (
    <div className="gmaps-controller-card">
      {/* Header bar */}
      <div className="gmaps-controller-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Waves size={16} style={{ color: '#00b4d8' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#e8eaed', letterSpacing: '0.02em' }}>
            Hydrologic Drainage & Flood Simulation
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setIsCollapsed(true)}
            className="gmaps-icon-btn"
            title="Minimize controller"
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      {/* QUICK-TEST: DEMO SIMULATION BUTTON (Prominent) */}
      <div style={{ padding: '10px 14px 2px 14px' }}>
        <button
          onClick={onTriggerDemoSurge}
          disabled={isLoading}
          className="gmaps-demo-surge-btn"
          title="Simulate 145 mm/hr cloudburst with 80% clogged Rajakaluves"
        >
          <Zap size={16} style={{ color: '#ffac33' }} />
          <span>Simulate Extreme Monsoon Surge (Demo)</span>
        </button>
      </div>

      {/* Real-time Physical Water Depth Telemetry Banner */}
      <div style={{
        margin: '8px 14px 4px 14px',
        padding: '8px 12px',
        borderRadius: '8px',
        background: 'rgba(32, 38, 50, 0.75)',
        border: `1px solid ${severityColor}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '10px', color: '#9aa0a6', textTransform: 'uppercase', fontWeight: 600 }}>
            Street Water Depth
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '1px' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: severityColor }}>
              {waterDepthMeters > 0 ? `${waterDepthMeters} m` : '0.0 m'}
            </span>
            <span style={{ fontSize: '11px', color: '#9aa0a6' }}>
              {waterDepthMeters > 0 ? (waterDepthMeters >= 1.4 ? '(Submersion)' : '(Ponding)') : '(Dry)'}
            </span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: '#9aa0a6', textTransform: 'uppercase', fontWeight: 600 }}>
            Flow In / Out
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#e8eaed', marginTop: '2px' }}>
            {simulationData?.q_in_mm_hr ?? Math.round(rainfallMm * 0.85)} / {simulationData?.q_out_mm_hr ?? 12} mm/h
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: '12px',
            background: severityColor + '20',
            color: severityColor,
            fontSize: '10.5px',
            fontWeight: 700
          }}>
            {severityLabel}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="gmaps-tab-bar">
        <button
          onClick={() => setActiveTab('CONTROLS')}
          className={`gmaps-tab ${activeTab === 'CONTROLS' ? 'active' : ''}`}
        >
          Controls
        </button>
        <button
          onClick={() => setActiveTab('ANALYTICS')}
          className={`gmaps-tab ${activeTab === 'ANALYTICS' ? 'active' : ''}`}
        >
          Before vs After
        </button>
        <button
          onClick={() => setActiveTab('INFRA')}
          className={`gmaps-tab ${activeTab === 'INFRA' ? 'active' : ''}`}
        >
          Infrastructure ({Object.values(infrastructureStatus || {}).filter(s => s === 'FLOODED').length} Breached)
        </button>
      </div>

      {/* TAB 1: Controls */}
      {activeTab === 'CONTROLS' && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Rainfall Intensity Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#e8eaed' }}>
                <CloudRain size={15} style={{ color: '#8ab4f8' }} />
                <span>Storm Rainfall Rate</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#8ab4f8' }}>{rainfallMm}</span>
                <span style={{ fontSize: '11px', color: '#9aa0a6' }}>mm/hr</span>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="300"
              step="5"
              value={rainfallMm}
              onChange={(e) => onRainfallChange(parseInt(e.target.value, 10))}
              className="gmaps-slider"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#80868b', marginTop: '4px' }}>
              <span>0 mm (Dry)</span>
              <span>75 mm</span>
              <span>145 mm (Surge)</span>
              <span>300 mm (Max)</span>
            </div>
          </div>

          {/* Drainage Clogging Factor Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#e8eaed' }}>
                <Sliders size={15} style={{ color: '#fbbc04' }} />
                <span>Rajakaluve Siltation Clogging</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: cloggingPercent > 50 ? '#ea4335' : '#fbbc04' }}>
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
              onChange={(e) => onCloggingChange(parseInt(e.target.value, 10))}
              className="gmaps-slider"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#80868b', marginTop: '4px' }}>
              <span>0% (Clean / Free-flow)</span>
              <span>50% (Choked)</span>
              <span>100% (Fully Blocked)</span>
            </div>
          </div>

          {/* Live Open-Meteo Weather Sync Button */}
          <div>
            <button
              onClick={handleFetchLiveWeather}
              disabled={isFetchingWeather}
              className="gmaps-weather-btn"
              title="Fetch live rainfall from Open-Meteo Weather API"
            >
              {isFetchingWeather ? (
                <Loader2 size={14} className="animate-spin" style={{ color: '#8ab4f8' }} />
              ) : (
                <RefreshCw size={14} style={{ color: '#8ab4f8' }} />
              )}
              <span>Sync Live Bengaluru Weather (Open-Meteo)</span>
            </button>
            {weatherNotice && (
              <div style={{
                marginTop: '5px',
                fontSize: '11px',
                color: weatherNotice.type === 'success' ? '#81c995' : '#f28b82'
              }}>
                {weatherNotice.text}
              </div>
            )}
          </div>

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
                  <span>SIMULATING ON AWS LAMBDA...</span>
                </>
              ) : (
                <>
                  <Zap size={16} />
                  <span>Run 4clique AWS Hydrologic Simulation</span>
                </>
              )}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '10px', color: '#9aa0a6' }}>
              <span>Target: AWS Lambda Function URL</span>
              {lastSuccessTimestamp && (
                <span style={{ color: '#81c995' }}>
                  200 OK • {latencyMs}ms ({lastSuccessTimestamp})
                </span>
              )}
            </div>

            {error && (
              <div style={{
                marginTop: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(234, 67, 53, 0.15)',
                border: '1px solid rgba(234, 67, 53, 0.3)',
                color: '#f28b82',
                fontSize: '11px'
              }}>
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Before vs After Analytics */}
      {activeTab === 'ANALYTICS' && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: '#202634', padding: '10px', borderRadius: '8px', border: '1px solid #303b4d' }}>
              <div style={{ fontSize: '10px', color: '#9aa0a6', fontWeight: 600 }}>CURRENT STATE</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#e8eaed', marginTop: '2px' }}>
                {waterDepthMeters}m Depth
              </div>
              <div style={{ fontSize: '11px', color: '#80868b', marginTop: '2px' }}>
                {simulationData?.flooded_sqkm ?? 0} km² • {simulationData?.impacted_arterial_roads ?? 0} Roads
              </div>
            </div>

            <div style={{ background: '#202634', padding: '10px', borderRadius: '8px', border: '1px solid #303b4d' }}>
              <div style={{ fontSize: '10px', color: '#9aa0a6', fontWeight: 600 }}>UNMITIGATED (85% CLOG)</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#ea4335', marginTop: '2px' }}>
                {simulationData?.baseline?.water_depth_meters ?? 1.8}m Depth
              </div>
              <div style={{ fontSize: '11px', color: '#80868b', marginTop: '2px' }}>
                {simulationData?.baseline?.flooded_sqkm ?? 16.5} km² • {simulationData?.baseline?.impacted_arterial_roads ?? 22} Roads
              </div>
            </div>
          </div>

          {simulationData?.flood_reduction_percentage > 0 && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(52, 168, 83, 0.15)',
              border: '1px solid rgba(52, 168, 83, 0.3)',
              color: '#81c995',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Mitigation Inundation Reduction:</span>
              <strong style={{ fontSize: '14px' }}>+{simulationData.flood_reduction_percentage}%</strong>
            </div>
          )}

          <div style={{ fontSize: '11px', color: '#9aa0a6', lineHeight: 1.5 }}>
            Hydrologic Drainage Balance: <code>Q_in = Rain &times; 0.85</code>, <code>Q_out = Rajakaluves &times; (1 - Clogging)</code>. Street water level capped at 2.5m.
          </div>
        </div>
      )}

      {/* TAB 3: Infrastructure Matrix */}
      {activeTab === 'INFRA' && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
          {[
            { name: "Bellandur KPTCL Substation", elev: "882m", breachDepth: "0.5m", coords: [77.6748, 12.9322] },
            { name: "Ecospace ORR", elev: "884m", breachDepth: "1.1m", coords: [77.6834, 12.9260] },
            { name: "Sakra World Hospital", elev: "886m", breachDepth: "2.0m", coords: [77.6896, 12.9279] }
          ].map((item) => {
            const isFlooded = infrastructureStatus?.[item.name] === 'FLOODED';
            return (
              <div
                key={item.name}
                onClick={() => onFocusNode && onFocusNode(item.coords)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: isFlooded ? 'rgba(234, 67, 53, 0.12)' : 'rgba(32, 38, 50, 0.6)',
                  border: `1px solid ${isFlooded ? '#ea433540' : '#303b4d'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
                title="Click to fly to node"
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#e8eaed' }}>{item.name}</div>
                  <div style={{ fontSize: '10px', color: '#9aa0a6', marginTop: '2px' }}>
                    Elevation: {item.elev} • Breach Level: {item.breachDepth}
                  </div>
                </div>
                <div style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: 700,
                  background: isFlooded ? '#ea4335' : '#34a853',
                  color: '#ffffff'
                }}>
                  {isFlooded ? 'FLOODED' : 'OPERATIONAL'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
