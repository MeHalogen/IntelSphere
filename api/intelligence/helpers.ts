/**
 * Intelligence helper utilities
 */

import type { CrisisLayer, CrisisEvent } from '../_lib/types';
import { ingest } from '../_lib/ingestion';
import { deduplicateEvents } from './deduplicateEvents';

const ALL_LAYERS: CrisisLayer[] = [
  'earthquakes',
  'wildfires',
  'floods',
  'storms',
  'conflicts',
  'airspace',
  'volcanoes'
];

/**
 * Ingest all available event layers with deduplication
 * Removes duplicate events from multiple sources (USGS, NASA, GDACS, etc.)
 */
export async function ingestAll(): Promise<CrisisEvent[]> {
  const rawEvents = await ingest(ALL_LAYERS);
  return deduplicateEvents(rawEvents, 100, 6);
}

/**
 * Ingest specific layers with deduplication
 */
export async function ingestLayers(layers: CrisisLayer[]): Promise<CrisisEvent[]> {
  const rawEvents = await ingest(layers);
  return deduplicateEvents(rawEvents, 100, 6);
}
