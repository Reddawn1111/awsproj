import React from 'react';
import { Activity, ShieldAlert, Cpu, Terminal, Settings } from 'lucide-react';

export function Header({
  activeScenarioId,
  rainfallMm,
  awsStatus,
  latencyMs,
  onOpenDevToolsGuide,
  onOpenSettings
}) {
  return (
    <header className="command-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', zIndex: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px' }}>
        {/* Title & Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'rgba(0, 240, 255, 0.12)',
            border: '1px solid #00f0ff',
            color: '#00f0ff',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '14px',
            letterSpacing: '0.05em'
          }}>
            4C
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '0.08em', color: '#ffffff' }}>
                4CLIQUE
              </span>
              <span style={{ color: '#475569' }}>|</span>
              <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: '#94a3b8', textTransform: 'uppercase' }}>
                Urban Water Digital Twin
              </span>
              <span style={{
                background: '#0e1c2e',
                border: '1px solid #1e3a5f',
                color: '#38bdf8',
                fontSize: '10px',
                padding: '2px 6px',
                fontWeight: 700,
                letterSpacing: '0.06em'
              }}>
                TRACK: HEAT & WATER
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span>Target Corridor: <strong style={{ color: '#cbd5e1' }}>Bengaluru / Bellandur - Sarjapur - ORR</strong></span>
              <span>•</span>
              <span className="font-mono">Lat: 12.9352°N, Lng: 77.6805°E</span>
            </div>
          </div>
        </div>

        {/* Real-time System Status Telemetry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Active AWS Scenario Pill */}
          <div style={{
            background: '#090f1a',
            border: '1px solid #1c2b42',
            padding: '5px 10px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Cpu size={13} style={{ color: awsStatus === 'SUCCESS' ? '#10b981' : (awsStatus === 'RUNNING' ? '#f59e0b' : '#64748b') }} />
            <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>AWS LAMBDA:</span>
            <span className="font-mono" style={{
              fontWeight: 600,
              color: awsStatus === 'SUCCESS' ? '#34d399' : (awsStatus === 'RUNNING' ? '#fbbf24' : '#94a3b8')
            }}>
              {awsStatus === 'RUNNING' ? 'SIMULATING...' : (awsStatus === 'SUCCESS' ? `READY (${latencyMs}ms)` : 'STANDBY')}
            </span>
            {activeScenarioId && (
              <span className="font-mono" style={{ color: '#475569', fontSize: '10px' }}>
                [{activeScenarioId}]
              </span>
            )}
          </div>

          {/* Rainfall Badge */}
          <div style={{
            background: '#090f1a',
            border: '1px solid #1c2b42',
            padding: '5px 10px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 700 }}>RAIN:</span>
            <span className="font-mono" style={{ color: '#00f0ff', fontWeight: 700 }}>{rainfallMm} mm</span>
          </div>

          {/* DevTools Judging Guide Trigger */}
          <button
            onClick={onOpenDevToolsGuide}
            className="btn-secondary"
            title="Open browser Network tab judging proof guide"
            style={{ padding: '6px 10px' }}
          >
            <Terminal size={13} style={{ color: '#ff9900' }} />
            <span>DevTools Proof</span>
          </button>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="btn-secondary"
            title="Configure Mapbox Token or AWS Lambda URL"
            style={{ padding: '6px 8px' }}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
