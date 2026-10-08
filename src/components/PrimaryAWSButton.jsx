import React from 'react';
import { Zap, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export function PrimaryAWSButton({
  onRunSimulation,
  isLoading,
  error,
  lastSuccessTimestamp,
  latencyMs,
  scenarioId
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        onClick={onRunSimulation}
        disabled={isLoading}
        className="btn-aws"
        style={{ width: '100%' }}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>RUNNING AWS SIMULATION...</span>
          </>
        ) : (
          <>
            <Zap size={16} />
            <span>RUN 4CLIQUE HYDROLOGIC TWIN ON AWS</span>
          </>
        )}
      </button>

      {/* Real-time Execution Feedback */}
      {isLoading && (
        <div style={{
          padding: '8px 10px',
          background: 'rgba(255, 153, 0, 0.08)',
          border: '1px solid rgba(255, 153, 0, 0.3)',
          color: '#ffac33',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div className="font-mono" style={{ fontSize: '10px' }}>
            POSTing scenario payload to AWS Lambda Function URL...
          </div>
        </div>
      )}

      {/* Success State */}
      {!isLoading && lastSuccessTimestamp && (
        <div style={{
          padding: '8px 10px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={12} />
            <span>Verified AWS Lambda Execution</span>
          </div>
          <span className="font-mono" style={{ color: '#64748b' }}>
            {latencyMs}ms • {lastSuccessTimestamp}
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div style={{
          padding: '8px 10px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#f87171',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
            <AlertTriangle size={13} />
            <span>Simulation Execution Fault</span>
          </div>
          <div style={{ fontSize: '10px', color: '#fca5a5', lineHeight: 1.4 }}>
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
