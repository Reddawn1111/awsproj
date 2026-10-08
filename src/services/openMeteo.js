// 4clique Open-Meteo Weather Service
// Coordinates: Bellandur-ORR, Bengaluru (Lat: 12.935, Lng: 77.680)

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const BENGALURU_COORDS = {
  latitude: 12.935,
  longitude: 77.680
};

/**
 * Fetches real-time / near-term hourly precipitation data for Bengaluru.
 * Clamps result between 0 and 300 mm.
 */
export async function fetchLiveBengaluruRain() {
  const params = new URLSearchParams({
    latitude: BENGALURU_COORDS.latitude.toString(),
    longitude: BENGALURU_COORDS.longitude.toString(),
    current: 'precipitation,rain,weather_code',
    hourly: 'precipitation,rain',
    forecast_days: '1',
    timezone: 'Asia/Kolkata'
  });

  const url = `${OPEN_METEO_URL}?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: HTTP ${response.status} (${response.statusText})`);
  }

  const data = await response.json();

  // Extract current precipitation or maximum hourly precipitation in the current cycle
  let rawPrecipitation = 0.0;
  if (data.current && typeof data.current.precipitation === 'number') {
    rawPrecipitation = data.current.precipitation;
  } else if (data.hourly && Array.isArray(data.hourly.precipitation) && data.hourly.precipitation.length > 0) {
    // Current hour index
    const currentHourIndex = new Date().getHours();
    rawPrecipitation = data.hourly.precipitation[currentHourIndex] || 0.0;
  }

  // Convert to storm scenario equivalent (hourly rate extrapolated to design storm depth or scaled)
  // If dry (0 mm), return 0 mm with appropriate metadata
  let calculatedScenarioRainfall = Math.round(rawPrecipitation * 8.0); // 8-hour storm accumulation equivalent
  if (rawPrecipitation > 0 && calculatedScenarioRainfall < 15) {
    calculatedScenarioRainfall = 25; // Minimum perceptible shower scenario
  }

  // Clamp between 0 and 300 mm
  const clampedMm = Math.min(300, Math.max(0, calculatedScenarioRainfall));

  return {
    rawCurrentPrecipitationMm: rawPrecipitation,
    scenarioRainfallMm: clampedMm,
    weatherCode: data.current?.weather_code ?? 0,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source: 'Open-Meteo WMO Station 12.935N, 77.680E'
  };
}
