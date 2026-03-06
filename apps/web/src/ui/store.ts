import { create } from 'zustand';
import type { CrisisEvent, CrisisLayer } from '../core/types';

export type EventsState = {
  events: CrisisEvent[];
  eventsUpdatedAt: string | null;
  setEvents: (events: CrisisEvent[], updatedAt?: string | null) => void;
};

type UiState = {
  activeLayers: CrisisLayer[];
  toggleLayer: (layer: CrisisLayer) => void;
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
} & EventsState;

const defaultLayers: CrisisLayer[] = ['earthquakes', 'wildfires', 'storms', 'floods', 'airspace', 'volcanoes', 'conflicts'];

export const useUiStore = create<UiState>((set) => ({
  activeLayers: defaultLayers,
  toggleLayer: (layer: CrisisLayer) =>
    set((s: UiState) => ({
      activeLayers: s.activeLayers.includes(layer)
        ? s.activeLayers.filter((l: CrisisLayer) => l !== layer)
        : [...s.activeLayers, layer]
    })),
  selectedEventId: null,
  selectEvent: (id: string | null) => set({ selectedEventId: id }),

  events: [],
  eventsUpdatedAt: null,
  setEvents: (events: CrisisEvent[], updatedAt?: string | null) =>
    set({
      events,
      eventsUpdatedAt: typeof updatedAt === 'string' ? updatedAt : updatedAt ?? new Date().toISOString()
    })
}));
