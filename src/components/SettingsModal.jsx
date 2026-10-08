import React, { useState } from 'react';
import { Settings, X, Save, RefreshCw } from 'lucide-react';

export function SettingsModal({
  isOpen,
  onClose,
  mapboxToken,
  onSaveMapboxToken,
  awsLambdaUrl,
  onSaveAwsLambdaUrl
}) {
  const [tempToken, setTempToken] = useState(mapboxToken);
  const [tempUrl, setTempUrl] = useState(awsLambdaUrl);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSaveMapboxToken(tempToken.trim());
    onSaveAwsLambdaUrl(tempUrl.trim());
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="command-panel"
        style={{ width: '90%', maxWidth: '540px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={14} style={{ color: '#00f0ff' }} />
            <span style={{ color: '#ffffff' }}>System Endpoints & Secrets Configuration</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
              MAPBOX PUBLIC ACCESS TOKEN (VITE_MAPBOX_TOKEN)
            </label>
            <input
              type="text"
              value={tempToken}
              onChange={(e) => setTempToken(e.target.value)}
              placeholder="pk.eyJ1..."
              className="font-mono"
              style={{
                width: '100%',
                background: '#090e18',
                border: '1px solid #1e2c45',
                color: '#ffffff',
                padding: '8px 10px',
                fontSize: '11px',
                outline: 'none'
              }}
            />
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              Enables 3D Terrain-DEM, satellite/dark raster, and extruded 3D buildings.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
              AWS LAMBDA FUNCTION URL (VITE_AWS_LAMBDA_URL)
            </label>
            <input
              type="text"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="https://...lambda-url.ap-south-1.on.aws/ or http://127.0.0.1:8000"
              className="font-mono"
              style={{
                width: '100%',
                background: '#090e18',
                border: '1px solid #1e2c45',
                color: '#ffffff',
                padding: '8px 10px',
                fontSize: '11px',
                outline: 'none'
              }}
            />
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              Public HTTP endpoint where browser sends hydrologic simulation POST requests.
            </div>
          </div>

          {savedNotice && (
            <div style={{ padding: '6px 10px', background: '#062c1c', border: '1px solid #10b981', color: '#34d399', fontSize: '11px' }}>
              Configuration saved successfully!
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-secondary" style={{ borderColor: '#00f0ff', color: '#00f0ff' }}>
              <Save size={13} />
              <span>Apply Configuration</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
