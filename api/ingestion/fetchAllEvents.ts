import { isolate } from './fetchUtils';
import type { CrisisEvent } from './types';
import { fetchEarthquakes } from './fetchEarthquakes';
import { fetchEONET } from './fetchEONET';
import { fetchGDACS } from './fetchGDACS';
import { fetchOpenSky } from './fetchOpenSky';

export type FetchAllResult = {
  events: CrisisEvent[];
  errors: string[];
};

export async function fetchAllEvents(): Promise<FetchAllResult> {
  const results = await Promise.all([
    isolate('USGS', () => fetchEarthquakes()),
    isolate('EONET', () => fetchEONET()),
    isolate('GDACS', () => fetchGDACS()),
    isolate('OpenSky', () => fetchOpenSky())
  ]);

  const events: CrisisEvent[] = [];
  const errors: string[] = [];

  for (const r of results) {
    if (r.ok) events.push(...(r.value as CrisisEvent[]));
    else errors.push(r.error);
  }

  // Best-effort de-dupe by id
  const seen = new Set<string>();
  const deduped = events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  return { events: deduped, errors };
}
