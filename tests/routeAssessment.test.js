import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessRouteHazards, assessRoutes, getRouteRiskNotice, isLatestSimulationResponse, recommendRoute } from '../src/services/routeAssessment.js';
import { fetchAlternativeRoutes } from '../src/services/routePlanning.js';

const bounds = { minLng: 77.6, minLat: 12.9, maxLng: 77.61, maxLat: 12.91 };
const route = (id, y, duration = 300) => ({
  id,
  name: id,
  distance: 1000,
  duration,
  coordinates: [[77.601, y], [77.605, y], [77.609, y]]
});

function gridResult({ wetDepth = 0, wetRow = 8, wetColumn = 8 } = {}) {
  const pooled_cells = [];
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const wet = row === wetRow && col === wetColumn;
      pooled_cells.push({
        row,
        col,
        lng: bounds.minLng + ((bounds.maxLng - bounds.minLng) * col) / 15,
        lat: bounds.minLat + ((bounds.maxLat - bounds.minLat) * row) / 15,
        depth_meters: wet ? wetDepth : 0,
        tier: wetDepth >= 0.8 && wet ? 'SEVERE' : wetDepth >= 0.3 && wet ? 'MODERATE' : 'SAFE'
      });
    }
  }
  return { bounds, peak_water_depth_m: wetDepth, pooled_cells };
}

test('TEST 1 — normal current simulation assesses routes and preserves an available selection', () => {
  const candidates = [route('fast', 12.905, 180), route('manual', 12.906, 240)];
  const assessments = assessRoutes(candidates, { simulationResult: { bounds, peak_water_depth_m: 0, pooled_cells: [] }, simulationStatus: 'current' });
  assert.ok(assessments.every(item => item.assessment === 'clear'));
  assert.equal(recommendRoute(assessments).id, 'fast');
  assert.equal(assessments.find(item => item.id === 'manual').id, 'manual');
});

test('TEST 2 — extreme flood marks the intersecting primary critical and recommends the covered alternative', () => {
  const candidates = [route('primary', 12.905), route('bypass', 12.909, 360)];
  const assessments = assessRoutes(candidates, { simulationResult: gridResult({ wetDepth: 1.2 }), simulationStatus: 'current' });
  assert.equal(assessments[0].assessment, 'critical');
  assert.equal(assessments[0].criticalCount, 1);
  assert.equal(assessments[1].assessment, 'clear');
  assert.equal(recommendRoute(assessments).id, 'bypass');
  assert.equal(assessments[0].hazardCount, 1);
});

test('TEST 3 — high-rain result replaces the low-rain route assessment', () => {
  const requested = { rainfallMm: 300, cloggingPercent: 20, bounds };
  assert.equal(isLatestSimulationResponse(2, 2, requested, requested), true);
  assert.equal(assessRouteHazards(route('primary', 12.905), { simulationResult: gridResult({ wetDepth: 1.1 }), simulationStatus: 'current' }).assessment, 'critical');
});

test('TEST 4 — changed clogging inputs reject an old response and reassess after completion', () => {
  const requested = { rainfallMm: 80, cloggingPercent: 100, bounds };
  const now = { rainfallMm: 80, cloggingPercent: 100, bounds };
  assert.equal(isLatestSimulationResponse(4, 4, requested, { ...now, cloggingPercent: 35 }), false);
  assert.equal(isLatestSimulationResponse(4, 4, requested, now), true);
  assert.equal(assessRouteHazards(route('primary', 12.905), { simulationResult: gridResult({ wetDepth: 0.45 }), simulationStatus: 'current' }).assessment, 'affected');
});

test('TEST 5 — all affected routes have no safe recommendation and show an explicit warning', () => {
  const assessments = assessRoutes([route('one', 12.905), route('two', 12.9055)], { simulationResult: gridResult({ wetDepth: 1.2 }), simulationStatus: 'current' });
  assert.ok(assessments.every(item => item.assessment === 'critical'));
  assert.equal(recommendRoute(assessments), null);
  assert.match(getRouteRiskNotice(assessments, 'current'), /No verified safe alternative/);
});

test('TEST 6 — failed simulation cannot become a zero-hazard clear result', () => {
  const result = assessRouteHazards(route('unknown', 12.905), { simulationResult: null, simulationStatus: 'failed' });
  assert.equal(result.assessment, 'failed');
  assert.notEqual(result.assessment, 'clear');
  assert.match(result.assessmentReason, /failed/);
  assert.match(getRouteRiskNotice([result], 'failed'), /safety is unavailable/);
});

test('AWS failure using the local fallback keeps flood cells and never claims verified safety', () => {
  const candidates = assessRoutes([route('primary', 12.905), route('bypass', 12.909)], {
    simulationResult: gridResult({ wetDepth: 1.2 }),
    simulationStatus: 'fallback'
  });
  assert.equal(candidates[0].assessment, 'critical');
  assert.equal(candidates[1].assessment, 'fallback-clear');
  assert.equal(recommendRoute(candidates).assessment, 'fallback-clear');
  assert.match(getRouteRiskNotice(candidates, 'fallback'), /critical modeled flood area/);
});

test('TEST 7 — late responses and responses for changed inputs are discarded', () => {
  const inputs = { rainfallMm: 300, cloggingPercent: 100, bounds };
  assert.equal(isLatestSimulationResponse(1, 2, inputs, inputs), false);
  assert.equal(isLatestSimulationResponse(2, 2, { ...inputs, rainfallMm: 80 }, inputs), false);
});

test('TEST 8 — existing application shell remains wired and route service does not invent fallback roads', async () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const drawer = readFileSync(new URL('../src/components/SimulationDrawer.jsx', import.meta.url), 'utf8');
  const routePanel = readFileSync(new URL('../src/components/RoutePlannerPanel.jsx', import.meta.url), 'utf8');
  assert.match(app, /<Map3D/);
  assert.match(app, /<SimulationDrawer/);
  assert.match(app, /runAwsBlockSimulation/);
  assert.match(app, /simulationResult=\{blockSimulationResult\}/);
  assert.match(app, /isLatestSimulationResponse/);
  assert.match(drawer, /Run 4clique AWS Hydrologic Simulation/);
  assert.match(routePanel, /simulationResult, simulationStatus/);
  await assert.rejects(fetchAlternativeRoutes({ coords: [77.6, 12.9] }, { coords: [77.61, 12.91] }, ''), /Mapbox Directions is unavailable/);
});

test('flood-aware route recomputation requests Mapbox alternatives with supported point exclusions', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async url => {
    requestedUrl = new URL(url);
    return new Response(JSON.stringify({ routes: [{ distance: 1200, duration: 240, geometry: { coordinates: [[77.6, 12.9], [77.61, 12.91]] } }] }), { status: 200 });
  };
  try {
    const result = await fetchAlternativeRoutes({ coords: [77.6, 12.9] }, { coords: [77.61, 12.91] }, 'test-token', [[77.605, 12.905]]);
    assert.equal(requestedUrl.searchParams.get('alternatives'), 'true');
    assert.equal(requestedUrl.searchParams.get('exclude'), 'point(77.605 12.905)');
    assert.equal(result.exclusionStatus, 'requested');
    assert.equal(result.routes[0].source, 'MAPBOX DIRECTIONS');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('routes outside the simulated block are classified as geographically insufficient', () => {
  const result = assessRouteHazards(route('outside', 12.95), { simulationResult: gridResult(), simulationStatus: 'current' });
  assert.equal(result.assessment, 'insufficient');
  assert.match(result.assessmentReason, /outside the simulated block/);
});
