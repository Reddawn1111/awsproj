import React, { useState } from 'react';
import { Activity, CloudRain, AlertTriangle, ChevronDown, ChevronUp, MapPin, ExternalLink } from 'lucide-react';

export function LiveStatusPill({
  liveSummary,
  hotspots = [],
  onFlyToHotspot,
  onOpenSettings,
  onOpenDevTools
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const maxRain = liveSummary?.max_rain_mm_hr ?? 0.0;
  const atRiskCount = liveSummary?.hotspots_at_risk ?? 0;
  const statusLabel = liveSummary?.status_label || (maxRain === 0 ? "Drainage flowing normally (No Inundation)" : "Assessing city...");

  const isDry = maxRain === 0 || atRiskCount === 0;

  return (
    <div className="gmaps-top-status-container">
      <div className="gmaps-top-telemetry-pill">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '5px',
            background: '#8ab4f8',
            color: '#202124',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '11px'
          }}>
            4C
          </div>
          <span style={{ fontWeight: 700, fontSize: '12.5px', color: '#e8eaed', letterSpacing: '0.04em' }}>
            4CLIQUE
          </span>
          <span style={{ color: '#5f6368' }}>|</span>
          <span style={{ fontSize: '11px', color: '#9aa0a6' }}>
            Bengaluru Live
          </span>
        </div>

        <div style={{ width: '1px', height: '14px', background: '#3c4043' }} />

        {/* Live Status Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: isDry ? '#10b981' : '#f59e0b',
            boxShadow: `0 0 8px ${isDry ? '#10b981' : '#f59e0b'}`
          }} />
          <span style={{ fontWeight: 600, color: isDry ? '#81c995' : '#fbbc04' }}>
            {statusLabel}
          </span>
        </div>

        {atRiskCount > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#8ab4f8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 0
            }}
            title="View hotspots at risk"
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}

        <div style={{ width: '1px', height: '14px', background: '#3c4043' }} />

        {/* DevTools & Settings buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={onOpenDevTools}
            className="gmaps-pill-btn"
            title="Inspect AWS Function URL DevTools"
          >
            DevTools
          </button>
          <button
            onClick={onOpenSettings}
            className="gmaps-pill-btn"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Expanded At-Risk Hotspots Dropdown */}
      {isExpanded && atRiskCount > 0 && (
        <div className="gmaps-hotspots-dropdown">
          <div style={{ fontSize: '10.5px', color: '#9aa0a6', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
            Bengaluru Hotspots with Inundation Risk:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
            {hotspots
              .filter(h => h.tier === 'MODERATE' || h.tier === 'SEVERE')
              .map(h => (
                <div
                  key={h.id}
                  onClick={() => {
                    onFlyToHotspot(h.coords);
                    setIsExpanded(false);
                  }}
                  className="gmaps-hotspot-item"
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#e8eaed', fontSize: '12px' }}>{h.name}</div>
                    <div style={{ fontSize: '10px', color: '#9aa0a6' }}>{h.zone} • {h.rain_mm_hr} mm/h rain</div>
                  </div>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '10px',
                    background: h.tier === 'SEVERE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: h.tier === 'SEVERE' ? '#ef4444' : '#f59e0b'
                  }}>
                    {h.tier} ({h.depth_meters}m)
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
