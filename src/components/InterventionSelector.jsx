import React from 'react';
import { Sliders, Wrench, Droplets, AlertTriangle } from 'lucide-react';

export const INTERVENTIONS = [
  {
    id: "BASELINE",
    title: "Clogged Rajakaluves",
    subtext: "Baseline unmitigated drainage network. Heavy silt accumulation & encroached storm channels restricting conveyance to 120,000 m³/hr.",
    badge: "BASELINE SCENARIO",
    badgeColor: "#ef4444",
    icon: AlertTriangle
  },
  {
    id: "DESILT_RAJAKALUVES",
    title: "Rajakaluve Desilting (+35% conveyance)",
    subtext: "Systematic deep desilting of Bellandur-Varthur primary rajakaluves. Boosts channel conveyance from 120,000 to 162,000 m³/hr.",
    badge: "+35% HYDRAULIC CAPACITY",
    badgeColor: "#00f0ff",
    icon: Wrench
  },
  {
    id: "RETENTION_BASIN",
    title: "Install 15,000 m³ Retention Basin",
    subtext: "Construct engineered detention buffer upstream of Ecospace tech corridor to absorb peak surge before reaching ORR bottleneck.",
    badge: "15,000 m³ BUFFER STORAGE",
    badgeColor: "#10b981",
    icon: Droplets
  }
];

export function InterventionSelector({ activeIntervention, onSelectIntervention }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="panel-section-title">
        <Sliders size={13} style={{ color: '#00f0ff' }} />
        <span>Mitigation Intervention Selector</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {INTERVENTIONS.map((item) => {
          const isSelected = activeIntervention === item.id;
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              onClick={() => onSelectIntervention(item.id)}
              className={`intervention-card ${isSelected ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={14} style={{ color: isSelected ? item.badgeColor : '#64748b' }} />
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: isSelected ? '#ffffff' : '#94a3b8'
                  }}>
                    {item.title}
                  </span>
                </div>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  border: `2px solid ${isSelected ? item.badgeColor : '#334155'}`,
                  background: isSelected ? item.badgeColor : 'transparent'
                }} />
              </div>

              <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.4, marginTop: '2px' }}>
                {item.subtext}
              </div>

              <div style={{ marginTop: '4px' }}>
                <span className="font-mono" style={{
                  fontSize: '9px',
                  padding: '2px 5px',
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${isSelected ? item.badgeColor + '60' : '#1e293b'}`,
                  color: isSelected ? item.badgeColor : '#64748b',
                  fontWeight: 600
                }}>
                  {item.badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
