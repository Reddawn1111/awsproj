import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Map3D } from './components/Map3D';
import { RainfallControl } from './components/RainfallControl';
import { InterventionSelector } from './components/InterventionSelector';
import { PrimaryAWSButton } from './components/PrimaryAWSButton';
import { BeforeAfterPanel } from './components/BeforeAfterPanel';
import { InfrastructureMatrix } from './components/InfrastructureMatrix';
import { DevToolsGuideModal } from './components/DevToolsGuideModal';
import { SettingsModal } from './components/SettingsModal';
import { runAwsHydrologicSimulation } from './services/awsSimulation';
import { Info, Database, Compass, Droplet } from 'lucide-react';

export function App() {
  // Scenario state
  const [rainfallMm, setRainfallMm] = useState(180);
  const [intervention, setIntervention] = useState('BASELINE');

  // Simulation execution state
  const [isLoading, setIsLoading] = useState(false);
  const [awsStatus, setAwsStatus] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'SUCCESS' | 'ERROR'
  const [simulationData, setSimulationData] = useState(null);
  const [infrastructureStatus, setInfrastructureStatus] = useState({
    "Sakra World Hospital": "OPERATIONAL",
    "Bellandur KPTCL Substation": "FLOODED",
    "Ecospace ORR": "OPERATIONAL"
  });
  const [lastSuccessTimestamp, setLastSuccessTimestamp] = useState(null);
  const [latencyMs, setLatencyMs] = useState(0);
  const [error, setError] = useState(null);

  // Map & Navigation state
  const [focusCoords, setFocusCoords] = useState(null);

  // Configuration & Overrides
  const [mapboxToken, setMapboxToken] = useState(() => {
    return localStorage.getItem('4clique_mapbox_token') || import.meta.env.VITE_MAPBOX_TOKEN || '';
  });
  const [awsLambdaUrl, setAwsLambdaUrl] = useState(() => {
    return localStorage.getItem('4clique_lambda_url') || import.meta.env.VITE_AWS_LAMBDA_URL || 'http://127.0.0.1:8000';
  });

  // Modal controls
  const [isDevToolsModalOpen, setIsDevToolsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Initial trigger on mount to calibrate initial twin state
  useEffect(() => {
    handleRunSimulation();
  }, []);

  const handleRunSimulation = async () => {
    setIsLoading(true);
    setAwsStatus('RUNNING');
    setError(null);

    try {
      const result = await runAwsHydrologicSimulation(rainfallMm, intervention, awsLambdaUrl);
      setSimulationData(result);
      if (result.infrastructure_status) {
        setInfrastructureStatus(result.infrastructure_status);
      }
      setLatencyMs(result.latencyMs);
      setLastSuccessTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setAwsStatus('SUCCESS');
    } catch (err) {
      console.error("Hydrologic Twin Simulation Failed:", err);
      setError(err.message);
      setAwsStatus('ERROR');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMapboxToken = (token) => {
    setMapboxToken(token);
    localStorage.setItem('4clique_mapbox_token', token);
  };

  const handleSaveAwsLambdaUrl = (url) => {
    setAwsLambdaUrl(url);
    localStorage.setItem('4clique_lambda_url', url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--bg-primary)' }}>
      {/* Top Telemetry Header */}
      <Header
        activeScenarioId={simulationData?.scenario_id}
        rainfallMm={rainfallMm}
        awsStatus={awsStatus}
        latencyMs={latencyMs}
        onOpenDevToolsGuide={() => setIsDevToolsModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* LEFT COLUMN: Input Parameters & AWS Invocation */}
        <div style={{
          width: '350px',
          height: '100%',
          overflowY: 'auto',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '12px',
          background: 'rgba(8, 12, 20, 0.92)',
          borderRight: '1px solid #1a273e',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Rainfall Intensity */}
          <div className="command-panel" style={{ padding: '12px' }}>
            <RainfallControl
              rainfallMm={rainfallMm}
              onRainfallChange={setRainfallMm}
            />
          </div>

          {/* Intervention Selector */}
          <div className="command-panel" style={{ padding: '12px' }}>
            <InterventionSelector
              activeIntervention={intervention}
              onSelectIntervention={setIntervention}
            />
          </div>

          {/* Primary AWS Execution Button */}
          <div className="command-panel" style={{ padding: '12px' }}>
            <PrimaryAWSButton
              onRunSimulation={handleRunSimulation}
              isLoading={isLoading}
              error={error}
              lastSuccessTimestamp={lastSuccessTimestamp}
              latencyMs={latencyMs}
              scenarioId={simulationData?.scenario_id}
            />
          </div>

          {/* Digital Twin Model Reference Note */}
          <div style={{ padding: '8px 10px', background: '#070c14', border: '1px solid #142034', fontSize: '10px', color: '#64748b', lineHeight: 1.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontWeight: 700, marginBottom: '2px' }}>
              <Info size={12} style={{ color: '#00f0ff' }} />
              <span>Scientific & Hydrologic Notice:</span>
            </div>
            Scenario-based decision support prototype calibrated to Bellandur-ORR basin hypsometry, 80% urban imperviousness, and stormwater channel conveyance.
          </div>
        </div>

        {/* CENTER COLUMN: 3D Map Diorama */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <Map3D
            mapboxToken={mapboxToken}
            simulationData={simulationData}
            infrastructureStatus={infrastructureStatus}
            focusCoords={focusCoords}
          />
        </div>

        {/* RIGHT COLUMN: Analytical Metrics & Infrastructure Impact */}
        <div style={{
          width: '360px',
          height: '100%',
          overflowY: 'auto',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '12px',
          background: 'rgba(8, 12, 20, 0.92)',
          borderLeft: '1px solid #1a273e',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Before vs After Analytical Panel */}
          <div className="command-panel" style={{ padding: '12px' }}>
            <BeforeAfterPanel
              simulationData={simulationData}
              activeIntervention={intervention}
            />
          </div>

          {/* Infrastructure Matrix */}
          <div className="command-panel" style={{ padding: '12px' }}>
            <InfrastructureMatrix
              infrastructureStatus={infrastructureStatus}
              onFocusNode={(coords) => setFocusCoords(coords)}
            />
          </div>

          {/* Hydrologic Catchment Telemetry */}
          {simulationData?.hydrologic_metrics && (
            <div className="command-panel" style={{ padding: '12px' }}>
              <div className="panel-section-title">
                <Database size={13} style={{ color: '#00f0ff' }} />
                <span>Hydrologic Balance Telemetry</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Catchment Basin Area:</span>
                  <span className="font-mono" style={{ color: '#f1f5f9' }}>
                    {simulationData.hydrologic_metrics.catchment_area_sqkm} km²
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Impervious Surface:</span>
                  <span className="font-mono" style={{ color: '#f1f5f9' }}>
                    {(simulationData.hydrologic_metrics.impervious_fraction * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Gross Storm Runoff:</span>
                  <span className="font-mono" style={{ color: '#f1f5f9' }}>
                    {Number(simulationData.hydrologic_metrics.gross_runoff_m3).toLocaleString()} m³
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Net Surface Ponding:</span>
                  <span className="font-mono" style={{ color: '#f87171' }}>
                    {Number(simulationData.hydrologic_metrics.net_accumulated_volume_m3).toLocaleString()} m³
                  </span>
                </div>
                {simulationData.hydrologic_metrics.volume_averted_m3 > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399', paddingTop: '4px', borderTop: '1px solid #1e2c45' }}>
                    <span>Stormwater Averted:</span>
                    <span className="font-mono" style={{ fontWeight: 700 }}>
                      +{Number(simulationData.hydrologic_metrics.volume_averted_m3).toLocaleString()} m³
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DevTools Judging Guide Modal */}
      <DevToolsGuideModal
        isOpen={isDevToolsModalOpen}
        onClose={() => setIsDevToolsModalOpen(false)}
        currentEndpoint={awsLambdaUrl}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        mapboxToken={mapboxToken}
        onSaveMapboxToken={handleSaveMapboxToken}
        awsLambdaUrl={awsLambdaUrl}
        onSaveAwsLambdaUrl={handleSaveAwsLambdaUrl}
      />
    </div>
  );
}
