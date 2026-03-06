// Single source of truth for event schema.
// Ingestion produces the same CrisisEvent shape that the API and frontend consume.
export type { CrisisEvent, CrisisLayer } from '../_lib/types';
