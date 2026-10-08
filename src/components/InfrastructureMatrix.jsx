import React from 'react';
import { ShieldCheck, ShieldAlert, Building2, Zap, Hospital } from 'lucide-react';
import { CRITICAL_INFRASTRUCTURE } from '../config/infrastructure';

export function InfrastructureMatrix({ infrastructureStatus, onFocusNode }) {
  const getIcon = (id) => {
    switch (id) {
      case 'sakra_hospital':
        return Hospital;
      case 'bellandur_substation':
        return Zap;
      default:
        return Building2;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="panel-section-title">
        <Building2 size={13} style={{ color: '#00f0ff' }} />
        <span>Critical Infrastructure Vulnerability Matrix</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {CRITICAL_INFRASTRUCTURE.map((item) => {
          const status = infrastructureStatus?.[item.name] || 'OPERATIONAL';
          const isFlooded = status === 'FLOODED';
          const Icon = getIcon(item.id);

          return (
            <div
              key={item.id}
              onClick={() => onFocusNode?.(item.coordinates)}
              style={{
                background: isFlooded ? 'rgba(54, 11, 14, 0.5)' : 'rgba(6, 44, 28, 0.4)',
                border: `1px solid ${isFlooded ? '#ef444450' : '#10b98140'}`,
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Click to focus camera in 3D"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={14} style={{ color: isFlooded ? '#ef4444' : '#10b981' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#f1f5f9' }}>
                    {item.name}
                  </span>
                </div>

                <div style={{
                  padding: '2px 6px',
                  fontSize: '9px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  background: isFlooded ? '#ef4444' : '#10b981',
                  color: isFlooded ? '#ffffff' : '#041c10',
                  letterSpacing: '0.05em'
                }}>
                  {status}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8' }}>
                <span className="font-mono">Elevation: {item.elevation_m}m</span>
                <span className="font-mono" style={{ color: isFlooded ? '#f87171' : '#64748b' }}>
                  Breach: &ge;{item.criticalThresholdMm}mm
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
