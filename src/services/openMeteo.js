// 4clique Open-Meteo Weather Service
// Supports city-wide multi-point rain grid query & single point query

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetches real-time precipitation for a 5x5 grid across Bengaluru in a single batch request.
 * @param {Array<{id: string, lat: number, lng: number}>} gridPoints
 */
export async function fetchCityRainGrid(gridPoints) {
  if (!gridPoints || gridPoints.length === 0) return [];

  const latList = gridPoints.map(p => p.lat.toFixed(3)).join(',');
  const lngList = gridPoints.map(p => p.lng.toFixed(3)).join(',');

  const url = `${OPEN_METEO_URL}?latitude=${latList}&longitude=${lngList}&current=precipitation,rain&timezone=Asia/Kolkata`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo batch HTTP ${res.status}`);
    }
    const data = await res.json();

    // Open-Meteo returns an Array when multiple coordinates are requested
    if (Array.isArray(data)) {
      return data.map((item, idx) => {
        const rain = item?.current?.precipitation ?? item?.current?.rain ?? 0.0;
        return {
          id: gridPoints[idx]?.id || `pt_${idx}`,
          lat: gridPoints[idx]?.lat,
          lng: gridPoints[idx]?.lng,
          rain_mm_hr: Math.max(0, Number(rain.toFixed(1)))
        };
      });
    } else if (data && data.current) {
      // Single response fallback
      const rain = data.current.precipitation ?? data.current.rain ?? 0.0;
      return [{
        id: gridPoints[0]?.id || 'pt_0',
        lat: gridPoints[0]?.lat,
        lng: gridPoints[0]?.lng,
        rain_mm_hr: Math.max(0, Number(rain.toFixed(1)))
      }];
    }
    return [];
  } catch (err) {
    console.warn("City rain grid fetch fallback:", err.message);
    // Return dry baseline on network failure
    return gridPoints.map(p => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      rain_mm_hr: 0.0
    }));
  }
}

/**
 * Fetches point precipitation for a specific coordinate (e.g., active block center).
 */
export async function fetchPointRain(lat, lng) {
  const url = `${OPEN_METEO_URL}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=precipitation,rain&timezone=Asia/Kolkata`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data = await res.json();
    const rain = data?.current?.precipitation ?? data?.current?.rain ?? 0.0;
    return {
      rain_mm_hr: Math.max(0, Number(rain.toFixed(1))),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err) {
    console.warn("Point rain fetch error:", err.message);
    return {
      rain_mm_hr: 0.0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fallback: true
    };
  }
}
