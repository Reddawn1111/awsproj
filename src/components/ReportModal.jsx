import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, ShieldAlert, Send, Clock, MapPin, RefreshCw } from 'lucide-react';
import { BENGALURU_DRAINAGE_ALERTS, saveDrainageOverride, getStoredDrainageAlerts } from '../config/drainageAlerts';

export function ReportModal({
  isOpen,
  onClose,
  initialDrainId = null,
  onReportSubmitted
}) {
  const [drains, setDrains] = useState([]);
  const [selectedDrainId, setSelectedDrainId] = useState(initialDrainId || BENGALURU_DRAINAGE_ALERTS[0].id);
  const [statusOverride, setStatusOverride] = useState('Severe');
  const [reportReason, setReportReason] = useState('');
  const [reporterType, setReporterType] = useState('Citizen'); // 'Citizen' | 'Municipal BBMP Officer'
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDrains(getStoredDrainageAlerts());
      if (initialDrainId) {
        setSelectedDrainId(initialDrainId);
        const match = getStoredDrainageAlerts().find(d => d.id === initialDrainId);
        if (match) {
          setStatusOverride(match.currentStatus || match.defaultStatus);
        }
      }
      setIsSuccess(false);
    }
  }, [isOpen, initialDrainId]);

  if (!isOpen) return null;

  const currentDrain = drains.find(d => d.id === selectedDrainId) || drains[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDrainId) return;

    const fullReason = `${reporterType}: ${reportReason.trim() || 'Status updated via Field Verification'}`;
    saveDrainageOverride(selectedDrainId, statusOverride, fullReason);

    setIsSuccess(true);
    if (onReportSubmitted) {
      onReportSubmitted(selectedDrainId, statusOverride, fullReason);
    }

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="gmaps-modal-backdrop" onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 14, 0.75)',
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
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 240, 255, 0.15)',
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
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444'
            }}>
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
                Municipal / Citizen Drainage Audit
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                Real-time status override for BBMP Rajakaluve chokepoints
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Drainage Line Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>
              Select Drainage Corridor / Chokepoint
            </label>
            <select
              value={selectedDrainId}
              onChange={(e) => {
                setSelectedDrainId(e.target.value);
                const d = drains.find(item => item.id === e.target.value);
                if (d) setStatusOverride(d.currentStatus || d.defaultStatus);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {drains.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.valley})
                </option>
              ))}
            </select>
          </div>

          {/* Current Node Telemetry Card */}
          {currentDrain && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Design Capacity:</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{currentDrain.designCapacityM3s} m³/s</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Observed Peak Discharge:</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: currentDrain.currentDischargeM3s > currentDrain.designCapacityM3s ? '#ef4444' : '#10b981' }}>
                  {currentDrain.currentDischargeM3s} m³/s ({Math.round((currentDrain.currentDischargeM3s / currentDrain.designCapacityM3s) * 100)}% load)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Baseline Status:</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: currentDrain.currentStatus === 'Severe' ? 'rgba(239, 68, 68, 0.2)' : currentDrain.currentStatus === 'Moderate' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: currentDrain.currentStatus === 'Severe' ? '#ef4444' : currentDrain.currentStatus === 'Moderate' ? '#f59e0b' : '#10b981'
                }}>
                  {currentDrain.currentStatus || currentDrain.defaultStatus}
                </span>
              </div>
            </div>
          )}

          {/* Status Override Radio Cards */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>
              Verified Status Override
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { status: 'Severe', label: 'Severe Deficit', color: '#ef4444', desc: 'Over capacity / Backflow' },
                { status: 'Moderate', label: 'Moderate Risk', color: '#f59e0b', desc: 'Silt deposition / Slower flow' },
                { status: 'Operational', label: 'Operational', color: '#10b981', desc: 'Clear channel / De-silted' }
              ].map(item => (
                <div
                  key={item.status}
                  onClick={() => setStatusOverride(item.status)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: `1.5px solid ${statusOverride === item.status ? item.color : 'rgba(255, 255, 255, 0.08)'}`,
                    background: statusOverride === item.status ? `${item.color}15` : 'rgba(15, 23, 42, 0.5)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: item.color,
                    margin: '0 auto 6px',
                    boxShadow: statusOverride === item.status ? `0 0 8px ${item.color}` : 'none'
                  }} />
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>{item.label}</div>
                  <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '2px' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Role & Reason */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Reporting Entity
              </label>
              <select
                value={reporterType}
                onChange={(e) => setReporterType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none'
                }}
              >
                <option value="Citizen">Citizen Audit</option>
                <option value="Municipal BBMP Officer">BBMP Inspector</option>
                <option value="Ward Committee">Ward Committee</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Field Notes / Justification
              </label>
              <input
                type="text"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="e.g., Silt accumulation, construction debris, de-silted"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={isSuccess}
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: isSuccess ? '#10b981' : 'linear-gradient(135deg, #00f0ff 0%, #0077b6 100%)',
              border: 'none',
              color: '#05080c',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px',
              transition: 'all 0.2s ease'
            }}
          >
            {isSuccess ? (
              <>
                <CheckCircle size={16} />
                <span>OVERRIDE PERSISTED REAL-TIME</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>SUBMIT MUNICIPAL STATUS OVERRIDE</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
