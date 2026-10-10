// 4clique Environmental Intelligence Service
// Fetches real-time weather observations, hourly precipitation forecasts,
// wind dynamics, and atmospheric metrics for Bengaluru via Open-Meteo API.

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute cache

// In-memory cache: key = `${lat.toFixed(3)},${lng.toFixed(3)}`
const envCache = new Map();
const inFlightRequests = new Map();

/**
 * Format wind direction degrees to compass direction
 */
export function getWindCompassDirection(degrees) {
  if (degrees === undefined || degrees === null) return 'N/A';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((degrees % 360) / 22.5)) % 16;
  return directions[index];
}

/**
 * Fetches comprehensive environmental intelligence for a target coordinate.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {boolean} [forceRefresh=false] - Force cache bypass
 */
export async function fetchEnvironmentalIntelligence(lat, lng, forceRefresh = false) {
  // Fallback to Bengaluru center if coordinates are invalid
  const validLat = typeof lat === 'number' && !isNaN(lat) ? lat : 12.9352;
  const validLng = typeof lng === 'number' && !isNaN(lng) ? lng : 77.6805;

  const cacheKey = `${validLat.toFixed(3)},${validLng.toFixed(3)}`;
  const now = Date.now();

  if (!forceRefresh && envCache.has(cacheKey)) {
    const cached = envCache.get(cacheKey);
    if (now - cached.cachedAt < CACHE_TTL_MS) {
      return {
        ...cached.data,
        sourceStatus: 'CACHED',
        isCached: true
      };
    }
  }

  // De-duplicate in-flight requests for the same coordinates
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const requestPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const signal = controller.signal;

    try {
      // 1. Fetch Open-Meteo High-Resolution Forecast
      const params = new URLSearchParams({
        latitude: validLat.toFixed(4),
        longitude: validLng.toFixed(4),
        current: 'precipitation,rain,temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
        hourly: 'precipitation,precipitation_probability,temperature_2m,wind_speed_10m',
        forecast_hours: '12',
        timezone: 'Asia/Kolkata'
      });

      const openMeteoResponse = await fetch(`${OPEN_METEO_FORECAST_URL}?${params.toString()}`, { signal });
      clearTimeout(timeoutId);

      if (!openMeteoResponse.ok) {
        throw new Error(`Open-Meteo HTTP ${openMeteoResponse.status}`);
      }

      const omData = await openMeteoResponse.json();
      const current = omData.current || {};
      const hourly = omData.hourly || {};

      // 2. Parse current observations
      const currentRainRate = Math.max(0, Number((current.precipitation ?? current.rain ?? 0.0).toFixed(1)));
      const tempC = current.temperature_2m !== undefined ? Number(current.temperature_2m.toFixed(1)) : null;
      const humidityPct = current.relative_humidity_2m !== undefined ? Math.round(current.relative_humidity_2m) : null;
      const surfacePressureHpa = current.surface_pressure !== undefined ? Number(current.surface_pressure.toFixed(1)) : null;
      const windSpeedKmh = current.wind_speed_10m !== undefined ? Number(current.wind_speed_10m.toFixed(1)) : null;
      const windDirDeg = current.wind_direction_10m ?? null;
      const windGustsKmh = current.wind_gusts_10m !== undefined ? Number(current.wind_gusts_10m.toFixed(1)) : null;

      // 3. Process hourly precipitation forecasts
      const hourlyTimes = hourly.time || [];
      const hourlyPrecip = hourly.precipitation || [];
      const hourlyProb = hourly.precipitation_probability || [];
      const hourlyTemp = hourly.temperature_2m || [];

      const forecastTimeline = [];

      for (let i = 0; i < hourlyTimes.length && i < 12; i++) {
        const timeStr = hourlyTimes[i];
        const precipMm = Math.max(0, Number((hourlyPrecip[i] ?? 0).toFixed(1)));
        const probPct = Math.max(0, Math.min(100, Math.round(hourlyProb[i] ?? 0)));
        const t = hourlyTemp[i] !== undefined ? Number(hourlyTemp[i].toFixed(1)) : null;

        forecastTimeline.push({
          time: timeStr,
          displayTime: formatHourlyLabel(timeStr),
          precipitation_mm: precipMm,
          probability_percent: probPct,
          temperature_c: t
        });
      }

      // 4. Calculate Accumulation for Next 1-Hour, 3-Hours, and 6-Hours
      const next1hAccumulation = forecastTimeline.slice(0, 1).reduce((sum, h) => sum + h.precipitation_mm, 0);
      const next3hAccumulation = forecastTimeline.slice(0, 3).reduce((sum, h) => sum + h.precipitation_mm, 0);
      const next6hAccumulation = forecastTimeline.slice(0, 6).reduce((sum, h) => sum + h.precipitation_mm, 0);

      const next1hAvgRate = next1hAccumulation;
      const next3hAvgRate = Number((next3hAccumulation / 3).toFixed(1));
      const maxNext3hRate = forecastTimeline.slice(0, 3).reduce((max, h) => Math.max(max, h.precipitation_mm), 0);
      const maxProbNext3h = forecastTimeline.slice(0, 3).reduce((max, h) => Math.max(max, h.probability_percent), 0);

      const result = {
        location: {
          lat: validLat,
          lng: validLng,
          city: 'Bengaluru',
          timezone: 'Asia/Kolkata'
        },
        currentWeather: {
          rainfall_rate_mm_hr: currentRainRate,
          temperature_c: tempC,
          relative_humidity_percent: humidityPct,
          surface_pressure_hpa: surfacePressureHpa,
          wind_speed_kmh: windSpeedKmh,
          wind_direction_deg: windDirDeg,
          wind_direction_compass: getWindCompassDirection(windDirDeg),
          wind_gusts_kmh: windGustsKmh,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        forecast: {
          next_1h_accumulation_mm: Number(next1hAccumulation.toFixed(1)),
          next_1h_rate_mm_hr: Number(next1hAvgRate.toFixed(1)),
          next_3h_accumulation_mm: Number(next3hAccumulation.toFixed(1)),
          next_3h_avg_rate_mm_hr: next3hAvgRate,
          next_3h_peak_rate_mm_hr: Number(maxNext3hRate.toFixed(1)),
          next_6h_accumulation_mm: Number(next6hAccumulation.toFixed(1)),
          precipitation_probability_pct: maxProbNext3h,
          timeline: forecastTimeline
        },
        sourceStatus: 'LIVE',
        isCached: false,
        primaryProvider: 'Open-Meteo Forecast API',
        lastUpdated: new Date().toISOString(),
        lastUpdatedFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };

      // Cache the successful result
      envCache.set(cacheKey, {
        cachedAt: now,
        data: result
      });

      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('[4clique Environmental] Open-Meteo fetch failed:', err.message);

      // If cache has any data for this location, return it as CACHED
      if (envCache.has(cacheKey)) {
        const cached = envCache.get(cacheKey);
        return {
          ...cached.data,
          sourceStatus: 'CACHED',
          isCached: true,
          fallbackNotice: `Using cached forecast (${err.message})`
        };
      }

      // Return structured UNAVAILABLE response with explicit failure metadata
      return {
        location: { lat: validLat, lng: validLng, city: 'Bengaluru' },
        currentWeather: {
          rainfall_rate_mm_hr: null,
          temperature_c: null,
          relative_humidity_percent: null,
          surface_pressure_hpa: null,
          wind_speed_kmh: null,
          wind_direction_deg: null,
          wind_direction_compass: 'N/A',
          wind_gusts_kmh: null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        forecast: {
          next_1h_accumulation_mm: null,
          next_1h_rate_mm_hr: null,
          next_3h_accumulation_mm: null,
          next_3h_avg_rate_mm_hr: null,
          next_3h_peak_rate_mm_hr: null,
          next_6h_accumulation_mm: null,
          precipitation_probability_pct: null,
          timeline: []
        },
        sourceStatus: 'UNAVAILABLE',
        isCached: false,
        primaryProvider: 'Open-Meteo Forecast API',
        errorMessage: err.message,
        lastUpdated: new Date().toISOString(),
        lastUpdatedFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);
  try {
    const res = await requestPromise;
    return res;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

function formatHourlyLabel(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
  } catch {
    return isoString.split('T')[1]?.slice(0, 5) || isoString;
  }
}
