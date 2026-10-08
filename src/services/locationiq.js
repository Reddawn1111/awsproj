// 4clique LocationIQ Autocomplete & Reverse Geocoding Service

const LOCATIONIQ_AUTOCOMPLETE_URL = 'https://api.locationiq.com/v1/autocomplete';
const LOCATIONIQ_REVERSE_URL = 'https://us1.locationiq.com/v1/reverse';

// Bengaluru Bounding Box constraint
const BENGALURU_VIEWBOX = '77.4,13.15,77.8,12.8';

/**
 * Autocomplete place search restricted to Bengaluru
 */
export async function searchLocationIQ(query, tokenOverride = null) {
  const token = (tokenOverride || import.meta.env.VITE_LOCATIONIQ_TOKEN || 'pk.b331338dcd3fee9865865d43152f9ed9').trim();

  if (!query || !query.trim()) return [];

  const params = new URLSearchParams({
    key: token,
    q: query.trim(),
    countrycodes: 'in',
    viewbox: BENGALURU_VIEWBOX,
    bounded: '1',
    limit: '6'
  });

  const url = `${LOCATIONIQ_AUTOCOMPLETE_URL}?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`LocationIQ HTTP ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("LocationIQ autocomplete error:", err.message);
    return [];
  }
}

/**
 * Reverse geocodes coordinates to street / neighborhood name
 */
export async function reverseLocationIQ(lat, lng, tokenOverride = null) {
  const token = (tokenOverride || import.meta.env.VITE_LOCATIONIQ_TOKEN || 'pk.b331338dcd3fee9865865d43152f9ed9').trim();

  const url = `${LOCATIONIQ_REVERSE_URL}?key=${token}&lat=${lat}&lon=${lng}&format=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`LocationIQ reverse HTTP ${res.status}`);
    const data = await res.json();
    const parts = (data.display_name || '').split(',');
    const main = parts[0]?.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const sub = parts.slice(1, 3).map(p => p.trim()).join(', ');
    return {
      fullName: data.display_name,
      primaryName: main,
      subName: sub
    };
  } catch (err) {
    console.warn("LocationIQ reverse error:", err.message);
    return {
      fullName: `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`,
      primaryName: `Zone [${lat.toFixed(4)}, ${lng.toFixed(4)}]`,
      subName: 'Bengaluru Urban'
    };
  }
}
