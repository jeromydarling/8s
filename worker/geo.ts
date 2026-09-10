// [lng, lat] state centroids — the approximate-location fallback when a record
// has no exact coordinates (association-entered events, users without a home).
export const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [-86.79, 32.81], AK: [-152.4, 64.2], AZ: [-111.66, 34.17], AR: [-92.44, 34.75],
  CA: [-119.68, 36.12], CO: [-105.31, 39.06], CT: [-72.76, 41.6], DE: [-75.51, 39.32],
  FL: [-81.69, 27.77], GA: [-83.64, 33.04], HI: [-157.5, 21.09], ID: [-114.48, 44.24],
  IL: [-88.99, 40.35], IN: [-86.26, 39.85], IA: [-93.21, 42.01], KS: [-96.73, 38.53],
  KY: [-84.67, 37.67], LA: [-91.87, 31.17], ME: [-69.38, 44.69], MD: [-76.8, 39.06],
  MA: [-71.53, 42.23], MI: [-84.54, 43.33], MN: [-93.9, 45.69], MS: [-89.68, 32.74],
  MO: [-92.29, 38.46], MT: [-110.45, 46.92], NE: [-98.27, 41.13], NV: [-117.06, 38.31],
  NH: [-71.56, 43.45], NJ: [-74.52, 40.3], NM: [-106.25, 34.84], NY: [-74.95, 42.17],
  NC: [-79.81, 35.63], ND: [-99.78, 47.53], OH: [-82.76, 40.39], OK: [-96.93, 35.57],
  OR: [-122.07, 44.57], PA: [-77.21, 40.59], RI: [-71.51, 41.68], SC: [-80.95, 33.86],
  SD: [-99.44, 44.3], TN: [-86.69, 35.75], TX: [-97.56, 31.05], UT: [-111.86, 40.15],
  VT: [-72.71, 44.05], VA: [-78.17, 37.77], WA: [-121.49, 47.4], WV: [-80.95, 38.49],
  WI: [-89.62, 44.27], WY: [-107.3, 42.99],
};

export function stateCentroid(state: string | null | undefined): { lat: number; lng: number } | null {
  const c = STATE_CENTROIDS[String(state ?? "").toUpperCase()];
  return c ? { lng: c[0], lat: c[1] } : null;
}
