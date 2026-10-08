import React from 'react';
import { Terminal, X, CheckCircle, ExternalLink, ShieldAlert } from 'lucide-react';

export function DevToolsGuideModal({ isOpen, onClose, currentEndpoint }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="command-panel"
        style={{ width: '92%', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={14} style={{ color: '#ff9900' }} />
            <span style={{ color: '#ffffff' }}>AWS Network Inspection & Hackathon Judging Proof</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px', lineHeight: 1.6 }}>
          <div style={{ background: '#090e18', border: '1px solid #ff990040', padding: '10px 12px', color: '#ffac33' }}>
            <strong>Hackathon Judging Verification Requirement:</strong>
            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
              4clique performs a real, unproxied client-side HTTP POST request from the browser directly to the AWS Lambda Function URL. No fake browser mock calculations are used for AWS metrics.
            </div>
          </div>

          <div>
            <h4 style={{ color: '#00f0ff', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
              Active Simulation Endpoint:
            </h4>
            <div className="font-mono" style={{
              background: '#040810',
              border: '1px solid #1e2c45',
              padding: '6px 10px',
              fontSize: '11px',
              color: '#38bdf8',
              wordBreak: 'break-all'
            }}>
              {currentEndpoint || 'http://127.0.0.1:8000'}
            </div>
          </div>

          <div>
            <h4 style={{ color: '#ffffff', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
              Step-by-Step Video / Demo Recording Procedure:
            </h4>
            <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#cbd5e1' }}>
              <li>Open the <strong>4clique</strong> application in your browser.</li>
              <li>Press <kbd style={{ background: '#1e293b', padding: '2px 5px', borderRadius: '2px' }}>F12</kbd> or <kbd style={{ background: '#1e293b', padding: '2px 5px', borderRadius: '2px' }}>Ctrl+Shift+I</kbd> to open DevTools.</li>
              <li>Navigate to the <strong>Network</strong> tab.</li>
              <li>Filter requests by <strong>Fetch/XHR</strong>.</li>
              <li>Adjust the Rainfall slider (e.g. 180 mm) and select <strong>DESILT_RAJAKALUVES</strong>.</li>
              <li>Click <strong style={{ color: '#ff9900' }}>"RUN 4CLIQUE HYDROLOGIC TWIN ON AWS"</strong>.</li>
              <li>Click on the captured request in the Network list:
                <ul style={{ paddingLeft: '14px', marginTop: '4px', color: '#94a3b8' }}>
                  <li>Confirm <strong>Request URL</strong> matches your AWS Lambda Function URL.</li>
                  <li>Confirm <strong>Method = POST</strong>.</li>
                  <li>Confirm <strong>Status = 200 OK</strong>.</li>
                  <li>Inspect <strong>Payload</strong>: shows <code className="font-mono" style={{ color: '#00f0ff' }}>&#123;"project":"4clique","rainfall_mm":180,"intervention":"DESILT_RAJAKALUVES"&#125;</code></li>
                  <li>Inspect <strong>Response</strong>: shows returned <code className="font-mono" style={{ color: '#10b981' }}>scenario_id</code>, <code className="font-mono" style={{ color: '#10b981' }}>flooded_sqkm</code>, <code className="font-mono" style={{ color: '#10b981' }}>infrastructure_status</code>, and <code className="font-mono" style={{ color: '#10b981' }}>flood_reduction_percentage</code>.</li>
                </ul>
              </li>
              <li>Point the camera to the 3D diorama showing the flood contours and infrastructure markers transition based on AWS results!</li>
            </ol>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #1e2c45' }}>
            <button onClick={onClose} className="btn-secondary" style={{ padding: '8px 16px' }}>
              Close Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
