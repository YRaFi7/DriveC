// Road Routing & Geocoding Helper for DriveC
// Uses Free OpenStreetMap Nominatim Geocoding and Project OSRM Routing
// Zero external API cost

export interface Coords {
  lat: number;
  lon: number;
  label?: string;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  pickupCoords?: Coords;
  destCoords?: Coords;
  source: string;
}

const geocodeCache = new Map<string, Coords>();
const routeCache = new Map<string, { distanceKm: number; durationMinutes: number }>();
const roadGeometryCache = new Map<string, [number, number][]>();

/**
 * Fetches verified road route polyline coordinates from Project OSRM (OpenStreetMap).
 * Returns array of [lat, lng] tuples suitable for Leaflet polyline rendering.
 * Zero external API cost - completely free and open.
 */
export async function getRouteRoadGeometry(
  pCoords: Coords,
  dCoords: Coords
): Promise<[number, number][]> {
  if (!pCoords || !dCoords) return [];
  const key = `${pCoords.lat.toFixed(4)},${pCoords.lon.toFixed(4)}->${dCoords.lat.toFixed(4)},${dCoords.lon.toFixed(4)}`;
  if (roadGeometryCache.has(key)) {
    return roadGeometryCache.get(key)!;
  }

  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pCoords.lon},${pCoords.lat};${dCoords.lon},${dCoords.lat}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0 && data.routes[0].geometry?.coordinates) {
        // GeoJSON coordinates are [lon, lat]. Convert to Leaflet [lat, lon]
        const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
          (pt: [number, number]) => [pt[1], pt[0]]
        );
        if (coords.length > 0) {
          roadGeometryCache.set(key, coords);
          return coords;
        }
      }
    }
  } catch (err) {
    console.warn('OSRM road geometry fetch failed, using straight road points fallback:', err);
  }

  // Fallback: pickup and destination coordinates
  const fallbackCoords: [number, number][] = [
    [pCoords.lat, pCoords.lon],
    [dCoords.lat, dCoords.lon]
  ];
  return fallbackCoords;
}

export const KERALA_PRESETS: Record<string, Coords> = {
  'cochin international airport': { lat: 10.1556, lon: 76.3912, label: 'Cochin International Airport (COK), Nedumbassery' },
  'cochin airport': { lat: 10.1556, lon: 76.3912, label: 'Cochin International Airport (COK)' },
  'kochi airport': { lat: 10.1556, lon: 76.3912, label: 'Cochin International Airport (COK)' },
  'cok airport': { lat: 10.1556, lon: 76.3912, label: 'Cochin International Airport (COK)' },
  'airport': { lat: 10.1556, lon: 76.3912, label: 'Cochin International Airport (COK)' },
  'kochi': { lat: 9.9312, lon: 76.2673, label: 'Kochi, Kerala' },
  'cochin': { lat: 9.9312, lon: 76.2673, label: 'Kochi, Kerala' },
  'aluva': { lat: 10.1076, lon: 76.3516, label: 'Aluva, Ernakulam' },
  'edappally': { lat: 10.0236, lon: 76.3117, label: 'Edappally, Kochi' },
  'kakkanad': { lat: 10.0159, lon: 76.3570, label: 'Kakkanad InfoPark, Kochi' },
  'fort kochi': { lat: 9.9658, lon: 76.2421, label: 'Fort Kochi, Kerala' },
  'vyttila': { lat: 9.9678, lon: 76.3197, label: 'Vyttila Mobility Hub, Kochi' },
  'tripunithura': { lat: 9.9515, lon: 76.3453, label: 'Tripunithura, Kochi' },
  'palarivattom': { lat: 10.0049, lon: 76.3073, label: 'Palarivattom, Kochi' },
  'kaloor': { lat: 9.9984, lon: 76.2995, label: 'Kaloor, Kochi' },
  'mg road': { lat: 9.9723, lon: 76.2828, label: 'MG Road, Kochi' },
  'marine drive': { lat: 9.9816, lon: 76.2753, label: 'Marine Drive, Kochi' },
  'kadavanthra': { lat: 9.9682, lon: 76.2998, label: 'Kadavanthra, Kochi' },
  'angamaly': { lat: 10.1960, lon: 76.3860, label: 'Angamaly, Kerala' },
  'perumbavoor': { lat: 10.1118, lon: 76.4789, label: 'Perumbavoor, Kerala' },
  'thrissur': { lat: 10.5276, lon: 76.2144, label: 'Thrissur, Kerala' },
  'kottayam': { lat: 9.5916, lon: 76.5222, label: 'Kottayam, Kerala' },
  'alappuzha': { lat: 9.4981, lon: 76.3388, label: 'Alappuzha (Alleppey), Kerala' },
  'alleppey': { lat: 9.4981, lon: 76.3388, label: 'Alappuzha (Alleppey), Kerala' },
  'kozhikode': { lat: 11.2588, lon: 75.7804, label: 'Kozhikode (Calicut), Kerala' },
  'calicut': { lat: 11.2588, lon: 75.7804, label: 'Kozhikode (Calicut), Kerala' },
  'thiruvananthapuram': { lat: 8.5241, lon: 76.9366, label: 'Thiruvananthapuram (Trivandrum), Kerala' },
  'trivandrum': { lat: 8.5241, lon: 76.9366, label: 'Thiruvananthapuram (Trivandrum), Kerala' },
  'kollam': { lat: 8.8932, lon: 76.6141, label: 'Kollam, Kerala' },
  'munnar': { lat: 10.0889, lon: 77.0595, label: 'Munnar, Idukki, Kerala' },
  'wayanad': { lat: 11.6854, lon: 76.1320, label: 'Wayanad, Kerala' },
  'palakkad': { lat: 10.7867, lon: 76.6548, label: 'Palakkad, Kerala' },
  'malappuram': { lat: 11.0510, lon: 76.0711, label: 'Malappuram, Kerala' },
  'kannur': { lat: 11.8745, lon: 75.3704, label: 'Kannur, Kerala' },
  'kasaragod': { lat: 12.4996, lon: 74.9869, label: 'Kasaragod, Kerala' },
  'pathanamthitta': { lat: 9.2648, lon: 76.7870, label: 'Pathanamthitta, Kerala' },
  'cherai': { lat: 10.1416, lon: 76.1783, label: 'Cherai Beach, Kerala' },
  'maradu': { lat: 9.9388, lon: 76.3339, label: 'Maradu, Kochi' },
  'kundannoor': { lat: 9.9442, lon: 76.3180, label: 'Kundannoor, Kochi' }
};

export async function geocodeLocation(query: string): Promise<Coords | null> {
  const clean = query.trim().toLowerCase();
  if (!clean) return null;

  if (geocodeCache.has(clean)) {
    return geocodeCache.get(clean)!;
  }

  const sortedPresets = Object.entries(KERALA_PRESETS).sort((a, b) => b[0].length - a[0].length);
  for (const [key, coords] of sortedPresets) {
    if (clean === key || clean.includes(key)) {
      geocodeCache.set(clean, coords);
      return coords;
    }
  }

  try {
    const searchParam = clean.includes('kerala') ? clean : `${clean}, Kerala, India`;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchParam)}&countrycodes=in&limit=1`,
      {
        headers: {
          'User-Agent': 'DriveC-Kerala-Road-Routing/1.0 (support@drivec.in)'
        },
        signal: AbortSignal.timeout(4000)
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const result: Coords = {
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          label: item.display_name
        };
        geocodeCache.set(clean, result);
        return result;
      }
    }
  } catch (err) {
    console.warn(`Nominatim geocoding error for "${query}":`, err);
  }

  return null;
}

export async function calculateRoadDistance(
  pickup: string,
  destination: string,
  pCoordsOverride?: Coords | null,
  dCoordsOverride?: Coords | null
): Promise<RouteResult> {
  const pCoords = pCoordsOverride || await geocodeLocation(pickup);
  const dCoords = dCoordsOverride || await geocodeLocation(destination);

  if (!pCoords || !dCoords) {
    // Fallback road estimate if geocoding fails
    return {
      distanceKm: 25.0,
      durationMinutes: 45,
      pickupCoords: pCoords || undefined,
      destCoords: dCoords || undefined,
      source: 'fallback_estimate'
    };
  }

  const routeKey = `${pCoords.lat.toFixed(4)},${pCoords.lon.toFixed(4)}->${dCoords.lat.toFixed(4)},${dCoords.lon.toFixed(4)}`;
  if (routeCache.has(routeKey)) {
    const cached = routeCache.get(routeKey)!;
    return {
      distanceKm: cached.distanceKm,
      durationMinutes: cached.durationMinutes,
      pickupCoords: pCoords,
      destCoords: dCoords,
      source: 'cached_osrm_road_route'
    };
  }

  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pCoords.lon},${pCoords.lat};${dCoords.lon},${dCoords.lat}?overview=false`;
    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(5000) });

    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      if (osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const distanceMeters = Number(route.distance) || 0;
        const durationSeconds = Number(route.duration) || 0;

        const distanceKm = Math.max(1, Math.round((distanceMeters / 1000) * 10) / 10);
        const durationMinutes = Math.max(5, Math.round(durationSeconds / 60));

        routeCache.set(routeKey, { distanceKm, durationMinutes });

        return {
          distanceKm,
          durationMinutes,
          pickupCoords: pCoords,
          destCoords: dCoords,
          source: 'osrm_road_network'
        };
      }
    }
  } catch (err) {
    console.warn('OSRM routing fetch failed:', err);
  }

  // Fallback haversine * 1.35 road factor
  const dLat = (dCoords.lat - pCoords.lat) * (Math.PI / 180);
  const dLon = (dCoords.lon - pCoords.lon) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pCoords.lat * (Math.PI / 180)) * Math.cos(dCoords.lat * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = 6371 * c;
  const roadKm = Math.max(2, Math.round(straightKm * 1.35 * 10) / 10);
  const durationMins = Math.max(10, Math.round((roadKm / 35) * 60));

  return {
    distanceKm: roadKm,
    durationMinutes: durationMins,
    pickupCoords: pCoords,
    destCoords: dCoords,
    source: 'road_curvature_projection'
  };
}
