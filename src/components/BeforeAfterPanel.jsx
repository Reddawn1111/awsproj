import React from 'react';
import { BarChart3, TrendingDown, ArrowRight, ShieldCheck, Droplet } from 'lucide-react';

export function BeforeAfterPanel({ simulationData, activeIntervention }) {
  if (!simulationData) {
    return (
      <div style={{ background: '#090e18', border: '1px solid #16233b', padding: '14px', textAlign: 'center' }}>
        <BarChart3 size={20} style={{ color: '#475569', margin: '0 auto 8px auto' }} />
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
          Awaiting AWS Hydrologic Simulation
        </div>
        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
          Select rainfall & intervention, then trigger the AWS Lambda execution.
        </div>
      </div>
    );
  }

  const baseline = simulationData.baseline || {
    flooded_sqkm: simulationData.flooded_sqkm,
    impacted_arterial_roads: simulationData.impacted_arterial_roads,
    infrastructure_status: simulationData.infrastructure_status
  };

  const current = {
    flooded_sqkm: simulationData.flooded_sqkm,
    impacted_arterial_roads: simulationData.impacted_arterial_roads,
    infrastructure_status: simulationData.infrastructure_status,
    flood_reduction_percentage: simulationData.flood_reduction_percentage || 0.0
  };

  // Count infrastructure at risk
  const countAtRisk = (statusMap) => {
    if (!statusMap) return 0;
    return Object.values(statusMap).filter(st => st === 'FLOODED').length;
  };

  const baselineAtRisk = countAtRisk(baseline.infrastructure_status);
  const currentAtRisk = countAtRisk(current.infrastructure_status);
  const roadsSaved = Math.max(0, baseline.impacted_arterial_roads - current.impacted_arterial_roads);
  const areaAvertedSqKm = Math.max(0, parseFloat((baseline.flooded_sqkm - current.flooded_sqkm).toFixed(2)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="panel-section-title">
        <BarChart3 size={13} style={{ color: '#00f0ff' }} />
        <span>Hydrologic Decision Support: Before vs After</span>
      </div>

      {/* Hero: Primary Flood Reduction % */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(0, 240, 255, 0.08) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.4)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em' }}>
            FLOOD REDUCTION EFFICIENCY
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            {activeIntervention === 'BASELINE' ? 'Baseline unmitigated condition' : `Versus clogged baseline`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <TrendingDown size={22} style={{ color: current.flood_reduction_percentage > 0 ? '#10b981' : '#64748b' }} />
          <span className="font-mono" style={{
            fontSize: '28px',
            fontWeight: 800,
            color: current.flood_reduction_percentage > 0 ? '#10b981' : '#94a3b8'
          }}>
            {current.flood_reduction_percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Comparative Matrix: Baseline vs Intervention */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {/* BEFORE / BASELINE */}
        <div style={{ background: '#090e18', border: '1px solid #241417', padding: '10px 12px' }}>
          <div style={{
            fontSize: '9px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#ef4444',
            marginBottom: '8px',
            borderBottom: '1px solid #ef444430',
            paddingBottom: '4px'
          }}>
            BEFORE / BASELINE
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>Flooded Area</div>
              <div className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>
                {baseline.flooded_sqkm.toFixed(1)} <span style={{ fontSize: '10px', color: '#94a3b8' }}>km²</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>Impacted Roads</div>
              <div className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>
                {baseline.impacted_arterial_roads} <span style={{ fontSize: '10px', color: '#94a3b8' }}>arteries</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>Infra at Risk</div>
              <div className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>
                {baselineAtRisk} of 3
              </div>
            </div>
          </div>
        </div>

        {/* AFTER / SELECTED INTERVENTION */}
        <div style={{ background: '#090e18', border: '1px solid #103328', padding: '10px 12px' }}>
          <div style={{
            fontSize: '9px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#10b981',
            marginBottom: '8px',
            borderBottom: '1px solid #10b98130',
            paddingBottom: '4px'
          }}>
            AFTER / INTERVENTION
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>Flooded Area</div>
              <div className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>
                {current.flooded_sqkm.toFixed(1)} <span style={{ fontSize: '10px', color: '#94a3b8' }}>km²</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>Impacted Roads</div>
              <div className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>
                {current.impacted_arterial_roads} <span style={{ fontSize: '10px', color: '#94a3b8' }}>arteries</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>Infra at Risk</div>
              <div className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>
                {currentAtRisk} of 3
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hydraulic Benefit Highlights */}
      {current.flood_reduction_percentage > 0 && (
        <div style={{
          background: 'rgba(0, 240, 255, 0.05)',
          border: '1px solid #1e3a5f',
          padding: '8px 10px',
          fontSize: '10px',
          color: '#cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00f0ff', fontWeight: 700 }}>
            <Droplet size={12} />
            <span>Mitigation Gains Delivered:</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Urban Area Protected:</span>
            <strong className="font-mono" style={{ color: '#38bdf8' }}>+{areaAvertedSqKm} km²</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Arterial Corridors Restored:</span>
            <strong className="font-mono" style={{ color: '#34d399' }}>+{roadsSaved} segments</strong>
          </div>
        </div>
      )}
    </div>
  );
}
