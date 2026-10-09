// 4clique Drainage & Rajakaluve Alerts Configuration
// Supports Full Karnataka Coverage with Citizen/Municipal Overrides

import { KARNATAKA_DRAINS } from './karnatakaDrains';

export { KARNATAKA_DRAINS };
export const BENGALURU_DRAINAGE_ALERTS = KARNATAKA_DRAINS.filter(d => d.district === 'Bengaluru Urban');

// Helper to get active drains with local storage overrides
export function getStoredDrainageAlerts(districtFilter = null) {
  try {
    const raw = localStorage.getItem('4clique_drainage_overrides');
    const overrides = raw ? JSON.parse(raw) : {};
    
    const baseList = districtFilter 
      ? KARNATAKA_DRAINS.filter(d => d.district === districtFilter)
      : KARNATAKA_DRAINS;

    return baseList.map(d => {
      const match = overrides[d.id];
      if (match) {
        return {
          ...d,
          currentStatus: match.status || d.defaultStatus,
          overrideNote: match.notes,
          overriddenAt: match.timestamp
        };
      }
      return {
        ...d,
        currentStatus: d.defaultStatus
      };
    });
  } catch (e) {
    console.warn("Could not load drainage overrides:", e);
    return KARNATAKA_DRAINS.map(d => ({ ...d, currentStatus: d.defaultStatus }));
  }
}

// Helper to save override
export function saveDrainageOverride(drainId, status, notes = "") {
  try {
    const raw = localStorage.getItem('4clique_drainage_overrides');
    const overrides = raw ? JSON.parse(raw) : {};
    overrides[drainId] = {
      status,
      notes,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('4clique_drainage_overrides', JSON.stringify(overrides));
    return overrides;
  } catch (e) {
    console.error("Failed to save drainage override:", e);
    return null;
  }
}
